import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CuentasPorPagarService } from '../../../core/services/cuentas-por-pagar.service';
import { ConfiguracionCuentasPorPagar } from '../../../core/models/cuentas-por-pagar.model';

const PREFIJO_PRUEBA = 'CEJ-2';

/**
 * Administración → Config. cuentas por pagar (2026-11-11): prefijo con el que el Sincronizador crea
 * los Comprobantes de Egreso en World Office y el interruptor para crearlos o no. Antes vivía en el
 * appsettings del Sincronizador.
 */
@Component({
  selector: 'app-configuracion-cuentas-por-pagar',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule
  ],
  template: `
    <div class="cfg">
      <h2>Configuración de cuentas por pagar</h2>

      @if (cargando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (guardada(); as g) {
        <section class="cfg__tarjeta">
          <div class="cfg__cabeza">
            <mat-icon>receipt_long</mat-icon>
            <div>
              <h3>Comprobantes de egreso en World Office</h3>
              <p>Cuando el pagador confirma un pago, el Sincronizador crea el CE en World Office con este prefijo.</p>
            </div>
          </div>

          <div class="cfg__estado" [class.cfg__estado--encendido]="g.crearCEEnWorldOffice">
            <mat-icon>{{ g.crearCEEnWorldOffice ? 'check_circle' : 'pause_circle' }}</mat-icon>
            <span>
              Hoy: <strong>{{ g.crearCEEnWorldOffice ? 'se crean CE' : 'NO se crean CE' }}</strong> · prefijo
              <strong>{{ g.prefijoCE }}</strong>
              @if (g.prefijoCE === prefijoPrueba) {
                (de prueba)
              }
            </span>
          </div>

          <mat-form-field appearance="outline" class="cfg__prefijo">
            <mat-label>Prefijo del CE</mat-label>
            <input matInput [ngModel]="prefijo()" (ngModelChange)="prefijo.set($event.toUpperCase())" maxlength="20" autocomplete="off" />
            <mat-hint>Producción: CEJ · Pruebas: {{ prefijoPrueba }}</mat-hint>
          </mat-form-field>
          @if (prefijo() && !prefijoValido()) {
            <span class="cfg__error">Solo letras, números y guion (por ejemplo CEJ).</span>
          }

          <mat-slide-toggle [ngModel]="crearCE()" (ngModelChange)="crearCE.set($event)">Crear CE en World Office</mat-slide-toggle>

          @if (crearCE() && hayCambios()) {
            <div class="cfg__aviso">
              <mat-icon>warning</mat-icon>
              <span>
                Al guardar, el Sincronizador creará comprobantes de egreso
                <strong>{{ prefijo() === prefijoPrueba ? 'de prueba' : 'REALES' }}</strong> con el prefijo
                <strong>{{ prefijo() }}</strong> en su próxima corrida. Si ese prefijo no tiene ningún CE en World Office, no se crea nada.
              </span>
            </div>
          }

          <div class="cfg__pie">
            @if (g.fechaActualizacion) {
              <span class="cfg__auditoria">Último cambio: {{ g.actualizadoPor }} · {{ g.fechaActualizacion | date: 'dd/MM/yyyy h:mm a' }}</span>
            } @else {
              <span class="cfg__auditoria">Sin cambios desde la instalación</span>
            }
            <button mat-flat-button color="primary" (click)="guardar()" [disabled]="!hayCambios() || !prefijoValido() || guardando()">
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
export class ConfiguracionCuentasPorPagarComponent implements OnInit {
  readonly prefijoPrueba = PREFIJO_PRUEBA;
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly guardada = signal<ConfiguracionCuentasPorPagar | null>(null);
  readonly prefijo = signal('');
  readonly crearCE = signal(false);

  readonly prefijoValido = computed(() => /^[A-Z0-9-]{1,20}$/.test(this.prefijo().trim()));
  readonly hayCambios = computed(() => {
    const g = this.guardada();
    return !!g && (g.prefijoCE !== this.prefijo().trim() || g.crearCEEnWorldOffice !== this.crearCE());
  });

  constructor(
    private readonly servicio: CuentasPorPagarService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargando.set(true);
    this.servicio.configuracion().subscribe({
      next: (c) => {
        this.aplicar(c);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('No se pudo cargar la configuración.', 'Cerrar', { duration: 4000 });
      }
    });
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.actualizarConfiguracion({ prefijoCE: this.prefijo().trim(), crearCEEnWorldOffice: this.crearCE() }).subscribe({
      next: (c) => {
        this.aplicar(c);
        this.guardando.set(false);
        this.snackBar.open('Configuración guardada.', 'Cerrar', { duration: 3000 });
      },
      error: (error) => {
        this.guardando.set(false);
        this.snackBar.open(error?.error?.mensaje ?? 'No se pudo guardar la configuración.', 'Cerrar', { duration: 5000 });
      }
    });
  }

  private aplicar(c: ConfiguracionCuentasPorPagar): void {
    this.guardada.set(c);
    this.prefijo.set(c.prefijoCE);
    this.crearCE.set(c.crearCEEnWorldOffice);
  }
}
