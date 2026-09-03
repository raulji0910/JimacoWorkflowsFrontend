import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RolService } from '../../../core/services/rol.service';
import { Rol } from '../../../core/models/rol.model';
import { RolFormDialogComponent } from './rol-form-dialog.component';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss'
})
export class RolesListComponent implements OnInit {
  readonly columnas = ['nombre', 'descripcion', 'estado', 'acciones'];
  readonly roles = signal<Rol[]>([]);
  readonly cargando = signal(false);

  constructor(
    private readonly rolService: RolService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.rolService.listar().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  abrirNuevo(): void {
    this.abrirDialogo(null);
  }

  abrirEditar(rol: Rol): void {
    this.abrirDialogo(rol);
  }

  private abrirDialogo(rol: Rol | null): void {
    const dialogRef = this.dialog.open(RolFormDialogComponent, { width: '28rem', data: { rol } });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      const peticion = rol ? this.rolService.actualizar(rol.id, resultado) : this.rolService.crear(resultado);
      peticion.subscribe({
        next: () => {
          this.snackBar.open(rol ? 'Rol actualizado' : 'Rol creado', 'Cerrar', { duration: 3000 });
          this.cargar();
        },
        error: (error) => {
          const mensaje = error?.error?.mensaje ?? 'No se pudo guardar el rol.';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
        }
      });
    });
  }
}
