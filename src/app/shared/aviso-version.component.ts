import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { VersionService } from '../core/services/version.service';

/** Franja fija arriba cuando el servidor ya tiene una versión más nueva que la que corre esta pestaña. */
@Component({
  selector: 'app-aviso-version',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (version.versionNueva(); as nueva) {
      <div class="aviso" role="alert">
        <mat-icon>system_update</mat-icon>
        <span class="aviso__texto">
          Hay una versión nueva del sistema (v{{ nueva }}; estás en v{{ version.versionActual }}). Se actualiza sola al cambiar de
          pantalla, o actualizá ahora.
        </span>
        <button mat-flat-button class="aviso__boton" (click)="version.recargar()">Actualizar ahora</button>
      </div>
    }
  `,
  styles: `
    .aviso {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2000;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
      padding: calc(0.5rem + env(safe-area-inset-top, 0px)) 1rem 0.5rem;
      background: #fff3c4;
      color: #4a3700;
      box-shadow: 0 2px 6px rgb(0 0 0 / 15%);
      font-size: 0.9rem;
    }
    .aviso__texto {
      flex: 1 1 16rem;
      min-width: 0;
    }
    .aviso__boton {
      --mdc-filled-button-container-color: #4a3700;
      --mdc-filled-button-label-text-color: #fff;
      --mat-button-filled-container-color: #4a3700;
      --mat-button-filled-label-text-color: #fff;
    }
  `
})
export class AvisoVersionComponent {
  readonly version = inject(VersionService);
}
