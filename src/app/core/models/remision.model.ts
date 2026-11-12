/** Entregas (2026-11-12) — ver RemisionDtos.cs en el backend. */

/** Una fila del dashboard de Entregas — ver RemisionTableroDto en el backend. */
export interface RemisionTablero {
  id: number;
  numero: string;
  fecha: string;
  cliente: string | null;
  nitCliente: string | null;
  ciudad: string | null;
  direccionEntrega: string | null;
  campoEntrega: string | null;
  elaboradoPor: string | null;
  cotizacion: string | null;
  ordenCompraCliente: string | null;
  cantidadRenglones: number;
  /** Cuándo llegó al sistema (≈ contabilización en WO) — desde acá corre el atraso. */
  fechaContabilizada: string;
  estado: 'PorEntregar' | 'Entregada' | 'Anulada';
  /** Por entregar hace más del umbral de horas: Atrasada (pulso rojo y sonido, como en HA). */
  enAlerta: boolean;
  fechaEntrega: string | null;
  entregadaPor: string | null;
  /** Coincide | NoCoincide | SinQR — null mientras no se entregue. */
  verificacionQR: string | null;
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
  /** Cumplió la regla: es esta remisión y (con IA) tiene la firma del cliente. */
  valido: boolean;
  iaNumeroLeido: string | null;
  iaHayFirma: boolean | null;
  iaObservacion: string | null;
}

/** Resultado de revisar un archivo antes de confirmar — ver VerificacionSoporteDto en el backend. */
export interface VerificacionSoporte {
  valido: boolean;
  motivo: string | null;
  qrCoincide: boolean;
  iaActiva: boolean;
  iaAnalizado: boolean;
  iaNumeroLeido: string | null;
  iaHayFirma: boolean;
  iaHayNombreOCedula: boolean;
  iaConfianza: string | null;
  iaObservacion: string | null;
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
