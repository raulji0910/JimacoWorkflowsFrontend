import { Component, Inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RemisionDetalle, VerificacionSoporte } from '../../core/models/remision.model';
import { RemisionService } from '../../core/services/remision.service';
import { leerQrDeArchivo } from '../../shared/lector-qr';
import { reducirImagen } from '../../shared/reducir-imagen';

const MAX_BYTES = 20 * 1024 * 1024;

interface ArchivoEnLista {
  id: number;
  /** El que se envía (las fotos ya reducidas: la IA acepta hasta ~5 MB y sube más rápido). */
  archivo: File;
  etapa: 'qr' | 'revisando' | 'listo';
  qr: string | null;
  previa: string | null;
  resultado: VerificacionSoporte | null;
  error: string | null;
}

/**
 * Confirmar la entrega de una remisión (2026-11-12). Pedido del usuario: la remisión solo pasa a
 * Entregada si el soporte es el correcto — es ESTA remisión (QR, o el número que lee la IA) y tiene
 * la firma del cliente (revisión con IA). Cada archivo se revisa apenas se adjunta y se muestra por
 * qué no sirve; "Confirmar entrega" solo se habilita con al menos un archivo válido. El servidor
 * vuelve a aplicar la misma regla al confirmar (con el resultado en memoria: no se paga dos veces).
 */
