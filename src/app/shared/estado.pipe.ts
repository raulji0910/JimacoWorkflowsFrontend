import { Pipe, PipeTransform } from '@angular/core';
import { EstadoInstanciaDocumento } from '../core/models/documento.model';

// Los estados que llegan del backend son el nombre del enum en C# (ver EstadoInstanciaDocumento
// en documento.model.ts) — sirven perfecto como clase CSS o para comparar en el código, pero
// "EnProceso" pegado se ve como un nombre de campo de base de datos, no como texto para el
// usuario. Este pipe solo agrega la etiqueta en español; el valor real (para *ngIf, clases, etc.)
// sigue siendo el string del enum tal cual.
const ETIQUETAS: Record<EstadoInstanciaDocumento, string> = {
  EnProceso: 'En proceso',
  Devuelto: 'Devuelto',
  Completado: 'Completado',
  Rechazado: 'Rechazado'
};

@Pipe({ name: 'estadoLabel', standalone: true })
export class EstadoLabelPipe implements PipeTransform {
  transform(estado: EstadoInstanciaDocumento): string {
    return ETIQUETAS[estado] ?? estado;
  }
}
