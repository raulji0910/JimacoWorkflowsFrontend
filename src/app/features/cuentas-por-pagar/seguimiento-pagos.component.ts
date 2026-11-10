import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CuentasPorPagarService } from '../../core/services/cuentas-por-pagar.service';
import {
  ConteoEstado,
  EstadoSeguimientoPago,
  GrupoSeguimiento,
  LineaOrdenPago,
  SeguimientoPago,
  SeguimientoPagina
} from '../../core/models/cuentas-por-pagar.model';
import { FiltroPagosComponent, ValorFiltroPagos, aFiltroApi, filtroInicial } from '../../shared/filtro-pagos.component';
import { PaginadorComponent } from '../../shared/paginador.component';

type Filtro = 'Todos' | EstadoSeguimientoPago;

/**
 * "Seguimiento de pagos" (2026-11-10, pedido real) — Gerencia Comercial ve qué pasó con lo que mandó
 * pagar: qué sigue esperando al pagador, qué se pagó (lote, banco, fecha y comprobante de egreso) y
 * qué se rechazó (quién, cuándo y por qué). Todo se filtra y pagina en el servidor, de a relaciones
 * completas; el detalle de facturas se pide al abrir cada proveedor.
 */
@Component({
  selector: 'app-seguimiento-pagos',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, FiltroPagosComponent, PaginadorComponent],
  template: `
    <div class="seg">
      <a mat-button routerLink="/cuentas-por-pagar">
        <mat-icon>arrow_back</mat-icon>
        Cuentas por pagar
      </a>

      <div class="seg__cabeza">
        <h2>Seguimiento de pagos</h2>
        <button mat-stroked-button (click)="cargar()" [disabled]="cargando()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
      </div>

      <app-filtro-pagos [valor]="filtro()" etiquetaFecha="Enviados a pagar" (cambio)="filtrar($event)" />

      <div class="seg__filtros" role="tablist">
        @for (f of filtros; track f.valor) {
          <button type="button" role="tab" class="seg__filtro" [class.seg__filtro--activo]="estado() === f.valor"
            [attr.aria-selected]="estado() === f.valor" (click)="elegirEstado(f.valor)">
            {{ f.texto }}
            @if (conteo(f.valor); as c) {
              <span class="seg__cuenta">{{ c.cantidad }}</span>
              @if (f.valor !== 'Todos') { <span class="seg__monto">$ {{ c.monto | number: '1.0-0' }}</span> }
            }
          </button>
        }
      </div>

      <div class="seg__barra-carga">
        @if (cargando()) { <mat-progress-bar mode="indeterminate" /> }
      </div>

      @if (pagina(); as pg) {
        @if (!pg.grupos.length) {
          <p class="seg__vacio">
            @if (filtro().buscar) {
              Nada coincide con "{{ filtro().buscar }}" en este período.
            } @else {
              @switch (estado()) {
                @case ('PorPagar') { No hay nada esperando al pagador en este período. }
                @case ('Rechazado') { No hay pagos rechazados en este período. }
                @case ('Pagado') { No hay pagos hechos en este período. }
                @default { No se mandó nada a pagar en este período. }
              }
            }
          </p>
        }

        @for (g of pg.grupos; track g.clave) {
          <section class="seg__grupo">
            <header class="seg__grupo-cabeza">
              <div>
                <h3>{{ titulo(g) }}</h3>
                <span class="seg__sub">{{ g.creadoPor ? g.creadoPor + ' · ' : '' }}{{ g.fecha | date: 'd MMM y' }}</span>
              </div>
              <span class="seg__total">$ {{ total(g) | number: '1.0-0' }}</span>
            </header>
            <ul class="seg__ordenes">
              @for (o of g.ordenes; track o.instanciaDocumentoId) {
                <li class="seg__orden">
                  <div class="seg__fila">
                    <button type="button" class="seg__tercero" (click)="alternar(o)" [attr.aria-expanded]="abierta(o)">
                      <span class="seg__nombre">{{ o.tercero }}</span>
                      <span class="seg__sub">
                        NIT {{ o.identificacion }}
                        <mat-icon inline>{{ abierta(o) ? 'expand_less' : 'expand_more' }}</mat-icon>
                      </span>
                    </button>
                    <span class="seg__valor">$ {{ o.neto | number: '1.0-0' }}</span>
                    <span class="seg__chip" [class]="'seg__chip--' + (o.conflictoCreacionCE ? 'Rechazado' : o.estado)">{{ textoEstado(o) }}</span>
                  </div>

                  @if (o.estado === 'Rechazado') {
                    <p class="seg__rechazo">
                      <mat-icon inline>block</mat-icon>
                      <span>
                        {{ o.rechazadoPor ?? 'El pagador' }} lo rechazó{{ o.fechaRechazo ? ' el ' + (o.fechaRechazo | date: 'd MMM, h:mm a') : '' }}:
                        <strong>{{ o.motivoRechazo }}</strong>
                      </span>
                    </p>
                  } @else if (o.estado === 'Pagado') {
                    <p class="seg__pago">
                      @if (o.numeroLote !== null) {
                        Lote {{ o.numeroLote }} · pagado el {{ o.fechaPago | date: 'd MMM y' }}{{ o.banco ? ' · ' + o.banco : '' }} ·
                      } @else {
                        Pagado antes del menú Pagos ·
                      }
                      @if (o.conflictoCreacionCE) {
                        <span class="seg__error">sin comprobante: {{ o.conflictoCreacionCE }}</span>
                      } @else if (o.numeroCE !== null) {
                        comprobante <strong>{{ o.prefijoCE }} {{ o.numeroCE }}</strong>
                      } @else {
                        comprobante en creación
                      }
                    </p>
                  }

                  @if (abierta(o)) {
                    @let ls = lineas()[o.instanciaDocumentoId];
                    <dl class="seg__lineas">
                      @if (!ls) {
                        <div><dt class="seg__sub">Cargando facturas…</dt><dd></dd></div>
                      } @else {
                        @for (l of ls; track $index) {
                          <div [class.seg__descuento]="l.valor < 0">
                            <dt>{{ l.etiqueta }} @if (l.detalle) { <span class="seg__sub">&nbsp;· {{ l.detalle }}</span> }</dt>
                            <dd>{{ l.valor < 0 ? '− ' : '' }}$ {{ (l.valor < 0 ? -l.valor : l.valor) | number: '1.0-0' }}</dd>
                          </div>
                        }
                      }
                      <div class="seg__pie">
                        <dt><a [routerLink]="['/documentos', o.instanciaDocumentoId]">Ver orden de pago {{ o.numeroReferencia }}</a></dt>
                        <dd></dd>
                      </div>
                    </dl>
                  }
                </li>
              }
            </ul>
          </section>
        }

        <app-paginador [total]="pg.total" [pagina]="pg.pagina" [tamano]="pg.tamanoPagina" [cargando]="cargando()"
          [unidad]="pg.total === 1 ? 'relación' : 'relaciones'" (irA)="irAPagina($event)" />
      }
    </div>
  `,
  styles: [`
    .seg { padding-bottom: 2rem; }
    .seg__cabeza { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; max-width: 52rem; }
    .seg__cabeza h2 { margin: 0.5rem 0 0; }
    .seg__sub { font-size: 0.8rem; opacity: 0.7; }
    .seg__vacio { opacity: 0.75; padding: 1rem 0; }
    .seg__filtros { display: flex; flex-wrap: wrap; gap: 0.5rem; max-width: 52rem; }
    .seg__filtro {
      display: inline-flex; align-items: baseline; gap: 0.4rem; padding: 0.4rem 0.85rem; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--mat-sys-outline-variant); background: var(--mat-sys-surface); color: inherit; font: inherit;
    }
    .seg__filtro--activo { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); border-color: transparent; font-weight: 500; }
    .seg__cuenta { font-weight: 600; font-variant-numeric: tabular-nums; }
    .seg__monto { font-size: 0.8rem; opacity: 0.75; font-variant-numeric: tabular-nums; }
    .seg__barra-carga { height: 4px; max-width: 52rem; margin-top: 0.5rem; }
    .seg__grupo { max-width: 52rem; margin-top: 0.75rem; border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; background: var(--mat-sys-surface); }
    .seg__grupo-cabeza { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .seg__grupo-cabeza h3 { margin: 0; font-size: 1rem; }
    .seg__total { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .seg__ordenes { list-style: none; margin: 0; padding: 0; }
    .seg__orden { border-bottom: 1px solid var(--mat-sys-outline-variant); padding-bottom: 0.25rem; }
    .seg__orden:last-child { border-bottom: none; }
    .seg__fila { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.75rem; }
    .seg__tercero { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; text-align: left;
      background: none; border: 0; padding: 0.2rem 0; color: inherit; font: inherit; cursor: pointer; }
    .seg__nombre { font-weight: 500; overflow-wrap: anywhere; }
    .seg__valor { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 500; }
    .seg__chip { font-size: 0.75rem; padding: 0.1rem 0.55rem; border-radius: 999px; white-space: nowrap; background: var(--mat-sys-surface-container-high); }
    .seg__chip--Pagado { background: color-mix(in srgb, #2e7d32 18%, transparent); }
    .seg__chip--Rechazado { background: color-mix(in srgb, var(--mat-sys-error) 18%, transparent); }
    .seg__chip--PorPagar { background: color-mix(in srgb, var(--mat-sys-tertiary) 16%, transparent); }
    .seg__rechazo, .seg__pago { margin: 0 0.75rem 0.4rem; font-size: 0.875rem; }
    .seg__rechazo { display: flex; gap: 0.35rem; align-items: flex-start; color: var(--mat-sys-error); }
    .seg__rechazo strong { color: var(--mat-sys-on-surface); font-weight: 500; }
    .seg__pago { opacity: 0.85; }
    .seg__error { color: var(--mat-sys-error); }
    .seg__lineas { margin: 0; padding: 0.25rem 1rem 0.5rem 1rem; }
    .seg__lineas > div { display: flex; justify-content: space-between; gap: 1rem; padding: 0.15rem 0; font-size: 0.9rem; }
    .seg__lineas dt { overflow-wrap: anywhere; }
    .seg__lineas dd { margin: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .seg__descuento { color: var(--mat-sys-primary); }
    .seg__pie { font-size: 0.85rem; }
    .seg__pie a { color: var(--mat-sys-primary); }
    @media (max-width: 600px) {
      .seg__fila { flex-wrap: wrap; }
      .seg__tercero { flex-basis: 100%; }
    }
  `]
})
export class SeguimientoPagosComponent implements OnInit {
  private readonly servicio = inject(CuentasPorPagarService);
  private readonly snackBar = inject(MatSnackBar);

