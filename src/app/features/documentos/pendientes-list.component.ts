import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DocumentoService } from '../../core/services/documento.service';
import { DocumentoResumen } from '../../core/models/documento.model';

@Component({
  selector: 'app-pendientes-list',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule, MatFormFieldModule, MatInputModule],
  templateUrl: './pendientes-list.component.html',
  styleUrl: './documentos-list.component.scss'
})
export class PendientesListComponent implements OnInit {
  readonly columnas = ['tipo', 'referencia', 'proveedor', 'valor', 'pasoActual', 'fecha', 'acciones'];
  readonly documentos = signal<DocumentoResumen[]>([]);
  readonly cargando = signal(false);
  readonly filtro = signal('');
  readonly documentosFiltrados = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    return texto ? this.documentos().filter((d) => (d.numeroReferencia ?? '').toLowerCase().includes(texto)) : this.documentos();
  });

  constructor(private readonly documentoService: DocumentoService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.documentoService.pendientes().subscribe({
      next: (documentos) => {
        this.documentos.set(documentos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }
}
