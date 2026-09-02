import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { DefinicionFlujoCrear } from '../../../core/models/flujo.model';
import { Rol } from '../../../core/models/rol.model';

export interface FlujoFormDialogData {
  tipoDocumentoId: number;
  roles: Rol[];
}

interface PasoEditable {
  nombre: string;
  permiteDevolver: boolean;
  permiteRechazar: boolean;
  /** Orden del paso destino, o 0 = "vuelve al emisor". */
  pasoDestinoDevolucionOrden: number;
  rolesIds: number[];
}

@Component({
  selector: 'app-flujo-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  templateUrl: './flujo-form-dialog.component.html'
})
export class FlujoFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FlujoFormDialogComponent>);
  readonly data = inject<FlujoFormDialogData>(MAT_DIALOG_DATA);

  nombre = '';
  pasos: PasoEditable[] = [
    { nombre: '', permiteDevolver: true, permiteRechazar: false, pasoDestinoDevolucionOrden: 0, rolesIds: [] }
  ];

  agregarPaso(): void {
    this.pasos.push({ nombre: '', permiteDevolver: true, permiteRechazar: false, pasoDestinoDevolucionOrden: 0, rolesIds: [] });
  }

  quitarPaso(index: number): void {
    this.pasos.splice(index, 1);
  }

  /// Órdenes disponibles como destino de devolución para el paso en `index` (solo pasos anteriores).
  ordenesDisponibles(index: number): number[] {
    return Array.from({ length: index }, (_, i) => i + 1);
  }

  guardar(): void {
    if (!this.nombre.trim() || this.pasos.length === 0) return;
    if (this.pasos.some((p) => !p.nombre.trim() || p.rolesIds.length === 0)) return;

    const dto: DefinicionFlujoCrear = {
      nombre: this.nombre,
      tipoDocumentoId: this.data.tipoDocumentoId,
      pasos: this.pasos.map((p, index) => ({
        nombre: p.nombre.trim(),
        orden: index + 1,
        permiteDevolver: p.permiteDevolver,
        permiteRechazar: p.permiteRechazar,
        pasoDestinoDevolucionOrden: p.pasoDestinoDevolucionOrden > 0 ? p.pasoDestinoDevolucionOrden : null,
        rolesIds: p.rolesIds
      }))
    };
    this.dialogRef.close(dto);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
