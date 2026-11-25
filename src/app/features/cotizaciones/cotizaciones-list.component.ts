import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { CotizacionResumen, EstadoCotizacion } from '../../core/models/cotizacion.model';
import { ETIQUETA_ESTADO_COTIZACION } from './estado-cotizacion';

type Filtro = 'Todas' | EstadoCotizacion;

// Mis cotizaciones (2026-11-25): las que armé en el portal, con su estado y el número que les dio WO.
@Component({
  selector: 'app-cotizaciones-list',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatButtonToggleModule, MatTooltipModule],
  templateUrl: './cotizaciones-list.component.html',
  styleUrl: './cotizaciones-list.component.scss'
})
export class CotizacionesListComponent implements OnInit {
  private readonly servicio = inject(CotizacionService);
  private readonly router = inject(Router);

  readonly etiquetas = ETIQUETA_ESTADO_COTIZACION;
  readonly cotizaciones = signal<CotizacionResumen[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtro = signal<Filtro>('Todas');
  readonly buscar = signal('');

  readonly visibles = computed(() => {
    const texto = this.buscar().trim().toUpperCase();
    return this.cotizaciones().filter(
      (c) =>
        (this.filtro() === 'Todas' || c.estado === this.filtro()) &&
        (!texto ||
          (c.clienteNombre ?? '').toUpperCase().includes(texto) ||
          (c.clienteIdentificacion ?? '').includes(texto) ||
          `${c.prefijoWO ?? ''} ${c.numeroWO ?? ''}`.includes(texto))
    );
  });

  readonly conteo = computed(() => {
    const conteo: Record<Filtro, number> = { Todas: 0, Borrador: 0, PorCrear: 0, Creada: 0, Error: 0 };
    for (const c of this.cotizaciones()) {
      conteo.Todas++;
      conteo[c.estado]++;
    }
    return conteo;
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.cotizaciones.set(lista);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(e.error?.mensaje ?? 'No se pudieron cargar las cotizaciones.');
        this.cargando.set(false);
      }
    });
  }

  abrir(c: CotizacionResumen): void {
    this.router.navigate(['/cotizaciones', c.id]);
  }
}
