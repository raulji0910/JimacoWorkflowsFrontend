import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CuentasPorPagarService } from '../../core/services/cuentas-por-pagar.service';
import { AnticipoPartida, DetalleProveedorCuentaPorPagar, EstadoPartida, PartidaCuentaPorPagar } from '../../core/models/cuentas-por-pagar.model';
import { haceCuanto, textoVencimiento } from './cuentas-por-pagar.util';

/**
 * Facturas pendientes de un proveedor — Gerencia Comercial marca cuáles se pagan (y qué anticipos se
 * descuentan) y las manda a pago: se crea una orden de pago ("Pago a Proveedor") que le llega a
 * Gerencia General; cuando confirma que pagó, el sistema crea el comprobante de egreso en World
 * Office (desde 2026-11-06, sin paso de Contabilidad). La confirmación es un paso dentro de la misma
 * pantalla, no un diálogo aparte.
 */
@Component({
  selector: 'app-proveedor-cuentas-por-pagar',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule
  ],
  templateUrl: './proveedor-cuentas-por-pagar.component.html',
  styleUrl: './proveedor-cuentas-por-pagar.component.scss'
})
export class ProveedorCuentasPorPagarComponent implements OnInit {
  private readonly servicio = inject(CuentasPorPagarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = ['seleccion', 'documento', 'facturaProveedor', 'fecha', 'vencimiento', 'saldo', 'estado'];
  readonly identificacion = this.route.snapshot.paramMap.get('identificacion') ?? '';
  readonly detalle = signal<DetalleProveedorCuentaPorPagar | null>(null);
  readonly error = signal<string | null>(null);
  readonly seleccionadas = signal<ReadonlySet<number>>(new Set());
  readonly confirmando = signal(false);
  readonly enviando = signal(false);
  observaciones = '';

  readonly haceCuanto = haceCuanto;
  readonly textoVencimiento = textoVencimiento;

  readonly disponibles = computed(() =>
    (this.detalle()?.partidas ?? []).filter((p) => this.estado(p) === 'Disponible' && p.idDocumentoDetalleWO !== null)
  );

  readonly partidasSeleccionadas = computed(() =>
    this.disponibles().filter((p) => this.seleccionadas().has(p.idDocumentoDetalleWO!))
  );

  readonly totalSeleccionado = computed(() => this.partidasSeleccionadas().reduce((suma, p) => suma + p.pendiente, 0));

  // Anticipos: vienen TODOS marcados por defecto (así lo cruza hoy Contabilidad) — se guarda lo que
  // el gerente DESMARCA, para que una recarga de la foto no vuelva a marcar lo que él quitó.
  readonly anticiposDesmarcados = signal<ReadonlySet<number>>(new Set());

  readonly anticiposDisponibles = computed(() =>
    (this.detalle()?.anticipos ?? []).filter((a) => a.estado === 'Disponible' && a.idDocumentoDetalleWO !== null && a.saldo > 0)
  );

  /**
   * Mismo reparto que el backend (CuentasPorPagarService.AplicarAnticiposAsync): del más viejo al
   * más nuevo, hasta cubrir las facturas marcadas; el último puede quedar aplicado en parte, y los
   * que ya no alcanzan no se mandan.
   */
  readonly anticiposAplicados = computed(() => {
    let restante = this.totalSeleccionado();
    const aplicados = new Map<number, number>();
    const marcados = this.anticiposDisponibles()
      .filter((a) => !this.anticiposDesmarcados().has(a.idDocumentoDetalleWO!))
      .sort((x, y) => (x.fecha ?? '').localeCompare(y.fecha ?? '') || x.idDocumentoDetalleWO! - y.idDocumentoDetalleWO!);
    for (const a of marcados) {
      if (restante <= 0) break;
      const valor = Math.min(a.saldo, restante);
      aplicados.set(a.idDocumentoDetalleWO!, valor);
      restante -= valor;
    }
    return aplicados;
  });

  readonly totalAnticiposAplicados = computed(() => [...this.anticiposAplicados().values()].reduce((s, v) => s + v, 0));

  readonly netoAPagar = computed(() => this.totalSeleccionado() - this.totalAnticiposAplicados());

  readonly todasSeleccionadas = computed(
    () => this.disponibles().length > 0 && this.partidasSeleccionadas().length === this.disponibles().length
  );

  // Pagos o notas crédito sin aplicar dentro de las cuentas por pagar: esos NO se descuentan solos
  // (los anticipos sí, ver anticiposAplicados) — por eso siguen mereciendo un aviso.
  readonly aFavor = computed(() => this.detalle()?.proveedor.saldoAFavor ?? 0);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.error.set(null);
    this.servicio.proveedor(this.identificacion).subscribe({
      next: (d) => {
        this.detalle.set(d);
        // Si la foto cambió, se descartan las marcas de facturas que ya no se pueden pagar.
        const vigentes = new Set(this.disponibles().map((p) => p.idDocumentoDetalleWO!));
        this.seleccionadas.set(new Set([...this.seleccionadas()].filter((id) => vigentes.has(id))));
      },
      error: (e: { error?: { mensaje?: string } }) =>
        this.error.set(e.error?.mensaje ?? 'No se pudo cargar el proveedor.')
    });
  }

