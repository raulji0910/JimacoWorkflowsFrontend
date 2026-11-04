import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentoService } from '../../core/services/documento.service';
import { DocumentoResumen } from '../../core/models/documento.model';
import { EstadoLabelPipe } from '../../shared/estado.pipe';

@Component({
  selector: 'app-mis-documentos-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    EstadoLabelPipe
  ],
  templateUrl: './mis-documentos-list.component.html',
  styleUrl: './documentos-list.component.scss'
})
export class MisDocumentosListComponent implements OnInit {
  readonly columnas = ['tipo', 'referencia', 'proveedor', 'estado', 'fecha', 'acciones'];
  readonly documentos = signal<DocumentoResumen[]>([]);
  readonly cargando = signal(false);
  readonly filtro = signal('');
  readonly documentosFiltrados = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    return texto ? this.documentos().filter((d) => (d.numeroReferencia ?? '').toLowerCase().includes(texto)) : this.documentos();
  });

  constructor(
    private readonly documentoService: DocumentoService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.documentoService.mios().subscribe({
      next: (documentos) => {
        this.documentos.set(documentos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  reenviar(id: number): void {
    this.documentoService.reenviar(id).subscribe({
      next: () => {
        this.snackBar.open('Documento reenviado', 'Cerrar', { duration: 3000 });
        this.cargar();
      },
      error: (error) => {
        const mensaje = error?.error?.mensaje ?? 'No se pudo reenviar el documento.';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
      }
    });
  }

  claseEstado(estado: string): string {
    return `documentos__chip--${estado.toLowerCase()}`;
  }
}
