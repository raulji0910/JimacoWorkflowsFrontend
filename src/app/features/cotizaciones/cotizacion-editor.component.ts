import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, Location, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { esDispositivoMovil } from '../../shared/dispositivo';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CotizacionService } from '../../core/services/cotizacion.service';
import {
  CatalogoCotizacion,
  ClienteCatalogo,
  Cotizacion,
  DireccionCliente,
  ExistenciaBodega,
  GuardarCotizacion,
  ProductoCatalogo,
  totalesRenglon
} from '../../core/models/cotizacion.model';
import { ETIQUETA_ESTADO_COTIZACION } from './estado-cotizacion';
import { ConCambiosSinGuardar } from '../../core/guards/cambios-sin-guardar.guard';

interface RenglonEditable {
  clave: number;
  idInventario: number;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  iva: number;
  idBodega: string;
  cantidad: number;
  valorUnitario: number;
  nota: string;
  /** Solo los productos agregados en esta sesión traen existencias (vienen de la búsqueda). */
  existencias: ExistenciaBodega[] | null;
}

const BODEGA_PRINCIPAL = 'Uno';
const SEGUNDOS_CONSULTA = 5;

// Editor de una cotización (2026-11-25): encabezado como en WO (cliente, sucursal, forma de pago,
// concepto, vigencia), "Más Datos" (los campos en uso de la COT en WO), renglones con productos del
// catálogo de WO y sus existencias, y totales con la misma regla de redondeo de WO. Al enviarla, el
// Sincronizador la crea en WO en menos de un minuto; mientras tanto la pantalla consulta sola cada
// pocos segundos hasta mostrar el número.
@Component({
  selector: 'app-cotizacion-editor',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, FormsModule, RouterLink, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule, MatTooltipModule],
  templateUrl: './cotizacion-editor.component.html',
  styleUrls: ['./cotizacion-editor.component.scss', './cotizacion-editor-tabla.component.scss']
})
export class CotizacionEditorComponent implements OnInit, OnDestroy, ConCambiosSinGuardar {
  private readonly servicio = inject(CotizacionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly sanitizer = inject(DomSanitizer);

  // ---- Impresión (PDF con el formato de WO), igual que la vista previa de la OC ----
  readonly esMovil = esDispositivoMovil();
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  readonly cargandoPdf = signal(false);
  private pdfObjectUrl: string | null = null;
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly etiquetas = ETIQUETA_ESTADO_COTIZACION;
  readonly catalogo = signal<CatalogoCotizacion | null>(null);
  readonly cotizacion = signal<Cotizacion | null>(null);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal(false);
  readonly cambios = signal(false);
  readonly confirmandoBorrado = signal(false);
  /** Mientras se guarda o se envía, nada se puede tocar. */
  readonly bloqueado = computed(() => this.ocupado() || !this.editable());

  // ---- Encabezado ----
  readonly cliente = signal<ClienteCatalogo | null>(null);
  readonly direcciones = signal<DireccionCliente[]>([]);
  readonly idDireccion = signal<number | null>(null);
  readonly idFormaPago = signal<number | null>(null);
  readonly concepto = signal('COTIZACIÓN');
  readonly vigenciaDias = signal(30);
  readonly masDatos = signal<Record<number, string>>({});

  // ---- Renglones ----
  readonly renglones = signal<RenglonEditable[]>([]);
  private siguienteClave = 1;

  // ---- Búsquedas ----
  textoCliente = '';
  textoProducto = '';
  readonly clientesEncontrados = signal<ClienteCatalogo[]>([]);
  readonly productosEncontrados = signal<ProductoCatalogo[]>([]);
  readonly buscandoProductos = signal(false);
  private readonly busquedaCliente$ = new Subject<string>();
  private readonly busquedaProducto$ = new Subject<string>();
  private consulta: ReturnType<typeof setInterval> | null = null;

  readonly estado = computed(() => this.cotizacion()?.estado ?? 'Borrador');
  readonly editable = computed(() => this.estado() === 'Borrador' || this.estado() === 'Error');
  /** Fecha del documento (hoy si no se ha enviado) + vigencia: el Vencimiento que queda en WO. */
  readonly venceEl = computed(() => {
    const base = this.cotizacion()?.fechaDocumento ? new Date(this.cotizacion()!.fechaDocumento + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + (Number(this.vigenciaDias()) || 0));
    return base;
  });
  /** "Más Datos" plegado por defecto (pedido 2026-11-25): se abre solo cuando hace falta llenarlo. */
  readonly masDatosAbierto = signal(false);
  readonly masDatosLlenos = computed(() => Object.values(this.masDatos()).filter((v) => !!v?.trim()).length);
  readonly nombresBodega = computed(() => new Map((this.catalogo()?.bodegas ?? []).map((b) => [b.idBodega, b.nombre])));

  readonly totales = computed(() => {
    let subtotal = 0;
    let iva = 0;
    let cantidades = 0;
    for (const r of this.renglones()) {
      const t = totalesRenglon(r.cantidad || 0, r.valorUnitario || 0, r.iva);
      subtotal += t.subtotal;
      iva += t.iva;
      cantidades += r.cantidad || 0;
    }
    return { subtotal, iva, total: subtotal + iva, cantidades };
  });

  ngOnInit(): void {
    this.busquedaCliente$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        // catchError adentro: un fallo de red no debe apagar el buscador para el resto de la sesión.
        switchMap((texto) => (texto.trim().length < 2 ? of([]) : this.servicio.buscarClientes(texto).pipe(catchError(() => of([]))))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({ next: (lista) => this.clientesEncontrados.set(lista), error: () => this.clientesEncontrados.set([]) });

    this.busquedaProducto$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((texto) => {
          if (texto.trim().length < 2) return of([]);
          this.buscandoProductos.set(true);
          return this.servicio.buscarProductos(texto).pipe(catchError(() => of([])));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (lista) => {
          this.productosEncontrados.set(lista);
          this.buscandoProductos.set(false);
        },
        error: () => this.buscandoProductos.set(false)
      });

    this.servicio.catalogo().subscribe({
      next: (catalogo) => this.catalogo.set(catalogo),
      error: (e: HttpErrorResponse) => this.error.set(this.mensaje(e, 'No se pudo cargar el catálogo de World Office.'))
    });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.cargar(id);
  }

  hayCambiosSinGuardar(): boolean {
    return this.cambios() && this.editable();
  }

  ngOnDestroy(): void {
    this.detenerConsulta();
    this.cerrarImpresion();
  }

  // ---------------- Impresión ----------------

  /** En computador abre/cierra el PDF dentro de la pantalla; en el celular lo abre en otra pestaña. */
  alternarImpresion(): void {
    const id = this.cotizacion()?.id;
    if (!id) return;
    if (this.pdfUrl()) {
      this.cerrarImpresion();
      return;
    }
    // La pestaña se abre YA, dentro del clic (Safari bloquea window.open después de una espera).
    const ventana = this.esMovil ? window.open('', '_blank') : null;
    this.cargandoPdf.set(true);
    this.servicio.pdf(id).subscribe({
      next: (blob) => {
        this.cargandoPdf.set(false);
        this.pdfObjectUrl = URL.createObjectURL(blob);
        if (ventana) {
          ventana.location.href = this.pdfObjectUrl;
          return;
        }
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl));
      },
      error: () => {
        this.cargandoPdf.set(false);
        ventana?.close();
        this.snackBar.open('No se pudo generar la impresión.', 'Cerrar', { duration: 4000 });
      }
    });
  }