  readonly filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'PorPagar', texto: 'Por pagar' },
    { valor: 'Pagado', texto: 'Pagados' },
    { valor: 'Rechazado', texto: 'Rechazados' },
    { valor: 'Todos', texto: 'Todos' }
  ];

  readonly filtro = signal<ValorFiltroPagos>(filtroInicial());
  readonly estado = signal<Filtro>('PorPagar');
  readonly pagina = signal<SeguimientoPagina | null>(null);
  readonly cargando = signal(false);
  readonly abiertas = signal<ReadonlySet<number>>(new Set());
  readonly lineas = signal<Record<number, LineaOrdenPago[]>>({});
  private numeroPagina = 1;
  private pedido = 0;

  ngOnInit(): void {
    this.cargar();
  }

  filtrar(v: ValorFiltroPagos): void {
    this.filtro.set(v);
    this.numeroPagina = 1;
    this.cargar();
  }

  elegirEstado(f: Filtro): void {
    if (f === this.estado()) return;
    this.estado.set(f);
    this.numeroPagina = 1;
    this.cargar();
  }

  irAPagina(n: number): void {
    this.numeroPagina = n;
    this.cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cargar(): void {
    const estado = this.estado();
    const pedido = ++this.pedido; // si el usuario cambia el filtro rápido, solo cuenta la última respuesta
    this.cargando.set(true);
    this.servicio.seguimiento(aFiltroApi(this.filtro(), this.numeroPagina, { estado: estado === 'Todos' ? null : estado })).subscribe({
      next: (p) => {
        if (pedido !== this.pedido) return;
        this.pagina.set(p);
        this.cargando.set(false);
      },
      error: (e: { error?: { mensaje?: string } }) => {
        if (pedido !== this.pedido) return;
        this.cargando.set(false);
        this.snackBar.open(e.error?.mensaje ?? 'No se pudo cargar el seguimiento.', 'Cerrar', { duration: 6000 });
      }
    });
  }

  conteo(f: Filtro): ConteoEstado | null {
    const p = this.pagina();
    if (!p) return null;
    switch (f) {
      case 'PorPagar': return p.porPagar;
      case 'Pagado': return p.pagados;
      case 'Rechazado': return p.rechazados;
      default: return p.todos;
    }
  }

  titulo(g: GrupoSeguimiento): string {
    if (g.numeroRelacion !== null) return `Relación de pagos ${g.numeroRelacion}`;
    return g.esExtraordinario ? 'Pago extraordinario' : 'Orden de pago anterior';
  }

  total(g: GrupoSeguimiento): number {
    return g.ordenes.reduce((s, o) => s + o.neto, 0);
  }

  textoEstado(o: SeguimientoPago): string {
    if (o.conflictoCreacionCE) return 'Revisar';
    switch (o.estado) {
      case 'PorPagar': return 'Por pagar';
      case 'Pagado': return 'Pagado';
      case 'Rechazado': return 'Rechazado';
      default: return 'Otro';
    }
  }

  abierta(o: SeguimientoPago): boolean {
    return this.abiertas().has(o.instanciaDocumentoId);
  }

  alternar(o: SeguimientoPago): void {
    const id = o.instanciaDocumentoId;
    const nuevo = new Set(this.abiertas());
    if (nuevo.has(id)) {
      nuevo.delete(id);
    } else {
      nuevo.add(id);
      if (!this.lineas()[id]) {
        this.servicio.lineasSeguimiento(id).subscribe({
          next: (ls) => this.lineas.update((m) => ({ ...m, [id]: ls })),
          error: () => this.snackBar.open('No se pudieron cargar las facturas.', 'Cerrar', { duration: 5000 })
        });
      }
    }
    this.abiertas.set(nuevo);
  }
}
