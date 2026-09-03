import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UsuarioService } from '../../../core/services/usuario.service';
import { RolService } from '../../../core/services/rol.service';
import { Usuario } from '../../../core/models/usuario.model';
import { Rol } from '../../../core/models/rol.model';
import { UsuarioFormDialogComponent } from './usuario-form-dialog.component';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule],
  templateUrl: './usuarios-list.component.html',
  styleUrl: '../roles/roles-list.component.scss'
})
export class UsuariosListComponent implements OnInit {
  readonly columnas = ['nombre', 'email', 'roles', 'estado', 'acciones'];
  readonly usuarios = signal<Usuario[]>([]);
  readonly roles = signal<Rol[]>([]);
  readonly cargando = signal(false);

  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly rolService: RolService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.rolService.listar().subscribe((roles) => this.roles.set(roles));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.usuarioService.listar().subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  abrirNuevo(): void {
    this.abrirDialogo(null);
  }

  abrirEditar(usuario: Usuario): void {
    this.abrirDialogo(usuario);
  }

  private abrirDialogo(usuario: Usuario | null): void {
    const dialogRef = this.dialog.open(UsuarioFormDialogComponent, {
      width: '30rem',
      data: { usuario, roles: this.roles() }
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      const peticion = usuario ? this.usuarioService.actualizar(usuario.id, resultado) : this.usuarioService.crear(resultado);
      peticion.subscribe({
        next: () => {
          this.snackBar.open(usuario ? 'Usuario actualizado' : 'Usuario creado', 'Cerrar', { duration: 3000 });
          this.cargar();
        },
        error: (error) => {
          const mensaje = error?.error?.mensaje ?? 'No se pudo guardar el usuario.';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
        }
      });
    });
  }
}
