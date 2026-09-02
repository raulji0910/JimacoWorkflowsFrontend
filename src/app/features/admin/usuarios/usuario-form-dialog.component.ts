import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { Usuario, UsuarioActualizar, UsuarioCrear } from '../../../core/models/usuario.model';
import { Rol } from '../../../core/models/rol.model';

export interface UsuarioFormDialogData {
  usuario: Usuario | null;
  roles: Rol[];
}

@Component({
  selector: 'app-usuario-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule
  ],
  templateUrl: './usuario-form-dialog.component.html'
})
export class UsuarioFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<UsuarioFormDialogComponent>);
  readonly data = inject<UsuarioFormDialogData>(MAT_DIALOG_DATA);

  readonly editando = this.data.usuario !== null;

  nombre = this.data.usuario?.nombre ?? '';
  email = this.data.usuario?.email ?? '';
  telefono = this.data.usuario?.telefono ?? '';
  activo = this.data.usuario?.activo ?? true;
  password = '';
  rolesIds: number[] = this.data.usuario?.roles.map((r) => r.id) ?? [];

  guardar(): void {
    if (!this.nombre.trim() || (!this.editando && (!this.email.trim() || !this.password))) return;

    if (this.editando) {
      const dto: UsuarioActualizar = {
        nombre: this.nombre,
        telefono: this.telefono || null,
        activo: this.activo,
        rolesIds: this.rolesIds
      };
      this.dialogRef.close(dto);
    } else {
      const dto: UsuarioCrear = {
        nombre: this.nombre,
        email: this.email,
        password: this.password,
        telefono: this.telefono || null,
        rolesIds: this.rolesIds
      };
      this.dialogRef.close(dto);
    }
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
