import { Component, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-remision-detalle',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './remision-detalle.component.html',
  styleUrl: './remision-detalle.component.scss'
})
export class RemisionDetalleComponent implements OnInit {
  readonly remision = signal<RemisionDetalle | null>(null);
  readonly cargando = signal(false);

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

  imprimir(): void {
    const r = this.remision();
    if (r) abrirPdfEnPestana(this.servicio.pdf([r.id]), this.snackBar);
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
        const msg =
          actualizada.verificacionQR === 'Coincide'
            ? `Entrega de la REM ${actualizada.numero} confirmada.`
            : `Entrega confirmada. Quedó marcada para revisar: el soporte no trae el QR de esta remisión.`;
        this.snackBar.open(msg, 'Cerrar', { duration: 6000 });
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
        return 'El soporte trae el QR de esta remisión.';
      case 'NoCoincide':
        return 'El soporte trae el QR de OTRA remisión: revisar que se haya adjuntado el documento correcto.';
      case 'SinQR':
        return 'No se pudo leer el QR en el soporte (foto borrosa, recortada o remisión impresa desde World Office): revisar a mano.';
      default:
        return '';
    }
  }
}
