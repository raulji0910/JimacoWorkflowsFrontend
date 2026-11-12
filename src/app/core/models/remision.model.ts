/** Entregas (2026-11-12) — ver RemisionDtos.cs en el backend. */

export type EstadoFiltroRemisiones = 'PorEntregar' | 'Entregada' | 'Revisar' | 'Todas';

export interface RemisionResumen {
  id: number;
  numero: string;
  fecha: string;
  cliente: string | null;
  nitCliente: string | null;
  ciudad: string | null;
  direccionEntrega: string | null;
  campoEntrega: string | null;
  vendedor: string | null;
  cotizacion: string | null;
  ordenCompraCliente: string | null;
  estado: 'PorEntregar' | 'Entregada' | 'Anulada';
  fechaEntrega: string | null;
  entregadaPor: string | null;
  /** Coincide | NoCoincide | SinQR — null mientras no se entregue. */
  verificacionQR: string | null;
  cantidadRenglones: number;
  cantidadSoportes: number;
}

export interface RemisionesPagina {
  items: RemisionResumen[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  porEntregar: number;
  entregadas: number;
  revisar: number;
  puedeGestionar: boolean;
}

export interface RenglonRemision {
  orden: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  unidadMedida: string | null;
}

export interface SoporteRemision {
  id: number;
  tipo: string;
  nombreArchivo: string;
  contentType: string | null;
  tamanoBytes: number;
  qrLeido: string | null;
  subidoPor: string;
  fechaCarga: string;
}

export interface RemisionDetalle {
  id: number;
  prefijo: string;
  numero: string;
  fecha: string;
  cliente: string | null;
  nitCliente: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  vendedor: string | null;
  elaboradoPorWO: string | null;
  formaDePago: string | null;
  direccionEntrega: string | null;
  campoEntrega: string | null;
  ordenCompraCliente: string | null;
  cotizacion: string | null;
  nota: string | null;
  estado: 'PorEntregar' | 'Entregada' | 'Anulada';
  fechaEntrega: string | null;
  entregadaPor: string | null;
  observacionEntrega: string | null;
  verificacionQR: string | null;
  /** Lo que lleva el QR impreso de ESTA remisión. */
  codigoQR: string;
  renglones: RenglonRemision[];
  soportes: SoporteRemision[];
  puedeGestionar: boolean;
}
