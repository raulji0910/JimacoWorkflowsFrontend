import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TipoCampo, TipoDocumento, TipoDocumentoActualizar, TipoDocumentoCrear } from '../../../core/models/tipo-documento.model';

export interface TipoDocumentoFormDialogData {
  tipo: TipoDocumento | null;
}

interface CampoEditable {
  nombre: string;
  etiqueta: string;
  tipoCampo: TipoCampo;
  requerido: boolean;
  opcionesTexto: string;
}

const TIPOS_CAMPO: TipoCampo[] = ['Texto', 'Numero', 'Fecha', 'Seleccion', 'Adjunto'];

@Component({
  selector: 'app-tipo-documento-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  templateUrl: './tipo-documento-form-dialog.component.html'
})
export class TipoDocumentoFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TipoDocumentoFormDialogComponent>);
  readonly data = inject<TipoDocumentoFormDialogData>(MAT_DIALOG_DATA);

  readonly editando = this.data.tipo !== null;
  readonly tiposCampo = TIPOS_CAMPO;

  nombre = this.data.tipo?.nombre ?? '';
  descripcion = this.data.tipo?.descripcion ?? '';
  prefijoWorldOffice = this.data.tipo?.prefijoWorldOffice ?? '';
  activo = this.data.tipo?.activo ?? true;

  campos: CampoEditable[] =
    this.data.tipo?.campos.map((c) => ({
      nombre: c.nombre,
      etiqueta: c.etiqueta,
      tipoCampo: c.tipoCampo,
      requerido: c.requerido,
      opcionesTexto: c.opciones?.join(', ') ?? ''
    })) ?? [];

  agregarCampo(): void {
    this.campos.push({ nombre: '', etiqueta: '', tipoCampo: 'Texto', requerido: false, opcionesTexto: '' });
  }

  quitarCampo(index: number): void {
    this.campos.splice(index, 1);
  }

  guardar(): void {
    if (!this.nombre.trim() || !this.prefijoWorldOffice.trim()) return;
    if (this.campos.some((c) => !c.nombre.trim() || !c.etiqueta.trim())) return;

    const camposDto = this.campos.map((c, index) => ({
      nombre: c.nombre.trim(),
      etiqueta: c.etiqueta.trim(),
      tipoCampo: c.tipoCampo,
      requerido: c.requerido,
      orden: index + 1,
      opciones:
        c.tipoCampo === 'Seleccion'
          ? c.opcionesTexto
              .split(',')
              .map((o) => o.trim())
              .filter((o) => o.length > 0)
          : null
    }));

    const prefijo = this.prefijoWorldOffice.trim().toUpperCase();

    if (this.editando) {
      const dto: TipoDocumentoActualizar = {
        nombre: this.nombre,
        descripcion: this.descripcion || null,
        prefijoWorldOffice: prefijo,
        activo: this.activo,
        campos: camposDto
      };
      this.dialogRef.close(dto);
    } else {
      const dto: TipoDocumentoCrear = {
        nombre: this.nombre,
        descripcion: this.descripcion || null,
        prefijoWorldOffice: prefijo,
        campos: camposDto
      };
      this.dialogRef.close(dto);
    }
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
