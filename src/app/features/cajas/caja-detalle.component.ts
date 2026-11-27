import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CajaService } from '../../core/services/caja.service';
import {
  CajaResumen,
  ConceptoCaja,
  ETIQUETA_ESTADO_GIRO,
  ETIQUETA_MOVIMIENTO,
  Giro,
  GiroResumen,
  HistorialCaja,
  MovimientoCaja,
  PasoPagoCaja,
  TipoMovimientoCaja
} from '../../core/models/caja.model';
import { PaginadorComponent } from '../../shared/paginador.component';
import {
  AccionGiro,
  GiroDetalleDialogComponent,
  NuevoGiroDialogComponent,
  ValorCajaDialogComponent,
  ValorDialogData,
  ValorDialogResultado
} from './caja-dialogos';

// Cajas menores (2026-11-27): saldo en tiempo real, giros pendientes, historial y (administrador) configuración.
@Component({
  selector: 'app-caja-detalle',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatTabsModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSlideToggleModule, MatTooltipModule, PaginadorComponent],
  templateUrl: './caja-detalle.component.html',
  styleUrls: ['./caja-detalle.component.scss', './caja-dialogos.scss']
})
export class CajaDetalleComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cajaId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  readonly estados = ETIQUETA_ESTADO_GIRO;
  readonly tipos = ETIQUETA_MOVIMIENTO;
  readonly tiposFiltro = Object.keys(ETIQUETA_MOVIMIENTO) as TipoMovimientoCaja[];
  readonly tamanoPagina = 50;

  readonly caja = signal<CajaResumen | null>(null);
  readonly error = signal<string | null>(null);
  readonly pendientes = signal<GiroResumen[]>([]);
  readonly todos = signal<GiroResumen[] | null>(null);
  readonly historial = signal<HistorialCaja | null>(null);
  readonly conceptos = signal<ConceptoCaja[]>([]);
  readonly pasos = signal<PasoPagoCaja[] | null>(null);
  readonly cargandoHistorial = signal(false);
  readonly pagina = signal(1);
  readonly esAdmin = computed(() => this.caja()?.esAdministrador ?? false);

  // Filtros del historial
  filtroTipo: TipoMovimientoCaja | '' = '';
  filtroTexto = '';
  filtroDesde = '';
  filtroHasta = '';

  // Configuración
  tope = 0;
  saldoMinimo = 0;
  nuevoConcepto = '';

  ngOnInit(): void {
    this.recargar();
    this.servicio.conceptos(this.cajaId).subscribe({ next: (c) => this.conceptos.set(c) });
  }

  /** Vuelve a leer saldo, pendientes y (si ya se abrieron) las otras pestañas. */
  recargar(): void {
    this.servicio.obtener(this.cajaId).subscribe({
      next: (c) => {
        this.caja.set(c);
        this.tope = c.tope;
        this.saldoMinimo = c.saldoMinimoAlerta;
        this.error.set(null);
      },
      error: (e: HttpErrorResponse) => this.error.set(e.error?.mensaje ?? 'No se pudo cargar la caja.')
    });
    this.servicio.giros(this.cajaId, true).subscribe({ next: (g) => this.pendientes.set(g) });
    if (this.todos() !== null) this.cargarTodos();
    if (this.historial() !== null) this.cargarHistorial();
  }

  cambioPestana(indice: number): void {
    if (indice === 1 && this.todos() === null) this.cargarTodos();
    if (indice === 2 && this.historial() === null) this.cargarHistorial();
    if (indice === 3 && this.pasos() === null && this.esAdmin()) {
      this.servicio.pasosPago(this.cajaId).subscribe({ next: (p) => this.pasos.set(p) });
    }
  }

  cargarTodos(): void {
    this.servicio.giros(this.cajaId, false).subscribe({ next: (g) => this.todos.set(g) });
  }

  cargarHistorial(pagina = this.pagina()): void {
    this.pagina.set(pagina);
    this.cargandoHistorial.set(true);
    this.servicio
      .historial(this.cajaId, {
        tipo: this.filtroTipo || null,
        texto: this.filtroTexto.trim() || null,
        // Días completos en hora de Colombia (UTC-5).
        desde: this.filtroDesde ? `${this.filtroDesde}T05:00:00Z` : null,
        hasta: this.filtroHasta ? this.diaSiguienteUtc(this.filtroHasta) : null,
        pagina,
        tamanoPagina: this.tamanoPagina
      })
      .subscribe({
        next: (h) => {
          this.historial.set(h);
          this.cargandoHistorial.set(false);
        },
        error: () => this.cargandoHistorial.set(false)
      });
  }

  limpiarFiltros(): void {
    this.filtroTipo = '';
    this.filtroTexto = '';
    this.filtroDesde = '';
    this.filtroHasta = '';
    this.cargarHistorial(1);
  }

  // ---------------- Acciones ----------------

  nuevoGiro(): void {
    const caja = this.caja();
    if (!caja) return;
    this.dialog
      .open(NuevoGiroDialogComponent, { data: { caja, conceptos: this.conceptos() }, width: '640px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((giro?: Giro) => {
        if (!giro) return;
        this.avisar(`Giro #${giro.numero} registrado.` + (giro.vueltaPendiente > 0 ? ` Vuelta pendiente: $${this.miles(giro.vueltaPendiente)}.` : ''));
        this.recargar();
        this.verGiro(giro.id);
      });
  }

  recargarCaja(): void {
    const caja = this.caja();
    if (!caja) return;
    this.pedir({
      titulo: 'Recargar la caja',
      descripcion: `Para llegar al tope faltan $${this.miles(caja.faltaParaTope)}.`,
      etiquetaValor: 'Valor que entra a la caja',
      valorInicial: caja.faltaParaTope || null,
      etiquetaNota: 'Nota (opcional)',
      textoBoton: 'Registrar recarga'
    }, (r) => this.servicio.recargar(this.cajaId, r.valor ?? 0, r.nota), 'Recarga registrada.');
  }

  arqueo(): void {
    const caja = this.caja();
    if (!caja) return;
    this.pedir({
      titulo: 'Arqueo de caja',
      descripcion: `Cuenta el efectivo físico. El sistema dice $${this.miles(caja.saldoActual)}; si no cuadra, se registra un ajuste por la diferencia.`,
      etiquetaValor: 'Efectivo contado',
      etiquetaNota: 'Motivo (obligatorio si hay diferencia)',
      textoBoton: 'Registrar arqueo'
    }, (r) => this.servicio.arqueo(this.cajaId, r.valor ?? 0, r.nota), null, (resultado) => {
      const d = (resultado as { diferencia: number }).diferencia;
      this.avisar(d === 0 ? 'La caja cuadra con el sistema.' : `Ajuste registrado por $${this.miles(d)}.`);
    });
  }

  anularMovimiento(m: MovimientoCaja): void {
    this.pedir({
      titulo: `Anular ${this.tipos[m.tipo].toLowerCase()} de $${this.miles(m.valor)}`,
      descripcion: 'El movimiento queda en el historial como anulado y el saldo se corrige.',
      etiquetaNota: 'Motivo de la anulación',
      notaObligatoria: true,
      textoBoton: 'Anular',
      peligro: true
    }, (r) => this.servicio.anularMovimiento(this.cajaId, m.id, r.nota ?? ''), 'Movimiento anulado.');
  }

  verGiro(giroId: number): void {
    this.dialog
      .open(GiroDetalleDialogComponent, { data: { cajaId: this.cajaId, giroId, esAdministrador: this.esAdmin() }, width: '640px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((accion?: AccionGiro) => {
        if (accion) this.accionGiro(giroId, accion);
      });
  }

  accionGiro(giroId: number, accion: AccionGiro): void {
    const giro = [...this.pendientes(), ...(this.todos() ?? [])].find((g) => g.id === giroId);
    switch (accion) {
      case 'legalizar':
        this.pedir({
          titulo: `Legalizar giro #${giro?.numero ?? ''}`,
          descripcion: giro ? `Se entregaron $${this.miles(giro.valorEntregado)} a ${giro.beneficiario}. Si gastó menos, queda vuelta pendiente; si gastó más, se le reintegra la diferencia.` : undefined,
          etiquetaValor: 'Valor gastado',
          valorInicial: giro?.valorEntregado ?? null,
          etiquetaNota: 'Nota (en qué se gastó)',
          textoBoton: 'Legalizar',
          permiteArchivo: true
        }, (r) => this.servicio.legalizar(this.cajaId, giroId, r.valor ?? 0, r.nota), 'Giro legalizado.', undefined, (r) => r.archivo ? giroId : null);
        break;
      case 'vuelta':
        this.pedir({
          titulo: `Recibir vuelta del giro #${giro?.numero ?? ''}`,
          descripcion: giro ? `${giro.beneficiario} debe $${this.miles(giro.vueltaPendiente)}.` : undefined,
          etiquetaValor: 'Valor recibido',
          valorInicial: giro?.vueltaPendiente ?? null,
          etiquetaNota: 'Nota (opcional)',
          textoBoton: 'Registrar vuelta'
        }, (r) => this.servicio.recibirVuelta(this.cajaId, giroId, r.valor ?? 0, r.nota), 'Vuelta registrada.');
        break;
      case 'anular':
        this.pedir({
          titulo: `Anular giro #${giro?.numero ?? ''}`,
          descripcion: 'El efectivo vuelve a la caja y el giro queda anulado en el historial.',
          etiquetaNota: 'Motivo de la anulación',
          notaObligatoria: true,
          textoBoton: 'Anular giro',
          peligro: true
        }, (r) => this.servicio.anularGiro(this.cajaId, giroId, r.nota ?? ''), 'Giro anulado.');
        break;
      case 'soporte':
        this.pedir({
          titulo: `Soporte del giro #${giro?.numero ?? ''}`,
          descripcion: 'Foto o PDF de la factura o recibo. Si ya tenía uno, se reemplaza.',
          textoBoton: 'Subir',
          permiteArchivo: true,
          archivoObligatorio: true
        }, null, null, undefined, () => giroId);
        break;
    }
  }

  // ---------------- Configuración ----------------

  guardarConfiguracion(): void {
    this.servicio.actualizar(this.cajaId, this.tope, this.saldoMinimo).subscribe({
      next: (c) => {
        this.caja.set(c);
        this.avisar('Configuración guardada.');
      },
      error: (e: HttpErrorResponse) => this.avisar(e.error?.mensaje ?? 'No se pudo guardar.')
    });
  }

  crearConcepto(): void {
    const nombre = this.nuevoConcepto.trim();
    if (!nombre) return;
    this.servicio.crearConcepto(this.cajaId, nombre).subscribe({
      next: (c) => {
        this.conceptos.set([...this.conceptos(), c].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.nuevoConcepto = '';
      },
      error: (e: HttpErrorResponse) => this.avisar(e.error?.mensaje ?? 'No se pudo crear el concepto.')
    });
  }

  alternarConcepto(concepto: ConceptoCaja): void {
    this.servicio.actualizarConcepto(this.cajaId, { ...concepto, activo: !concepto.activo }).subscribe({
      next: (c) => this.conceptos.set(this.conceptos().map((x) => (x.id === c.id ? c : x))),
      error: (e: HttpErrorResponse) => this.avisar(e.error?.mensaje ?? 'No se pudo actualizar el concepto.')
    });
  }

  marcarPaso(paso: PasoPagoCaja, requiere: boolean): void {
    this.servicio.marcarPasoPago(this.cajaId, paso.pasoId, requiere).subscribe({
      next: (p) => this.pasos.set((this.pasos() ?? []).map((x) => (x.pasoId === p.pasoId ? p : x))),
      error: (e: HttpErrorResponse) => this.avisar(e.error?.mensaje ?? 'No se pudo marcar el paso.')
    });
  }

  // ---------------- Apoyo ----------------

  /**
   * Abre el diálogo de valor/motivo y, si se acepta, ejecuta la acción. Si el diálogo trae un archivo
   * y <paramref name="giroConSoporte"/> devuelve un giro, sube el soporte después.
   */
  private pedir(
    data: ValorDialogData,
    accion: ((r: ValorDialogResultado) => Observable<unknown>) | null,
    exito: string | null,
    alTerminar?: (resultado: unknown) => void,
    giroConSoporte?: (r: ValorDialogResultado) => number | null
  ): void {
    this.dialog
      .open(ValorCajaDialogComponent, { data, width: '480px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((r?: ValorDialogResultado) => {
        if (!r) return;
        const subirSoporte = () => {
          const giroId = giroConSoporte?.(r);
          if (giroId && r.archivo) {
            this.servicio.subirSoporte(this.cajaId, giroId, r.archivo).subscribe({
              next: () => this.avisar('Soporte guardado.'),
              error: (e: HttpErrorResponse) => this.avisar(e.error?.mensaje ?? 'No se pudo subir el soporte.')
            });
          }
        };
        if (!accion) {
          subirSoporte();
          return;
        }
        accion(r).subscribe({
          next: (resultado) => {
            if (exito) this.avisar(exito);
            alTerminar?.(resultado);
            subirSoporte();
            this.recargar();
          },
          error: (e: HttpErrorResponse) => this.avisar(e.error?.mensaje ?? 'No se pudo completar la acción.')
        });
      });
  }

  private avisar(texto: string): void {
    this.snackBar.open(texto, 'Cerrar', { duration: 5000 });
  }

  miles(valor: number): string {
    return Math.round(valor).toLocaleString('es-CO');
  }

  private diaSiguienteUtc(dia: string): string {
    const fecha = new Date(`${dia}T05:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    return fecha.toISOString();
  }
}
