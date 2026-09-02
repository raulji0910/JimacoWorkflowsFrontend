import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface ComentarioDialogData {
  titulo: string;
  /** Texto de ayuda mostrado arriba del campo. */
  descripcion: string;
  requerido: boolean;
  textoConfirmar: string;
}

@Component({
  selector: 'app-comentario-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './comentario-dialog.component.html'
})
export class ComentarioDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ComentarioDialogComponent>);
  readonly data = inject<ComentarioDialogData>(MAT_DIALOG_DATA);

  comentario = '';

  confirmar(): void {
    if (this.data.requerido && !this.comentario.trim()) return;
    this.dialogRef.close(this.comentario.trim() || null);
  }

  cancelar(): void {
    this.dialogRef.close(undefined);
  }
}
