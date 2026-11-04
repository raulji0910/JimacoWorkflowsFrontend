import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { PasoResumen } from '../core/models/documento.model';

export interface ComentarioDialogData {
  titulo: string;
  /** Texto de ayuda mostrado arriba del campo. */
  descripcion: string;
  requerido: boolean;
  textoConfirmar: string;
  // Pasos anteriores posibles como destino de "Devolver" (ver DocumentoDetalle.destinosDevolucionDisponibles).
  // Sin esto, o con un solo destino, no se muestra ningún selector — con más de uno, elegir es obligatorio.
  destinos?: PasoResumen[];
  // Si el paso actual exige el número del Comprobante de Egreso al aprobar (ver
  // DocumentoDetalle.pasoActualRequiereComprobanteEgreso) — muestra un campo aparte, obligatorio,
  // y el comentario queda opcional aunque `requerido` sea true en este caso.
  pedirNumeroComprobante?: boolean;
}

export interface ComentarioDialogResultado {
  comentario: string | null;
  pasoDestinoId: number | null;
  numeroComprobante: string | null;
}

@Component({
  selector: 'app-comentario-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  templateUrl: './comentario-dialog.component.html'
})
export class ComentarioDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ComentarioDialogComponent>);
  readonly data = inject<ComentarioDialogData>(MAT_DIALOG_DATA);

  comentario = '';
  pasoDestinoId: number | null = null;
  numeroComprobante = '';

  get necesitaElegirDestino(): boolean {
    return (this.data.destinos?.length ?? 0) > 1;
  }

  get puedeConfirmar(): boolean {
    // El comentario es obligatorio salvo que este diálogo esté pidiendo el número de comprobante
    // (ej. Aprobar con Comprobante de Egreso) — ahí lo obligatorio es el número, no el comentario.
    if (this.data.requerido && !this.data.pedirNumeroComprobante && !this.comentario.trim()) return false;
    if (this.data.pedirNumeroComprobante && !this.numeroComprobante.trim()) return false;
    if (this.necesitaElegirDestino && this.pasoDestinoId == null) return false;
    return true;
  }

  confirmar(): void {
    if (!this.puedeConfirmar) return;

    // Con un solo destino configurado no hace falta que la persona elija — se usa ese directo.
    const destinoFinal = this.necesitaElegirDestino ? this.pasoDestinoId : (this.data.destinos?.[0]?.id ?? null);

    const resultado: ComentarioDialogResultado = {
      comentario: this.comentario.trim() || null,
      pasoDestinoId: destinoFinal,
      numeroComprobante: this.numeroComprobante.trim() || null
    };
    this.dialogRef.close(resultado);
  }

  cancelar(): void {
    this.dialogRef.close(undefined);
  }
}
