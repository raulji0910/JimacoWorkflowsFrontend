import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CuentasPorPagarService } from '../core/services/cuentas-por-pagar.service';
import { CuentaBanco } from '../core/models/cuentas-por-pagar.model';

export interface ConfirmarPagoProveedorDialogData {
  proveedor: string | null;
  neto: number;
}

export interface ConfirmarPagoProveedorResultado {
  archivo: File | null;
  idCuentaBancoWO: number | null;
  fechaPago: string;
}

/** "yyyy-MM-dd" de hoy en Colombia (UTC−5, sin horario de verano) — mismo "hoy" que valida el backend. */
function hoyColombia(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Confirmación del pago de una orden de pago a proveedor (2026-11-06): el gerente general indica
 * desde qué banco pagó, la fecha y el soporte, y con eso el sistema crea el comprobante de egreso en
 * World Office. Si los anticipos cubren todo (neto 0) no sale plata: no pide banco ni soporte. El
 * <input type=file> vive dentro del diálogo por el mismo motivo que en SoportePagoDialogComponent.
 */
@Component({
  selector: 'app-confirmar-pago-proveedor-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Confirmar pago</h2>
    <mat-dialog-content class="cpp">
      @if (data.neto > 0) {
        <p>
          Confirmá el pago de <strong>$ {{ data.neto | number: '1.0-0' }}</strong>
          @if (data.proveedor) { a <strong>{{ data.proveedor }}</strong> }.
          Con estos datos el sistema crea el comprobante de egreso en World Office.
        </p>
        <mat-form-field appearance="outline" class="cpp__campo">
          <mat-label>Banco desde donde se pagó</mat-label>
          <mat-select [(ngModel)]="idBanco" [disabled]="!bancos().length">
            @for (b of bancos(); track b.idCuentaContableWO) {
              <mat-option [value]="b.idCuentaContableWO">{{ b.nombre }} ({{ b.codigo }})</mat-option>
            }
          </mat-select>
          @if (cargandoBancos()) { <mat-hint>Cargando bancos…</mat-hint> }
          @else if (!bancos().length) { <mat-hint class="cpp__error">No hay bancos cargados desde World Office todavía.</mat-hint> }
        </mat-form-field>
      } @else {
        <p>
          Los anticipos cubren todo el pago: <strong>no sale plata</strong>. Al confirmar, el sistema crea en World Office
          el comprobante que cruza los anticipos contra las facturas.
        </p>
      }

      <mat-form-field appearance="outline" class="cpp__campo">
        <mat-label>Fecha del pago</mat-label>
        <input matInput type="date" [(ngModel)]="fecha" [max]="hoy" required />
        <mat-hint>Es la fecha que lleva el comprobante de egreso.</mat-hint>
      </mat-form-field>

      @if (data.neto > 0) {
        <div class="cpp__soporte">
          <button mat-stroked-button type="button" (click)="elegirArchivo()">
            <mat-icon>attach_file</mat-icon>
            {{ archivo() ? 'Cambiar PDF' : 'Adjuntar soporte (PDF)' }}
          </button>
          <span class="cpp__archivo">{{ archivo()?.name ?? 'Falta el comprobante de la transferencia' }}</span>
        </div>
        <input #inputArchivo type="file" accept=".pdf,application/pdf" hidden (change)="onArchivoSeleccionado($event)" />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="!listo()" (click)="confirmar()">Confirmar pago</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cpp { display: flex; flex-direction: column; gap: 0.25rem; }
    .cpp__campo { width: 100%; }
    .cpp__soporte { display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.25rem; }
    .cpp__archivo { font-size: 0.85rem; opacity: 0.8; overflow-wrap: anywhere; }
    .cpp__error { color: var(--mat-sys-error); }
  `]
})
export class ConfirmarPagoProveedorDialogComponent implements OnInit {
  readonly data = inject<ConfirmarPagoProveedorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmarPagoProveedorDialogComponent>);
  private readonly cuentasPorPagar = inject(CuentasPorPagarService);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('inputArchivo') private inputRef?: ElementRef<HTMLInputElement>;

  readonly hoy = hoyColombia();
  readonly bancos = signal<CuentaBanco[]>([]);
  readonly cargandoBancos = signal(false);
  readonly archivo = signal<File | null>(null);
  idBanco: number | null = null;
  fecha = this.hoy;

  ngOnInit(): void {
    if (this.data.neto <= 0) return;
    this.cargandoBancos.set(true);
    this.cuentasPorPagar.bancos().subscribe({
      next: (bancos) => {
        this.bancos.set(bancos);
        this.idBanco = bancos.find((b) => b.porDefecto)?.idCuentaContableWO ?? bancos[0]?.idCuentaContableWO ?? null;
        this.cargandoBancos.set(false);
      },
      error: () => this.cargandoBancos.set(false)
    });
  }

  listo(): boolean {
    if (!this.fecha || this.fecha > this.hoy) return false;
    return this.data.neto <= 0 || (this.idBanco !== null && this.archivo() !== null);
  }

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
    this.archivo.set(archivo);
  }

  confirmar(): void {
    if (!this.listo()) return;
    const resultado: ConfirmarPagoProveedorResultado = {
      archivo: this.data.neto > 0 ? this.archivo() : null,
      idCuentaBancoWO: this.data.neto > 0 ? this.idBanco : null,
      fechaPago: this.fecha
    };
    this.dialogRef.close(resultado);
  }
}
