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
import { AccionObservacionFactura, ObservacionOrden, ObservacionesFactura } from '../../core/models/conciliacion.model';

export interface ObservacionesFacturaDialogData {
  facturaId: number;
}

// Revisión de una factura Parcial o Con diferencia (adición de Jimaco, 2026-11-24): historial de
// observaciones (no se edita ni se borra) y la marca "Revisada" (motivo obligatorio), que la saca de
// "Sin revisar" sin cambiar su estado del cruce. Cierra con true si se agregó algo.
@Component({
  selector: 'app-observaciones-factura-dialog',
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
  templateUrl: './observaciones-factura-dialog.component.html',
  styleUrl: './observaciones-orden-dialog.component.scss'
})
export class ObservacionesFacturaDialogComponent implements OnInit {
  private readonly conciliacionService = inject(ConciliacionService);
  private readonly dialogRef = inject(MatDialogRef<ObservacionesFacturaDialogComponent, boolean>);
  readonly data = inject<ObservacionesFacturaDialogData>(MAT_DIALOG_DATA);

  readonly factura = signal<ObservacionesFactura | null>(null);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly faltaTexto = signal(false);

  texto = '';
  // Marcar como revisada (si no lo está) o quitar la marca (si lo está) junto con la observación.
  cambiarMarca = false;
  private huboCambios = false;

  readonly etiquetas: Record<ObservacionOrden['tipo'], string> = {
    Observacion: 'Observación',
    MarcaRevisada: 'Marcó como revisada',
    QuitaMarcaRevisada: 'Quitó la marca de revisada',
    MarcaNoRequiereFactura: 'Marcó: no requiere factura',
    QuitaMarcaNoRequiereFactura: 'Quitó la marca'
  };

  ngOnInit(): void {
    this.conciliacionService.observacionesFactura(this.data.facturaId).subscribe({
      next: (f) => this.factura.set(f),
      error: () => this.error.set('No se pudo cargar la factura.')
    });
  }

  guardar(): void {
    const factura = this.factura();
    if (!factura) return;
    // El motivo es obligatorio (también para marcar/quitar): se avisa al lado del campo.
    if (!this.texto.trim()) {
      this.faltaTexto.set(true);
      return;
    }
    const accion: AccionObservacionFactura = !this.cambiarMarca
      ? 'Observacion'
      : factura.revisada
        ? 'QuitarMarcaRevisada'
        : 'MarcarRevisada';

    this.guardando.set(true);
    this.error.set(null);
    this.conciliacionService.agregarObservacionFactura(factura.facturaId, this.texto.trim(), accion).subscribe({
      next: (f) => {
        this.factura.set(f);
        this.texto = '';
        this.cambiarMarca = false;
        this.faltaTexto.set(false);
        this.huboCambios = true;
        this.guardando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(e.error?.mensaje ?? 'No se pudo guardar la observación.');
      }
    });
  }

  etiquetaCampo(revisada: boolean): string {
    if (!this.cambiarMarca) return 'Nueva observación';
    return revisada ? '¿Por qué se reabre? (obligatorio)' : '¿Qué se aclaró? (obligatorio)';
  }

  textoBoton(revisada: boolean): string {
    if (!this.cambiarMarca) return 'Agregar observación';
    return revisada ? 'Quitar "Revisada"' : 'Marcar como revisada';
  }

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
