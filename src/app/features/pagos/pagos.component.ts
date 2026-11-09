import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PagosService } from '../../core/services/pagos.service';
import { CuentasPorPagarService } from '../../core/services/cuentas-por-pagar.service';
import { CuentaBanco, LoteOrden, LotePago, OrdenPagoPendiente } from '../../core/models/cuentas-por-pagar.model';

/** "yyyy-MM-dd" de hoy en Colombia (UTC−5, sin horario de verano) — mismo "hoy" que valida el backend. */
function hoyColombia(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

interface GrupoOrdenes {
  clave: string;
  titulo: string;
  subtitulo: string | null;
  observaciones: string | null;
  ordenes: OrdenPagoPendiente[];
}

/**
 * Menú "Pagos" (2026-11-09, pedido real) — el pagador (Gerencia General) ve lo que le mandaron
 * (relaciones de Gerencia Comercial y pagos extraordinarios), elige qué paga como un LOTE (mismo
 * banco, misma fecha y UN solo soporte PDF para todo — por dentro el sistema crea un comprobante de
 * egreso por tercero en World Office) y rechaza lo que no. Lo que no elige queda pendiente.
 */
@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.scss'
})
export class PagosComponent implements OnInit {
  private readonly pagos = inject(PagosService);
  private readonly cuentasPorPagar = inject(CuentasPorPagarService);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('inputArchivo') private inputRef?: ElementRef<HTMLInputElement>;

  readonly hoy = hoyColombia();
  readonly pendientes = signal<OrdenPagoPendiente[] | null>(null);
  readonly lotes = signal<LotePago[] | null>(null);
  readonly pestana = signal(0);
  readonly seleccion = signal<ReadonlySet<number>>(new Set());
  readonly expandidas = signal<ReadonlySet<number>>(new Set());

  // Rechazo en la misma tarjeta (sin diálogo): qué orden y el motivo.
  readonly rechazando = signal<number | null>(null);
  motivoRechazo = '';

  // Paso de pago del lote (en la misma página).
  readonly pagando = signal(false);
  readonly enviando = signal(false);
  readonly bancos = signal<CuentaBanco[]>([]);
  readonly archivo = signal<File | null>(null);
  idBanco: number | null = null;
  fecha = this.hoy;

