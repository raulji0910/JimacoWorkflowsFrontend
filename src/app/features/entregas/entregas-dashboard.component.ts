import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RemisionService } from '../../core/services/remision.service';
import { AuthService } from '../../core/services/auth.service';
import { RemisionTablero } from '../../core/models/remision.model';
import { abrirPdfEnPestana } from './entregas-utilidades';

const CLAVE_SONIDO = 'aprobaciones.entregas.sonido';
const CLAVE_PAGE_SIZE = 'aprobaciones.entregas.pageSize';
const MS_ENTRE_CHEQUEOS = 60_000;
const MS_RECIEN_ENTREGADA = 24 * 60 * 60 * 1000;
const MS_ENTRE_BEEPS = 2_000;

export type NivelEstadoRemision = 'atrasada' | 'entregada' | 'revisar' | 'normal';

/**
 * Vista de facturación (fase 2, 2026-11-13): "faltan" = entregadas a las que les faltan documentos o
 * que contabilidad devolvió; "contabilidad" = enviadas a facturar. 'ninguna' = vistas de entrega.
 */
export type VistaFacturacion = 'ninguna' | 'faltan' | 'contabilidad';

/**
 * Dashboard de Entregas (2026-11-12) — calcado del de Alistamiento a pedido del usuario ("que se
 * mantenga la uniformidad de la aplicación y las mismas alertas"): misma tabla, mismos filtros con
 * autocompletar, mismo pulso rojo y beep cada 2 s mientras haya alguna remisión Atrasada (por
 * entregar hace más de Entregas:HorasUmbralAlerta horas desde que se contabilizó), mismos botones
 * de vista y mismo paginador. Comparte la hoja de estilos del de Alistamiento.
 */
