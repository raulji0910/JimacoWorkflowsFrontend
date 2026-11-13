import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { HojaAlistamientoService } from '../../core/services/hoja-alistamiento.service';
import { HojaAlistamientoResumen } from '../../core/models/hoja-alistamiento.model';
import { AuthService } from '../../core/services/auth.service';

const CLAVE_SONIDO = 'aprobaciones.alistamiento.sonido';
const CLAVE_PAGE_SIZE = 'aprobaciones.alistamiento.pageSize';
const MS_ENTRE_CHEQUEOS = 60_000;
// Recién completadas (2026-11-11): las que pasaron a completas en esta ventana suben arriba de la
// grilla y llevan la marca "Completada hace …" — para que Logística no las pierda.
const MS_RECIEN_COMPLETADA = 24 * 60 * 60 * 1000;
const MS_ENTRE_BEEPS = 2_000;
const UMBRAL_AVANZADA = 0.8;

export type NivelEstadoHoja = 'completa' | 'atrasada' | 'avanzada' | 'normal';

/**
 * Dashboard de Hojas de Alistamiento (2026-09-28) — Transporte ve qué le falta reunir, Gerencia
 * Comercial supervisa el atraso; ambos entran por acá. El pulso rojo y el sonido son para las dos
 * (pedido explícito del usuario) — el sonido exige que la persona lo haya activado con un clic
 * primero (los navegadores bloquean audio sin interacción previa), y solo suena mientras esta
 * pestaña está abierta — no es una notificación real en segundo plano. Mientras haya AL MENOS UNA
 * hoja atrasada, el beep se repite cada 2 segundos (pedido explícito) — no es un aviso único al
 * momento de atrasarse, es constante hasta que se resuelve.
 */
@Component({
  selector: 'app-alistamiento-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
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
    MatAutocompleteModule
  ],
  templateUrl: './alistamiento-dashboard.component.html',
  styleUrl: './alistamiento-dashboard.component.scss'
})
export class AlistamientoDashboardComponent implements OnInit, OnDestroy {
  private readonly hojaService = inject(HojaAlistamientoService);
  private readonly authService = inject(AuthService);
  // Empresa del dashboard (2026-11-13): la ruta /alistamiento-ferrealiados trae data.empresa.
  readonly empresa: 'Jimaco' | 'Ferrealiados' = inject(ActivatedRoute).snapshot.data['empresa'] === 'Ferrealiados' ? 'Ferrealiados' : 'Jimaco';
  readonly rutaBase = this.empresa === 'Ferrealiados' ? '/alistamiento-ferrealiados' : '/alistamiento';

  // Columna "OC" quitada (2026-10-16, pedido explícito del usuario) — las OC ligadas ya se ven
  // completas al entrar a la Hoja (botones "Ver OC ..." en el detalle), así que repetirlas acá
  // solo apretaba la tabla sin aportar nada; mejora el responsive.
  readonly columnas = ['hoja', 'cliente', 'campoEntrega', 'elaboradoPor', 'progreso', 'antiguedad', 'total', 'estado', 'acciones'];
  readonly hojas = signal<HojaAlistamientoResumen[]>([]);
  // "Ahora" fijado en cada carga (cada minuto) — la marca "hace …" y el orden se recalculan con los
  // datos que ya se traen, sin pedir nada extra al servidor.
  private readonly ahoraCarga = signal(Date.now());
  readonly cargando = signal(false);
  readonly soloIncompletas = signal(true);
  // Reemplaza al viejo filtro "solo remisionadas" (2026-10-14) — "Ver completas" ya cubre ese caso
  // (una Hoja completa puede estar remisionada o no, ver filtradas()); este filtro queda "siempre
  // aparte", igual que el anterior: al activarlo, ignora el de solo-incompletas.
  readonly soloCompletas = signal(false);
  readonly sonidoActivo = signal(this.leerPreferenciaSonido());
  readonly pageIndex = signal(0);
  // Tamaño de página recordado por navegador (2026-10-16, pedido explícito) — persiste entre
  // visitas igual que la preferencia de sonido; el índice de página NO se guarda, siempre arranca
  // en la primera.
  readonly pageSize = signal(this.leerPreferenciaPageSize());
  readonly pageSizeOptions = [10, 25, 50];

  // Filtros de texto predictivo (autocompletar con los valores que ya aparecen en las hojas
  // cargadas) — pedido explícito del usuario (2026-09-30), viendo la Hoja de Alistamiento real
  // impresa: "CAMPO ENTREGA - CIUDAD - DIRECCION" y "ELABORADO POR" son campos reales de esa hoja.
  readonly filtroCampoEntrega = signal('');
  readonly filtroElaboradoPor = signal('');
  readonly filtroNumeroHoja = signal('');

  readonly opcionesCampoEntrega = computed(() => this.valoresUnicos((h) => h.campoEntrega));
  readonly opcionesElaboradoPor = computed(() => this.valoresUnicos((h) => h.elaboradoPor));

  readonly puedeGestionar = this.authService.puedeGestionarAlistamientoDe(this.empresa);

  private audioContext: AudioContext | null = null;
  private temporizadorCarga: ReturnType<typeof setInterval> | null = null;
  private temporizadorBeep: ReturnType<typeof setInterval> | null = null;

