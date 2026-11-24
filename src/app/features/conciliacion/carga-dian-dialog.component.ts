import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConciliacionService } from '../../core/services/conciliacion.service';
import { CargaArchivosResultado, EstadoCarga, OrigenFactura } from '../../core/models/conciliacion.model';

type Paso = 'seleccion' | 'subiendo' | 'resultado';

// Mismos topes que la API (60 MB por petición, 500 archivos): se avisan antes de subir.
const MAXIMO_BYTES = 55 * 1024 * 1024;
const MAXIMO_ARCHIVOS = 500;

// Carga de los ZIP que se descargan del portal de la DIAN (uno por factura), varios a la vez. La
// DIAN es la que tiene todas las facturas: esto completa las que el proveedor no mandó al correo de
// facturación. Lo repetido se descarta por CUFE, así que no importa subir de más.
@Component({
  selector: 'app-carga-dian-dialog',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './carga-dian-dialog.component.html',
  styleUrl: './carga-dian-dialog.component.scss'
})
export class CargaDianDialogComponent {
  private readonly conciliacionService = inject(ConciliacionService);
  private readonly dialogRef = inject(MatDialogRef<CargaDianDialogComponent, boolean>);

  readonly paso = signal<Paso>('seleccion');
  readonly archivos = signal<File[]>([]);
  readonly arrastrando = signal(false);
  readonly avance = signal(0);
  readonly resultado = signal<CargaArchivosResultado | null>(null);
  readonly error = signal<string | null>(null);
  readonly omitidos = signal<string[]>([]);

  readonly tamanoTotal = computed(() => this.archivos().reduce((t, a) => t + a.size, 0));
  readonly excede = computed(() => this.tamanoTotal() > MAXIMO_BYTES || this.archivos().length > MAXIMO_ARCHIVOS);

  // Primero lo que entró, después lo que ya estaba y al final lo rechazado.
  readonly facturasOrdenadas = computed(() => {
    const orden: Record<EstadoCarga, number> = { Nueva: 0, Duplicada: 1, OtroReceptor: 2, NoReconocida: 3 };
    return [...(this.resultado()?.facturas ?? [])].sort((a, b) => orden[a.estado] - orden[b.estado]);
  });

  readonly rechazadas = computed(() => {
    const r = this.resultado();
    return r ? r.noReconocidas + r.otroReceptor : 0;
  });

  readonly etiquetasEstado: Record<EstadoCarga, string> = {
    Nueva: 'Nueva',
    Duplicada: 'Ya estaba',
    OtroReceptor: 'No es para Jimaco',
    NoReconocida: 'No es factura'
  };

  readonly etiquetasOrigen: Record<OrigenFactura, string> = {
    Correo: 'llegó por correo',
    Carpeta: 'carga por carpeta',
    Dian: 'carga DIAN anterior'
  };

  alSeleccionar(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.agregar(Array.from(input.files ?? []));
    input.value = '';
  }

  alArrastrar(evento: DragEvent, encima: boolean): void {
    evento.preventDefault();
    this.arrastrando.set(encima);
  }

  alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    this.agregar(Array.from(evento.dataTransfer?.files ?? []));
  }

  quitar(archivo: File): void {
    this.archivos.update((lista) => lista.filter((a) => a !== archivo));
  }

  limpiar(): void {
    this.archivos.set([]);
    this.omitidos.set([]);
  }

  cargar(): void {
    if (!this.archivos().length || this.excede()) return;
    this.paso.set('subiendo');
    this.avance.set(0);
    this.error.set(null);

    this.conciliacionService.cargarArchivos(this.archivos()).subscribe({
      next: (evento) => {
        if (evento.type === HttpEventType.UploadProgress && evento.total) {
          this.avance.set(Math.round((evento.loaded / evento.total) * 100));
        } else if (evento.type === HttpEventType.Response && evento.body) {
          this.resultado.set(evento.body);
          this.paso.set('resultado');
        }
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(this.mensajeError(e));
        this.paso.set('seleccion');
      }
    });
  }

  otraCarga(): void {
    this.limpiar();
    this.resultado.set(null);
    this.paso.set('seleccion');
  }

  cerrar(): void {
    // La pantalla solo se recarga si entró algo nuevo.
    this.dialogRef.close((this.resultado()?.nuevas ?? 0) > 0);
  }

  // Sin duplicar el mismo archivo si se agrega dos veces; lo que no es ZIP/XML se descarta con aviso.
  private agregar(nuevos: File[]): void {
    const soportado = (a: File) => /\.(zip|xml)$/i.test(a.name);
    this.omitidos.set(nuevos.filter((a) => !soportado(a)).map((a) => a.name));
    this.archivos.update((lista) => {
      const clave = (a: File) => `${a.name}|${a.size}|${a.lastModified}`;
      const ya = new Set(lista.map(clave));
      return [...lista, ...nuevos.filter((a) => soportado(a) && !ya.has(clave(a)))];
    });
    this.error.set(null);
  }

  private mensajeError(e: HttpErrorResponse): string {
    if (e.status === 413) return 'Los archivos pesan demasiado para una sola carga. Divídelos en varias cargas más pequeñas.';
    if (e.status === 403) return 'Tu usuario no tiene permiso para cargar facturas.';
    if (e.status === 0) return 'No se pudo conectar con el servidor. Revisa la conexión e intenta de nuevo.';
    if (e.error?.mensaje) return e.error.mensaje;
    if (typeof e.error === 'string' && e.error) return e.error;
    return 'No se pudo completar la carga. Intenta de nuevo.';
  }
}
