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
import { ComentarioDialogComponent, ComentarioDialogResultado } from '../../shared/comentario-dialog.component';
import { SoportePagoDialogComponent } from '../../shared/soporte-pago-dialog.component';
import { EstadoLabelPipe } from '../../shared/estado.pipe';
import { esDispositivoMovil } from '../../shared/dispositivo';

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
  imports: [
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    EstadoLabelPipe
  ],
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

  // En celular no se incrusta el PDF en un <iframe> (ver shared/dispositivo.ts) — se abre en una
  // pestaña nueva con el visor nativo del sistema, que sí soporta multipágina.
  readonly esMovil = esDispositivoMovil();

  private id = 0;
  private token = '';
  // Paso que estaba ACTUAL cuando se mandó este correo (claim "paso" del token, ver
  // IJwtGenerador.GenerarTokenAccionCorreo) — null en links viejos emitidos antes de este chequeo
  // (2026-09-22), ahí no se puede comparar y se deja el comportamiento anterior.
  private pasoDelToken: number | null = null;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.error.set('Este link no es válido — falta el token de acceso.');
      this.cargando.set(false);
      return;
    }

    this.pasoDelToken = this.leerPasoDelToken(this.token);
    this.cargar();
  }

  /**
   * Lee el claim "paso" del payload del JWT SIN validar la firma — no hace falta acá, es solo para
   * decidir qué mostrar en pantalla; la Api vuelve a validar todo (firma, expiración, y este mismo
   * paso) antes de ejecutar cualquier acción real (ver TokenCorreoActionFilter).
   */
  private leerPasoDelToken(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(json);
      const paso = Number(claims['paso']);
      return Number.isFinite(paso) ? paso : null;
    } catch {
      return null;
    }
  }

  /**
   * true cuando este link de correo ya no corresponde al paso actual del documento — esta misma
   * persona ya actuó con este mismo link, o el documento avanzó por otro medio (ej. alguien lo
   * aprobó desde el sistema) mientras el correo seguía sin abrir. Con un token viejo sin claim
   * "paso" nunca da true acá (no se puede comparar) — la Api es quien manda la última palabra.
   */
  get enlaceYaNoAplica(): boolean {
    const d = this.documento();
    if (!d || this.pasoDelToken == null) return false;
    return d.estado !== 'EnProceso' || d.pasoActualId !== this.pasoDelToken;
  }

  private cargar(): void {
    this.cargando.set(true);
    this.documentoService.obtener(this.id, this.token).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.cargando.set(false);
        // La vista previa se abre sola — quien llega desde el correo necesita ver el documento
        // de una, sin un clic extra. En celular NO se puede: abrir una pestaña nueva sin que la
        // persona haya hecho clic recién la bloquean como popup en Safari/Chrome — ahí se deja
        // el botón visible para que lo abra ella misma.
        if (!this.esMovil) this.verPdf();
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
    if (this.esMovil) {
      this.abrirPdfEnPestanaNueva();
      return;
    }

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

  // Mismo truco que en documento-detalle.component.ts: abrir la pestaña en blanco síncronamente
  // dentro del clic, y recién ahí setearle la ubicación cuando llega el blob — así Safari no la
  // bloquea como popup.
  private abrirPdfEnPestanaNueva(): void {
    if (this.pdfObjectUrl) {
      window.open(this.pdfObjectUrl, '_blank');
      return;
    }

    const ventana = window.open('', '_blank');
    this.cargandoPdf.set(true);
    this.documentoService.obtenerPdf(this.id, this.token).subscribe({
      next: (blob) => {
        this.pdfObjectUrl = URL.createObjectURL(blob);
        this.cargandoPdf.set(false);
        if (ventana) ventana.location.href = this.pdfObjectUrl;
      },
      error: () => {
        this.cargandoPdf.set(false);
        ventana?.close();
      }
    });
  }

  cerrarVistaPrevia(): void {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = null;
    this.pdfUrl.set(null);
  }

  aprobar(): void {
    const d = this.documento();
    if (d?.pasoActualRequiereSoportePagoAlAprobar) {
      const dialogRef = this.dialog.open(SoportePagoDialogComponent, { width: '28rem' });
      dialogRef.afterClosed().subscribe((archivo: File | undefined) => {
        if (!archivo) return;
        this.subirSoporteYContinuar(archivo);
      });
      return;
    }
    this.continuarAprobar(null);
  }

  private subirSoporteYContinuar(archivo: File): void {
    this.procesando.set(true);
    this.documentoService.subirAdjunto(this.id, archivo, true, this.token).subscribe({
      next: (adjunto) => {
        this.procesando.set(false);
        this.continuarAprobar(adjunto.id);
      },
      error: (error) => {
        this.procesando.set(false);
        const mensaje = error?.error?.mensaje ?? 'No se pudo subir el soporte de pago.';
        this.error.set(mensaje);
      }
    });
  }

  private continuarAprobar(soportePagoAdjuntoId: number | null): void {
    const d = this.documento();
    const requiereComprobante = d?.pasoActualRequiereComprobanteEgreso ?? false;
    const requiereComentario = d?.pasoActualRequiereComentarioAlAprobar ?? false;

    if (!requiereComprobante && !requiereComentario) {
      this.ejecutar('Aprobado', null, null, null, soportePagoAdjuntoId);
      return;
    }

    // Ver documento-detalle.component.ts para el porqué — mismo diálogo, misma condición.
    const dialogRef = this.dialog.open(ComentarioDialogComponent, {
      width: '28rem',
      data: {
        titulo: requiereComprobante ? 'Aprobar con Comprobante de Egreso' : 'Aprobar con observación',
        descripcion: requiereComprobante
          ? 'Escribí el número del Comprobante de Egreso que generaste en World Office para este giro.'
          : 'Indicá la observación pedida para este paso (ej. a quién le entregaste el dinero).',
        requerido: requiereComentario,
        textoConfirmar: 'Aprobar',
        pedirNumeroComprobante: requiereComprobante
      }
    });
    dialogRef.afterClosed().subscribe((resultado: ComentarioDialogResultado | undefined) => {
      if (resultado === undefined) return;
      this.ejecutar('Aprobado', resultado.comentario, null, resultado.numeroComprobante, soportePagoAdjuntoId);
    });
  }

  devolver(): void {
    const destinos = this.documento()?.destinosDevolucionDisponibles ?? [];
    const dialogRef = this.dialog.open(ComentarioDialogComponent, {
      width: '28rem',
      data: {
        titulo: 'Devolver documento',
        descripcion: 'Indicá qué debe corregir quien lo emitió.',
        requerido: true,
        textoConfirmar: 'Devolver',
        destinos
      }
    });
    dialogRef.afterClosed().subscribe((resultado: ComentarioDialogResultado | undefined) => {
      if (resultado === undefined) return;
      this.ejecutar('Devuelto', resultado.comentario, resultado.pasoDestinoId);
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
    dialogRef.afterClosed().subscribe((resultado: ComentarioDialogResultado | undefined) => {
      if (resultado === undefined) return;
      this.ejecutar('Rechazado', resultado.comentario);
    });
  }

  redirigirAPagoContado(): void {
    const dialogRef = this.dialog.open(ComentarioDialogComponent, {
      width: '28rem',
      data: {
        titulo: 'Redirigir a pago en efectivo',
        descripcion: 'Indicá el motivo: el documento pasa a Asistente de Gerencia para el desembolso en efectivo, y sigue su curso normal desde ahí.',
        requerido: true,
        textoConfirmar: 'Redirigir'
      }
    });
    dialogRef.afterClosed().subscribe((resultado: ComentarioDialogResultado | undefined) => {
      if (resultado === undefined) return;
      this.ejecutar('RedirigidoAContado', resultado.comentario);
    });
  }

  private ejecutar(
    accion: 'Aprobado' | 'Devuelto' | 'Rechazado' | 'RedirigidoAContado',
    comentario: string | null,
    pasoDestinoId: number | null = null,
    numeroComprobanteEgreso: string | null = null,
    soportePagoAdjuntoId: number | null = null
  ): void {
    this.procesando.set(true);
    this.documentoService.ejecutarAccion(this.id, { accion, comentario, pasoDestinoId, numeroComprobanteEgreso, soportePagoAdjuntoId }, this.token).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.procesando.set(false);
        const textos: Record<string, string> = {
          Aprobado: 'Documento aprobado correctamente.',
          Devuelto: 'Documento devuelto correctamente.',
          Rechazado: 'Documento rechazado correctamente.',
          RedirigidoAContado: 'Documento redirigido a pago en efectivo.'
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