  cerrarImpresion(): void {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = null;
    this.pdfUrl.set(null);
  }

  // ---------------- Carga ----------------

  private cargar(id: number, enSegundoPlano = false): void {
    this.servicio.obtener(id, enSegundoPlano).subscribe({
      next: (c) => this.aplicar(c),
      error: (e: HttpErrorResponse) => {
        if (!enSegundoPlano) this.error.set(this.mensaje(e, 'No se pudo cargar la cotización.'));
      }
    });
  }

  /** Pone en pantalla lo que devolvió la Api. */
  private aplicar(c: Cotizacion): void {
    const estabaCreando = this.cotizacion()?.estado === 'PorCrear';
    if (this.pdfUrl() && (this.cotizacion()?.id !== c.id || this.cotizacion()?.fechaActualizacion !== c.fechaActualizacion)) this.cerrarImpresion();
    this.cotizacion.set(c);
    this.cliente.set(c.idTercero ? { idTercero: c.idTercero, identificacion: c.clienteIdentificacion ?? '', nombre: c.clienteNombre ?? '' } : null);
    this.textoCliente = c.clienteNombre ?? '';
    this.idDireccion.set(c.idDireccion);
    this.idFormaPago.set(c.idFormaPago);
    this.concepto.set(c.concepto ?? 'COTIZACIÓN');
    this.vigenciaDias.set(c.vigenciaDias);
    const masDatos: Record<number, string> = {};
    for (const [numero, valor] of Object.entries(c.masDatos)) masDatos[Number(numero)] = valor;
    this.masDatos.set(masDatos);

    const existenciasPrevias = new Map(this.renglones().map((r) => [r.idInventario, r.existencias]));
    this.renglones.set(
      c.renglones.map((r) => ({
        clave: this.siguienteClave++,
        idInventario: r.idInventario,
        codigo: r.codigo,
        descripcion: r.descripcion,
        unidadMedida: r.unidadMedida,
        iva: r.iva,
        idBodega: r.idBodega,
        cantidad: r.cantidad,
        valorUnitario: r.valorUnitario,
        nota: r.nota ?? '',
        existencias: existenciasPrevias.get(r.idInventario) ?? null
      }))
    );
    if (c.idTercero) this.cargarDirecciones(c.idTercero, false);
    this.cambios.set(false);

    if (c.estado === 'PorCrear') this.iniciarConsulta();
    else {
      this.detenerConsulta();
      if (estabaCreando && c.estado === 'Creada')
        this.snackBar.open(`Cotización creada en World Office: ${c.prefijoWO} ${c.numeroWO}`, 'Cerrar', { duration: 8000 });
    }
  }

