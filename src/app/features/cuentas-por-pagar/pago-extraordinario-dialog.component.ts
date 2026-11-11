import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap, catchError } from 'rxjs';
import { CuentasPorPagarService } from '../../core/services/cuentas-por-pagar.service';
import { TerceroWO, TipoGiro } from '../../core/models/cuentas-por-pagar.model';

/**
 * Pago extraordinario (2026-11-09) — giro a un tercero sin factura, cuando Gerencia Comercial lo
 * necesita: tercero (catálogo de World Office), monto, tipo de giro (decide la cuenta del CE) y
 * concepto. Genera un correo solo para este giro; el pagador lo ve en su menú "Pagos".
 */
/** Minúsculas y sin tildes, para buscar "telefono" y encontrar "TELÉFONO". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

@Component({
  selector: 'app-pago-extraordinario-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule],
  template: `
    <header class="pe__cabeza">
      <span class="pe__icono"><mat-icon>add_card</mat-icon></span>
      <div>
        <h2>Pago extraordinario</h2>
        <p>Giro a un tercero que no sale de una factura. Le llega un correo solo para este pago a Gerencia General.</p>
      </div>
      <button mat-icon-button mat-dialog-close class="pe__cerrar" [disabled]="enviando()" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
    </header>

    <mat-dialog-content class="pe">
      <!-- 1. Tercero -->
      <section class="pe__paso">
        <span class="pe__etiqueta"><span class="pe__num">1</span> ¿A quién se le gira?</span>
        @if (tercero(); as t) {
          <div class="pe__tercero">
            <span class="pe__avatar">{{ iniciales(t.nombre) }}</span>
            <div class="pe__tercero-datos">
              <strong>{{ t.nombre }}</strong>
              <span>NIT {{ t.identificacion }}</span>
            </div>
            <button mat-button type="button" (click)="cambiarTercero()" [disabled]="enviando()">Cambiar</button>
          </div>
        } @else {
          <mat-form-field appearance="outline" class="pe__campo" subscriptSizing="dynamic">
            <mat-label>Buscar tercero por nombre o NIT</mat-label>
            <mat-icon matPrefix>person_search</mat-icon>
            <input matInput [matAutocomplete]="auto" [ngModel]="textoTercero" (ngModelChange)="buscar($event)" autocomplete="off" />
            <mat-autocomplete #auto="matAutocomplete" [displayWith]="mostrar" (optionSelected)="elegir($event)">
              @for (t of terceros(); track t.idTerceroWO) {
                <mat-option [value]="t">
                  <span class="pe__opcion">{{ t.nombre }}</span>
                  <span class="pe__opcion-nit">NIT {{ t.identificacion }}</span>
                </mat-option>
              }
            </mat-autocomplete>
            @if (buscando()) {
              <mat-hint>Buscando en World Office…</mat-hint>
            } @else if (sinResultados()) {
              <mat-hint class="pe__aviso">No aparece en World Office. Si es nuevo, primero hay que crearlo en WO.</mat-hint>
            } @else {
              <mat-hint>Escribí al menos 2 letras o números.</mat-hint>
            }
          </mat-form-field>
        }
      </section>

      <!-- 2. Monto y tipo -->
      <section class="pe__paso">
        <span class="pe__etiqueta"><span class="pe__num">2</span> ¿Cuánto y de qué tipo?</span>
        <mat-form-field appearance="outline" class="pe__monto" subscriptSizing="dynamic">
          <mat-label>Monto</mat-label>
          <span matTextPrefix class="pe__signo">$&nbsp;</span>
          <input matInput inputmode="numeric" autocomplete="off" placeholder="0" [ngModel]="montoTexto" (ngModelChange)="escribirMonto($event)" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="pe__campo" subscriptSizing="dynamic">
          <mat-label>Tipo de giro (cuenta)</mat-label>
          <mat-icon matPrefix>account_tree</mat-icon>
          <input matInput [matAutocomplete]="autoGiro" [ngModel]="textoGiro()" (ngModelChange)="buscarGiro($event)"
            placeholder="Código o concepto, ej. 5135 o peajes" autocomplete="off" />
          <mat-autocomplete #autoGiro="matAutocomplete" [displayWith]="mostrarGiro" (optionSelected)="elegirGiro($event)" class="pe__panel-giros">
            @for (g of girosAgrupados(); track g.grupo) {
              <mat-optgroup [label]="g.grupo">
                @for (t of g.tipos; track t.id) {
                  <mat-option [value]="t">{{ t.nombre }}</mat-option>
                }
              </mat-optgroup>
            } @empty {
              <mat-option disabled>Ninguna cuenta coincide con "{{ textoGiro() }}"</mat-option>
            }
          </mat-autocomplete>
          @if (tipoGiro(); as tg) {
            <mat-hint>{{ tg.grupo }}</mat-hint>
          } @else {
            <mat-hint>{{ tiposGiro().length }} cuentas — escribí para filtrar o abrí la lista.</mat-hint>
          }
        </mat-form-field>
      </section>

      <!-- 3. Concepto -->
      <section class="pe__paso">
        <span class="pe__etiqueta"><span class="pe__num">3</span> ¿Para qué es?</span>
        <mat-form-field appearance="outline" class="pe__campo" subscriptSizing="dynamic">
          <mat-label>Concepto</mat-label>
          <textarea matInput rows="2" maxlength="300" [(ngModel)]="concepto"></textarea>
          <mat-hint>Lo ve el pagador y queda en el comprobante.</mat-hint>
          <mat-hint align="end">{{ concepto.length }}/300</mat-hint>
        </mat-form-field>
      </section>

      @if (listo()) {
        <div class="pe__resumen">
          <mat-icon>send</mat-icon>
          <span>
            Se le pide a Gerencia General girar <strong>$ {{ valor | number: '1.0-0' }}</strong>
            a <strong>{{ tercero()?.nombre }}</strong> como <strong>{{ nombreTipo() }}</strong>{{ tipoGiro()?.grupo ? ' (' + tipoGiro()?.grupo + ')' : '' }}.
          </span>
        </div>
      }

      @if (error()) {
        <p class="pe__error"><mat-icon inline>error</mat-icon> {{ error() }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions class="pe__acciones">
      <button mat-button mat-dialog-close [disabled]="enviando()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="!listo() || enviando()" (click)="enviar()">
        <mat-icon>send</mat-icon>
        {{ enviando() ? 'Enviando…' : 'Enviar al pagador' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; }
    .pe__cabeza {
      position: relative;
      display: flex; gap: 0.9rem; align-items: flex-start;
      padding: 1.25rem 3.25rem 1.1rem 1.5rem;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .pe__cabeza h2 { margin: 0; font: var(--mat-sys-title-large); }
    .pe__cabeza p { margin: 0.25rem 0 0; font-size: 0.875rem; opacity: 0.9; line-height: 1.35; }
    .pe__icono {
      flex: 0 0 auto; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 50%;
      background: color-mix(in srgb, var(--mat-sys-on-primary) 18%, transparent);
    }
    .pe__cerrar { position: absolute; top: 0.5rem; right: 0.5rem; color: var(--mat-sys-on-primary); }

    .pe { display: flex; flex-direction: column; gap: 1.1rem; padding-top: 1.25rem !important; }
    .pe__paso { display: flex; flex-direction: column; gap: 0.5rem; }
    .pe__etiqueta { display: flex; align-items: center; gap: 0.5rem; font-weight: 500; color: var(--mat-sys-on-surface); }
    .pe__num {
      display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%; font-size: 0.75rem; font-weight: 600;
      background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container);
    }
    .pe__campo { width: 100%; }
    .pe__aviso { color: var(--mat-sys-error); }
    .pe__opcion { display: block; }
    .pe__opcion-nit { display: block; font-size: 0.8rem; opacity: 0.7; }

    .pe__tercero {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.5rem 0.65rem 0.75rem; border-radius: 12px;
      background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container);
    }
    .pe__avatar {
      flex: 0 0 auto; display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 50%;
      background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); font-weight: 600; letter-spacing: 0.03em;
    }
    .pe__tercero-datos { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
    .pe__tercero-datos strong { overflow-wrap: anywhere; }
    .pe__tercero-datos span { font-size: 0.85rem; opacity: 0.8; }

    .pe__monto { width: min(100%, 16rem); }
    .pe__monto input { font-size: 1.35rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .pe__signo { font-size: 1.35rem; font-weight: 600; color: var(--mat-sys-primary); }

    .pe__resumen {
      display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.75rem 0.9rem; border-radius: 12px; font-size: 0.9rem;
      border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 40%, transparent);
      background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
    }
    .pe__resumen mat-icon { color: var(--mat-sys-primary); flex: 0 0 auto; }
    .pe__error { display: flex; gap: 0.35rem; align-items: center; color: var(--mat-sys-error); margin: 0; }
    .pe__acciones { justify-content: flex-end; gap: 0.5rem; padding: 0.5rem 1.5rem 1.25rem !important; }
  `]
})
export class PagoExtraordinarioDialogComponent implements OnInit {
  private readonly servicio = inject(CuentasPorPagarService);
  private readonly dialogRef = inject(MatDialogRef<PagoExtraordinarioDialogComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busquedas = new Subject<string>();

  readonly tiposGiro = signal<TipoGiro[]>([]);
  // Tipo de giro: buscador con la lista agrupada por grupo del PUC (son ~75 cuentas).
  readonly textoGiro = signal('');
  readonly tipoGiro = signal<TipoGiro | null>(null);
  readonly girosAgrupados = computed(() => {
    const filtro = normalizar(this.textoGiro());
    const elegido = this.tipoGiro();
    const lista = this.tiposGiro().filter(
      (t) => !filtro || (elegido && t.id === elegido.id) || t.codigoCuenta.startsWith(filtro) || normalizar(t.nombre).includes(filtro) || normalizar(t.grupo ?? '').includes(filtro)
    );
    const grupos = new Map<string, TipoGiro[]>();
    for (const t of lista) {
      const g = t.grupo ?? 'Otros';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g)!.push(t);
    }
    return [...grupos.entries()].map(([grupo, tipos]) => ({ grupo, tipos }));
  });
  readonly mostrarGiro = (t: TipoGiro | string | null): string => (typeof t === 'string' ? t : (t?.nombre ?? ''));
  readonly terceros = signal<TerceroWO[]>([]);
  readonly tercero = signal<TerceroWO | null>(null);
  readonly buscando = signal(false);
  readonly sinResultados = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  textoTercero = '';
  readonly mostrar = (t: TerceroWO | string | null): string => (typeof t === 'string' ? t : (t?.nombre ?? ''));
  valor: number | null = null;
  montoTexto = '';
  tipoGiroId: number | null = null;
  concepto = '';

  ngOnInit(): void {
    this.servicio.tiposGiro().subscribe((tipos) => {
      this.tiposGiro.set(tipos);
      if (tipos.length === 1) this.fijarGiro(tipos[0]);
    });

    this.busquedas
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((texto) => {
          if (texto.trim().length < 2) {
            this.buscando.set(false);
            return of([] as TerceroWO[]);
          }
          this.buscando.set(true);
          return this.servicio.buscarTerceros(texto.trim()).pipe(catchError(() => of([] as TerceroWO[])));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((lista) => {
        this.buscando.set(false);
        this.terceros.set(lista);
        this.sinResultados.set(lista.length === 0 && this.textoTercero.trim().length >= 2 && !this.tercero());
      });
  }

  buscar(texto: string | TerceroWO): void {
    if (typeof texto !== 'string') return; // la opción elegida llega por elegir()
    this.textoTercero = texto;
    this.tercero.set(null);
    this.busquedas.next(texto);
  }

  elegir(evento: MatAutocompleteSelectedEvent): void {
    const t = evento.option.value as TerceroWO;
    this.tercero.set(t);
    this.textoTercero = t.nombre;
    this.sinResultados.set(false);
  }

  /** Solo dígitos, mostrados con puntos de miles mientras se escribe ("1.500.000"). */
  escribirMonto(texto: string): void {
    const digitos = (texto ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);
    this.valor = digitos ? Number(digitos) : null;
    this.montoTexto = digitos ? Number(digitos).toLocaleString('es-CO') : '';
  }

  iniciales(nombre: string): string {
    return nombre.split(/\s+/).filter((p) => /[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  cambiarTercero(): void {
    this.tercero.set(null);
    this.textoTercero = '';
    this.terceros.set([]);
  }

  nombreTipo(): string {
    return this.tipoGiro()?.nombre ?? '';
  }

  buscarGiro(texto: string | TipoGiro): void {
    if (typeof texto !== 'string') return; // la opción elegida llega por elegirGiro()
    this.textoGiro.set(texto);
    this.tipoGiro.set(null);
    this.tipoGiroId = null;
  }

  elegirGiro(evento: MatAutocompleteSelectedEvent): void {
    this.fijarGiro(evento.option.value as TipoGiro);
  }

  private fijarGiro(t: TipoGiro): void {
    this.tipoGiro.set(t);
    this.tipoGiroId = t.id;
    this.textoGiro.set(t.nombre);
  }

  listo(): boolean {
    return this.tercero() !== null && (this.valor ?? 0) > 0 && this.tipoGiroId !== null && this.concepto.trim().length > 0;
  }

  enviar(): void {
    const t = this.tercero();
    if (!t || !this.listo()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.servicio
      .crearExtraordinario({ idTerceroWO: t.idTerceroWO, valor: Math.round(this.valor!), tipoGiroId: this.tipoGiroId!, concepto: this.concepto.trim() })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (e: { error?: { mensaje?: string } }) => {
          this.enviando.set(false);
          this.error.set(e.error?.mensaje ?? 'No se pudo crear el pago.');
        }
      });
  }
}
