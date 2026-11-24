import { Component, OnInit, computed, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaginadorEs } from '../../core/paginador-es';
import { ConciliacionService } from '../../core/services/conciliacion.service';
import {
  Conciliacion,
  EstadoConciliacion,
  FacturaConciliada,
  OrdenFacturadaSinXml,
  OrdenPendiente,
  ReferenciaOrdenInvalida
} from '../../core/models/conciliacion.model';
import { ConciliacionDetalleDialogComponent } from './conciliacion-detalle-dialog.component';
import { CargaDianDialogComponent } from './carga-dian-dialog.component';
import { ObservacionesOrdenDialogComponent } from './observaciones-orden-dialog.component';
import { ObservacionesFacturaDialogComponent } from './observaciones-factura-dialog.component';

type Filtro = 'Todas' | EstadoConciliacion | 'OrdenesPendientes' | 'FacturadasSinXml' | 'ReferenciasInvalidas';
type Tabla = 'facturas' | 'ordenes' | 'facturadas' | 'invalidas';
type RevisionOrden = 'Todas' | 'SinRevisar' | 'ConObservacion' | 'NoRequiereFactura';
type RevisionFactura = 'Todas' | 'SinRevisar' | 'ConObservacion' | 'Revisada';
type ValorOrden = string | number | null;

const sinOrden: Sort = { active: '', direction: '' };

interface Tarjeta {
  filtro: Filtro;
  titulo: string;
  icono: string;
  cantidad: number;
  valor: number;
}

// Cruce de las facturas electrónicas que llegan a facturacion@jimaco.com.co (las sube el Sincronizador
// en modo --conciliacion) contra las OC de World Office. Copia de la pantalla de Ferrealiados con las
// adiciones de Jimaco (2026-11-24): emisor de cada OC, observaciones + "Revisada" en facturas Parciales /
// Con diferencia y descarga de XML a demanda. El cálculo lo hace la API al vuelo en cada consulta; los
// filtros de proveedor/OC/factura y el paginado se aplican aquí sobre lo ya traído.
@Component({
  selector: 'app-conciliacion',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    PercentPipe,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSortModule,
    MatCheckboxModule
  ],
  // Paginador en español solo en esta pantalla (el resto de la app no lo usaba).
  providers: [{ provide: MatPaginatorIntl, useClass: PaginadorEs }],
  templateUrl: './conciliacion.component.html',
  styleUrls: ['./conciliacion.component.scss', './conciliacion-jimaco.component.scss']
})
export class ConciliacionComponent implements OnInit {
  readonly columnasFacturas = ['seleccion', 'fecha', 'proveedor', 'factura', 'subtotal', 'iva', 'oc', 'diferencia', 'estado', 'acciones'];
  readonly columnasOrdenes = ['fecha', 'dias', 'proveedor', 'oc', 'subtotal', 'saldo', 'revision'];
  readonly columnasFacturadas = ['fecha', 'proveedor', 'oc', 'subtotal', 'fc', 'documento'];
  readonly columnasInvalidas = ['fecha', 'proveedor', 'fc', 'documento', 'referencia', 'motivo'];

  readonly etiquetas: Record<EstadoConciliacion, string> = {
    Cuadra: 'Cuadra',
    Diferencia: 'Diferencia',
    Parcial: 'Parcial',
    SinOrdenCompra: 'Sin OC'
  };

  desde: Date;
  hasta: Date;
  readonly conciliacion = signal<Conciliacion | null>(null);
  readonly cargando = signal(false);
  readonly filtro = signal<Filtro>('Todas');

  readonly proveedor = signal('');
  readonly numeroOc = signal('');
  readonly numeroFactura = signal('');

