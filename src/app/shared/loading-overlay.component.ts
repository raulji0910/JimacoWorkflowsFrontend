import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoadingService } from '../core/services/loading.service';

/**
 * Rueda de espera de pantalla completa, montada una única vez en app.html. Espera un
 * poco (RETRASO_MS) antes de mostrarse para que una respuesta casi instantánea no la haga
 * parpadear — pero se oculta de inmediato apenas la última petición en vuelo termina.
 */
const RETRASO_MS = 150;

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

    this.destroyRef.onDestroy(() => this.limpiarTemporizador());
  }

  private limpiarTemporizador(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }
}