  get filtradas(): HojaAlistamientoResumen[] {
    // Completa + Remisionada vuelve a verse igual que cualquier otra Hoja completa (2026-10-23,
    // pedido explícito del usuario revirtiendo el ocultamiento del 2026-10-14) — oculta en la vista
    // por defecto (solo incompletas), visible con "Ver completas".
    const todas = this.hojas();
    const porCompletas = this.soloCompletas() ? todas.filter((h) => h.completa) : todas;
    const porIncompleta =
      this.soloIncompletas() && !this.soloCompletas() ? porCompletas.filter((h) => !h.completa) : porCompletas;
    const textoCampoEntrega = this.filtroCampoEntrega().trim().toLowerCase();
    const textoElaboradoPor = this.filtroElaboradoPor().trim().toLowerCase();
    const textoNumeroHoja = this.filtroNumeroHoja().trim().toLowerCase();
    const filtradas = porIncompleta.filter(
      (h) =>
        (!textoCampoEntrega || (h.campoEntrega ?? '').toLowerCase().includes(textoCampoEntrega)) &&
        (!textoElaboradoPor || (h.elaboradoPor ?? '').toLowerCase().includes(textoElaboradoPor)) &&
        (!textoNumeroHoja || h.numeroReferenciaHoja.toLowerCase().includes(textoNumeroHoja))
    );

    // La vista por defecto (solo incompletas) no cambia: ahí no hay completas.
    if (this.soloIncompletas() && !this.soloCompletas()) return filtradas;

    // "Viendo todas" y "Ver completas": las completadas en las últimas 24 h van primero (la más
    // reciente arriba); el resto queda en el orden de siempre (sort estable).
    return [...filtradas].sort((a, b) => this.msRecienCompletada(b) - this.msRecienCompletada(a));
  }

  /** Momento en que se completó si fue en las últimas 24 h; 0 si no (no sube). */
  private msRecienCompletada(h: HojaAlistamientoResumen): number {
    if (!h.completa || !h.fechaCompletada) return 0;
    const ms = new Date(h.fechaCompletada).getTime();
    return this.ahoraCarga() - ms <= MS_RECIEN_COMPLETADA ? ms : 0;
  }

  /** "hace 5 min" / "hace 3 h" para la marca — null si no es reciente. */
  haceCuantoSeCompleto(h: HojaAlistamientoResumen): string | null {
    const ms = this.msRecienCompletada(h);
    if (!ms) return null;
    const minutos = Math.max(0, Math.floor((this.ahoraCarga() - ms) / 60000));
    if (minutos < 1) return 'hace un momento';
    if (minutos < 60) return `hace ${minutos} min`;
    return `hace ${Math.floor(minutos / 60)} h`;
  }

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

  actualizarFiltroNumeroHoja(valor: string): void {
    this.filtroNumeroHoja.set(valor);
    this.pageIndex.set(0);
  }

  private valoresUnicos(selector: (h: HojaAlistamientoResumen) => string | null): string[] {
    const set = new Set<string>();
    for (const h of this.hojas()) {
      const valor = selector(h);
      if (valor) set.add(valor);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // Paginación en el cliente — el volumen de hojas es modesto (todo lo que ya se trajo del
  // backend), no hace falta pedir por páginas al servidor.
  get paginadas(): HojaAlistamientoResumen[] {
    const inicio = this.pageIndex() * this.pageSize();
    return this.filtradas.slice(inicio, inicio + this.pageSize());
  }

  cambiarPagina(evento: PageEvent): void {
    this.pageIndex.set(evento.pageIndex);
    this.pageSize.set(evento.pageSize);
    try {
      localStorage.setItem(CLAVE_PAGE_SIZE, String(evento.pageSize));
    } catch {
      // localStorage puede fallar en navegación privada — no es crítico, solo no se recuerda la preferencia.
    }
  }

  alternarFiltro(): void {
    this.soloIncompletas.set(!this.soloIncompletas());
    this.pageIndex.set(0);
  }

  alternarCompletas(): void {
    this.soloCompletas.set(!this.soloCompletas());
    this.pageIndex.set(0);
  }

  get hayAtrasadas(): boolean {
    return this.hojas().some((h) => h.enAlerta);
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
    this.cargando.set(true);
    this.hojaService.listar(this.empresa).subscribe({
      next: (hojas) => {
        this.ahoraCarga.set(Date.now());
        this.hojas.set(hojas);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  horasDesde(fechaCreacion: string): number {
    return Math.floor((Date.now() - new Date(fechaCreacion).getTime()) / (1000 * 60 * 60));
  }

  // Prioridad: atrasada (rojo, lo más urgente) sobre completa, sobre avanzada (amarillo, ≥80% de
  // los ítems) — si está atrasada pero ya casi lista, sigue importando más el atraso.
  nivelEstado(h: HojaAlistamientoResumen): NivelEstadoHoja {
    if (h.enAlerta) return 'atrasada';
    if (h.completa) return 'completa';
    if (h.totalRenglones > 0 && h.renglonesCompletos / h.totalRenglones >= UMBRAL_AVANZADA) return 'avanzada';
    return 'normal';
  }

  alternarSonido(): void {
    const nuevoValor = !this.sonidoActivo();
    this.sonidoActivo.set(nuevoValor);
    try {
      localStorage.setItem(CLAVE_SONIDO, nuevoValor ? '1' : '0');
    } catch {
      // localStorage puede fallar en navegación privada — no es crítico, solo no se recuerda la preferencia.
    }
    // El beep de prueba también sirve para "destrabar" el audio del navegador — reproducir sonido
    // exige un gesto explícito del usuario, y este clic lo es.
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
      // Si el navegador bloquea el audio (no hubo interacción todavía), no hay nada más que hacer acá.
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