  // ---------------- Cliente ----------------

  // Al elegir una opción, el autocompletado manda el OBJETO elegido por ngModelChange (no texto): se ignora,
  // lo maneja elegirCliente/agregarProducto. Sin esto la búsqueda se rompía después de la primera elección.
  buscarCliente(texto: string | ClienteCatalogo): void {
    if (typeof texto !== 'string') return;
    this.textoCliente = texto;
    this.busquedaCliente$.next(texto);
  }

  elegirCliente(evento: MatAutocompleteSelectedEvent): void {
    const cliente = evento.option.value as ClienteCatalogo;
    this.cliente.set(cliente);
    this.textoCliente = cliente.nombre;
    this.idDireccion.set(null);
    this.cargarDirecciones(cliente.idTercero, true);
    this.marcarCambio();
  }

  quitarCliente(): void {
    this.cliente.set(null);
    this.textoCliente = '';
    this.direcciones.set([]);
    this.idDireccion.set(null);
    this.marcarCambio();
  }

  private cargarDirecciones(idTercero: number, elegirPrincipal: boolean): void {
    this.servicio.direcciones(idTercero).subscribe((lista) => {
      this.direcciones.set(lista);
      if (elegirPrincipal) this.idDireccion.set(lista.find((d) => d.principal)?.idDireccion ?? lista[0]?.idDireccion ?? null);
    });
  }

  textoDireccion(d: DireccionCliente): string {
    return [d.direccion, d.ciudad].filter((s) => !!s).join(' - ') || `Sucursal ${d.idDireccion}`;
  }

  // ---------------- Productos ----------------

  buscarProducto(texto: string | ProductoCatalogo): void {
    if (typeof texto !== 'string') return;
    this.textoProducto = texto;
    this.busquedaProducto$.next(texto);
  }

  agregarProducto(evento: MatAutocompleteSelectedEvent): void {
    const p = evento.option.value as ProductoCatalogo;
    // Bodega: la principal si tiene existencia; si no, la primera que tenga; si ninguna, la principal.
    const conExistencia = p.existencias.find((e) => e.existencia > 0);
    const bodega = p.existencias.some((e) => e.idBodega === BODEGA_PRINCIPAL && e.existencia > 0)
      ? BODEGA_PRINCIPAL
      : (conExistencia?.idBodega ?? BODEGA_PRINCIPAL);
    this.renglones.update((lista) => [
      ...lista,
      {
        clave: this.siguienteClave++,
        idInventario: p.idInventario,
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidadMedida: p.unidadMedida,
        iva: p.iva,
        idBodega: bodega,
        cantidad: 1,
        valorUnitario: p.precio1 || 0,
        nota: '',
        existencias: p.existencias
      }
    ]);
    this.textoProducto = '';
    this.productosEncontrados.set([]);
    evento.option.deselect();
    this.marcarCambio();
  }

  textoExistencias(existencias: ExistenciaBodega[]): string {
    return existencias.length === 0 ? 'Sin existencias' : existencias.map((e) => `${e.bodega}: ${this.numero(e.existencia)}`).join(' · ');
  }

  existenciaEnBodega(r: RenglonEditable): number | null {
    if (!r.existencias) return null;
    return r.existencias.find((e) => e.idBodega === r.idBodega)?.existencia ?? 0;
  }

  actualizarRenglon(r: RenglonEditable, cambios: Partial<RenglonEditable>): void {
    this.renglones.update((lista) => lista.map((x) => (x.clave === r.clave ? { ...x, ...cambios } : x)));
    this.marcarCambio();
  }

  quitarRenglon(r: RenglonEditable): void {
    this.renglones.update((lista) => lista.filter((x) => x.clave !== r.clave));
    this.marcarCambio();
  }

  totalRenglon(r: RenglonEditable): number {
    return totalesRenglon(r.cantidad || 0, r.valorUnitario || 0, r.iva).total;
  }

  // ---------------- Más Datos ----------------

  cambiarMasDato(numero: number, valor: string): void {
    this.masDatos.update((m) => ({ ...m, [numero]: valor }));
    this.marcarCambio();
  }

  marcarCambio(): void {
    this.cambios.set(true);
  }

  // ---------------- Acciones ----------------

