import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CuentasPorPagarService } from '../../core/services/cuentas-por-pagar.service';
import { BorradorProveedor, RelacionBorrador, RelacionCreada } from '../../core/models/cuentas-por-pagar.model';

/**
 * Relación de pagos (2026-11-09) — Gerencia Comercial revisa todo lo que fue marcando proveedor por
 * proveedor y lo ratifica de una vez: se crea una orden de pago por proveedor y le llega UN solo
 * correo al pagador con la relación completa. La confirmación es un paso en la misma página.
 */
@Component({
  selector: 'app-relacion-pagos',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="rel">
      <a mat-button routerLink="/cuentas-por-pagar">
        <mat-icon>arrow_back</mat-icon>
        Cuentas por pagar
      </a>

      <h2>Relación de pagos</h2>

      @if (creada(); as c) {
        <div class="rel__exito">
          <mat-icon>mark_email_read</mat-icon>
          <div>
            <h3>Relación {{ c.numero }} enviada</h3>
            <p>
              {{ c.ordenes }} {{ c.ordenes === 1 ? 'orden' : 'órdenes' }} de pago por <strong>$ {{ c.total | number: '1.0-0' }}</strong>.
              Al pagador le llegó un solo correo con toda la relación; la va a ver en su menú "Pagos".
            </p>
            <a mat-flat-button color="primary" routerLink="/cuentas-por-pagar">Volver a cuentas por pagar</a>
          </div>
        </div>
      } @else if (relacion(); as r) {
        @if (!r.proveedores.length) {
          <p class="rel__vacio">
            La relación está vacía. Entrá a cada proveedor desde <a routerLink="/cuentas-por-pagar">Cuentas por pagar</a>,
            marcá las facturas y tocá "Agregar a la relación".
          </p>
        } @else {
          <p class="rel__meta">
            {{ r.proveedores.length }} proveedor{{ r.proveedores.length === 1 ? '' : 'es' }} ·
            {{ r.facturas }} factura{{ r.facturas === 1 ? '' : 's' }} · total a pagar
            <strong>$ {{ r.total | number: '1.0-0' }}</strong>
          </p>

          <div class="rel__lista">
            @for (p of r.proveedores; track p.identificacion) {
              <section class="rel__proveedor" [class.rel__proveedor--problema]="p.problema">
                <header class="rel__cabeza">
                  <div>
                    <h3>{{ p.nombre }}</h3>
                    <span class="rel__sub">NIT {{ p.identificacion }}</span>
                  </div>
                  <div class="rel__acciones">
                    <a mat-button [routerLink]="['/cuentas-por-pagar', p.identificacion]">Editar</a>
                    <button mat-button (click)="quitar(p)" [disabled]="trabajando()">Quitar</button>
                  </div>
                </header>

                @if (p.problema) {
                  <p class="rel__problema"><mat-icon inline>error</mat-icon> {{ p.problema }}</p>
                }

                <dl class="rel__cuentas">
                  @for (f of p.facturas; track f.idDocumentoDetalleWO) {
                    <div [class.rel__tachada]="!f.disponible">
                      <dt>
                        {{ f.etiqueta }}
                        @if (f.numeroDocumentoExterno) { <span class="rel__sub">&nbsp;· {{ f.numeroDocumentoExterno }}</span> }
                        @if (f.vencimiento) { <span class="rel__sub">&nbsp;· vence {{ f.vencimiento | date: 'd MMM y' }}</span> }
                      </dt>
                      <dd>$ {{ f.valor | number: '1.0-0' }}</dd>
                    </div>
                  }
                  @for (a of p.anticipos; track a.idDocumentoDetalleWO) {
                    @if (a.valor > 0) {
                      <div class="rel__descuento">
                        <dt>Anticipo {{ a.etiqueta }} @if (a.nota) { <span class="rel__sub">&nbsp;· {{ a.nota }}</span> }</dt>
                        <dd>− $ {{ a.valor | number: '1.0-0' }}</dd>
                      </div>
                    }
                  }
                  <div class="rel__neto">
                    <dt>A pagar</dt>
                    <dd>$ {{ p.neto | number: '1.0-0' }}</dd>
                  </div>
                </dl>
              </section>
            }
          </div>

          <div class="rel__barra">
            @if (!confirmando()) {
              <span class="rel__total">$ {{ r.total | number: '1.0-0' }}</span>
              <button mat-flat-button color="primary" (click)="confirmando.set(true)" [disabled]="hayProblemas()">
                <mat-icon>send</mat-icon>
                Ratificar y enviar
              </button>
            } @else {
              <div class="rel__confirmar">
                <h3>¿Enviar la relación al pagador?</h3>
                <p>
                  Se crean {{ r.proveedores.length }} {{ r.proveedores.length === 1 ? 'orden' : 'órdenes' }} de pago (una por proveedor)
                  por <strong>$ {{ r.total | number: '1.0-0' }}</strong> y le llega <strong>un solo correo</strong> al pagador.
                </p>
                <mat-form-field appearance="outline" class="rel__obs">
                  <mat-label>Observaciones para el pagador (opcional)</mat-label>
                  <textarea matInput rows="2" maxlength="500" [(ngModel)]="observaciones"></textarea>
                </mat-form-field>
                <div class="rel__botones">
                  <button mat-button (click)="confirmando.set(false)" [disabled]="trabajando()">Volver</button>
                  <button mat-flat-button color="primary" (click)="ratificar()" [disabled]="trabajando()">
                    {{ trabajando() ? 'Enviando…' : 'Confirmar y enviar' }}
                  </button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .rel { padding-bottom: 7rem; }
    .rel h2 { margin: 0.5rem 0 0.25rem; }
    .rel__meta { margin: 0 0 1rem; opacity: 0.85; }
    .rel__vacio { opacity: 0.8; }
    .rel__lista { display: flex; flex-direction: column; gap: 0.75rem; max-width: 46rem; }
    .rel__proveedor {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-surface);
    }
    .rel__proveedor--problema { border-color: var(--mat-sys-error); }
    .rel__cabeza { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap; }
    .rel__cabeza h3 { margin: 0; font-size: 1rem; }
    .rel__acciones { display: flex; gap: 0.25rem; }
    .rel__sub { font-size: 0.8rem; opacity: 0.7; }
    .rel__problema { color: var(--mat-sys-error); margin: 0.5rem 0 0; font-size: 0.9rem; }
    .rel__cuentas { margin: 0.5rem 0 0; }
    .rel__cuentas > div { display: flex; justify-content: space-between; gap: 1rem; padding: 0.15rem 0; }
    .rel__cuentas dt { overflow-wrap: anywhere; }
    .rel__cuentas dd { margin: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .rel__descuento { color: var(--mat-sys-primary); }
    .rel__tachada { text-decoration: line-through; opacity: 0.6; }
    .rel__neto { border-top: 1px solid var(--mat-sys-outline-variant); margin-top: 0.25rem; padding-top: 0.35rem !important; font-weight: 600; }
    .rel__barra {
      position: fixed; left: 0; right: 0; bottom: 0;
      display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 1rem;
      padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
      background: var(--mat-sys-surface-container);
      border-top: 1px solid var(--mat-sys-outline-variant);
      z-index: 5;
    }
    .rel__total { font-size: 1.15rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .rel__confirmar { width: 100%; max-width: 40rem; margin-left: auto; }
    .rel__confirmar h3 { margin: 0 0 0.25rem; }
    .rel__confirmar p { margin: 0 0 0.5rem; }
    .rel__obs { width: 100%; }
    .rel__botones { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .rel__exito { display: flex; gap: 1rem; align-items: flex-start; max-width: 40rem; padding: 1rem; border-radius: 8px;
      background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .rel__exito h3 { margin: 0 0 0.25rem; }
  `]
})
export class RelacionPagosComponent implements OnInit {
  private readonly servicio = inject(CuentasPorPagarService);
  private readonly snackBar = inject(MatSnackBar);

  readonly relacion = signal<RelacionBorrador | null>(null);
  readonly creada = signal<RelacionCreada | null>(null);
  readonly confirmando = signal(false);
  readonly trabajando = signal(false);
  observaciones = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.servicio.relacion().subscribe({
      next: (r) => this.relacion.set(r),
      error: (e: { error?: { mensaje?: string } }) =>
        this.snackBar.open(e.error?.mensaje ?? 'No se pudo cargar la relación.', 'Cerrar', { duration: 6000 })
    });
  }

  hayProblemas(): boolean {
    return (this.relacion()?.proveedores ?? []).some((p) => p.problema);
  }

  quitar(p: BorradorProveedor): void {
    this.trabajando.set(true);
    this.servicio.guardarEnRelacion(p.identificacion, [], []).subscribe({
      next: (r) => {
        this.relacion.set(r);
        this.trabajando.set(false);
        this.confirmando.set(false);
      },
      error: (e: { error?: { mensaje?: string } }) => {
        this.trabajando.set(false);
        this.snackBar.open(e.error?.mensaje ?? 'No se pudo quitar.', 'Cerrar', { duration: 6000 });
      }
    });
  }

  ratificar(): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.servicio.ratificar(this.observaciones.trim() || null).subscribe({
      next: (c) => {
        this.trabajando.set(false);
        this.creada.set(c);
      },
      error: (e: { error?: { mensaje?: string } }) => {
        this.trabajando.set(false);
        this.confirmando.set(false);
        this.snackBar.open(e.error?.mensaje ?? 'No se pudo enviar la relación.', 'Cerrar', { duration: 10000 });
        this.cargar();
      }
    });
  }
}
