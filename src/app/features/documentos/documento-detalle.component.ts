import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentoService } from '../../core/services/documento.service';
import { AuthService } from '../../core/services/auth.service';
import { DocumentoDetalle } from '../../core/models/documento.model';
import { ComentarioDialogComponent, ComentarioDialogResultado } from '../../shared/comentario-dialog.component';
import { SoportePagoDialogComponent } from '../../shared/soporte-pago-dialog.component';
import { EstadoLabelPipe } from '../../shared/estado.pipe';
import { esDispositivoMovil } from '../../shared/dispositivo';

@Component({
  selector: 'app-documento-detalle',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    PercentPipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatListModule,
    MatTableModule,
    MatTooltipModule,
    EstadoLabelPipe
  ],
  templateUrl: './documento-detalle.component.html',
  styleUrl: './documento-detalle.component.scss'
})
export class DocumentoDetalleComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);

  readonly documento = signal<DocumentoDetalle | null>(null);
  readonly cargando = signal(false);
  readonly procesando = signal(false);
  readonly columnasRenglones = ['codigo', 'descripcion', 'cantidad', 'valorUnitario', 'iva', 'total'];
  readonly puedeVerAlistamiento = this.authService.puedeVerAlistamiento();

  readonly cargandoPdf = signal(false);
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  private pdfObjectUrl: string | null = null;

  // En celular no se incrusta el PDF en un <iframe> (ver shared/dispositivo.ts) — se abre en una
  // pestaña nueva con el visor nativo del sistema, que sí soporta multipágina.
  readonly esMovil = esDispositivoMovil();

  get id(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  // Claves que hoy pone el Sincronizador en "Datos" (ver Program.cs) — mismas etiquetas que ya
  // usa el PDF (DocumentoPdfGenerador) para que la pantalla y el PDF digan lo mismo. Cualquier
  // clave que no esté acá (ej. un campo definido a mano en un tipo de documento nuevo) se muestra
  // igual, "humanizada" desde camelCase — ver etiquetaPara.
  private static readonly ETIQUETAS_DATOS: Record<string, string> = {
    nit: 'NIT',
    direccionProveedor: 'Dirección proveedor',
    formaDePago: 'Forma de pago',
    cotizacionOrigen: 'Cotización origen',
    observaciones: 'Observaciones',
    observacionesAdicionales: 'Observaciones adicionales',
    elaboradoPor: 'Elaborado por'
  };

  get datosEntries(): [string, string][] {
    const datos = this.documento()?.datos;
    return datos ? Object.entries(datos) : [];
  }

  etiquetaPara(clave: string): string {
    return DocumentoDetalleComponent.ETIQUETAS_DATOS[clave] ?? this.humanizar(clave);
  }

  private humanizar(clave: string): string {
    // "direccionEntrega" -> "Direccion entrega"
    const conEspacios = clave.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1).toLowerCase();
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
    this.documentoService.subirAdjunto(this.id, archivo, true).subscribe({
      next: (adjunto) => {
        this.procesando.set(false);
        this.continuarAprobar(adjunto.id);
      },
      error: (error) => this.manejarError(error)
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

    // Este paso exige el número del Comprobante de Egreso de World Office y/o un comentario
    // obligatorio antes de aprobar (ver PasoActualRequiereComprobanteEgreso /
    // PasoActualRequiereComentarioAlAprobar) — mismo diálogo que usa Devolver, reutilizado acá.
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

  reenviarNotificacion(): void {
    this.procesando.set(true);
    this.documentoService.reenviarNotificacion(this.id).subscribe({
      next: ({ enviadas, fallidas }) => {
        this.procesando.set(false);
        const mensaje =
          fallidas === 0
            ? `Notificación reenviada (${enviadas} correo${enviadas === 1 ? '' : 's'} enviado${enviadas === 1 ? '' : 's'}).`
            : `Ojo: ${fallidas} correo${fallidas === 1 ? '' : 's'} no se pudo${fallidas === 1 ? '' : 'ieron'} enviar (revisá SMTP/DNS).`;
        this.snackBar.open(mensaje, 'Cerrar', { duration: 6000 });
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

  alternarVistaPrevia(): void {
    if (this.esMovil) {
      this.abrirPdfEnPestanaNueva();
      return;
    }

    if (this.pdfUrl()) {
      this.cerrarVistaPrevia();
      return;
    }

    this.cargandoPdf.set(true);
    this.documentoService.obtenerPdf(this.id).subscribe({
      next: (blob) => {
        this.pdfObjectUrl = URL.createObjectURL(blob);
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl));
        this.cargandoPdf.set(false);
      },
      error: () => {
        this.cargandoPdf.set(false);
        this.snackBar.open('No se pudo generar la vista previa.', 'Cerrar', { duration: 4000 });
      }
    });
  }

  // Ya con el blob en mano, alcanza con abrirlo — pero la primera vez hay que pedirlo. Para que
  // el navegador no bloquee la pestaña como popup (Safari es estricto: solo lo permite si ocurre
  // dentro del mismo gesto de clic), la abrimos en blanco ACÁ MISMO, de forma síncrona, y recién
  // cuando llega el blob le seteamos la ubicación — en vez de esperar la respuesta y ahí sí
  // llamar a window.open, que en Safari ya cuenta como "no fue un clic directo".
  private abrirPdfEnPestanaNueva(): void {
    if (this.pdfObjectUrl) {
      window.open(this.pdfObjectUrl, '_blank');
      return;
    }

    const ventana = window.open('', '_blank');
    this.cargandoPdf.set(true);
    this.documentoService.obtenerPdf(this.id).subscribe({
      next: (blob) => {
        this.pdfObjectUrl = URL.createObjectURL(blob);
        this.cargandoPdf.set(false);
        if (ventana) ventana.location.href = this.pdfObjectUrl;
      },
      error: () => {
        this.cargandoPdf.set(false);
        ventana?.close();
        this.snackBar.open('No se pudo generar la vista previa.', 'Cerrar', { duration: 4000 });
      }
    });
  }

  cerrarVistaPrevia(): void {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = null;
    this.pdfUrl.set(null);
  }

  ngOnDestroy(): void {
    this.cerrarVistaPrevia();
  }

  private ejecutar(
    accion: 'Aprobado' | 'Devuelto' | 'Rechazado' | 'RedirigidoAContado',
    comentario: string | null,
    pasoDestinoId: number | null = null,
    numeroComprobanteEgreso: string | null = null,
    soportePagoAdjuntoId: number | null = null
  ): void {
    this.procesando.set(true);
    this.documentoService.ejecutarAccion(this.id, { accion, comentario, pasoDestinoId, numeroComprobanteEgreso, soportePagoAdjuntoId }).subscribe({
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