  readonly grupos = computed<GrupoOrdenes[]>(() => {
    const lista = this.pendientes() ?? [];
    const grupos = new Map<string, GrupoOrdenes>();
    for (const o of lista) {
      const clave = o.esExtraordinario ? 'extra' : o.numeroRelacion !== null ? `rel-${o.numeroRelacion}` : 'sueltas';
      if (!grupos.has(clave)) {
        grupos.set(clave, {
          clave,
          titulo: o.esExtraordinario ? 'Pagos extraordinarios' : o.numeroRelacion !== null ? `Relación de pagos ${o.numeroRelacion}` : 'Órdenes de pago',
          subtitulo: o.esExtraordinario ? null : [o.creadoPor, o.fechaCreacion ? new Date(o.fechaCreacion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : null].filter(Boolean).join(' · ') || null,
          observaciones: o.esExtraordinario ? null : o.observaciones,
          ordenes: []
        });
      }
      grupos.get(clave)!.ordenes.push(o);
    }
    // Relaciones primero (de la más vieja a la más nueva), extraordinarios al final.
    return [...grupos.values()].sort((a, b) => (a.clave === 'extra' ? 1 : b.clave === 'extra' ? -1 : a.clave.localeCompare(b.clave, undefined, { numeric: true })));
  });

  readonly seleccionadas = computed(() => (this.pendientes() ?? []).filter((o) => this.seleccion().has(o.instanciaDocumentoId)));
  readonly totalSeleccionado = computed(() => this.seleccionadas().reduce((s, o) => s + o.neto, 0));
  readonly totalPendiente = computed(() => (this.pendientes() ?? []).reduce((s, o) => s + o.neto, 0));

  ngOnInit(): void {
    this.cargar();
    this.cuentasPorPagar.bancos().subscribe((b) => {
      this.bancos.set(b);
      this.idBanco = b.find((x) => x.porDefecto)?.idCuentaContableWO ?? b[0]?.idCuentaContableWO ?? null;
    });
  }

  cargar(): void {
    this.pagos.pendientes().subscribe({
      next: (p) => {
        this.pendientes.set(p);
        const vigentes = new Set(p.map((o) => o.instanciaDocumentoId));
        this.seleccion.set(new Set([...this.seleccion()].filter((id) => vigentes.has(id))));
      },
      error: (e: { error?: { mensaje?: string } }) => this.avisar(e.error?.mensaje ?? 'No se pudieron cargar los pagos pendientes.')
    });
    this.pagos.lotes().subscribe({ next: (l) => this.lotes.set(l) });
  }

  estaSeleccionada(o: OrdenPagoPendiente): boolean {
    return this.seleccion().has(o.instanciaDocumentoId);
  }

  alternar(o: OrdenPagoPendiente): void {
    const nuevo = new Set(this.seleccion());
    if (nuevo.has(o.instanciaDocumentoId)) nuevo.delete(o.instanciaDocumentoId);
    else nuevo.add(o.instanciaDocumentoId);
    this.seleccion.set(nuevo);
  }

  grupoCompleto(g: GrupoOrdenes): boolean {
    return g.ordenes.every((o) => this.seleccion().has(o.instanciaDocumentoId));
  }

  grupoParcial(g: GrupoOrdenes): boolean {
    return !this.grupoCompleto(g) && g.ordenes.some((o) => this.seleccion().has(o.instanciaDocumentoId));
  }

  alternarGrupo(g: GrupoOrdenes): void {
    const nuevo = new Set(this.seleccion());
    const marcar = !this.grupoCompleto(g);
    for (const o of g.ordenes) {
      if (marcar) nuevo.add(o.instanciaDocumentoId);
      else nuevo.delete(o.instanciaDocumentoId);
    }
    this.seleccion.set(nuevo);
  }

  totalGrupo(g: GrupoOrdenes): number {
    return g.ordenes.reduce((s, o) => s + o.neto, 0);
  }

  expandida(o: OrdenPagoPendiente): boolean {
    return this.expandidas().has(o.instanciaDocumentoId);
  }

  alternarDetalle(o: OrdenPagoPendiente): void {
    const nuevo = new Set(this.expandidas());
    if (nuevo.has(o.instanciaDocumentoId)) nuevo.delete(o.instanciaDocumentoId);
    else nuevo.add(o.instanciaDocumentoId);
    this.expandidas.set(nuevo);
  }

  // ---- Rechazo ----

  pedirRechazo(o: OrdenPagoPendiente): void {
    this.rechazando.set(o.instanciaDocumentoId);
    this.motivoRechazo = '';
  }

  confirmarRechazo(o: OrdenPagoPendiente): void {
    const motivo = this.motivoRechazo.trim();
    if (!motivo) return;
    this.enviando.set(true);
    this.pagos.rechazar(o.instanciaDocumentoId, motivo).subscribe({
      next: () => {
        this.enviando.set(false);
        this.rechazando.set(null);
        this.avisar(`Rechazado: ${o.tercero}. Las facturas vuelven a quedar disponibles para Gerencia Comercial.`);
        this.cargar();
      },
      error: (e: { error?: { mensaje?: string } }) => {
        this.enviando.set(false);
        this.avisar(e.error?.mensaje ?? 'No se pudo rechazar.');
      }
    });
  }

  // ---- Pago del lote ----

  empezarPago(): void {
    if (!this.seleccionadas().length) return;
    this.pagando.set(true);
    this.rechazando.set(null);
  }

  listoParaPagar(): boolean {
    if (!this.fecha || this.fecha > this.hoy || !this.seleccionadas().length) return false;
    return this.totalSeleccionado() <= 0 || (this.idBanco !== null && this.archivo() !== null);
  }

  elegirArchivo(): void {
    this.inputRef?.nativeElement.click();
  }

  onArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
      this.avisar('El soporte tiene que ser un PDF.');
      input.value = '';
      return;
    }
    this.archivo.set(archivo);
  }

  confirmarPago(): void {
    if (!this.listoParaPagar() || this.enviando()) return;
    const conPlata = this.totalSeleccionado() > 0;
    this.enviando.set(true);
    this.pagos
      .pagarLote(
        this.seleccionadas().map((o) => o.instanciaDocumentoId),
        conPlata ? this.idBanco : null,
        this.fecha,
        conPlata ? this.archivo() : null
      )
      .subscribe({
        next: (lote) => {
          this.enviando.set(false);
          this.pagando.set(false);
          this.archivo.set(null);
          this.seleccion.set(new Set());
          this.avisar(`Lote ${lote.numero} registrado: el sistema crea los comprobantes de egreso en World Office en la próxima sincronización.`);
          this.cargar();
          this.pestana.set(1);
        },
        error: (e: { error?: { mensaje?: string } }) => {
          this.enviando.set(false);
          this.avisar(e.error?.mensaje ?? 'No se pudo registrar el pago.');
          this.cargar();
        }
      });
  }

  // ---- Lotes pagados ----

  verSoporte(lote: LotePago): void {
    this.pagos.soporte(lote.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.avisar('No se pudo abrir el soporte.')
    });
  }

  estadoCE(o: LoteOrden): 'creado' | 'pendiente' | 'conflicto' {
    if (o.conflictoCreacionCE) return 'conflicto';
    return o.numeroCE !== null ? 'creado' : 'pendiente';
  }

  private avisar(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: 7000 });
  }
}
