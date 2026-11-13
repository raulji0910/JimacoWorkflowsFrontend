import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RemisionService } from '../../core/services/remision.service';
import { DocumentoRequerido, EventoFacturacion, RemisionDetalle, SoporteRemision } from '../../core/models/remision.model';
import { ComentarioDialogComponent, ComentarioDialogResultado } from '../../shared/comentario-dialog.component';
import { reducirImagen } from '../../shared/reducir-imagen';
import { abrirPdfEnPestana } from './entregas-utilidades';

const TIPOS_ACEPTADOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Entregas fase 2 (2026-11-13): "Documentos para facturar" en el detalle de una remisión entregada.
 * Una caja por tipo documental que aplica al cliente (arrastrar y soltar o escoger el archivo); cada
 * archivo se revisa con IA al subirlo (si está encendida) y, si no parece el documento pedido, queda
 * un aviso que no bloquea. Con todo lo obligatorio, el emisor la envía a contabilidad; el contable
 * puede devolverla con un comentario.
 */
@Component({
  selector: 'app-documentos-facturacion',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    @let r = remision();
    <section class="fac">
      <header class="fac__cabeza">
        <h3>Documentos para facturar</h3>
        <span class="fac__estado" [class]="'fac__estado fac__estado--' + (r.estadoFacturacion ?? 'PendienteDocumentos')">
          {{ textoEstado() }}
        </span>
      </header>

      @switch (r.estadoFacturacion) {
        @case ('Devuelta') {
          <div class="fac__banda fac__banda--devuelta">
            <mat-icon>undo</mat-icon>
            <div>
              <strong>Contabilidad la devolvió</strong>
              @if (ultimaDevolucion(); as d) {
                ({{ d.usuario }}, {{ d.fecha | date: 'dd/MM/yyyy h:mm a' }}): “{{ d.comentario }}”
              }
              @if (r.puedeAdjuntarDocumentos) {
                <div>Corregí o agregá los documentos y volvé a enviarla a contabilidad.</div>
              }
            </div>
          </div>
        }
        @case ('EnFacturacion') {
          <div class="fac__banda fac__banda--contabilidad">
            <mat-icon>receipt_long</mat-icon>
            <span>
              En contabilidad para facturar desde el {{ r.fechaEnvioFacturacion | date: "dd/MM/yyyy 'a las' h:mm a" }}
              @if (r.puedeDevolver) {
                Si falta algo o un documento está mal, devolvela al emisor con un comentario.
              }
            </span>
          </div>
        }
        @default {
          @if (r.puedeAdjuntarDocumentos) {
            <p class="fac__ayuda">Adjuntá cada documento en su caja (PDF o foto). Cuando estén los obligatorios, enviala a contabilidad.</p>
          } @else if (r.emisor) {
            <p class="fac__ayuda">Esperando que {{ r.emisor }} adjunte los documentos.</p>
          } @else {
            <div class="fac__banda fac__banda--aviso">
              <mat-icon>person_off</mat-icon>
              <span>
                Ningún usuario tiene el Usuario WO <strong>{{ r.elaboradoPorWO || '(vacío)' }}</strong>: no se le avisó a nadie de esta entrega.
                Un administrador debe ponerlo en Administración → Usuarios.
              </span>
            </div>
          }
        }
      }

      <div class="fac__tipos">
        @for (t of r.documentosRequeridos ?? []; track t.tipoId) {
          <div class="fac__tipo" [class.fac__tipo--completo]="t.completo">
            <div class="fac__tipo-cabeza">
              <mat-icon class="fac__tipo-icono">{{ t.completo ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              <div>
                <strong>{{ t.nombre }}</strong>
                <span class="fac__tipo-req">{{ t.obligatorio ? 'Obligatorio' : 'Opcional' }}</span>
              </div>
            </div>

            @for (d of documentosDe(t); track d.id) {
              <div class="fac__doc">
                <mat-icon class="fac__doc-icono">{{ esImagen(d) ? 'image' : 'picture_as_pdf' }}</mat-icon>
                <div class="fac__doc-texto">
                  <button mat-button class="fac__doc-nombre" (click)="ver(d)">{{ d.nombreArchivo }}</button>
                  <span class="fac__doc-meta">{{ d.subidoPor }} · {{ d.fechaCarga | date: 'dd/MM/yyyy h:mm a' }}</span>
                  @if (d.aviso) {
                    <span class="fac__doc-aviso"><mat-icon>warning</mat-icon> {{ d.aviso }}</span>
                  } @else if (d.iaTipoDetectado) {
                    <span class="fac__doc-ok"><mat-icon>verified</mat-icon> La IA lo reconoce como {{ d.iaTipoDetectado }}</span>
                  }
                  @if (d.iaObservacion) {
                    <span class="fac__doc-meta"><em>{{ d.iaObservacion }}</em></span>
                  }
                </div>
                @if (d.puedeEliminar) {
                  <button mat-icon-button (click)="eliminar(d)" [disabled]="ocupado()" matTooltip="Quitar este archivo" [attr.aria-label]="'Quitar ' + d.nombreArchivo">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </div>
            }

            @if (r.puedeAdjuntarDocumentos) {
              @if (subiendo() === t.tipoId) {
                <div class="fac__zona fac__zona--subiendo">
                  <mat-spinner diameter="22" />
                  <span>Subiendo{{ iaRevisa() ? ' y revisando' : '' }}…</span>
                </div>
              } @else {
                <div
                  class="fac__zona"
                  [class.fac__zona--encima]="encima() === t.tipoId"
                  (dragover)="arrastrando($event, t)"
                  (dragleave)="encima.set(null)"
                  (drop)="soltar($event, t)"
                >
                  <mat-icon>upload_file</mat-icon>
                  <span>Arrastrá el archivo aquí o</span>
                  <input #entrada type="file" hidden accept="application/pdf,image/*" multiple (change)="escoger($event, t)" />
                  <button mat-stroked-button type="button" [disabled]="ocupado()" (click)="entrada.click()">Escoger archivo</button>
                </div>
              }
            }
          </div>
        }
      </div>

      @if (r.puedeAdjuntarDocumentos || r.puedeDevolver) {
        <div class="fac__acciones">
          @if (r.puedeAdjuntarDocumentos) {
            @if (faltantes().length > 0) {
              <span class="fac__faltan">Falta: {{ faltantes().join(', ') }}</span>
            }
            <button mat-flat-button color="primary" [disabled]="ocupado() || faltantes().length > 0" (click)="enviar()">
              <mat-icon>send</mat-icon>
              Enviar a contabilidad
            </button>
          }
          @if (r.puedeDevolver) {
            <button mat-stroked-button color="warn" [disabled]="ocupado()" (click)="devolver()">
              <mat-icon>undo</mat-icon>
              Devolver al emisor
            </button>
          }
        </div>
      }

      @if ((r.historial ?? []).length > 0) {
        <div class="fac__historial">
          <h4>Historial</h4>
          <ul>
            @for (h of r.historial; track $index) {
              <li>
                <mat-icon>{{ iconoEvento(h) }}</mat-icon>
                <span>
                  <strong>{{ textoEvento(h) }}</strong> · {{ h.usuario }} · {{ h.fecha | date: 'dd/MM/yyyy h:mm a' }}
                  @if (h.comentario) {
                    — “{{ h.comentario }}”
                  }
                </span>
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styleUrl: './documentos-facturacion.component.scss'
})
export class DocumentosFacturacionComponent {
  private readonly servicio = inject(RemisionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly remision = input.required<RemisionDetalle>();
  /** El detalle actualizado después de cada cambio — el padre lo reemplaza. */
  readonly actualizada = output<RemisionDetalle>();
  /** La IA está encendida: solo cambia el texto de "Subiendo y revisando…". */
  readonly iaRevisa = input(false);

  readonly subiendo = signal<number | null>(null);
  readonly encima = signal<number | null>(null);
  readonly enviando = signal(false);
  readonly ocupado = computed(() => this.subiendo() !== null || this.enviando());

  readonly faltantes = computed(() =>
    (this.remision().documentosRequeridos ?? []).filter((t) => t.obligatorio && !t.completo).map((t) => t.nombre)
  );

  readonly ultimaDevolucion = computed(() =>
    [...(this.remision().historial ?? [])].reverse().find((h) => h.accion === 'Devuelta') ?? null
  );

  textoEstado(): string {
    switch (this.remision().estadoFacturacion) {
      case 'EnFacturacion':
        return 'En contabilidad';
      case 'Devuelta':
        return 'Devuelta por contabilidad';
      case 'Facturada':
        return 'Facturada';
      default:
        return this.faltantes().length > 0 ? `Faltan ${this.faltantes().length} documento${this.faltantes().length === 1 ? '' : 's'}` : 'Lista para enviar';
    }
  }

  documentosDe(t: DocumentoRequerido): SoporteRemision[] {
    return this.remision().soportes.filter((s) => s.tipo === 'DocumentoFacturacion' && s.tipoDocumentoFacturacionId === t.tipoId);
  }

  esImagen(s: SoporteRemision): boolean {
    return (s.contentType ?? '').startsWith('image/');
  }

  ver(s: SoporteRemision): void {
    abrirPdfEnPestana(this.servicio.soporte(s.id), this.snackBar);
  }

  // ---- Arrastrar y soltar / escoger ----

  arrastrando(evento: DragEvent, t: DocumentoRequerido): void {
    evento.preventDefault();
    if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'copy';
    this.encima.set(t.tipoId);
  }

  soltar(evento: DragEvent, t: DocumentoRequerido): void {
    evento.preventDefault();
    this.encima.set(null);
    this.subir(t, Array.from(evento.dataTransfer?.files ?? []));
  }

  escoger(evento: Event, t: DocumentoRequerido): void {
    const entrada = evento.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []);
    entrada.value = '';
    this.subir(t, archivos);
  }

  private async subir(t: DocumentoRequerido, archivos: File[]): Promise<void> {
    if (this.ocupado() || archivos.length === 0) return;
    const validos = archivos.filter((a) => TIPOS_ACEPTADOS.includes(a.type));
    if (validos.length < archivos.length) {
      this.snackBar.open('Solo se aceptan PDF o fotos (JPG, PNG).', 'Cerrar', { duration: 5000 });
    }
    this.subiendo.set(t.tipoId);
    try {
      for (const archivo of validos) {
        const listo = await reducirImagen(archivo);
        const detalle = await new Promise<RemisionDetalle>((ok, mal) =>
          this.servicio.adjuntarDocumento(this.remision().id, t.tipoId, listo).subscribe({ next: ok, error: mal })
        );
        this.actualizada.emit(detalle);
        const nuevo = detalle.soportes.filter((s) => s.tipoDocumentoFacturacionId === t.tipoId).at(-1);
        if (nuevo?.aviso) this.snackBar.open(`Ojo con "${nuevo.nombreArchivo}": ${nuevo.aviso}`, 'Entendido', { duration: 10000 });
      }
    } catch (e: unknown) {
      this.error(e, 'No se pudo subir el archivo. Revisá la conexión e intentá de nuevo.');
    } finally {
      this.subiendo.set(null);
    }
  }

  eliminar(d: SoporteRemision): void {
    this.enviando.set(true);
    this.servicio.eliminarDocumento(this.remision().id, d.id).subscribe({
      next: (detalle) => {
        this.enviando.set(false);
        this.actualizada.emit(detalle);
        this.snackBar.open(`Se quitó "${d.nombreArchivo}".`, 'Cerrar', { duration: 3000 });
      },
      error: (e) => {
        this.enviando.set(false);
        this.error(e, 'No se pudo quitar el archivo.');
      }
    });
  }

  // ---- Enviar / devolver ----

  enviar(): void {
    const r = this.remision();
    const conAviso = r.soportes.filter((s) => s.tipo === 'DocumentoFacturacion' && s.aviso).length;
    this.dialog
      .open(ComentarioDialogComponent, {
        data: {
          titulo: `Enviar REM ${r.numero} a contabilidad`,
          descripcion:
            conAviso > 0
              ? `${conAviso} documento${conAviso === 1 ? ' tiene' : 's tienen'} aviso de la IA. Podés enviarla igual; contale a contabilidad por qué.`
              : 'Le llega un correo a contabilidad para que la facture.',
          requerido: false,
          textoConfirmar: 'Enviar a contabilidad'
        },
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)'
      })
      .afterClosed()
      .subscribe((res?: ComentarioDialogResultado) => {
        if (!res) return;
        this.enviando.set(true);
        this.servicio.enviarAFacturacion(r.id, res.comentario).subscribe({
          next: (detalle) => {
            this.enviando.set(false);
            this.actualizada.emit(detalle);
            this.snackBar.open(`REM ${r.numero} enviada a contabilidad.`, 'Cerrar', { duration: 5000 });
          },
          error: (e) => {
            this.enviando.set(false);
            this.error(e, 'No se pudo enviar a contabilidad.');
          }
        });
      });
  }

  devolver(): void {
    const r = this.remision();
    this.dialog
      .open(ComentarioDialogComponent, {
        data: {
          titulo: `Devolver REM ${r.numero} al emisor`,
          descripcion: 'Contale qué falta o qué documento está mal. Le llega por correo y la tiene que volver a enviar.',
          requerido: true,
          textoConfirmar: 'Devolver'
        },
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)'
      })
      .afterClosed()
      .subscribe((res?: ComentarioDialogResultado) => {
        if (!res?.comentario) return;
        this.enviando.set(true);
        this.servicio.devolver(r.id, res.comentario).subscribe({
          next: (detalle) => {
            this.enviando.set(false);
            this.actualizada.emit(detalle);
            this.snackBar.open(`REM ${r.numero} devuelta al emisor.`, 'Cerrar', { duration: 5000 });
          },
          error: (e) => {
            this.enviando.set(false);
            this.error(e, 'No se pudo devolver.');
          }
        });
      });
  }

  textoEvento(h: EventoFacturacion): string {
    return h.accion === 'EnviadaAFacturacion' ? 'Enviada a contabilidad' : h.accion === 'Devuelta' ? 'Devuelta al emisor' : 'Facturada';
  }

  iconoEvento(h: EventoFacturacion): string {
    return h.accion === 'EnviadaAFacturacion' ? 'send' : h.accion === 'Devuelta' ? 'undo' : 'receipt_long';
  }

  private error(e: unknown, porDefecto: string): void {
    const mensaje = (e as { error?: { mensaje?: string } })?.error?.mensaje;
    this.snackBar.open(mensaje ?? porDefecto, 'Cerrar', { duration: 6000 });
  }
}