  guardar(): void {
    this.ocupado.set(true);
    this.guardar$().subscribe({
      next: (c) => {
        this.ocupado.set(false);
        this.despuesDeGuardar(c);
        this.snackBar.open('Borrador guardado.', 'Cerrar', { duration: 3000 });
      },
      error: (e: HttpErrorResponse) => this.fallo(e, 'No se pudo guardar la cotización.')
    });
  }

  /** Guarda y envía: la Api valida todo y la deja para que el Sincronizador la cree en WO. */
  enviar(): void {
    // Bloqueado desde el primer clic hasta que la Api responda (ni doble envío ni edición a medias).
    this.ocupado.set(true);
    this.guardar$()
      .pipe(
        switchMap((c) => {
          this.despuesDeGuardar(c);
          return this.servicio.enviar(c.id);
        })
      )
      .subscribe({
        next: (c) => {
          this.ocupado.set(false);
          this.aplicar(c);
          this.snackBar.open('Enviada. World Office le asignará el número en menos de un minuto.', 'Cerrar', { duration: 6000 });
        },
        error: (e: HttpErrorResponse) => this.fallo(e, 'No se pudo enviar la cotización.')
      });
  }

  copiar(): void {
    const id = this.cotizacion()?.id;
    if (!id) return;
    this.servicio.copiar(id).subscribe({
      next: (c) => {
        this.router.navigate(['/cotizaciones', c.id]).then(() => this.aplicar(c));
        this.snackBar.open('Copia creada como borrador nuevo.', 'Cerrar', { duration: 4000 });
      },
      error: (e: HttpErrorResponse) => this.fallo(e, 'No se pudo copiar la cotización.')
    });
  }

  eliminar(): void {
    const id = this.cotizacion()?.id;
    if (!id) return;
    if (!this.confirmandoBorrado()) {
      this.confirmandoBorrado.set(true);
      return;
    }
    this.servicio.eliminar(id).subscribe({
      next: () => this.router.navigate(['/cotizaciones']),
      error: (e: HttpErrorResponse) => this.fallo(e, 'No se pudo borrar la cotización.')
    });
  }

  private guardar$(): Observable<Cotizacion> {
    this.error.set(null);
    this.confirmandoBorrado.set(false);
    const dto = this.armarDto();
    const id = this.cotizacion()?.id;
    return id ? this.servicio.actualizar(id, dto) : this.servicio.crear(dto);
  }

  private despuesDeGuardar(c: Cotizacion): void {
    const eraNueva = !this.cotizacion();
    this.aplicar(c);
    // Solo se cambia la dirección (nueva → /cotizaciones/id), SIN volver a navegar: navegar recreaba la
    // pantalla y la copia nueva leía la cotización antes de terminar el envío, mostrándola editable
    // aunque ya estuviera "Creando en WO" (reportado 2026-11-25).
    if (eraNueva) this.location.replaceState(`/cotizaciones/${c.id}`);
  }

  private armarDto(): GuardarCotizacion {
    const masDatos: Record<number, string> = {};
    for (const [numero, valor] of Object.entries(this.masDatos())) if (valor?.trim()) masDatos[Number(numero)] = valor.trim();
    return {
      idTercero: this.cliente()?.idTercero ?? null,
      idDireccion: this.idDireccion(),
      idFormaPago: this.idFormaPago(),
      concepto: this.concepto().trim() || null,
      vigenciaDias: Number(this.vigenciaDias()) || 0,
      masDatos,
      renglones: this.renglones().map((r) => ({
        idInventario: r.idInventario,
        idBodega: r.idBodega,
        cantidad: Number(r.cantidad) || 0,
        valorUnitario: Number(r.valorUnitario) || 0,
        nota: r.nota.trim() || null
      }))
    };
  }

  // ---------------- Consulta automática mientras WO la crea ----------------

  private iniciarConsulta(): void {
    if (this.consulta) return;
    this.consulta = setInterval(() => {
      const id = this.cotizacion()?.id;
      if (id) this.cargar(id, true);
    }, SEGUNDOS_CONSULTA * 1000);
  }

  private detenerConsulta(): void {
    if (this.consulta) clearInterval(this.consulta);
    this.consulta = null;
  }

  // ---------------- Apoyo ----------------

  private fallo(e: HttpErrorResponse, porDefecto: string): void {
    this.ocupado.set(false);
    this.error.set(this.mensaje(e, porDefecto));
  }

  private mensaje(e: HttpErrorResponse, porDefecto: string): string {
    return e.error?.mensaje ?? porDefecto;
  }

  private numero(valor: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(valor);
  }

  nombreCliente = (c: ClienteCatalogo | string | null): string => (typeof c === 'string' ? c : (c?.nombre ?? ''));

  /** El buscador de productos queda vacío después de agregar uno. */
  readonly sinTexto = (): string => '';
}