@Component({
  selector: 'app-entregas-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatTableModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatCheckboxModule
  ],
  templateUrl: './entregas-dashboard.component.html',
  styleUrls: ['../alistamiento/alistamiento-dashboard.component.scss', './entregas-dashboard.component.scss']
})
export class EntregasDashboardComponent implements OnInit, OnDestroy {
  private readonly servicio = inject(RemisionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  readonly columnas = ['seleccion', 'remision', 'cliente', 'campoEntrega', 'elaboradoPor', 'contabilizada', 'cotizacion', 'estado', 'acciones'];
  readonly remisiones = signal<RemisionTablero[]>([]);
  private readonly ahoraCarga = signal(Date.now());
  readonly cargando = signal(false);
  private primeraCarga = true;
  // Cada quien abre en lo suyo: Logística en "por entregar", el emisor (vendedora) en "faltan
  // documentos" y el contable en "en contabilidad".
  readonly vistaFacturacion = signal<VistaFacturacion>(this.vistaInicial());
  readonly soloPorEntregar = signal(this.vistaFacturacion() === 'ninguna');
  readonly soloEntregadas = signal(false);
  readonly sonidoActivo = signal(this.leerPreferenciaSonido());
  readonly pageIndex = signal(0);
  readonly pageSize = signal(this.leerPreferenciaPageSize());
  readonly pageSizeOptions = [10, 25, 50];
  readonly seleccion = signal<Set<number>>(new Set());

  readonly filtroCampoEntrega = signal('');
  readonly filtroElaboradoPor = signal('');
  readonly filtroNumero = signal('');

  readonly opcionesCampoEntrega = computed(() => this.valoresUnicos((r) => r.campoEntrega));
  readonly opcionesElaboradoPor = computed(() => this.valoresUnicos((r) => r.elaboradoPor));

  private audioContext: AudioContext | null = null;
  private temporizadorCarga: ReturnType<typeof setInterval> | null = null;
  private temporizadorBeep: ReturnType<typeof setInterval> | null = null;

  get filtradas(): RemisionTablero[] {
    const vista = this.vistaFacturacion();
    const todas =
      vista === 'ninguna' ? this.remisiones() : this.remisiones().filter((r) => this.enVistaFacturacion(r, vista));
    if (vista !== 'ninguna') return this.aplicarFiltrosTexto(todas);
    const porEntregadas = this.soloEntregadas() ? todas.filter((r) => r.estado === 'Entregada') : todas;
    const porPendiente =
      this.soloPorEntregar() && !this.soloEntregadas() ? porEntregadas.filter((r) => r.estado === 'PorEntregar') : porEntregadas;
    const filtradas = this.aplicarFiltrosTexto(porPendiente);

    // Vista por defecto (solo por entregar): la más vieja arriba, como llega del servidor.
    if (this.soloPorEntregar() && !this.soloEntregadas()) return filtradas;

    // "Viendo todas" y "Ver entregadas": las entregadas en las últimas 24 h van primero (la más
    // reciente arriba), igual que las HA recién completadas; el resto queda en su orden.
    return [...filtradas].sort((a, b) => this.msRecienEntregada(b) - this.msRecienEntregada(a));
  }

  private aplicarFiltrosTexto(lista: RemisionTablero[]): RemisionTablero[] {
    const campo = this.filtroCampoEntrega().trim().toLowerCase();
    const elaboro = this.filtroElaboradoPor().trim().toLowerCase();
    const numero = this.filtroNumero().trim().toLowerCase();
    return lista.filter(
      (r) =>
        (!campo || (r.campoEntrega ?? '').toLowerCase().includes(campo)) &&
        (!elaboro || (r.elaboradoPor ?? '').toLowerCase().includes(elaboro)) &&
        (!numero || r.numero.toLowerCase().includes(numero))
    );
  }

  private enVistaFacturacion(r: RemisionTablero, vista: VistaFacturacion): boolean {
    if (r.estado !== 'Entregada') return false;
    if (vista === 'faltan') return r.estadoFacturacion === 'PendienteDocumentos' || r.estadoFacturacion === 'Devuelta';
    return r.estadoFacturacion === 'EnFacturacion';
  }

  readonly cantidadFaltan = computed(() => this.remisiones().filter((r) => this.enVistaFacturacion(r, 'faltan')).length);
  readonly cantidadContabilidad = computed(
    () => this.remisiones().filter((r) => this.enVistaFacturacion(r, 'contabilidad')).length
  );

  private vistaInicial(): VistaFacturacion {
    if (this.auth.puedeGestionarEntregas()) return 'ninguna';
    if (this.auth.puedeFacturarEntregas()) return 'contabilidad';
    if (this.auth.puedeDocumentarEntregas()) return 'faltan';
    return 'ninguna';
  }

  alternarVistaFacturacion(vista: Exclude<VistaFacturacion, 'ninguna'>): void {
    const nueva = this.vistaFacturacion() === vista ? 'ninguna' : vista;
    this.vistaFacturacion.set(nueva);
    if (nueva === 'ninguna') this.soloPorEntregar.set(true);
    this.soloEntregadas.set(false);
    this.pageIndex.set(0);
  }

  /** Chip de facturación de una entregada (null = no aplica). */
  facturacion(r: RemisionTablero): { texto: string; clase: string; ayuda: string } | null {
    if (r.estado !== 'Entregada' || !r.estadoFacturacion) return null;
    switch (r.estadoFacturacion) {
      case 'EnFacturacion':
        return { texto: 'En contabilidad', clase: 'entregas__chip--contabilidad', ayuda: 'Enviada a contabilidad para facturar' };
      case 'Devuelta':
        return { texto: 'Devuelta', clase: 'entregas__chip--devuelta', ayuda: 'Contabilidad la devolvió: hay que corregir y volver a enviar' };
      case 'Facturada':
        return { texto: 'Facturada', clase: 'alistamiento__chip--completa', ayuda: 'Ya se facturó' };
      default:
        return r.documentosFaltantes > 0
          ? {
              texto: `Faltan ${r.documentosFaltantes} doc.`,
              clase: 'entregas__chip--faltan',
              ayuda: 'Faltan documentos obligatorios para facturar'
            }
          : { texto: 'Lista para enviar', clase: 'entregas__chip--faltan', ayuda: 'Tiene los documentos; falta enviarla a contabilidad' };
    }
  }

  /** Lo que le toca al que consulta: el emisor ve resaltadas las suyas pendientes; el contable, las que le llegaron. */
  meToca(r: RemisionTablero): boolean {
    if (r.estado !== 'Entregada') return false;
    if (r.esMia && (r.estadoFacturacion === 'PendienteDocumentos' || r.estadoFacturacion === 'Devuelta')) return true;
    return this.auth.puedeFacturarEntregas() && r.estadoFacturacion === 'EnFacturacion';
  }

  get paginadas(): RemisionTablero[] {
    const inicio = this.pageIndex() * this.pageSize();
    return this.filtradas.slice(inicio, inicio + this.pageSize());
  }

  get hayAtrasadas(): boolean {
    return this.remisiones().some((r) => r.enAlerta);
  }

  get cantidadSeleccion(): number {
    return this.seleccion().size;
  }

  ngOnInit(): void {
    this.cargar();
    this.temporizadorCarga = setInterval(() => this.cargar(), MS_ENTRE_CHEQUEOS);
    this.temporizadorBeep = setInterval(() => {
      if (this.sonidoActivo() && this.hayAtrasadas) this.reproducirBeep();
    }, MS_ENTRE_BEEPS);
  }

  ngOnDestroy(): void {
    if (this.temporizadorCarga) clearInterval(this.temporizadorCarga);
    if (this.temporizadorBeep) clearInterval(this.temporizadorBeep);
  }

  cargar(): void {
    // Solo la primera carga muestra la barra: el refresco de cada minuto no debe "parpadear" la tabla.
    if (this.primeraCarga) this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (remisiones) => {
        this.ahoraCarga.set(Date.now());
        this.remisiones.set(remisiones);
        this.cargando.set(false);
        this.primeraCarga = false;
        const vigentes = new Set(remisiones.map((r) => r.id));
        this.seleccion.set(new Set([...this.seleccion()].filter((id) => vigentes.has(id))));
      },
      error: () => this.cargando.set(false)
    });
  }

  // ---- Estado ----

  nivelEstado(r: RemisionTablero): NivelEstadoRemision {
    if (r.enAlerta) return 'atrasada';
    if (r.estado === 'Entregada') return r.verificacionQR && r.verificacionQR !== 'Coincide' ? 'revisar' : 'entregada';
    return 'normal';
  }

  private msRecienEntregada(r: RemisionTablero): number {
    if (r.estado !== 'Entregada' || !r.fechaEntrega) return 0;
    const ms = new Date(r.fechaEntrega).getTime();
    return this.ahoraCarga() - ms <= MS_RECIEN_ENTREGADA ? ms : 0;
  }

  haceCuantoSeEntrego(r: RemisionTablero): string | null {
    const ms = this.msRecienEntregada(r);
    if (!ms) return null;
    const minutos = Math.max(0, Math.floor((this.ahoraCarga() - ms) / 60000));
    if (minutos < 1) return 'hace un momento';
    if (minutos < 60) return `hace ${minutos} min`;
    return `hace ${Math.floor(minutos / 60)} h`;
  }

  horasDesde(fecha: string): number {
    return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60));
  }

  // ---- Selección e impresión ----

  estaSeleccionada(r: RemisionTablero): boolean {
    return this.seleccion().has(r.id);
  }

  alternarSeleccion(r: RemisionTablero, marcado: boolean): void {
    const s = new Set(this.seleccion());
    if (marcado) s.add(r.id);
    else s.delete(r.id);
    this.seleccion.set(s);
  }

  get paginaSeleccionada(): boolean {
    const p = this.paginadas;
    return p.length > 0 && p.every((r) => this.seleccion().has(r.id));
  }

  get paginaParcial(): boolean {
    const p = this.paginadas;
    return p.some((r) => this.seleccion().has(r.id)) && !this.paginaSeleccionada;
  }

  alternarPagina(marcado: boolean): void {
    const s = new Set(this.seleccion());
    for (const r of this.paginadas) {
      if (marcado) s.add(r.id);
      else s.delete(r.id);
    }
    this.seleccion.set(s);
  }

  imprimir(ids: number[]): void {
    if (ids.length > 0) abrirPdfEnPestana(this.servicio.pdf(ids), this.snackBar);
  }

  imprimirSeleccion(): void {
    // En el orden en que aparecen en la tabla.
    const ids = this.filtradas.filter((r) => this.seleccion().has(r.id)).map((r) => r.id);
    this.imprimir(ids);
  }

  // ---- Filtros y vistas (igual que Alistamiento) ----

  opcionesCampoEntregaFiltradas(): string[] {
    const texto = this.filtroCampoEntrega().trim().toLowerCase();
    return texto ? this.opcionesCampoEntrega().filter((op) => op.toLowerCase().includes(texto)) : this.opcionesCampoEntrega();
  }

  opcionesElaboradoPorFiltradas(): string[] {
    const texto = this.filtroElaboradoPor().trim().toLowerCase();
    return texto ? this.opcionesElaboradoPor().filter((op) => op.toLowerCase().includes(texto)) : this.opcionesElaboradoPor();
  }

  actualizarFiltroCampoEntrega(valor: string): void {
    this.filtroCampoEntrega.set(valor);
    this.pageIndex.set(0);
  }

  actualizarFiltroElaboradoPor(valor: string): void {
    this.filtroElaboradoPor.set(valor);
    this.pageIndex.set(0);
  }

  actualizarFiltroNumero(valor: string): void {
    this.filtroNumero.set(valor);
    this.pageIndex.set(0);
  }

  private valoresUnicos(selector: (r: RemisionTablero) => string | null): string[] {
    const set = new Set<string>();
    for (const r of this.remisiones()) {
      const valor = selector(r);
      if (valor) set.add(valor);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  cambiarPagina(evento: PageEvent): void {
    this.pageIndex.set(evento.pageIndex);
    this.pageSize.set(evento.pageSize);
    try {
      localStorage.setItem(CLAVE_PAGE_SIZE, String(evento.pageSize));
    } catch {
      // Navegación privada: no se recuerda la preferencia, no es crítico.
    }
  }

  alternarFiltro(): void {
    // Saliendo de una vista de facturación se vuelve a "Viendo todas".
    if (this.vistaFacturacion() !== 'ninguna') {
      this.vistaFacturacion.set('ninguna');
      this.soloPorEntregar.set(false);
    } else {
      this.soloPorEntregar.set(!this.soloPorEntregar());
    }
    this.pageIndex.set(0);
  }

  alternarEntregadas(): void {
    this.vistaFacturacion.set('ninguna');
    this.soloEntregadas.set(!this.soloEntregadas());
    this.pageIndex.set(0);
  }

  // ---- Sonido (igual que Alistamiento) ----

  alternarSonido(): void {
    const nuevoValor = !this.sonidoActivo();
    this.sonidoActivo.set(nuevoValor);
    try {
      localStorage.setItem(CLAVE_SONIDO, nuevoValor ? '1' : '0');
    } catch {
      // Navegación privada: no se recuerda la preferencia, no es crítico.
    }
    if (nuevoValor) this.reproducirBeep();
  }

  private reproducirBeep(): void {
    try {
      this.audioContext ??= new AudioContext();
      const contexto = this.audioContext;
      const oscilador = contexto.createOscillator();
      const ganancia = contexto.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(880, contexto.currentTime);
      ganancia.gain.setValueAtTime(0.15, contexto.currentTime);
      ganancia.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + 0.4);
      oscilador.connect(ganancia).connect(contexto.destination);
      oscilador.start();
      oscilador.stop(contexto.currentTime + 0.4);
    } catch {
      // El navegador bloquea el audio sin interacción previa — no hay nada más que hacer.
    }
  }

  private leerPreferenciaSonido(): boolean {
    try {
      return localStorage.getItem(CLAVE_SONIDO) === '1';
    } catch {
      return false;
    }
  }

  private leerPreferenciaPageSize(): number {
    try {
      const guardado = Number(localStorage.getItem(CLAVE_PAGE_SIZE));
      return [10, 25, 50].includes(guardado) ? guardado : 10;
    } catch {
      return 10;
    }
  }
}
