import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingOverlayComponent } from './shared/loading-overlay.component';
import { AvisoVersionComponent } from './shared/aviso-version.component';
import { VersionService } from './core/services/version.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingOverlayComponent, AvisoVersionComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor() {
    // Control de versiones: avisa y recarga cuando se publica una versión nueva (ver VersionService).
    inject(VersionService).iniciar();
  }
}
