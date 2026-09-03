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
import { DefinicionFlujo, DefinicionFlujoCrear } from '../../../core/models/flujo.model';
import { Rol } from '../../../core/models/rol.model';

export interface FlujoFormDialogData {
  tipoDocumentoId: number;
  roles: Rol[];
  /** Flujo activo actual, si hay uno — se usa para precargar los pasos y poder editarlos en vez de arrancar de cero. */
  flujoActivo: DefinicionFlujo | null;
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

  readonly editando = this.data.flujoActivo !== null;

  nombre = this.data.flujoActivo?.nombre ?? '';
  pasos: PasoEditable[] = this.data.flujoActivo
    ? this.mapearPasosExistentes(this.data.flujoActivo)
    : [{ nombre: '', permiteDevolver: true, permiteRechazar: false, pasoDestinoDevolucionOrden: 0, rolesIds: [] }];

  private mapearPasosExistentes(flujo: DefinicionFlujo): PasoEditable[] {
    const ordenPorId = new Map(flujo.pasos.map((p) => [p.id, p.orden]));
    return flujo.pasos
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({
        nombre: p.nombre,
        permiteDevolver: p.permiteDevolver,
        permiteRechazar: p.permiteRechazar,
        pasoDestinoDevolucionOrden: p.pasoDestinoDevolucionId ? (ordenPorId.get(p.pasoDestinoDevolucionId) ?? 0) : 0,
        rolesIds: [...p.rolesIds]
      }));
  }

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