  // Orden elegido con clic en los encabezados (sin orden = como llega de la API). Se guarda aparte
  // por tabla para que no se pierda al pasar de las facturas a las OC sin factura y volver.
  readonly ordenFacturas = signal<Sort>(sinOrden);
  readonly ordenOrdenes = signal<Sort>(sinOrden);
  readonly ordenFacturadas = signal<Sort>(sinOrden);
  readonly ordenInvalidas = signal<Sort>(sinOrden);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);

  readonly hayFiltrosTexto = computed(() => !!(this.proveedor() || this.numeroOc() || this.numeroFactura()));

  // Facturas y OC pendientes después de los filtros de texto (antes del filtro por estado), para que
  // las tarjetas de resumen cuenten sobre lo mismo que se está buscando.
  private readonly facturasBuscadas = computed(() => {
    const datos = this.conciliacion();
    if (!datos) return [];
    const proveedor = this.normalizar(this.proveedor());
    const oc = this.numeroOc().trim();
    const factura = this.normalizar(this.numeroFactura());
    return datos.facturas.filter(
      (f) =>
        (!proveedor || this.coincideProveedor(f.nombreProveedor, f.nitProveedor, proveedor)) &&
        (!oc || f.ordenesCompra.some((n) => String(n).includes(oc))) &&
        (!factura || this.normalizar(f.numero).includes(factura))
    );
  });

  private readonly ordenesBuscadas = computed(() => {
    const datos = this.conciliacion();
    if (!datos) return [];
    const proveedor = this.normalizar(this.proveedor());
    const oc = this.numeroOc().trim();
    // Una OC pendiente no tiene factura: si se busca por número de factura no hay nada que mostrar.
    if (this.numeroFactura().trim()) return [];
    return datos.ordenesPendientes.filter(
      (o) =>
        (!proveedor || this.coincideProveedor(o.nombreProveedor, o.nitProveedor, proveedor)) &&
        (!oc || String(o.numero).includes(oc))
    );
  });

  // OC que una FC de WO dice cubrir pero sin XML, y OC mal citadas en una FC: el número de factura
  // se busca contra el "Doc. Externo" de la FC (el número de la factura del proveedor).
  private readonly facturadasBuscadas = computed(() => {
    const datos = this.conciliacion();
    if (!datos) return [];
    const proveedor = this.normalizar(this.proveedor());
    const oc = this.numeroOc().trim();
    const factura = this.normalizar(this.numeroFactura());
    return datos.ordenesFacturadasSinXml.filter(
      (o) =>
        (!proveedor || this.coincideProveedor(o.nombreProveedor, o.nitProveedor, proveedor)) &&
        (!oc || String(o.numero).includes(oc)) &&
        (!factura || this.normalizar(o.documentoExterno ?? '').includes(factura))
    );
  });

  private readonly invalidasBuscadas = computed(() => {
    const datos = this.conciliacion();
    if (!datos) return [];
    const proveedor = this.normalizar(this.proveedor());
    const oc = this.numeroOc().trim();
    const factura = this.normalizar(this.numeroFactura());
    return datos.referenciasInvalidas.filter(
      (r) =>
        (!proveedor || this.coincideProveedor(r.nombreProveedor, r.nitProveedor, proveedor)) &&
        (!oc || String(r.ordenCitada).includes(oc)) &&
        (!factura || this.normalizar(r.documentoExterno ?? '').includes(factura))
    );
  });

  readonly cantidadInvalidas = computed(() => this.invalidasBuscadas().length);

  readonly tarjetas = computed<Tarjeta[]>(() => {
    const facturas = this.facturasBuscadas();
    const ordenes = this.ordenesBuscadas();
    const facturadas = this.facturadasBuscadas();
    const grupo = (estado: EstadoConciliacion) => facturas.filter((f) => f.estado === estado);
    const sumar = (lista: FacturaConciliada[]) => lista.reduce((t, f) => t + f.subtotal, 0);
    return [
      { filtro: 'Todas', titulo: 'Facturas', icono: 'receipt_long', cantidad: facturas.length, valor: sumar(facturas) },
      { filtro: 'Cuadra', titulo: 'Cuadran', icono: 'check_circle', cantidad: grupo('Cuadra').length, valor: sumar(grupo('Cuadra')) },
      { filtro: 'Diferencia', titulo: 'Con diferencia', icono: 'warning', cantidad: grupo('Diferencia').length, valor: sumar(grupo('Diferencia')) },
      { filtro: 'Parcial', titulo: 'Parciales', icono: 'call_split', cantidad: grupo('Parcial').length, valor: sumar(grupo('Parcial')) },
      { filtro: 'SinOrdenCompra', titulo: 'Sin OC', icono: 'help', cantidad: grupo('SinOrdenCompra').length, valor: sumar(grupo('SinOrdenCompra')) },
      {
        filtro: 'OrdenesPendientes',
        titulo: 'OC sin factura',
        icono: 'pending_actions',
        cantidad: ordenes.length,
        valor: ordenes.reduce((t, o) => t + o.saldoSubtotal, 0)
      },
      {
        filtro: 'FacturadasSinXml',
        titulo: 'Facturadas sin XML',
        icono: 'cloud_off',
        cantidad: facturadas.length,
        valor: facturadas.reduce((t, o) => t + o.subtotal, 0)
      }
    ];
  });

  readonly porcentajeCuadran = computed(() => {
    const facturas = this.facturasBuscadas();
    return facturas.length ? facturas.filter((f) => f.estado === 'Cuadra').length / facturas.length : 0;
  });

  // Revisión de las facturas Parciales / Con diferencia (adición de Jimaco). El filtro solo aparece en
  // esas dos tarjetas: en "Cuadran" o "Sin OC" no hay nada que revisar.
  readonly revisionFactura = signal<RevisionFactura>('Todas');

  readonly opcionesRevisionFactura: { valor: RevisionFactura; titulo: string }[] = [
    { valor: 'Todas', titulo: 'Todas' },
    { valor: 'SinRevisar', titulo: 'Sin revisar' },
    { valor: 'ConObservacion', titulo: 'Con observación' },
    { valor: 'Revisada', titulo: 'Revisadas' }
  ];

  readonly filtroRevisionFacturaVisible = computed(() => this.filtro() === 'Diferencia' || this.filtro() === 'Parcial');

  private readonly facturasDelEstado = computed(() => {
    const filtro = this.filtro();
    const facturas = this.facturasBuscadas();
    return filtro === 'Todas' ? facturas : facturas.filter((f) => f.estado === filtro);
  });

  readonly conteoRevisionFactura = computed(() => {
    const facturas = this.facturasDelEstado();
    return {
      Todas: facturas.length,
      SinRevisar: facturas.filter((f) => f.observaciones === 0).length,
      ConObservacion: facturas.filter((f) => f.observaciones > 0 && !f.revisada).length,
      Revisada: facturas.filter((f) => f.revisada).length
    } satisfies Record<RevisionFactura, number>;
  });

  readonly facturasFiltradas = computed(() => {
    const revision = this.filtroRevisionFacturaVisible() ? this.revisionFactura() : 'Todas';
    const filtradas = this.facturasDelEstado().filter(
      (f) =>
        revision === 'Todas' ||
        (revision === 'SinRevisar' && f.observaciones === 0) ||
        (revision === 'ConObservacion' && f.observaciones > 0 && !f.revisada) ||
        (revision === 'Revisada' && f.revisada)
    );
    return this.ordenarLista(filtradas, this.ordenFacturas(), (f, columna) => this.valorFactura(f, columna));
  });

  // ---- Descarga de XML a demanda (adición de Jimaco) ----
  // Se eligen facturas con la casilla de cada fila (o todas las del filtro actual) y se bajan en un ZIP.
  readonly seleccion = signal<ReadonlySet<number>>(new Set());
  readonly descargando = signal(false);

  readonly todasSeleccionadas = computed(() => {
    const filas = this.facturasFiltradas();
    const sel = this.seleccion();
    return filas.length > 0 && filas.every((f) => sel.has(f.facturaId));
  });

  readonly algunaSeleccionada = computed(() => {
    const sel = this.seleccion();
    return this.facturasFiltradas().some((f) => sel.has(f.facturaId)) && !this.todasSeleccionadas();
  });

  // Filtro por estado de revisión de las OC sin factura (no cambia la tarjeta: la OC sigue pendiente).
  readonly revision = signal<RevisionOrden>('Todas');

  readonly opcionesRevision: { valor: RevisionOrden; titulo: string }[] = [
    { valor: 'Todas', titulo: 'Todas' },
    { valor: 'SinRevisar', titulo: 'Sin revisar' },
    { valor: 'ConObservacion', titulo: 'Con observación' },
    { valor: 'NoRequiereFactura', titulo: 'No requiere factura' }
  ];

  readonly conteoRevision = computed(() => {
    const ordenes = this.ordenesBuscadas();
    return {
      Todas: ordenes.length,
      SinRevisar: ordenes.filter((o) => o.observaciones === 0).length,
      ConObservacion: ordenes.filter((o) => o.observaciones > 0).length,
      NoRequiereFactura: ordenes.filter((o) => o.noRequiereFactura).length
    } satisfies Record<RevisionOrden, number>;
  });

  private readonly ordenesOrdenadas = computed(() => {
    const revision = this.revision();
    const ordenes = this.ordenesBuscadas().filter(
      (o) =>
        revision === 'Todas' ||
        (revision === 'SinRevisar' && o.observaciones === 0) ||
        (revision === 'ConObservacion' && o.observaciones > 0) ||
        (revision === 'NoRequiereFactura' && o.noRequiereFactura)
    );
    return this.ordenarLista(ordenes, this.ordenOrdenes(), (o, columna) => this.valorOrden(o, columna));
  });

  private readonly facturadasOrdenadas = computed(() =>
    this.ordenarLista(this.facturadasBuscadas(), this.ordenFacturadas(), (o, columna) => this.valorFacturada(o, columna))
  );

  private readonly invalidasOrdenadas = computed(() =>
    this.ordenarLista(this.invalidasBuscadas(), this.ordenInvalidas(), (r, columna) => this.valorInvalida(r, columna))
  );

  readonly totalFilas = computed(() => {
    switch (this.filtro()) {
      case 'OrdenesPendientes': return this.ordenesOrdenadas().length;
      case 'FacturadasSinXml': return this.facturadasOrdenadas().length;
      case 'ReferenciasInvalidas': return this.invalidasOrdenadas().length;
      default: return this.facturasFiltradas().length;
    }
  });

  readonly paginaFacturas = computed(() => this.paginar(this.facturasFiltradas()));
  readonly paginaOrdenes = computed(() => this.paginar(this.ordenesOrdenadas()));
  readonly paginaFacturadas = computed(() => this.paginar(this.facturadasOrdenadas()));
  readonly paginaInvalidas = computed(() => this.paginar(this.invalidasOrdenadas()));

  // En Jimaco solo entra quien tiene el rol Conciliador, y ese rol puede todo lo de esta pantalla.
  readonly puedeCargar = true;

  constructor(
    private readonly conciliacionService: ConciliacionService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {
    this.hasta = new Date();
    this.desde = new Date();
    this.desde.setDate(this.desde.getDate() - 30);
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    if (!this.desde || !this.hasta) return;
    this.cargando.set(true);
    this.conciliacionService.conciliar(this.aIso(this.desde), this.aIso(this.hasta)).subscribe({
      next: (resultado) => {
        this.conciliacion.set(resultado);
        // Lo elegido que ya no está en el resultado (otro rango) se descarta.
        const ids = new Set(resultado.facturas.map((f) => f.facturaId));
        this.seleccion.set(new Set([...this.seleccion()].filter((id) => ids.has(id))));
        this.pageIndex.set(0);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  seleccionar(filtro: Filtro): void {
    this.filtro.set(filtro);
    this.pageIndex.set(0);
  }

  /** Atajo: todo el año en curso (pedido: consultar la información de 2026). */
  todoElAnio(): void {
    const hoy = new Date();
    this.desde = new Date(hoy.getFullYear(), 0, 1);
    this.hasta = hoy;
    this.cargar();
  }

  cambiarRevisionFactura(revision: RevisionFactura): void {
    this.revisionFactura.set(revision);
    this.pageIndex.set(0);
  }

  alternarFactura(factura: FacturaConciliada): void {
    const sel = new Set(this.seleccion());
    if (sel.has(factura.facturaId)) sel.delete(factura.facturaId);
    else sel.add(factura.facturaId);
    this.seleccion.set(sel);
  }

  /** Casilla del encabezado: marca o desmarca todas las facturas del filtro actual (no solo la página). */
  alternarTodas(): void {
    const sel = new Set(this.seleccion());
    const filas = this.facturasFiltradas();
    if (this.todasSeleccionadas()) filas.forEach((f) => sel.delete(f.facturaId));
    else filas.forEach((f) => sel.add(f.facturaId));
    this.seleccion.set(sel);
  }

  limpiarSeleccion(): void {
    this.seleccion.set(new Set());
  }

  descargarSeleccion(): void {
    const ids = [...this.seleccion()];
    if (ids.length === 0 || this.descargando()) return;
    if (ids.length > 500) {
      this.snackBar.open('Se pueden descargar máximo 500 XML a la vez.', 'Cerrar', { duration: 5000 });
      return;
    }
    this.descargando.set(true);
    this.conciliacionService.descargarXml(ids).subscribe({
      next: (respuesta) => {
        this.descargando.set(false);
        guardarArchivo(respuesta.body!, nombreDescarga(respuesta.headers.get('Content-Disposition'), 'facturas-xml.zip'));
      },
      error: () => {
        this.descargando.set(false);
        this.snackBar.open('No se pudieron descargar los XML.', 'Cerrar', { duration: 5000 });
      }
    });
  }

  // Observaciones de una factura Parcial / Con diferencia. Si se agregó algo, se recarga.
  verObservacionesFactura(factura: FacturaConciliada): void {
    this.dialog
      .open(ObservacionesFacturaDialogComponent, {
        width: '44rem',
        maxWidth: '95vw',
        autoFocus: false,
        data: { facturaId: factura.facturaId }
      })
      .afterClosed()
      .subscribe((cambio) => {
        if (cambio) this.cargar();
      });
  }

  // Cada cambio en un filtro de texto vuelve a la primera página.
  cambiarTexto(campo: 'proveedor' | 'numeroOc' | 'numeroFactura', valor: string): void {
    this[campo].set(valor);
    this.pageIndex.set(0);
  }

  limpiarFiltros(): void {
    this.proveedor.set('');
    this.numeroOc.set('');
    this.numeroFactura.set('');
    this.pageIndex.set(0);
  }

  ordenar(tabla: Tabla, orden: Sort): void {
    const senales = { facturas: this.ordenFacturas, ordenes: this.ordenOrdenes, facturadas: this.ordenFacturadas, invalidas: this.ordenInvalidas };
    senales[tabla].set(orden);
    this.pageIndex.set(0);
  }

  alCambiarPagina(evento: PageEvent): void {
    this.pageIndex.set(evento.pageIndex);
    this.pageSize.set(evento.pageSize);
  }

  verDetalle(factura: FacturaConciliada): void {
    const dialogRef = this.dialog.open(ConciliacionDetalleDialogComponent, {
      width: '72rem',
      maxWidth: '95vw',
      autoFocus: 'dialog',
      data: { facturaId: factura.facturaId }
    });
    dialogRef.afterOpened().subscribe(() => window.dispatchEvent(new Event('resize')));
  }

  cambiarRevision(revision: RevisionOrden): void {
    this.revision.set(revision);
    this.pageIndex.set(0);
  }

  // Historial de revisión de una OC sin factura. Si se agregó algo, se recarga para ver el ✔.
  verObservaciones(orden: OrdenPendiente): void {
    this.dialog
      .open(ObservacionesOrdenDialogComponent, {
        width: '44rem',
        maxWidth: '95vw',
        autoFocus: false,
        data: { idAsientoContable: orden.idAsientoContable, puedeEscribir: this.puedeCargar }
      })
      .afterClosed()
      .subscribe((cambio) => {
        if (cambio) this.cargar();
      });
  }

  abrirCargaDian(): void {
    this.dialog
      .open(CargaDianDialogComponent, { width: '56rem', maxWidth: '95vw', disableClose: true, autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((hayNuevas) => {
        if (hayNuevas) this.cargar();
      });
  }

  etiqueta(estado: EstadoConciliacion): string {
    return this.etiquetas[estado];
  }

  claseEstado(estado: EstadoConciliacion): string {
    return `conciliacion__chip--${estado.toLowerCase()}`;
  }

  diasDesde(orden: OrdenPendiente): number {
    const fecha = new Date(`${orden.fecha}T00:00:00`);
    return Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 86_400_000));
  }

  // Los vacíos (factura sin OC, diferencia de una que cuadra) van siempre al final, en los dos sentidos.
  private ordenarLista<T>(lista: T[], orden: Sort, valor: (item: T, columna: string) => ValorOrden): T[] {
    if (!orden.active || !orden.direction) return lista;
    const signo = orden.direction === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = valor(a, orden.active);
      const vb = valor(b, orden.active);
      if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
      const comparacion =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      return comparacion * signo;
    });
  }

  private valorFactura(f: FacturaConciliada, columna: string): ValorOrden {
    switch (columna) {
      case 'fecha': return f.fechaEmision;
      case 'proveedor': return f.nombreProveedor;
      case 'factura': return f.numero;
      case 'subtotal': return f.subtotal;
      case 'iva': return f.iva;
      case 'oc': return f.ordenesCompra[0] ?? null;
      case 'emisor': return f.emisoresOrdenCompra?.[0] ?? null;
      case 'revision': return f.revisada ? 2 : f.observaciones > 0 ? 1 : f.estado === 'Diferencia' || f.estado === 'Parcial' ? 0 : null;
      case 'diferencia': return f.estado === 'Cuadra' ? null : f.diferenciaSubtotal;
      case 'estado': return this.etiquetas[f.estado];
      default: return null;
    }
  }

  private valorOrden(o: OrdenPendiente, columna: string): ValorOrden {
    switch (columna) {
      case 'fecha': return o.fecha;
      case 'dias': return this.diasDesde(o);
      case 'proveedor': return o.nombreProveedor;
      case 'oc': return o.numero;
      case 'emisor': return o.emisor;
      case 'subtotal': return o.subtotal;
      case 'saldo': return o.saldoSubtotal;
      case 'revision': return o.noRequiereFactura ? 2 : o.observaciones > 0 ? 1 : 0;
      default: return null;
    }
  }

  private valorFacturada(o: OrdenFacturadaSinXml, columna: string): ValorOrden {
    switch (columna) {
      case 'fecha': return o.fecha;
      case 'proveedor': return o.nombreProveedor;
      case 'oc': return o.numero;
      case 'emisor': return o.emisor;
      case 'subtotal': return o.subtotal;
      case 'fc': return o.facturaCompraNumero;
      case 'documento': return o.documentoExterno;
      default: return null;
    }
  }

  private valorInvalida(r: ReferenciaOrdenInvalida, columna: string): ValorOrden {
    switch (columna) {
      case 'fecha': return r.fecha;
      case 'proveedor': return r.nombreProveedor;
      case 'fc': return r.facturaCompraNumero;
      case 'documento': return r.documentoExterno;
      case 'referencia': return r.referenciaOrdenes;
      case 'motivo': return r.motivo;
      default: return null;
    }
  }

  private paginar<T>(lista: T[]): T[] {
    const inicio = this.pageIndex() * this.pageSize();
    return lista.slice(inicio, inicio + this.pageSize());
  }

  private coincideProveedor(nombre: string, nit: string, buscado: string): boolean {
    const digitos = buscado.replace(/\D/g, '');
    return this.normalizar(nombre).includes(buscado) || (digitos.length >= 3 && nit.includes(digitos));
  }

  // Minúsculas y sin tildes, para que "PARAMO" encuentre "PÁRAMO".
  private normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  // DateOnly del backend: se arma a mano con la fecha local (toISOString() la pasaría a UTC y
  // de noche en Colombia correría el día).
  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
}

/** Nombre que manda la API en Content-Disposition (filename*=UTF-8'' o filename=). */
export function nombreDescarga(contentDisposition: string | null, porDefecto: string): string {
  if (!contentDisposition) return porDefecto;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8) return decodeURIComponent(utf8[1].replace(/"/g, ''));
  const simple = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return simple ? simple[1] : porDefecto;
}

export function guardarArchivo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
