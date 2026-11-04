import { Component, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentoService } from '../../core/services/documento.service';
import { DocumentoResumen } from '../../core/models/documento.model';
import { ComentarioDialogComponent, ComentarioDialogResultado } from '../../shared/comentario-dialog.component';
import { EstadoLabelPipe } from '../../shared/estado.pipe';

/**
 * Búsqueda administrativa por número de referencia, sin importar el paso/rol del usuario — solo
 * visible para quien tenga un rol con Rol.PuedeDevolverCualquierDocumento (ver
 * AuthService.puedeDevolverCualquierDocumento y app.routes.ts). Desde acá se puede devolver
 * cualquier documento EN PROCESO al emisor, sin importar en qué paso esté — pensado para casos
 * administrativos (ej. corregir algo en World Office), no para el flujo normal de aprobación.
 */
@Component({
  selector: 'app-buscar-documento',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    DecimalPipe,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    EstadoLabelPipe
  ],
  templateUrl: './buscar-documento.component.html',
  styleUrl: './documentos-list.component.scss'
})
export class BuscarDocumentoComponent {
  readonly columnas = ['tipo', 'referencia', 'proveedor', 'valor', 'estado', 'pasoActual', 'fecha', 'acciones'];
  readonly numeroReferencia = signal('');
  readonly documentos = signal<DocumentoResumen[]>([]);
  readonly cargando = signal(false);
  readonly procesandoId = signal<number | null>(null);
  readonly buscado = signal(false);

  constructor(
    private readonly documentoService: DocumentoService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  buscar(): void {
    const numero = this.numeroReferencia().trim();
    if (!numero) return;

    this.cargando.set(true);
    this.buscado.set(true);
    this.documentoService.buscar(numero).subscribe({
      next: (documentos) => {
        this.documentos.set(documentos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  devolver(documento: DocumentoResumen): void {
    const dialogRef = this.dialog.open(ComentarioDialogComponent, {
      width: '28rem',
      data: {
        titulo: `Devolver ${documento.numeroReferencia ?? ''}`.trim(),
        descripcion:
          'Esto anula el paso en el que está ahora mismo y devuelve el documento al emisor — queda "en espera de aprobación" en World Office.',
        requerido: true,
        textoConfirmar: 'Devolver'
      }
    });
    dialogRef.afterClosed().subscribe((resultado: ComentarioDialogResultado | undefined) => {
      if (resultado === undefined || !resultado.comentario) return;

      this.procesandoId.set(documento.id);
      this.documentoService.devolverForzado(documento.id, resultado.comentario).subscribe({
        next: () => {
          this.procesandoId.set(null);
          this.snackBar.open('Documento devuelto al emisor', 'Cerrar', { duration: 3000 });
          this.buscar();
        },
        error: (error) => {
          this.procesandoId.set(null);
          const mensaje = error?.error?.mensaje ?? 'No se pudo devolver el documento.';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
        }
      });
    });
  }
}
