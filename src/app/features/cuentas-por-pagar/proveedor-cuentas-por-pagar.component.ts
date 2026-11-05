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
import { DetalleProveedorCuentaPorPagar, EstadoPartida, PartidaCuentaPorPagar } from '../../core/models/cuentas-por-pagar.model';
import { haceCuanto, textoVencimiento } from './cuentas-por-pagar.util';

/**
 * Facturas pendientes de un proveedor — Gerencia Comercial marca cuáles se pagan y las manda a pago:
 * se crea un documento "Pago a Proveedor" que sigue el flujo normal (Contabilidad genera el CEJ,
 * Gerencia General paga). La confirmación es un paso dentro de la misma pantalla (resumen + aviso si
 * el proveedor tiene anticipos o pagos sin aplicar), no un diálogo aparte.
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

  readonly todasSeleccionadas = computed(
    () => this.disponibles().length > 0 && this.partidasSeleccionadas().length === this.disponibles().length
  );

  // Lo que el proveedor ya tiene a favor de Jimaco: anticipos sin cruzar + pagos/notas sin aplicar.
  readonly aFavor = computed(() => {
    const p = this.detalle()?.proveedor;
    return p ? p.anticipos + p.saldoAFavor : 0;
  });

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
        observaciones: this.observaciones.trim() || null
      })
      .subscribe({
        next: (id) => {
          this.snackBar.open('Pago enviado a Contabilidad', 'Cerrar', { duration: 4000 });
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

  numeroDocumento(p: PartidaCuentaPorPagar): string {
    return [p.prefijo, p.numeroDocumento].filter(Boolean).join(' ') || '—';
  }
}
