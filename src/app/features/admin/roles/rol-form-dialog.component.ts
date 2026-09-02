import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { Rol, RolActualizar, RolCrear } from '../../../core/models/rol.model';

export interface RolFormDialogData {
  rol: Rol | null;
}

@Component({
  selector: 'app-rol-form-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatButtonModule],
  templateUrl: './rol-form-dialog.component.html'
})
export class RolFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RolFormDialogComponent>);
  readonly data = inject<RolFormDialogData>(MAT_DIALOG_DATA);

  readonly editando = this.data.rol !== null;

  nombre = this.data.rol?.nombre ?? '';
  descripcion = this.data.rol?.descripcion ?? '';
  activo = this.data.rol?.activo ?? true;

  guardar(): void {
    if (!this.nombre.trim()) return;

    if (this.editando) {
      const dto: RolActualizar = { nombre: this.nombre, descripcion: this.descripcion || null, activo: this.activo };
      this.dialogRef.close(dto);
    } else {
      const dto: RolCrear = { nombre: this.nombre, descripcion: this.descripcion || null };
      this.dialogRef.close(dto);
    }
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
