import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RemisionService } from '../../core/services/remision.service';
import { RemisionDetalle, SoporteRemision } from '../../core/models/remision.model';
import { ConfirmarEntregaDialogComponent } from './confirmar-entrega-dialog.component';
import { abrirPdfEnPestana } from './entregas-utilidades';
import { esDispositivoMovil } from '../../shared/dispositivo';

@Component({
  selector: 'app-remision-detalle',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './remision-detalle.component.html',
  styleUrl: './remision-detalle.component.scss'
})
export class RemisionDetalleComponent implements OnInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  readonly remision = signal<RemisionDetalle | null>(null);
  readonly cargando = signal(false);
  // Vista previa del PDF (2026-11-12, pedido del usuario) — igual que en la OC: en computador se
  // incrusta; en celular se abre en otra pestaña (el visor incrustado no funciona bien ahí).
  readonly esMovil = esDispositivoMovil();
  readonly cargandoPdf = signal(false);
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  private pdfObjectUrl: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly servicio: RemisionService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargando.set(true);
    this.servicio.obtener(id).subscribe({
      next: (r) => {
        this.remision.set(r);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  ngOnDestroy(): void {
    this.cerrarVistaPrevia();
  }

  /** Abre el PDF en otra pestaña — desde ahí se imprime (Ctrl+P o el botón del visor). */
  imprimir(): void {
    const r = this.remision();
    if (r) abrirPdfEnPestana(this.servicio.pdf([r.id]), this.snackBar);
  }

  alternarVistaPrevia(): void {
    const r = this.remision();
    if (!r) return;
    if (this.esMovil) {
      this.imprimir();
      return;
    }
    if (this.pdfUrl()) {
      this.cerrarVistaPrevia();
      return;
    }
    this.cargandoPdf.set(true);
    this.servicio.pdf([r.id]).subscribe({
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

  cerrarVistaPrevia(): void {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = null;
    this.pdfUrl.set(null);
  }

  confirmarEntrega(): void {
    const r = this.remision();
    if (!r) return;
    this.dialog
      .open(ConfirmarEntregaDialogComponent, {
        data: { remision: r },
        width: '36rem',
        maxWidth: 'calc(100vw - 2rem)',
        autoFocus: false,
        disableClose: true
      })
      .afterClosed()
      .subscribe((actualizada?: RemisionDetalle) => {
        if (!actualizada) return;
        this.remision.set(actualizada);
        this.snackBar.open(`Entrega de la REM ${actualizada.numero} confirmada.`, 'Cerrar', { duration: 6000 });
      });
  }

  verSoporte(s: SoporteRemision): void {
    abrirPdfEnPestana(this.servicio.soporte(s.id), this.snackBar);
  }

  esImagen(s: SoporteRemision): boolean {
    return (s.contentType ?? '').startsWith('image/');
  }

  textoVerificacion(v: string | null): string {
    switch (v) {
      case 'Coincide':
        return 'El soporte trae el QR de esta remisión y fue validado.';
      case 'NoCoincide':
        return 'El soporte trae el QR de OTRA remisión: revisar que se haya adjuntado el documento correcto.';
      case 'SinQR':
        return 'El soporte se validó por el número de remisión que leyó la IA (no se leyó el QR).';
      default:
        return '';
    }
  }
}
