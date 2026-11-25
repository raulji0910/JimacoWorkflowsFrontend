import { EstadoCotizacion } from '../../core/models/cotizacion.model';

/** Cómo se le muestra cada estado al usuario. */
export const ETIQUETA_ESTADO_COTIZACION: Record<EstadoCotizacion, string> = {
  Borrador: 'Borrador',
  PorCrear: 'Creando en WO…',
  Creada: 'Creada en WO',
  Error: 'Rechazada por WO'
};
