import { Component, OnInit, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-documento-nuevo',
  standalone: true,
  imports: [
    FormsModule,
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
  valor: number | null = null;
  fechaDocumento: Date | null = null;
  datos: Record<string, string> = {};

  get tipoSeleccionado(): TipoDocumento | null {
    return this.tipos().find((t) => t.id === this.tipoSeleccionadoId) ?? null;
  }

  ngOnInit(): void {
    this.tipoDocumentoService.listar().subscribe((tipos) => this.tipos.set(tipos.filter((t) => t.activo)));
  }

  seleccionarTipo(): void {
    this.datos = {};
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

    this.guardando.set(true);
    this.documentoService
      .crear({
        tipoDocumentoId: tipo.id,
        numeroReferencia: this.numeroReferencia || null,
        proveedor: this.proveedor || null,
        valor: this.valor,
        fechaDocumento: this.fechaDocumento ? this.fechaDocumento.toISOString() : null,
        datos: Object.keys(this.datos).length > 0 ? this.datos : null
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
