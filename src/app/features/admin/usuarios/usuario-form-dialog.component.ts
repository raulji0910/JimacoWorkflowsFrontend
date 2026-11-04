import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Usuario, UsuarioActualizar, UsuarioCrear } from '../../../core/models/usuario.model';
import { Rol } from '../../../core/models/rol.model';
import { UsuarioService } from '../../../core/services/usuario.service';

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
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './usuario-form-dialog.component.html'
})
export class UsuarioFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<UsuarioFormDialogComponent>);
  private readonly usuarioService = inject(UsuarioService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<UsuarioFormDialogData>(MAT_DIALOG_DATA);

  readonly editando = this.data.usuario !== null;

  nombre = this.data.usuario?.nombre ?? '';
  email = this.data.usuario?.email ?? '';
  telefono = this.data.usuario?.telefono ?? '';
  usuarioWO = this.data.usuario?.usuarioWO ?? '';
  nombresCompletosWO = this.data.usuario?.nombresCompletosWO ?? '';
  activo = this.data.usuario?.activo ?? true;
  password = '';
  rolesIds: number[] = this.data.usuario?.roles.map((r) => r.id) ?? [];

  // Restablecer contraseña: acción aparte del resto del formulario — se manda apenas se confirma,
  // no espera al "Guardar" general (que no toca la contraseña de un usuario existente).
  readonly mostrarRestablecer = signal(false);
  readonly restableciendo = signal(false);
  passwordNueva = '';

  restablecerPassword(): void {
    if (!this.data.usuario || this.passwordNueva.length < 6) return;

    this.restableciendo.set(true);
    this.usuarioService.restablecerPassword(this.data.usuario.id, { passwordNueva: this.passwordNueva }).subscribe({
      next: () => {
        this.restableciendo.set(false);
        this.mostrarRestablecer.set(false);
        this.passwordNueva = '';
        this.snackBar.open('Contraseña restablecida', 'Cerrar', { duration: 3000 });
      },
      error: (error) => {
        this.restableciendo.set(false);
        const mensaje = error?.error?.mensaje ?? 'No se pudo restablecer la contraseña.';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
      }
    });
  }

  guardar(): void {
    if (!this.nombre.trim() || !this.email.trim() || (!this.editando && !this.password)) return;

    if (this.editando) {
      const dto: UsuarioActualizar = {
        nombre: this.nombre,
        email: this.email,
        telefono: this.telefono || null,
        usuarioWO: this.usuarioWO || null,
        nombresCompletosWO: this.nombresCompletosWO || null,
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
        usuarioWO: this.usuarioWO || null,
        nombresCompletosWO: this.nombresCompletosWO || null,
        rolesIds: this.rolesIds
      };
      this.dialogRef.close(dto);
    }
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
