import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TipoDocumentoService } from '../../../core/services/tipo-documento.service';
import { TipoDocumento } from '../../../core/models/tipo-documento.model';
import { TipoDocumentoFormDialogComponent } from './tipo-documento-form-dialog.component';

@Component({
  selector: 'app-tipos-documento-list',
  standalone: true,
  imports: [RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule],
  templateUrl: './tipos-documento-list.component.html',
  styleUrl: '../roles/roles-list.component.scss'
})
export class TiposDocumentoListComponent implements OnInit {
  readonly columnas = ['nombre', 'descripcion', 'campos', 'estado', 'acciones'];
  readonly tipos = signal<TipoDocumento[]>([]);
  readonly cargando = signal(false);

  constructor(
    private readonly tipoDocumentoService: TipoDocumentoService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.tipoDocumentoService.listar().subscribe({
      next: (tipos) => {
        this.tipos.set(tipos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  abrirNuevo(): void {
    this.abrirDialogo(null);
  }

  abrirEditar(tipo: TipoDocumento): void {
    this.abrirDialogo(tipo);
  }

  private abrirDialogo(tipo: TipoDocumento | null): void {
    const dialogRef = this.dialog.open(TipoDocumentoFormDialogComponent, { width: '38rem', data: { tipo } });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      const peticion = tipo
        ? this.tipoDocumentoService.actualizar(tipo.id, resultado)
        : this.tipoDocumentoService.crear(resultado);
      peticion.subscribe({
        next: () => {
          this.snackBar.open(tipo ? 'Tipo de documento actualizado' : 'Tipo de documento creado', 'Cerrar', { duration: 3000 });
          this.cargar();
        },
        error: (error) => {
          const mensaje = error?.error?.mensaje ?? 'No se pudo guardar el tipo de documento.';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
        }
      });
    });
  }
}
