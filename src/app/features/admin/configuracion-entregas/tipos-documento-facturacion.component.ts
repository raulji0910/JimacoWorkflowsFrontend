import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RemisionService } from '../../../core/services/remision.service';
import { TipoDocumentoFacturacion } from '../../../core/models/remision.model';

/** Una fila en edición (id null = nueva, todavía sin guardar). */
interface FilaTipo {
  id: number | null;
  nombre: string;
  descripcion: string;
  obligatorio: boolean;
  nitsClientes: string;
  orden: number;
  activo: boolean;
  guardando: boolean;
  cambiada: boolean;
}

/**
 * Administración → Config. de entregas → "Documentos para facturar" (2026-11-13): qué documentos
 * pide cada cliente. Sin NIT = a todos; con NIT(s) = solo a esos clientes (ej. Proforma: PARES y
 * VERANO). La descripción también le explica a la IA qué es el documento.
 */
@Component({
  selector: 'app-tipos-documento-facturacion',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule],
  template: `
    <section class="cfg__tarjeta">
      <div class="cfg__cabeza">
        <mat-icon>folder_copy</mat-icon>
        <div>
          <h3>Documentos para facturar</h3>
          <p>
            Lo que el emisor debe adjuntar a una remisión entregada antes de enviarla a contabilidad. Sin NIT, se pide a
            <strong>todos</strong> los clientes; con NIT(s), solo a esos clientes.
          </p>
        </div>
      </div>

      @for (f of filas(); track $index) {
        <div class="tipos__fila" [class.tipos__fila--inactiva]="!f.activo">
          <div class="tipos__campos">
            <mat-form-field appearance="outline" class="tipos__nombre">
              <mat-label>Documento</mat-label>
              <input matInput [(ngModel)]="f.nombre" (ngModelChange)="f.cambiada = true" maxlength="100" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="tipos__nits">
              <mat-label>Solo para estos NIT (vacío = todos)</mat-label>
              <input matInput [(ngModel)]="f.nitsClientes" (ngModelChange)="f.cambiada = true" placeholder="900268747; 900331322" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="tipos__descripcion">
              <mat-label>Descripción (ayuda a la IA a reconocerlo)</mat-label>
              <input matInput [(ngModel)]="f.descripcion" (ngModelChange)="f.cambiada = true" maxlength="500" />
            </mat-form-field>
          </div>
          <div class="tipos__opciones">
            <mat-slide-toggle [(ngModel)]="f.obligatorio" (ngModelChange)="f.cambiada = true">Obligatorio</mat-slide-toggle>
            <mat-slide-toggle [(ngModel)]="f.activo" (ngModelChange)="f.cambiada = true">Activo</mat-slide-toggle>
            <button mat-flat-button color="primary" [disabled]="!f.cambiada || !f.nombre.trim() || f.guardando" (click)="guardar(f)">
              <mat-icon>save</mat-icon>
              Guardar
            </button>
          </div>
        </div>
      }

      <div class="cfg__pie">
        <span class="cfg__auditoria">Para dejar de pedir un documento, desactivalo (no se borra: los ya adjuntos se conservan).</span>
        <button mat-stroked-button (click)="agregar()">
          <mat-icon>add</mat-icon>
          Agregar documento
        </button>
      </div>
    </section>
  `,
  // Mismas tarjetas que el resto de "Config. de entregas" (los estilos del padre no llegan acá).
  styles: `
    :host { display: block; }
    .cfg__tarjeta {
      display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem;
      border-radius: 12px; border: 1px solid var(--mat-sys-outline-variant); background: var(--mat-sys-surface);
    }
    .cfg__cabeza { display: flex; gap: 0.75rem; align-items: flex-start; }
    .cfg__cabeza mat-icon { color: var(--mat-sys-primary); margin-top: 0.15rem; flex: none; }
    .cfg__cabeza h3 { margin: 0 0 0.25rem; font: var(--mat-sys-title-medium); }
    .cfg__cabeza p { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .cfg__pie { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
    .cfg__auditoria { color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; }
    .tipos__fila {
      display: flex; flex-direction: column; gap: 0.25rem; padding: 0.75rem;
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 10px;
    }
    .tipos__fila--inactiva { opacity: 0.6; }
    .tipos__campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: 0 0.75rem; }
    .tipos__descripcion { grid-column: 1 / -1; }
    .tipos__opciones { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; justify-content: flex-end; }
  `
})
export class TiposDocumentoFacturacionComponent implements OnInit {
  private readonly servicio = inject(RemisionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly filas = signal<FilaTipo[]>([]);

  ngOnInit(): void {
    this.servicio.tiposDocumento().subscribe({
      next: (tipos) => this.filas.set(tipos.map((t) => this.aFila(t))),
      error: () => this.snackBar.open('No se pudieron cargar los documentos para facturar.', 'Cerrar', { duration: 4000 })
    });
  }

  agregar(): void {
    const orden = Math.max(0, ...this.filas().map((f) => f.orden)) + 1;
    this.filas.set([
      ...this.filas(),
      { id: null, nombre: '', descripcion: '', obligatorio: true, nitsClientes: '', orden, activo: true, guardando: false, cambiada: true }
    ]);
  }

  guardar(f: FilaTipo): void {
    f.guardando = true;
    this.servicio
      .guardarTipoDocumento(f.id, {
        nombre: f.nombre.trim(),
        descripcion: f.descripcion.trim() || null,
        obligatorio: f.obligatorio,
        nitsClientes: f.nitsClientes.trim() || null,
        orden: f.orden,
        activo: f.activo
      })
      .subscribe({
        next: (t) => {
          this.filas.set(this.filas().map((x) => (x === f ? this.aFila(t) : x)));
          this.snackBar.open(`"${t.nombre}" guardado.`, 'Cerrar', { duration: 3000 });
        },
        error: (e) => {
          f.guardando = false;
          this.snackBar.open(e?.error?.mensaje ?? 'No se pudo guardar.', 'Cerrar', { duration: 5000 });
        }
      });
  }

  private aFila(t: TipoDocumentoFacturacion): FilaTipo {
    return {
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion ?? '',
      obligatorio: t.obligatorio,
      nitsClientes: (t.nitsClientes ?? '').split(';').filter(Boolean).join('; '),
      orden: t.orden,
      activo: t.activo,
      guardando: false,
      cambiada: false
    };
  }
}
