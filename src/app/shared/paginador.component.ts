import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Anterior / Siguiente con "1–10 de 47". No se muestra si todo cabe en una página. */
@Component({
  selector: 'app-paginador',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (total > tamano) {
      <nav class="pg" aria-label="Páginas">
        <span class="pg__rango">{{ inicio }}–{{ fin }} de {{ total }} {{ unidad }}</span>
        <button mat-stroked-button type="button" [disabled]="pagina <= 1 || cargando" (click)="ir(pagina - 1)">
          <mat-icon>chevron_left</mat-icon>
          Anterior
        </button>
        <button mat-stroked-button type="button" [disabled]="pagina >= paginas || cargando" (click)="ir(pagina + 1)">
          Siguiente
          <mat-icon iconPositionEnd>chevron_right</mat-icon>
        </button>
      </nav>
    }
  `,
  styles: [`
    .pg { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; max-width: 52rem; }
    .pg__rango { margin-right: auto; font-size: 0.875rem; opacity: 0.8; font-variant-numeric: tabular-nums; }
  `]
})
export class PaginadorComponent {
  @Input() total = 0;
  @Input() pagina = 1;
  @Input() tamano = 10;
  @Input() unidad = '';
  @Input() cargando = false;
  @Output() readonly irA = new EventEmitter<number>();

  get paginas(): number {
    return Math.max(1, Math.ceil(this.total / this.tamano));
  }

  get inicio(): number {
    return (this.pagina - 1) * this.tamano + 1;
  }

  get fin(): number {
    return Math.min(this.total, this.pagina * this.tamano);
  }

  ir(pagina: number): void {
    this.irA.emit(pagina);
  }
}