@Component({
  selector: 'app-confirmar-entrega-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="ce__cabeza">
      <mat-icon>task_alt</mat-icon>
      <div>
        <h2>Confirmar entrega</h2>
        <span>REM {{ data.remision.numero }} · {{ data.remision.cliente }}</span>
      </div>
    </div>

    <mat-dialog-content class="ce">
      <p class="ce__ayuda">
        Adjuntá la remisión <strong>firmada por el cliente</strong>: la hoja completa, nítida y con el código QR visible.
        Solo se confirma si el documento es esta remisión y tiene la firma.
      </p>

      <div class="ce__botones">
        <button mat-flat-button color="primary" type="button" (click)="camara.click()" [disabled]="enviando()">
          <mat-icon>photo_camera</mat-icon>
          Tomar foto
        </button>
        <button mat-stroked-button type="button" (click)="selector.click()" [disabled]="enviando()">
          <mat-icon>upload_file</mat-icon>
          Subir foto o PDF
        </button>
        <input #camara type="file" accept="image/*" capture="environment" hidden (change)="agregar(camara)" />
        <input #selector type="file" accept="image/*,application/pdf" multiple hidden (change)="agregar(selector)" />
      </div>

      @if (archivos().length > 0) {
        <ul class="ce__lista">
          @for (a of archivos(); track a.id) {
            <li class="ce__archivo" [class.ce__archivo--ok]="a.resultado?.valido" [class.ce__archivo--mal]="a.etapa === 'listo' && !a.resultado?.valido">
              @if (a.previa) {
                <img [src]="a.previa" alt="" class="ce__previa" />
              } @else {
                <mat-icon class="ce__icono-pdf">picture_as_pdf</mat-icon>
              }
              <div class="ce__archivo-texto">
                <span class="ce__nombre">{{ a.archivo.name }}</span>
                @switch (a.etapa) {
                  @case ('qr') {
                    <span class="ce__estado"><mat-spinner diameter="14" /> Buscando el código QR…</span>
                  }
                  @case ('revisando') {
                    <span class="ce__estado"><mat-spinner diameter="14" /> Revisando el documento y la firma…</span>
                  }
                  @default {
                    @if (a.resultado?.valido) {
                      <span class="ce__estado ce__estado--ok">
                        <mat-icon>verified</mat-icon>
                        Es la REM {{ data.remision.numero }}{{ a.resultado?.iaActiva ? ' y tiene la firma del cliente' : '' }}
                      </span>
                    } @else {
                      <span class="ce__estado ce__estado--mal">
                        <mat-icon>error</mat-icon>
                        {{ a.error || a.resultado?.motivo || 'No sirve como soporte.' }}
                      </span>
                    }
                    @if (a.resultado?.iaObservacion) {
                      <span class="ce__ia"><mat-icon>auto_awesome</mat-icon> {{ a.resultado?.iaObservacion }}</span>
                    }
                  }
                }
              </div>
              <button mat-icon-button type="button" (click)="quitar(a)" [disabled]="enviando()" aria-label="Quitar archivo">
                <mat-icon>close</mat-icon>
              </button>
            </li>
          }
        </ul>
      }

      @if (ningunoValido()) {
        <div class="ce__alerta">
          <mat-icon>info</mat-icon>
          <span>
            Todavía no hay un soporte válido, así que la remisión <strong>sigue por entregar</strong>.
            Tomá otra foto de la hoja completa, con buena luz, el QR visible y la firma del cliente.
          </span>
        </div>
      }

      <label class="ce__etiqueta" for="ce-observacion">Observación (opcional)</label>
      <mat-form-field appearance="outline" class="ce__obs" subscriptSizing="dynamic">
        <textarea id="ce-observacion" matInput rows="2" maxlength="1000" [(ngModel)]="observacion" placeholder="Ej. recibió el almacenista, faltó un ítem…"></textarea>
      </mat-form-field>

      @if (error()) {
        <p class="ce__error">{{ error() }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancelar()" [disabled]="enviando()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="confirmar()" [disabled]="!puedeConfirmar()">
        @if (enviando()) {
          <mat-spinner diameter="18" />
        } @else {
          <mat-icon>task_alt</mat-icon>
        }
        Confirmar entrega
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ce__cabeza {
      display: flex; gap: 0.75rem; align-items: center; padding: 1.25rem 1.5rem;
      background: var(--mat-sys-primary); color: var(--mat-sys-on-primary);
    }
    .ce__cabeza h2 { margin: 0; font: var(--mat-sys-title-large); }
    .ce__cabeza span { opacity: 0.9; font-size: 0.875rem; }
    .ce { display: flex; flex-direction: column; gap: 1rem; padding-top: 1rem !important; }
    .ce__ayuda { margin: 0; }
    .ce__botones { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .ce__botones button { flex: 1 1 12rem; }
    .ce__lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .ce__archivo {
      display: flex; gap: 0.75rem; align-items: center; padding: 0.5rem;
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px;
    }
    .ce__archivo--ok { border-color: var(--mat-sys-primary); background: color-mix(in srgb, var(--mat-sys-primary-container) 40%, transparent); }
    .ce__archivo--mal { border-color: var(--mat-sys-error); }
    .ce__previa { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; flex: none; }
    .ce__icono-pdf { width: 56px; height: 40px; font-size: 40px; color: var(--mat-sys-error); flex: none; text-align: center; }
    .ce__archivo-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
    .ce__nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .ce__estado { display: inline-flex; align-items: flex-start; gap: 0.3rem; font-size: 0.8125rem; color: var(--mat-sys-on-surface-variant); }
    .ce__estado mat-icon, .ce__ia mat-icon { font-size: 16px; width: 16px; height: 16px; flex: none; }
    .ce__estado--ok { color: var(--mat-sys-primary); font-weight: 500; }
    .ce__estado--mal { color: var(--mat-sys-error); font-weight: 500; }
    .ce__ia { display: inline-flex; align-items: flex-start; gap: 0.3rem; font-size: 0.75rem; color: var(--mat-sys-on-surface-variant); font-style: italic; }
    .ce__alerta {
      display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.75rem 1rem; border-radius: 8px;
      background: #fff3c4; color: #5c4400; font-size: 0.875rem;
    }
    .ce__alerta mat-icon { flex: none; }
    .ce__etiqueta { font-weight: 500; margin-bottom: -0.5rem; }
    .ce__obs { width: 100%; }
    .ce__error { margin: 0; color: var(--mat-sys-error); }
  `]
})
export class ConfirmarEntregaDialogComponent {
  readonly archivos = signal<ArchivoEnLista[]>([]);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  observacion = '';
  private siguienteId = 1;

  readonly revisando = computed(() => this.archivos().some((a) => a.etapa !== 'listo'));
  readonly hayValido = computed(() => this.archivos().some((a) => a.resultado?.valido));
  readonly ningunoValido = computed(() => this.archivos().length > 0 && !this.revisando() && !this.hayValido());
  readonly puedeConfirmar = computed(() => this.hayValido() && !this.revisando() && !this.enviando());

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: { remision: RemisionDetalle },
    private readonly dialogRef: MatDialogRef<ConfirmarEntregaDialogComponent, RemisionDetalle>,
    private readonly servicio: RemisionService
  ) {}

  agregar(input: HTMLInputElement): void {
    const nuevos = Array.from(input.files ?? []);
    input.value = '';
    this.error.set(null);
    for (const original of nuevos) {
      if (original.size > MAX_BYTES) {
        this.error.set(`"${original.name}" pesa más de 20 MB.`);
        continue;
      }
      const item: ArchivoEnLista = {
        id: this.siguienteId++,
        archivo: original,
        etapa: 'qr',
        qr: null,
        previa: original.type.startsWith('image/') ? URL.createObjectURL(original) : null,
        resultado: null,
        error: null
      };
      this.archivos.update((l) => [...l, item]);
      void this.procesar(item.id, original);
    }
  }

  /** QR sobre el original (más resolución) → foto reducida → revisión en el servidor (QR + IA). */
  private async procesar(id: number, original: File): Promise<void> {
    const qr = await leerQrDeArchivo(original);
    const archivo = await reducirImagen(original);
    this.actualizar(id, { qr, archivo, etapa: 'revisando' });
    this.servicio.verificarSoporte(this.data.remision.id, archivo, qr).subscribe({
      next: (resultado) => this.actualizar(id, { resultado, etapa: 'listo' }),
      error: (e) =>
        this.actualizar(id, {
          etapa: 'listo',
          error: e?.error?.mensaje ?? 'No se pudo revisar el archivo. Revisá la conexión y volvé a adjuntarlo.'
        })
    });
  }

  private actualizar(id: number, cambios: Partial<ArchivoEnLista>): void {
    this.archivos.update((l) => l.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
  }

  quitar(a: ArchivoEnLista): void {
    if (a.previa) URL.revokeObjectURL(a.previa);
    this.archivos.update((l) => l.filter((x) => x.id !== a.id));
  }

  cancelar(): void {
    this.liberar();
    this.dialogRef.close();
  }

  confirmar(): void {
    if (!this.puedeConfirmar()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.servicio
      .confirmarEntrega(
        this.data.remision.id,
        this.archivos().map((a) => ({ archivo: a.archivo, qrLeido: a.qr })),
        this.observacion
      )
      .subscribe({
        next: (r) => {
          this.liberar();
          this.dialogRef.close(r);
        },
        error: (e) => {
          this.enviando.set(false);
          this.error.set(e?.error?.mensaje ?? 'No se pudo confirmar la entrega. Revisá la conexión e intentá de nuevo.');
        }
      });
  }

  private liberar(): void {
    for (const a of this.archivos()) if (a.previa) URL.revokeObjectURL(a.previa);
  }
}
