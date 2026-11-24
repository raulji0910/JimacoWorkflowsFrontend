import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoadingService } from '../core/services/loading.service';

/**
 * Rueda de espera de pantalla completa, montada una única vez en app.html. Espera un
 * poco (RETRASO_MS) antes de mostrarse para que una respuesta casi instantánea no la haga
 * parpadear — pero se oculta de inmediato apenas la última petición en vuelo termina.
 *
 * 2026-11-24: también cuenta la NAVEGACIÓN entre pantallas. Cada pantalla es un archivo aparte
 * (loadComponent) que se descarga al hacer clic en el menú, y eso no pasa por HttpClient: con la
 * red lenta la pantalla vieja se quedaba quieta 0,5–1 s sin rueda. Desde NavigationStart hasta
 * NavigationEnd/Cancel/Error la rueda queda prendida, y el final se aplaza un ciclo para que
 * empalme con las peticiones que la pantalla nueva dispara al abrir (sin parpadeo).
 */
const RETRASO_MS = 100;

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    @if (visible()) {
      <div class="overlay" role="status" aria-live="polite" aria-label="Procesando">
        <mat-spinner diameter="48" />
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.55);
      backdrop-filter: blur(1px);
    }

    ::ng-deep .overlay .mdc-circular-progress__determinate-circle,
    ::ng-deep .overlay .mdc-circular-progress__indeterminate-circle-graphic {
      stroke: #1c6521;
    }
  `]
})
export class LoadingOverlayComponent {
  private readonly loading = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private navegando = false;

  readonly visible = signal(false);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const activo = this.loading.activo();
      this.limpiarTemporizador();

      if (activo) {
        this.temporizador = setTimeout(() => this.visible.set(true), RETRASO_MS);
      } else {
        this.visible.set(false);
      }
    });

    this.router.events.pipe(takeUntilDestroyed()).subscribe((evento) => {
      if (evento instanceof NavigationStart && !this.navegando) {
        this.navegando = true;
        this.loading.iniciar();
      } else if (
        (evento instanceof NavigationEnd || evento instanceof NavigationCancel || evento instanceof NavigationError) &&
        this.navegando
      ) {
        this.navegando = false;
        setTimeout(() => this.loading.finalizar());
      }
    });

    this.destroyRef.onDestroy(() => this.limpiarTemporizador());
  }

  private limpiarTemporizador(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }
}
