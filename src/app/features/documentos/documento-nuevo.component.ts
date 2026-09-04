import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TipoDocumentoService } from '../../core/services/tipo-documento.service';
import { DocumentoService } from '../../core/services/documento.service';
import { TipoDocumento } from '../../core/models/tipo-documento.model';
import { RenglonInput } from '../../core/models/documento.model';

interface RenglonEditable extends RenglonInput {
  total: number;
}

function renglonVacio(): RenglonEditable {
  return { codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'Und.', valorUnitario: 0, porcentajeIva: 0.19, total: 0 };
}

@Component({
  selector: 'app-documento-nuevo',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './documento-nuevo.component.html',
  styleUrl: './documento-nuevo.component.scss'
})
export class DocumentoNuevoComponent implements OnInit {
  private readonly tipoDocumentoService = inject(TipoDocumentoService);
  private readonly documentoService = inject(DocumentoService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly tipos = signal<TipoDocumento[]>([]);
  readonly guardando = signal(false);
  archivo: File | null = null;
  tipoSeleccionadoId: number | null = null;

  numeroReferencia = '';
  proveedor = '';
  fechaDocumento: Date | null = null;
  datos: Record<string, string> = {};
  renglones: RenglonEditable[] = [renglonVacio()];

  get tipoSeleccionado(): TipoDocumento | null {
    return this.tipos().find((t) => t.id === this.tipoSeleccionadoId) ?? null;
  }

  get subtotal(): number {
    return this.renglones.reduce((suma, r) => suma + r.cantidad * r.valorUnitario, 0);
  }

  get totalIva(): number {
    return this.renglones.reduce((suma, r) => suma + r.cantidad * r.valorUnitario * r.porcentajeIva, 0);
  }

  get total(): number {
    return this.subtotal + this.totalIva;
  }

  ngOnInit(): void {
    this.tipoDocumentoService.listar().subscribe((tipos) => this.tipos.set(tipos.filter((t) => t.activo)));
  }

  seleccionarTipo(): void {
    this.datos = {};
  }

  agregarRenglon(): void {
    this.renglones.push(renglonVacio());
  }

  quitarRenglon(index: number): void {
    this.renglones.splice(index, 1);
    if (this.renglones.length === 0) this.agregarRenglon();
  }

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivo = input.files?.[0] ?? null;
  }

  guardar(): void {
    const tipo = this.tipoSeleccionado;
    if (!tipo) return;

    const faltante = tipo.campos.find((c) => c.requerido && c.tipoCampo !== 'Adjunto' && !this.datos[c.nombre]?.trim());
    if (faltante) {
      this.snackBar.open(`Falta el campo "${faltante.etiqueta}".`, 'Cerrar', { duration: 4000 });
      return;
    }

    const renglonesCompletos = this.renglones.filter((r) => r.descripcion.trim() && r.cantidad > 0);
    if (renglonesCompletos.length === 0) {
      this.snackBar.open('Agregá al menos un renglón con descripción y cantidad.', 'Cerrar', { duration: 4000 });
      return;
    }

    this.guardando.set(true);
    this.documentoService
      .crear({
        tipoDocumentoId: tipo.id,
        numeroReferencia: this.numeroReferencia || null,
        proveedor: this.proveedor || null,
        valor: null, // se calcula en el backend sumando los renglones
        fechaDocumento: this.fechaDocumento ? this.fechaDocumento.toISOString() : null,
        datos: Object.keys(this.datos).length > 0 ? this.datos : null,
        renglones: renglonesCompletos.map(({ total: _total, ...r }) => r)
      })
      .subscribe({
        next: (documento) => {
          if (this.archivo) {
            this.documentoService.subirAdjunto(documento.id, this.archivo).subscribe({
              next: () => this.finalizar(documento.id),
              error: () => {
                this.snackBar.open('El documento se creó, pero el adjunto no se pudo subir. Podés subirlo desde el detalle.', 'Cerrar', {
                  duration: 6000
                });
                this.finalizar(documento.id);
              }
            });
          } else {
            this.finalizar(documento.id);
          }
        },
        error: (error) => {
          this.guardando.set(false);
          const mensaje = error?.error?.mensaje ?? 'No se pudo crear el documento.';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
        }
      });
  }

  private finalizar(id: number): void {
    this.guardando.set(false);
    this.snackBar.open('Documento creado', 'Cerrar', { duration: 3000 });
    this.router.navigate(['/documentos', id]);
  }
}
