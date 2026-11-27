import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { CajaService } from '../../core/services/caja.service';
import { CajaResumen } from '../../core/models/caja.model';

// Cajas menores (2026-11-27): las cajas donde el usuario es administrador o girador. Con una sola, entra directo.
@Component({
  selector: 'app-cajas-list',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, MatIconModule],
  template: `
    <section class="cajas">
      <header>
        <h2>Cajas menores</h2>
        <p class="cajas__tenue">Efectivo de cada empresa: giros, legalizaciones, vueltas y recargas.</p>
      </header>

      @if (error()) {
        <p class="cajas__error">{{ error() }}</p>
      }

      <div class="cajas__lista">
        @for (c of cajas(); track c.id) {
          <a class="caja" [routerLink]="['/cajas', c.id]">
            <div class="caja__titulo">
              <mat-icon>savings</mat-icon>
              <span>{{ c.nombre }}</span>
              <span class="caja__rol">{{ c.esAdministrador ? 'Administrador' : 'Girador' }}</span>
            </div>
            <div class="caja__saldo" [class.caja__saldo--bajo]="c.saldoBajo">
              {{ c.saldoActual | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
            </div>
            <div class="caja__tenue">en efectivo · tope {{ c.tope | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</div>
            <div class="caja__pendientes">
              <span>{{ c.girosAbiertos }} por legalizar</span>
              <span>{{ c.girosConVueltaPendiente }} con vuelta pendiente</span>
            </div>
          </a>
        } @empty {
          @if (!cargando()) {
            <p class="cajas__tenue">No tienes ninguna caja asignada.</p>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .cajas { display: flex; flex-direction: column; gap: 1rem; }
    h2 { margin: 0; font: var(--mat-sys-headline-small); }
    .cajas__tenue, .caja__tenue { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .caja__tenue { font-size: 0.8rem; }
    .cajas__error { color: var(--mat-sys-error); margin: 0; }
    .cajas__lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
    .caja {
      display: flex; flex-direction: column; gap: 0.35rem; padding: 1rem 1.25rem;
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px;
      color: inherit; text-decoration: none; background: var(--mat-sys-surface-container-low);
    }
    .caja:hover, .caja:focus-visible { background: var(--mat-sys-surface-container); outline: none; }
    .caja__titulo { display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
    .caja__rol {
      margin-left: auto; font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px;
      background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container);
    }
    .caja__saldo { font: var(--mat-sys-headline-medium); font-variant-numeric: tabular-nums; }
    .caja__saldo--bajo { color: var(--mat-sys-error); }
    .caja__pendientes { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); }
  `
})
export class CajasListComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly router = inject(Router);

  readonly cajas = signal<CajaResumen[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.servicio.listar().subscribe({
      next: (cajas) => {
        this.cargando.set(false);
        if (cajas.length === 1) {
          this.router.navigate(['/cajas', cajas[0].id], { replaceUrl: true });
          return;
        }
        this.cajas.set(cajas);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(e.error?.mensaje ?? 'No se pudieron cargar las cajas.');
      }
    });
  }
}
