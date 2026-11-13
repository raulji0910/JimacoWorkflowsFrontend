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
  /**
   * Un flujo existente para usar como PUNTO DE PARTIDA (clonar sus pasos) — nunca se edita en el
   * lugar, siempre se crea un flujo nuevo (ver DefinicionFlujoService.CrearAsync). Null = arrancar
   * en blanco.
   */
  basadoEn: DefinicionFlujo | null;
}

interface PasoEditable {
  nombre: string;
  permiteDevolver: boolean;
  permiteRechazar: boolean;
  permiteDevolverAlEmisor: boolean;
  /** Órdenes (1-based) de los pasos anteriores a los que TAMBIÉN puede devolver. */
  destinosDevolucionOrdenes: number[];
  requiereComprobanteEgresoAlAprobar: boolean;
  requiereComentarioAlAprobar: boolean;
  /** Orden (1-based) de un paso POSTERIOR al que "Redirigir a pago de contado" puede mandar. */
  redirigirAPagoContadoOrden: number | null;
  requiereSoportePagoAlAprobar: boolean;
  rolesIds: number[];
}

/** "Cualquiera" se representa como null en el modelo — ese es el único motivo de este tipo aparte. */
type FormaDePagoOpcion = 'Cualquiera' | 'Contado' | 'Credito';

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

  readonly clonando = this.data.basadoEn !== null;

  nombre = this.data.basadoEn ? `${this.data.basadoEn.nombre} (copia)` : '';
  valorMinimo: number | null = this.data.basadoEn?.valorMinimo ?? null;
  valorMaximo: number | null = this.data.basadoEn?.valorMaximo ?? null;
  formaDePago: FormaDePagoOpcion = this.mapearFormaDePagoAOpcion(this.data.basadoEn?.formaDePagoRequerida ?? null);

  pasos: PasoEditable[] = this.data.basadoEn
    ? this.mapearPasosExistentes(this.data.basadoEn)
    : [{ nombre: '', permiteDevolver: true, permiteRechazar: false, permiteDevolverAlEmisor: true, destinosDevolucionOrdenes: [], requiereComprobanteEgresoAlAprobar: false, requiereComentarioAlAprobar: false, redirigirAPagoContadoOrden: null, requiereSoportePagoAlAprobar: false, rolesIds: [] }];

  private mapearFormaDePagoAOpcion(valor: string | null): FormaDePagoOpcion {
    if (valor === 'Contado' || valor === 'Credito') return valor;
    return 'Cualquiera';
  }

  private mapearPasosExistentes(flujo: DefinicionFlujo): PasoEditable[] {
    const ordenPorId = new Map(flujo.pasos.map((p) => [p.id, p.orden]));
    return flujo.pasos
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({
        nombre: p.nombre,
        permiteDevolver: p.permiteDevolver,
        permiteRechazar: p.permiteRechazar,
        permiteDevolverAlEmisor: p.permiteDevolverAlEmisor,
        destinosDevolucionOrdenes: p.destinosDevolucionIds.map((id) => ordenPorId.get(id)).filter((o): o is number => o != null),
        requiereComprobanteEgresoAlAprobar: p.requiereComprobanteEgresoAlAprobar,
        requiereComentarioAlAprobar: p.requiereComentarioAlAprobar,
        redirigirAPagoContadoOrden: p.pasoRedirigirAPagoContadoId != null ? (ordenPorId.get(p.pasoRedirigirAPagoContadoId) ?? null) : null,
        requiereSoportePagoAlAprobar: p.requiereSoportePagoAlAprobar,
        rolesIds: [...p.rolesIds]
      }));
  }

  agregarPaso(): void {
    // permiteRechazar/permiteDevolverAlEmisor en false: son exclusivos del primer paso del flujo
    // (ver guardar()) — un paso agregado acá nunca es el primero.
    this.pasos.push({ nombre: '', permiteDevolver: true, permiteRechazar: false, permiteDevolverAlEmisor: false, destinosDevolucionOrdenes: [], requiereComprobanteEgresoAlAprobar: false, requiereComentarioAlAprobar: false, redirigirAPagoContadoOrden: null, requiereSoportePagoAlAprobar: false, rolesIds: [] });
  }

  quitarPaso(index: number): void {
    this.pasos.splice(index, 1);
    // Los destinos de los pasos que quedan pueden haber quedado apuntando a un orden que ya no
    // existe, o que cambió de número al correrse la lista — se limpian todos para no dejar
    // referencias raras; la persona los vuelve a elegir.
    for (const paso of this.pasos) {
      paso.destinosDevolucionOrdenes = [];
      paso.redirigirAPagoContadoOrden = null;
    }
  }

  /** Órdenes disponibles como destino de devolución para el paso en `index` (solo pasos anteriores). */
  ordenesDisponibles(index: number): number[] {
    return Array.from({ length: index }, (_, i) => i + 1);
  }

  /** Órdenes disponibles para "Redirigir a pago de contado" desde el paso en `index` (solo pasos posteriores). */
  ordenesPosterioresDisponibles(index: number): number[] {
    return Array.from({ length: this.pasos.length - index - 1 }, (_, i) => index + 2 + i);
  }

  guardar(): void {
    // Sin pasos es válido (2026-11-13): el documento queda aprobado al llegar (ej. crédito de Ferrealiados).
    if (!this.nombre.trim()) return;
    if (this.pasos.some((p) => !p.nombre.trim() || p.rolesIds.length === 0)) return;
    if (this.valorMinimo != null && this.valorMaximo != null && this.valorMinimo > this.valorMaximo) return;

    const dto: DefinicionFlujoCrear = {
      nombre: this.nombre.trim(),
      tipoDocumentoId: this.data.tipoDocumentoId,
      valorMinimo: this.valorMinimo,
      valorMaximo: this.valorMaximo,
      formaDePagoRequerida: this.formaDePago === 'Cualquiera' ? null : this.formaDePago,
      // Rechazar y "devolver al emisor" son exclusivos del primer paso (ver validación equivalente
      // en DefinicionFlujoService.CrearAsync) — se sanea acá por si quedó un valor viejo (ej. al
      // clonar un flujo, o si el paso 1 original se convirtió en el paso 2 al reordenar).
      pasos: this.pasos.map((p, index) => ({
        nombre: p.nombre.trim(),
        orden: index + 1,
        permiteDevolver: p.permiteDevolver,
        permiteRechazar: index === 0 && p.permiteRechazar,
        permiteDevolverAlEmisor: index === 0 && p.permiteDevolverAlEmisor,
        destinosDevolucionOrdenes: p.destinosDevolucionOrdenes,
        requiereComprobanteEgresoAlAprobar: p.requiereComprobanteEgresoAlAprobar,
        requiereComentarioAlAprobar: p.requiereComentarioAlAprobar,
        redirigirAPagoContadoOrden: p.redirigirAPagoContadoOrden,
        requiereSoportePagoAlAprobar: p.requiereSoportePagoAlAprobar,
        rolesIds: p.rolesIds
      }))
    };
    this.dialogRef.close(dto);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
