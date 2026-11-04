import { Component, Inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DespachoRemision } from '../../core/models/hoja-alistamiento.model';

export interface DespachosRemisionDialogData {
  descripcion: string;
  cantidadPedida: number;
  unidadMedida: string | null;
  despachos: DespachoRemision[];
}

/**
 * Detalle de las Remisiones que despacharon un renglón puntual (2026-10-26) — solo se usa cuando hay
 * MÁS DE UNA Remisión parcial para el mismo ítem (el caso simple, una sola, se muestra directo en la
 * tabla sin este modal — pedido explícito del usuario, para no obligar a un clic extra en el caso
 * común). Tarjetas en vez de la tabla genérica `.tabla-responsiva` del resto del sistema (2026-10-26,
 * corregido tras ver cómo se veía: esa tabla está pensada para listas largas en pantalla completa —
 * acá son 2-5 filas en un modal angosto, y el patrón "apilar celdas sin separación" se veía pobre,
 * sin ninguna frontera visual entre una Remisión y la siguiente).
 */
@Component({
  selector: 'app-despachos-remision-dialog',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="despachos__titulo">{{ data.descripcion }}</h2>
    <mat-dialog-content class="despachos">
      <p class="despachos__resumen">
        <mat-icon class="despachos__icono-resumen">local_shipping</mat-icon>
        {{ cantidadTotal | number: '1.0-2' }} / {{ data.cantidadPedida | number: '1.0-2' }} {{ data.unidadMedida }}
        remisionado en {{ data.despachos.length }} Remisiones
      </p>

      @for (d of data.despachos; track d.numeroRemision) {
        <div class="despachos__tarjeta">
          <div class="despachos__numero">Remisión {{ d.numeroRemision }}</div>
          <div class="despachos__detalle">
            <span>{{ d.fecha | date: 'd MMM y' }}</span>
            <span class="despachos__cantidad">{{ d.cantidad | number: '1.0-2' }} {{ data.unidadMedida }}</span>
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    // Verde real de la marca (mismo valor que el primario de theme-colors.scss) — los textos de
    // descripción vienen en MAYÚSCULAS de World Office tal cual (así se escriben ahí los ítems), así
    // que no se fuerza el case acá (perdería información, ej. siglas) — se baja el tamaño/peso en vez
    // de dejarlo como un título grande sin matizar, que es lo que se veía "feo" (2026-10-26).
    $jimaco-verde: #1c6521;

    .despachos__titulo {
      font-size: 1.05rem;
      font-weight: 600;
      line-height: 1.35;
      letter-spacing: 0.01em;
    }

    .despachos {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      min-width: 260px;
    }

    .despachos__resumen {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      color: $jimaco-verde;
      font-weight: 500;
      margin: 0 0 0.25rem;
    }

    .despachos__icono-resumen {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
      color: $jimaco-verde;
    }

    .despachos__tarjeta {
      border: 1px solid rgba(28, 101, 33, 0.25);
      border-left: 3px solid $jimaco-verde;
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      background: rgba(28, 101, 33, 0.04);
    }

    .despachos__numero {
      font-weight: 600;
      color: $jimaco-verde;
    }

    .despachos__detalle {
      display: flex;
      justify-content: space-between;
      margin-top: 0.15rem;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .despachos__cantidad {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `
})
export class DespachosRemisionDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) readonly data: DespachosRemisionDialogData) {}

  get cantidadTotal(): number {
    return this.data.despachos.reduce((suma, d) => suma + d.cantidad, 0);
  }
}
