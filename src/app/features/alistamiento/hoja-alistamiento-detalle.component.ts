import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HojaAlistamientoService } from '../../core/services/hoja-alistamiento.service';
import { HojaAlistamientoDetalle, RenglonHojaAlistamiento } from '../../core/models/hoja-alistamiento.model';
import { AuthService } from '../../core/services/auth.service';
import { DespachosRemisionDialogComponent } from './despachos-remision-dialog.component';
import { ConCambiosSinGuardar } from '../../core/guards/cambios-sin-guardar.guard';

/**
 * La Hoja de Alistamiento como pantalla propia (2026-09-28) — a diferencia de la sección dentro del
 * detalle de la OC, acá Transporte entra directo a lo que le importa (los ítems a reunir), sin el
 * resto de la OC (renglones con precios, historial de aprobación, comprobante de egreso, etc.).
 * Cada renglón se guarda por separado (check por línea) — pedido explícito del usuario: en la
 * bodega la conexión no siempre es estable, y guardar todo junto arriesga mandar un valor a medio
 * escribir de otra línea que el operario ni tocó todavía.
 */
@Component({
  selector: 'app-hoja-alistamiento-detalle',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './hoja-alistamiento-detalle.component.html',
  styleUrl: './hoja-alistamiento-detalle.component.scss'
})
export class HojaAlistamientoDetalleComponent implements OnInit, ConCambiosSinGuardar {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hojaService = inject(HojaAlistamientoService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly hoja = signal<HojaAlistamientoDetalle | null>(null);
  readonly cargando = signal(false);
  readonly guardandoRenglonId = signal<number | null>(null);
  readonly columnas = ['codigo', 'descripcion', 'cantidad', 'cantidadDisponible', 'remisionado'];
  readonly puedeGestionar = this.authService.puedeGestionarAlistamiento();
  // Filtro predeterminado (2026-10-15, pedido explícito del usuario): al entrar, Transporte ve
  // solo lo que le falta reunir, no toda la lista completa de nuevo.
  readonly soloIncompletos = signal(true);

  // Última cantidad disponible REALMENTE guardada por renglón (snapshot al cargar) — separada de
  // `r.cantidadDisponible`, que el input edita en vivo con cada tecla (ngModel). Bug real
  // encontrado (2026-10-15): el color/filtro de completo-incompleto evaluaba el valor en vivo, así
  // que escribir un número (sin todavía apretar "Guardar") ya pintaba la fila en verde o la sacaba
  // del filtro — el color ahora solo refleja lo que el backend confirmó, nunca lo que se está
  // tipeando.
  readonly guardadoPorId = signal<Record<number, number>>({});

  cantidadGuardada(r: RenglonHojaAlistamiento): number {
    return this.guardadoPorId()[r.id] ?? r.cantidadDisponible;
  }

  // Bug real reportado por Logística (2026-11-09, Hoja 16100 — "marco la cantidad y vuelve a 0"):
  // en el registro del servidor no había NINGÚN guardado de esa Hoja. Lo escrito solo se guarda con
  // el check de la línea; Enter no hacía nada, y salir de la página (o guardar OTRA línea, que
  // recargaba la Hoja entera) descartaba sin aviso lo escrito y no guardado. Ahora: Enter guarda,
  // la línea con un número sin guardar se marca, guardar una línea conserva lo tecleado en las
  // demás, y salir con cambios pendientes pide confirmación.
  sinGuardar(r: RenglonHojaAlistamiento): boolean {
    return Number(r.cantidadDisponible ?? 0) !== this.cantidadGuardada(r);
  }

  // Incluye el guardado en curso: si el navegador se cierra o recarga en ese momento, la petición
  // se corta (el backend ya no la cancela, pero puede no haber alcanzado a salir).
  hayCambiosSinGuardar(): boolean {
    if (this.guardandoRenglonId() !== null) return true;
    return this.hoja()?.renglones.some((r) => this.sinGuardar(r)) ?? false;
  }

  @HostListener('window:beforeunload', ['$event'])
  avisarAntesDeCerrar(evento: BeforeUnloadEvent): void {
    if (this.hayCambiosSinGuardar()) evento.preventDefault();
  }

  estaIncompleto(r: RenglonHojaAlistamiento): boolean {
    return this.cantidadGuardada(r) < r.cantidad;
  }

  // Tercer estado (2026-10-21, pedido explícito del usuario): antes "incompleto" era un solo color
  // (rojo) sin importar si ya se había avanzado algo — ahora se distingue "sin empezar" (rojo,
  // titilante, nada guardado todavía) de "parcial" (amarillo, fijo, ya hay al menos 1 unidad
  // guardada pero no toda la cantidad pedida). El filtro de "solo incompletos" no cambia — sigue
  // ocultando únicamente los completos (ver renglonesFiltrados), rojo y amarillo siguen visibles ahí.
  estadoRenglon(r: RenglonHojaAlistamiento): 'sinIniciar' | 'parcial' | 'completo' {
    const guardada = this.cantidadGuardada(r);
    if (guardada <= 0) return 'sinIniciar';
    if (guardada < r.cantidad) return 'parcial';
    return 'completo';
  }

  // Remisionado por renglón (2026-10-26) — independiente del estado de Disponible (uno lo marca
  // Transporte a mano, el otro lo detecta World Office solo). El caso simple (una sola Remisión) se
  // muestra directo en la tabla; el modal (abrirDespachos) solo hace falta cuando hay más de una
  // Remisión parcial — pedido explícito del usuario, para no obligar a un clic extra en el caso común.
  estadoRemision(r: RenglonHojaAlistamiento): 'ninguno' | 'parcial' | 'completo' {
    if (r.cantidadRemisionada <= 0) return 'ninguno';
    if (r.cantidadRemisionada < r.cantidad) return 'parcial';
    return 'completo';
  }

  abrirDespachos(r: RenglonHojaAlistamiento): void {
    this.dialog.open(DespachosRemisionDialogComponent, {
      data: { descripcion: r.descripcion, cantidadPedida: r.cantidad, unidadMedida: r.unidadMedida, despachos: r.despachosRemision },
      width: '380px',
      maxWidth: '95vw'
    });
  }

  get renglonesFiltrados(): RenglonHojaAlistamiento[] {
    const h = this.hoja();
    if (!h) return [];
    return this.soloIncompletos() ? h.renglones.filter((r) => this.estaIncompleto(r)) : h.renglones;
  }

  alternarFiltro(): void {
    this.soloIncompletos.set(!this.soloIncompletos());
  }

  get id(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.hojaService.obtener(this.id).subscribe({
      next: (hoja) => {
        // Lo tecleado y todavía no guardado en OTRAS líneas sobrevive a la recarga (ver sinGuardar).
        const pendientes = new Map<number, number>();
        for (const r of this.hoja()?.renglones ?? []) {
          if (this.sinGuardar(r)) pendientes.set(r.id, r.cantidadDisponible);
        }
        const mapa: Record<number, number> = {};
        for (const r of hoja.renglones) {
          mapa[r.id] = r.cantidadDisponible;
          if (pendientes.has(r.id)) r.cantidadDisponible = pendientes.get(r.id)!;
        }
        this.guardadoPorId.set(mapa);
        this.hoja.set(hoja);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('No se pudo cargar la Hoja de Alistamiento.', 'Cerrar', { duration: 4000 });
        this.router.navigate(['/alistamiento']);
      }
    });
  }

  // El input ya trae [max], pero eso no bloquea escribir un número mayor a mano en todos los
  // navegadores — se recorta acá también, y el backend lo vuelve a validar por las dudas.
  corregirCantidad(renglon: RenglonHojaAlistamiento): void {
    if (renglon.cantidadDisponible < 0) renglon.cantidadDisponible = 0;
    if (renglon.cantidadDisponible > renglon.cantidad) renglon.cantidadDisponible = renglon.cantidad;
  }

  guardarRenglon(renglon: RenglonHojaAlistamiento): void {
    const h = this.hoja();
    if (!h || this.guardandoRenglonId() === renglon.id) return;

    if (renglon.cantidadDisponible == null) renglon.cantidadDisponible = 0;
    this.corregirCantidad(renglon);
    this.guardandoRenglonId.set(renglon.id);
    const dto = { renglones: [{ renglonId: renglon.id, cantidadDisponible: renglon.cantidadDisponible }] };
    this.hojaService.actualizarCantidades(h.id, dto).subscribe({
      next: () => {
        this.guardandoRenglonId.set(null);
        this.snackBar.open(`${renglon.descripcion} guardado`, 'Cerrar', { duration: 2000 });
        // Ya quedó guardado: se marca como tal antes de recargar, para que la recarga no lo trate
        // como "pendiente" y pise el valor confirmado por el servidor.
        this.guardadoPorId.update((m) => ({ ...m, [renglon.id]: renglon.cantidadDisponible }));
        this.cargar();
      },
      error: (error) => {
        this.guardandoRenglonId.set(null);
        const mensaje = error?.error?.mensaje ?? 'No se pudo guardar.';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
      }
    });
  }
}