  estado(p: PartidaCuentaPorPagar): EstadoPartida {
    return p.estado;
  }

  estaSeleccionada(p: PartidaCuentaPorPagar): boolean {
    return p.idDocumentoDetalleWO !== null && this.seleccionadas().has(p.idDocumentoDetalleWO);
  }

  alternar(p: PartidaCuentaPorPagar): void {
    if (p.idDocumentoDetalleWO === null || this.estado(p) !== 'Disponible') return;
    const nuevo = new Set(this.seleccionadas());
    if (nuevo.has(p.idDocumentoDetalleWO)) nuevo.delete(p.idDocumentoDetalleWO);
    else nuevo.add(p.idDocumentoDetalleWO);
    this.seleccionadas.set(nuevo);
    this.confirmando.set(false);
  }

  alternarTodas(): void {
    this.seleccionadas.set(
      this.todasSeleccionadas() ? new Set() : new Set(this.disponibles().map((p) => p.idDocumentoDetalleWO!))
    );
    this.confirmando.set(false);
  }

  seleccionarVencidas(): void {
    this.seleccionadas.set(
      new Set(this.disponibles().filter((p) => (p.diasVencido ?? 0) > 0).map((p) => p.idDocumentoDetalleWO!))
    );
    this.confirmando.set(false);
  }

  limpiar(): void {
    this.seleccionadas.set(new Set());
    this.confirmando.set(false);
  }

  pedirConfirmacion(): void {
    if (this.partidasSeleccionadas().length > 0) this.confirmando.set(true);
  }

  enviarAPago(): void {
    const partidas = this.partidasSeleccionadas();
    if (partidas.length === 0 || this.enviando()) return;

    this.enviando.set(true);
    this.servicio
      .crearPago({
        identificacion: this.identificacion,
        idsDocumentoDetalleWO: partidas.map((p) => p.idDocumentoDetalleWO!),
        observaciones: this.observaciones.trim() || null,
        idsAnticiposWO: [...this.anticiposAplicados().keys()]
      })
      .subscribe({
        next: (id) => {
          this.snackBar.open('Orden de pago enviada a Gerencia General', 'Cerrar', { duration: 4000 });
          this.router.navigate(['/documentos', id]);
        },
        error: (e: { error?: { mensaje?: string } }) => {
          this.enviando.set(false);
          this.confirmando.set(false);
          this.snackBar.open(e.error?.mensaje ?? 'No se pudo crear el pago.', 'Cerrar', { duration: 8000 });
          this.cargar();
        }
      });
  }

  anticipoMarcado(a: AnticipoPartida): boolean {
    return a.idDocumentoDetalleWO !== null && a.estado === 'Disponible' && !this.anticiposDesmarcados().has(a.idDocumentoDetalleWO);
  }

  alternarAnticipo(a: AnticipoPartida): void {
    if (a.idDocumentoDetalleWO === null || a.estado !== 'Disponible') return;
    const nuevo = new Set(this.anticiposDesmarcados());
    if (nuevo.has(a.idDocumentoDetalleWO)) nuevo.delete(a.idDocumentoDetalleWO);
    else nuevo.add(a.idDocumentoDetalleWO);
    this.anticiposDesmarcados.set(nuevo);
    this.confirmando.set(false);
  }

  aplicadoDe(a: AnticipoPartida): number {
    return a.idDocumentoDetalleWO === null ? 0 : (this.anticiposAplicados().get(a.idDocumentoDetalleWO) ?? 0);
  }

  numeroAnticipo(a: AnticipoPartida): string {
    return [a.prefijo, a.numeroDocumento].filter(Boolean).join(' ') || '—';
  }

  numeroDocumento(p: PartidaCuentaPorPagar): string {
    return [p.prefijo, p.numeroDocumento].filter(Boolean).join(' ') || '—';
  }
}
