import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CotizacionService } from '../../../core/services/cotizacion.service';
import { ConfiguracionDocumentosWO } from '../../../core/models/cotizacion.model';

const PREFIJO_PRUEBA = 'PRUEB';

/**
 * Administración → Config. de cotizaciones (2026-11-26): prefijo con el que el Sincronizador crea las
 * cotizaciones del portal en World Office y el interruptor para crearlas o no — igual que el prefijo
 * del CE en "Config. de pagos". El Sincronizador lo lee de la Api en cada corrida.
 */
@Component({
  selector: 'app-configuracion-cotizaciones',
  standalone: true,
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule],
  template: `
    <div class="cfg">
      <h2>Configuración de cotizaciones</h2>

      @if (guardada(); as g) {
        <section class="cfg__tarjeta">
          <div class="cfg__cabeza">
            <mat-icon>request_quote</mat-icon>
            <div>
              <h3>Cotizaciones en World Office</h3>
              <p>Cuando una vendedora envía una cotización desde el portal, el Sincronizador la crea en World Office con este prefijo.</p>
            </div>
          </div>

          <div class="cfg__estado" [class.cfg__estado--encendido]="g.crearCotizacionesEnWorldOffice">
            <mat-icon>{{ g.crearCotizacionesEnWorldOffice ? 'check_circle' : 'pause_circle' }}</mat-icon>
            <span>
              Hoy: <strong>{{ g.crearCotizacionesEnWorldOffice ? 'se crean cotizaciones' : 'NO se crean cotizaciones' }}</strong> · prefijo
              <strong>{{ g.prefijoCotizacion }}</strong>
              @if (g.prefijoCotizacion === prefijoPrueba) {
                (de prueba)
              }
              @if (g.cotizacionesEnCola > 0) {
                · {{ g.cotizacionesEnCola }} esperando a crearse
              }
            </span>
          </div>

          <mat-form-field appearance="outline" class="cfg__prefijo">
            <mat-label>Prefijo de la cotización</mat-label>
            <input matInput [ngModel]="prefijo()" (ngModelChange)="prefijo.set($event.toUpperCase())" maxlength="20" autocomplete="off" style="text-transform: uppercase" />
            <mat-hint>Producción: COT · Pruebas: {{ prefijoPrueba }}</mat-hint>
          </mat-form-field>
          @if (prefijo() && !prefijoValido()) {
            <span class="cfg__error">Solo letras, números y guion (por ejemplo COT).</span>
          }

          <mat-slide-toggle [ngModel]="crear()" (ngModelChange)="crear.set($event)">Crear cotizaciones en World Office</mat-slide-toggle>

          @if (crear() && hayCambios()) {
            <div class="cfg__aviso">
              <mat-icon>warning</mat-icon>
              <span>
                Al guardar, el Sincronizador creará cotizaciones
                <strong>{{ prefijo() === prefijoPrueba ? 'de prueba' : 'REALES' }}</strong> con el prefijo
                <strong>{{ prefijo() }}</strong> en su próxima corrida (cerca de un minuto). Si ese prefijo no tiene ninguna
                cotización en World Office, no se crea nada.
              </span>
            </div>
          }

          <div class="cfg__pie">
            @if (g.fechaActualizacion) {
              <span class="cfg__auditoria">Último cambio: {{ g.actualizadoPor }} · {{ g.fechaActualizacion | date: 'dd/MM/yyyy h:mm a' }}</span>
            } @else {
              <span></span>
            }
            <button mat-flat-button (click)="guardar()" [disabled]="!hayCambios() || !prefijoValido() || guardando()">
              <mat-icon>save</mat-icon>
              Guardar
            </button>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .cfg { max-width: 44rem; display: flex; flex-direction: column; gap: 1rem; }
    .cfg h2 { margin: 0; }
    .cfg__tarjeta {
      display: flex; flex-direction: column; gap: 1.25rem; padding: 1.5rem;
      border-radius: 12px; border: 1px solid var(--mat-sys-outline-variant); background: var(--mat-sys-surface);
    }
    .cfg__cabeza { display: flex; gap: 0.75rem; align-items: flex-start; }
    .cfg__cabeza mat-icon { color: var(--mat-sys-primary); margin-top: 0.15rem; }
    .cfg__cabeza h3 { margin: 0 0 0.25rem; font: var(--mat-sys-title-medium); }
    .cfg__cabeza p { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .cfg__estado {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 8px;
      background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface);
    }
    .cfg__estado--encendido { background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .cfg__prefijo { width: 100%; max-width: 16rem; }
    .cfg__error { color: var(--mat-sys-error); font-size: 0.875rem; margin-top: -1rem; }
    .cfg__aviso {
      display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.75rem 1rem; border-radius: 8px;
      background: #fff3c4; color: #5c4400;
    }
    .cfg__pie { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
    .cfg__auditoria { color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; }
  `
})
export class ConfiguracionCotizacionesComponent implements OnInit {
  private readonly servicio = inject(CotizacionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly prefijoPrueba = PREFIJO_PRUEBA;
  readonly guardando = signal(false);
  readonly guardada = signal<ConfiguracionDocumentosWO | null>(null);
  readonly prefijo = signal('');
  readonly crear = signal(false);

  readonly prefijoValido = computed(() => /^[A-Z0-9-]{1,20}$/.test(this.prefijo().trim()));
  readonly hayCambios = computed(() => {
    const g = this.guardada();
    return !!g && (g.prefijoCotizacion !== this.prefijo().trim() || g.crearCotizacionesEnWorldOffice !== this.crear());
  });

  ngOnInit(): void {
    this.servicio.configuracion().subscribe({
      next: (c) => this.aplicar(c),
      error: (e: HttpErrorResponse) => this.snackBar.open(e.error?.mensaje ?? 'No se pudo cargar la configuración.', 'Cerrar', { duration: 5000 })
    });
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.actualizarConfiguracion({ prefijoCotizacion: this.prefijo().trim(), crearCotizacionesEnWorldOffice: this.crear() }).subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.aplicar(c);
        this.snackBar.open('Configuración guardada.', 'Cerrar', { duration: 3000 });
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.snackBar.open(e.error?.mensaje ?? 'No se pudo guardar la configuración.', 'Cerrar', { duration: 5000 });
      }
    });
  }

  private aplicar(c: ConfiguracionDocumentosWO): void {
    this.guardada.set(c);
    this.prefijo.set(c.prefijoCotizacion);
    this.crear.set(c.crearCotizacionesEnWorldOffice);
  }
}
