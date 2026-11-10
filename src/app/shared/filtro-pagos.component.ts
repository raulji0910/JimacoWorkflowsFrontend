import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FiltroPagos } from '../core/models/cuentas-por-pagar.model';

export type PeriodoPagos = 'mes' | 'mesPasado' | '3meses' | 'todo' | 'rango';

export interface ValorFiltroPagos {
  periodo: PeriodoPagos;
  desde: string;
  hasta: string;
  buscar: string;
}

/** "yyyy-MM-dd" en Colombia (UTC−5). */
function diaColombia(d: Date): string {
  return new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function rangoPeriodo(periodo: PeriodoPagos): { desde: string; hasta: string } {
  const hoy = diaColombia(new Date());
  const [a, m] = hoy.split('-').map(Number);
  const primero = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}-01`;
  switch (periodo) {
    case 'mes':
      return { desde: primero(a, m), hasta: hoy };
    case 'mesPasado': {
      const [pa, pm] = m === 1 ? [a - 1, 12] : [a, m - 1];
      const ultimo = new Date(Date.UTC(a, m - 1, 0)).toISOString().slice(0, 10); // día 0 del mes actual = último del pasado
      return { desde: primero(pa, pm), hasta: ultimo };
    }
    case '3meses':
      return { desde: diaColombia(new Date(Date.now() - 90 * 86400 * 1000)), hasta: hoy };
    default:
      return { desde: '', hasta: '' };
  }
}

export function filtroInicial(periodo: PeriodoPagos = '3meses'): ValorFiltroPagos {
  return { periodo, ...rangoPeriodo(periodo), buscar: '' };
}

/** Lo que va al backend (sin el período, que solo es de la pantalla). */
export function aFiltroApi(v: ValorFiltroPagos, pagina: number, extra: Partial<FiltroPagos> = {}): FiltroPagos {
  return { desde: v.desde || null, hasta: v.hasta || null, buscar: v.buscar.trim() || null, pagina, ...extra };
}

/**
 * Barra de filtros de las listas de pagos (2026-11-10): buscador por proveedor o NIT y período.
 * No carga nada: avisa con (cambio) y la pantalla pide la página 1 con el filtro nuevo.
 */
@Component({
  selector: 'app-filtro-pagos',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="fp">
      <mat-form-field appearance="outline" class="fp__buscar" subscriptSizing="dynamic">
        <mat-label>Buscar proveedor o NIT</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [ngModel]="v.buscar" (ngModelChange)="escribir($event)" autocomplete="off" />
        @if (v.buscar) {
          <button matSuffix mat-icon-button type="button" (click)="limpiar()" aria-label="Limpiar búsqueda">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="fp__periodo" subscriptSizing="dynamic">
        <mat-label>{{ etiquetaFecha }}</mat-label>
        <mat-select [ngModel]="v.periodo" (ngModelChange)="elegirPeriodo($event)">
          <mat-option value="mes">Este mes</mat-option>
          <mat-option value="mesPasado">Mes pasado</mat-option>
          <mat-option value="3meses">Últimos 3 meses</mat-option>
          <mat-option value="todo">Todo</mat-option>
          <mat-option value="rango">Elegir fechas…</mat-option>
        </mat-select>
      </mat-form-field>

      @if (v.periodo === 'rango') {
        <mat-form-field appearance="outline" class="fp__fecha" subscriptSizing="dynamic">
          <mat-label>Desde</mat-label>
          <input matInput type="date" [ngModel]="v.desde" (ngModelChange)="fecha('desde', $event)" [max]="v.hasta || null" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="fp__fecha" subscriptSizing="dynamic">
          <mat-label>Hasta</mat-label>
          <input matInput type="date" [ngModel]="v.hasta" (ngModelChange)="fecha('hasta', $event)" [min]="v.desde || null" />
        </mat-form-field>
      }
    </div>
  `,
  styles: [`
    .fp { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin: 0.75rem 0; max-width: 52rem; }
    .fp__buscar { flex: 1 1 16rem; min-width: 0; }
    .fp__periodo { flex: 0 1 12rem; }
    .fp__fecha { flex: 0 1 10rem; }
    @media (max-width: 600px) {
      .fp__periodo, .fp__fecha { flex: 1 1 9rem; }
    }
  `]
})
export class FiltroPagosComponent implements OnDestroy {
  @Input() etiquetaFecha = 'Período';
  @Input() set valor(v: ValorFiltroPagos) {
    this.v = { ...v };
  }
  @Output() readonly cambio = new EventEmitter<ValorFiltroPagos>();

  v: ValorFiltroPagos = filtroInicial();
  private espera?: ReturnType<typeof setTimeout>;

  escribir(texto: string): void {
    this.v = { ...this.v, buscar: texto };
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.emitir(), 350);
  }

  limpiar(): void {
    clearTimeout(this.espera);
    this.v = { ...this.v, buscar: '' };
    this.emitir();
  }

  elegirPeriodo(periodo: PeriodoPagos): void {
    // "Elegir fechas" arranca con el rango que se estaba viendo, para ajustarlo.
    this.v = periodo === 'rango'
      ? { ...this.v, periodo, ...(this.v.desde || this.v.hasta ? {} : rangoPeriodo('3meses')) }
      : { ...this.v, periodo, ...rangoPeriodo(periodo) };
    this.emitir();
  }

  fecha(cual: 'desde' | 'hasta', valor: string): void {
    this.v = { ...this.v, [cual]: valor ?? '' };
    this.emitir();
  }

  ngOnDestroy(): void {
    clearTimeout(this.espera);
  }

  private emitir(): void {
    this.cambio.emit({ ...this.v });
  }
}
