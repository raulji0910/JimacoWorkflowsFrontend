import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentoService } from '../../core/services/documento.service';
import { DocumentoDetalle } from '../../core/models/documento.model';
import { ComentarioDialogComponent } from '../../shared/comentario-dialog.component';

@Component({
  selector: 'app-documento-detalle',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule, MatListModule],
  templateUrl: './documento-detalle.component.html',
  styleUrl: './documento-detalle.component.scss'
})
export class DocumentoDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentoService = inject(DocumentoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly documento = signal<DocumentoDetalle | null>(null);
  readonly cargando = signal(false);
  readonly procesando = signal(false);

  get id(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  get datosEntries(): [string, string][] {
    const datos = this.documento()?.datos;
    return datos ? Object.entries(datos) : [];
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.documentoService.obtener(this.id).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  aprobar(): void {
    this.ejecutar('Aprobado', null);
  }

  devolver(): void {
    const dialogRef = this.dialog.open(ComentarioDialogComponent, {
      width: '28rem',
      data: {
        titulo: 'Devolver documento',
        descripcion: 'Indicá qué debe corregir quien lo emitió.',
        requerido: true,
        textoConfirmar: 'Devolver'
      }
    });
    dialogRef.afterClosed().subscribe((comentario: string | null | undefined) => {
      if (comentario === undefined) return;
      this.ejecutar('Devuelto', comentario);
    });
  }

  rechazar(): void {
    const dialogRef = this.dialog.open(ComentarioDialogComponent, {
      width: '28rem',
      data: {
        titulo: 'Rechazar documento',
        descripcion: 'Esta acción es definitiva — el documento no vuelve a quedar activo.',
        requerido: true,
        textoConfirmar: 'Rechazar'
      }
    });
    dialogRef.afterClosed().subscribe((comentario: string | null | undefined) => {
      if (comentario === undefined) return;
      this.ejecutar('Rechazado', comentario);
    });
  }

  reenviar(): void {
    this.procesando.set(true);
    this.documentoService.reenviar(this.id).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.procesando.set(false);
        this.snackBar.open('Documento reenviado', 'Cerrar', { duration: 3000 });
      },
      error: (error) => this.manejarError(error)
    });
  }

  subirAdjunto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.procesando.set(true);
    this.documentoService.subirAdjunto(this.id, archivo).subscribe({
      next: () => {
        this.procesando.set(false);
        input.value = '';
        this.snackBar.open('Adjunto cargado', 'Cerrar', { duration: 3000 });
        this.cargar();
      },
      error: (error) => {
        input.value = '';
        this.manejarError(error);
      }
    });
  }

  descargarAdjunto(adjuntoId: number, nombreArchivo: string): void {
    this.documentoService.descargarAdjunto(adjuntoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivo;
        enlace.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('No se pudo descargar el adjunto.', 'Cerrar', { duration: 4000 })
    });
  }

  volver(): void {
    this.router.navigate(['/pendientes']);
  }

  private ejecutar(accion: 'Aprobado' | 'Devuelto' | 'Rechazado', comentario: string | null): void {
    this.procesando.set(true);
    this.documentoService.ejecutarAccion(this.id, { accion, comentario }).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.procesando.set(false);
        this.snackBar.open('Acción registrada', 'Cerrar', { duration: 3000 });
      },
      error: (error) => this.manejarError(error)
    });
  }

  private manejarError(error: { error?: { mensaje?: string } }): void {
    this.procesando.set(false);
    const mensaje = error?.error?.mensaje ?? 'No se pudo completar la acción.';
    this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
  }
}
