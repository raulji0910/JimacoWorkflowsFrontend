import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ConciliacionService } from '../../core/services/conciliacion.service';
import { AccionObservacionOrden, ObservacionOrden, ObservacionesOrden } from '../../core/models/conciliacion.model';

export interface ObservacionesOrdenDialogData {
  idAsientoContable: number;
  puedeEscribir: boolean;
}

// Historial de revisión de una OC sin factura: lo que encontró quien revisa (no se edita ni se
// borra) y la marca "No requiere factura", que no saca la OC de la lista. Cierra con true si se
// agregó algo.
@Component({
  selector: 'app-observaciones-orden-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressBarModule
  ],
  templateUrl: './observaciones-orden-dialog.component.html',
  styleUrl: './observaciones-orden-dialog.component.scss'
})
export class ObservacionesOrdenDialogComponent implements OnInit {
  private readonly conciliacionService = inject(ConciliacionService);
  private readonly dialogRef = inject(MatDialogRef<ObservacionesOrdenDialogComponent, boolean>);
  readonly data = inject<ObservacionesOrdenDialogData>(MAT_DIALOG_DATA);

  readonly orden = signal<ObservacionesOrden | null>(null);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly faltaTexto = signal(false);

  texto = '';
  // Marcar (si no está marcada) o quitar la marca (si lo está) junto con la observación.
  cambiarMarca = false;
  private huboCambios = false;

  readonly etiquetas: Record<ObservacionOrden['tipo'], string> = {
    Observacion: 'Observación',
    MarcaNoRequiereFactura: 'Marcó: no requiere factura',
    QuitaMarcaNoRequiereFactura: 'Quitó la marca',
    MarcaRevisada: 'Marcó como revisada',
    QuitaMarcaRevisada: 'Quitó la marca de revisada'
  };

  ngOnInit(): void {
    this.conciliacionService.observaciones(this.data.idAsientoContable).subscribe({
      next: (o) => this.orden.set(o),
      error: () => this.error.set('No se pudo cargar la OC.')
    });
  }

  guardar(): void {
    const orden = this.orden();
    if (!orden) return;
    // El motivo es obligatorio (también para marcar/quitar la marca): se avisa en vez de no hacer nada.
    if (!this.texto.trim()) {
      this.faltaTexto.set(true);
      return;
    }
    const accion: AccionObservacionOrden = !this.cambiarMarca
      ? 'Observacion'
      : orden.noRequiereFactura
        ? 'QuitarMarcaNoRequiereFactura'
        : 'MarcarNoRequiereFactura';

    this.guardando.set(true);
    this.error.set(null);
    this.conciliacionService.agregarObservacion(orden.idAsientoContable, this.texto.trim(), accion).subscribe({
      next: (o) => {
        this.orden.set(o);
        this.texto = '';
        this.cambiarMarca = false;
        this.faltaTexto.set(false);
        this.huboCambios = true;
        this.guardando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(e.error?.mensaje ?? (typeof e.error === 'string' && e.error ? e.error : 'No se pudo guardar la observación.'));
      }
    });
  }

  etiquetaCampo(marcada: boolean): string {
    if (!this.cambiarMarca) return 'Nueva observación';
    return marcada ? '¿Por qué se quita la marca? (obligatorio)' : '¿Por qué no requiere factura? (obligatorio)';
  }

  textoBoton(marcada: boolean): string {
    if (!this.cambiarMarca) return 'Agregar observación';
    return marcada ? 'Quitar la marca' : 'Marcar como no requiere factura';
  }

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
