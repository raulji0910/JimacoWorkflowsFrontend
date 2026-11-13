import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RemisionService } from '../../../core/services/remision.service';
import { ConfiguracionEntregas } from '../../../core/models/remision.model';
import { TiposDocumentoFacturacionComponent } from './tipos-documento-facturacion.component';

/**
 * Administración → Config. de entregas (2026-11-12): interruptor de la revisión con IA de la firma
 * o el sello del cliente. Apagado = la entrega se confirma solo con el QR de la remisión.
 * Mismo estilo que "Config. de pagos".
 */
@Component({
  selector: 'app-configuracion-entregas',
  standalone: true,
  imports: [DatePipe, FormsModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatSlideToggleModule, TiposDocumentoFacturacionComponent],
  template: `
    <div class="cfg">
      <h2>Configuración de entregas</h2>

      @if (cargando()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (guardada(); as g) {
        <section class="cfg__tarjeta">
          <div class="cfg__cabeza">
            <mat-icon>auto_awesome</mat-icon>
            <div>
              <h3>Revisión con IA</h3>
              <p>
                Con la IA encendida, además del código QR se revisa que la foto o el PDF sea esta remisión y que tenga
                la <strong>firma o el sello del cliente</strong>. Apagada, la entrega se confirma solo con el QR.
                También revisa los <strong>documentos para facturar</strong> (si parecen el documento pedido); ahí solo avisa, no bloquea.
              </p>
            </div>
          </div>

          <div class="cfg__estado" [class.cfg__estado--encendido]="g.verificacionIAActiva && g.iaConClave">
            <mat-icon>{{ g.verificacionIAActiva && g.iaConClave ? 'check_circle' : 'pause_circle' }}</mat-icon>
            <span>
              Hoy:
              <strong>{{ g.verificacionIAActiva && g.iaConClave ? 'se revisa con IA (QR + firma o sello)' : 'solo se exige el QR' }}</strong>
            </span>
          </div>

          <mat-slide-toggle [ngModel]="activa()" (ngModelChange)="activa.set($event)">Revisar con IA</mat-slide-toggle>

          @if (!g.iaConClave) {
            <div class="cfg__aviso">
              <mat-icon>key_off</mat-icon>
              <span>
                El servidor todavía <strong>no tiene la clave de la IA</strong> (Anthropic). Podés dejarla encendida, pero no
                va a revisar nada hasta que se configure la clave.
              </span>
            </div>
          }

          <div class="cfg__pie">
            @if (g.fechaActualizacion) {
              <span class="cfg__auditoria">Último cambio: {{ g.actualizadoPor }} · {{ g.fechaActualizacion | date: 'dd/MM/yyyy h:mm a' }}</span>
            } @else {
              <span class="cfg__auditoria">Sin cambios desde la instalación · remisiones desde {{ g.fechaInicio | date: 'dd/MM/yyyy' }}</span>
            }
            <button mat-flat-button color="primary" (click)="guardar()" [disabled]="!hayCambios() || guardando()">
              <mat-icon>save</mat-icon>
              Guardar
            </button>
          </div>
        </section>
      }

      <app-tipos-documento-facturacion />
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
    .cfg__cabeza mat-icon { color: var(--mat-sys-primary); margin-top: 0.15rem; flex: none; }
    .cfg__cabeza h3 { margin: 0 0 0.25rem; font: var(--mat-sys-title-medium); }
    .cfg__cabeza p { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .cfg__estado {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 8px;
      background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface);
    }
    .cfg__estado--encendido { background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .cfg__aviso {
      display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.75rem 1rem; border-radius: 8px;
      background: #fff3c4; color: #5c4400;
    }
    .cfg__aviso mat-icon { flex: none; }
    .cfg__pie { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
    .cfg__auditoria { color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; }
  `
})
export class ConfiguracionEntregasComponent implements OnInit {
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly guardada = signal<ConfiguracionEntregas | null>(null);
  readonly activa = signal(false);

  readonly hayCambios = computed(() => {
    const g = this.guardada();
    return !!g && g.verificacionIAActiva !== this.activa();
  });

  constructor(
    private readonly servicio: RemisionService,
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
    this.servicio.actualizarConfiguracion({ verificacionIAActiva: this.activa() }).subscribe({
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

  private aplicar(c: ConfiguracionEntregas): void {
    this.guardada.set(c);
    this.activa.set(c.verificacionIAActiva);
  }
}
