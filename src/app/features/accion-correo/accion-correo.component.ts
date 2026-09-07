import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { DocumentoService } from '../../core/services/documento.service';
import { DocumentoDetalle } from '../../core/models/documento.model';
import { ComentarioDialogComponent } from '../../shared/comentario-dialog.component';

/**
 * Página liviana para aprobar/rechazar/devolver directamente desde el link del correo de
 * notificación — sin loguearse, con el token acotado que genera NotificacionService (ver
 * IJwtGenerador.GenerarTokenAccionCorreo). A propósito vive FUERA del layout con authGuard
 * (ver app.routes.ts): no requiere sesión ni depende de que la persona tenga usuario abierto.
 *
 * Ojo con un detalle de seguridad importante: el link del correo NUNCA aprueba/rechaza al abrirse
 * solo (muchos clientes de correo/escáneres antivirus "pre-visitan" los links automáticamente) —
 * siempre hace falta un clic explícito en esta página para que se ejecute la acción de verdad.
 */
@Component({
  selector: 'app-accion-correo',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule],
  templateUrl: './accion-correo.component.html',
  styleUrl: './accion-correo.component.scss'
})
export class AccionCorreoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly documentoService = inject(DocumentoService);
  private readonly dialog = inject(MatDialog);
  private readonly sanitizer = inject(DomSanitizer);

  readonly documento = signal<DocumentoDetalle | null>(null);
  readonly cargando = signal(true);
  readonly procesando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);

  readonly cargandoPdf = signal(false);
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  private pdfObjectUrl: string | null = null;

  private id = 0;
  private token = '';

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.error.set('Este link no es válido — falta el token de acceso.');
      this.cargando.set(false);
      return;
    }

    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.documentoService.obtener(this.id, this.token).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(
          'No se pudo abrir el documento. El link puede haber vencido, o el documento ya se resolvió en otro paso.'
        );
        this.cargando.set(false);
      }
    });
  }

  verPdf(): void {
    if (this.pdfUrl()) {
      this.cerrarVistaPrevia();
      return;
    }

    this.cargandoPdf.set(true);
    this.documentoService.obtenerPdf(this.id, this.token).subscribe({
      next: (blob) => {
        this.pdfObjectUrl = URL.createObjectURL(blob);
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl));
        this.cargandoPdf.set(false);
      },
      error: () => {
        this.cargandoPdf.set(false);
      }
    });
  }

  cerrarVistaPrevia(): void {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = null;
    this.pdfUrl.set(null);
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

  private ejecutar(accion: 'Aprobado' | 'Devuelto' | 'Rechazado', comentario: string | null): void {
    this.procesando.set(true);
    this.documentoService.ejecutarAccion(this.id, { accion, comentario }, this.token).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.procesando.set(false);
        const textos: Record<string, string> = {
          Aprobado: 'Documento aprobado correctamente.',
          Devuelto: 'Documento devuelto correctamente.',
          Rechazado: 'Documento rechazado correctamente.'
        };
        this.mensajeExito.set(textos[accion]);
      },
      error: (error) => {
        this.procesando.set(false);
        const mensaje = error?.error?.mensaje ?? 'No se pudo completar la acción. El link puede haber vencido.';
        this.error.set(mensaje);
      }
    });
  }

  ngOnDestroy(): void {
    this.cerrarVistaPrevia();
  }
}
