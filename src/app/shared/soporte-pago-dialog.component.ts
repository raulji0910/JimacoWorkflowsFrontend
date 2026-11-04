import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Aviso previo a "Aprobar" cuando el paso exige soporte de pago (2026-09-29) — pedido explícito
 * del usuario: antes esto abría el selector de archivos directo, sin explicar por qué. El
 * <input type=file> vive DENTRO de este diálogo a propósito — si se disparara desde afuera, en el
 * callback de afterClosed(), varios navegadores lo bloquean por no venir de un clic directo del
 * usuario (la animación de cierre del diálogo rompe la cadena de "user activation").
 */
@Component({
  selector: 'app-soporte-pago-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './soporte-pago-dialog.component.html'
})
export class SoportePagoDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SoportePagoDialogComponent>);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('inputArchivo') private inputRef?: ElementRef<HTMLInputElement>;

  elegirArchivo(): void {
    this.inputRef?.nativeElement.click();
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
      this.snackBar.open('El soporte de pago tiene que ser un PDF.', 'Cerrar', { duration: 4000 });
      input.value = '';
      return;
    }

    this.dialogRef.close(archivo);
  }
}
