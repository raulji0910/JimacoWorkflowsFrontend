import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CuentasPorPagarService } from '../../core/services/cuentas-por-pagar.service';
import { ProveedorCuentaPorPagar, RelacionBorrador, ResumenCuentasPorPagar } from '../../core/models/cuentas-por-pagar.model';
import { PagoExtraordinarioDialogComponent } from './pago-extraordinario-dialog.component';
import { haceCuanto } from './cuentas-por-pagar.util';

const CLAVE_PAGE_SIZE = 'aprobaciones.cxp.pageSize';

type Orden = 'neto' | 'vencido' | 'dias' | 'nombre';

/**
 * Cuentas por Pagar (2026-11-05) — Gerencia Comercial ve lo que se les debe a los proveedores según
 * World Office (foto que trae el Sincronizador cada pocos minutos) y entra a cada proveedor para
 * decidir qué facturas se pagan. El neto descuenta pagos sin aplicar y anticipos sin cruzar: es lo
 * que realmente se le debe.
 */
@Component({
  selector: 'app-cuentas-por-pagar',
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
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule
  ],
  templateUrl: './cuentas-por-pagar.component.html',
  styleUrl: './cuentas-por-pagar.component.scss'
})
export class CuentasPorPagarComponent implements OnInit {
  private readonly servicio = inject(CuentasPorPagarService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Relación de pagos en preparación (borrador) — se muestra como aviso para ir a revisarla y enviarla. */
  readonly relacion = signal<RelacionBorrador | null>(null);

  readonly columnas = ['proveedor', 'facturas', 'pendiente', 'vencido', 'descuentos', 'neto', 'acciones'];
  readonly resumen = signal<ResumenCuentasPorPagar | null>(null);
  readonly error = signal<string | null>(null);

  readonly busqueda = signal('');
  readonly orden = signal<Orden>('neto');
  // Por defecto solo quien tiene facturas por pagar — los terceros que solo tienen anticipos sin
  // cruzar (a favor de Jimaco) se ven activando el interruptor.
  readonly incluirSoloAnticipos = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(this.leerPageSize());
  readonly pageSizeOptions = [10, 25, 50, 100];

  readonly filtrados = computed<ProveedorCuentaPorPagar[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const lista = (this.resumen()?.proveedores ?? []).filter(
      (p) =>
        (this.incluirSoloAnticipos() || p.facturas > 0) &&
        (!texto || p.nombre.toLowerCase().includes(texto) || p.identificacion.includes(texto))
    );
    const comparar: Record<Orden, (a: ProveedorCuentaPorPagar, b: ProveedorCuentaPorPagar) => number> = {
      neto: (a, b) => b.neto - a.neto,
      vencido: (a, b) => b.vencido - a.vencido,
      dias: (a, b) => b.diasMaximoVencido - a.diasMaximoVencido,
      nombre: (a, b) => a.nombre.localeCompare(b.nombre)
    };
    return [...lista].sort(comparar[this.orden()]);
  });

  readonly paginados = computed(() => {
    const inicio = this.pageIndex() * this.pageSize();
    return this.filtrados().slice(inicio, inicio + this.pageSize());
  });

  // Barra de antigüedad: el ancho de cada tramo es su proporción del total por pagar.
  readonly tramos = computed(() => {
    const r = this.resumen();
    if (!r || r.totalPendiente <= 0) return [];
    return [
      { clase: 'al-dia', etiqueta: 'Al día', valor: r.alDia },
      { clase: 'v30', etiqueta: '1–30 días', valor: r.vencido1a30 },
      { clase: 'v60', etiqueta: '31–60 días', valor: r.vencido31a60 },
      { clase: 'v90', etiqueta: 'Más de 60 días', valor: r.vencidoMas60 }
    ].map((t) => ({ ...t, porcentaje: (t.valor / r.totalPendiente) * 100 }));
  });

  readonly haceCuanto = haceCuanto;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.error.set(null);
    this.servicio.relacion().subscribe({ next: (r) => this.relacion.set(r), error: () => this.relacion.set(null) });
    this.servicio.resumen().subscribe({
      next: (r) => this.resumen.set(r),
      error: (e: { error?: { mensaje?: string } }) =>
        this.error.set(e.error?.mensaje ?? 'No se pudieron cargar las cuentas por pagar.')
    });
  }

  abrirExtraordinario(): void {
    this.dialog
      .open(PagoExtraordinarioDialogComponent, { width: '32rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((enviado) => {
        if (enviado) this.snackBar.open('Pago extraordinario enviado al pagador', 'Cerrar', { duration: 5000 });
      });
  }

  actualizarBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.pageIndex.set(0);
  }

  cambiarOrden(valor: Orden): void {
    this.orden.set(valor);
    this.pageIndex.set(0);
  }

  alternarSoloAnticipos(valor: boolean): void {
    this.incluirSoloAnticipos.set(valor);
    this.pageIndex.set(0);
  }

  cambiarPagina(evento: PageEvent): void {
    this.pageIndex.set(evento.pageIndex);
    this.pageSize.set(evento.pageSize);
    try {
      localStorage.setItem(CLAVE_PAGE_SIZE, String(evento.pageSize));
    } catch {
      // Navegación privada: no se recuerda el tamaño, no es crítico.
    }
  }

  private leerPageSize(): number {
    try {
      const valor = Number(localStorage.getItem(CLAVE_PAGE_SIZE));
      return this.pageSizeOptions.includes(valor) ? valor : 25;
    } catch {
      return 25;
    }
  }
}
