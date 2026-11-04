/** Una OC que comparte una Hoja de Alistamiento con otras — ver OcVinculadaAlistamientoDto en el backend. */
export interface OcVinculadaAlistamiento {
  instanciaDocumentoId: number;
  numeroReferencia: string | null;
}

/**
 * Una fila del dashboard de alistamiento — ver HojaAlistamientoResumenDto en el backend. Una misma
 * Cotización puede estar ligada a más de una OC; acá aparece una sola vez y `ocs` lista todas las
 * que la comparten.
 */
export interface HojaAlistamientoResumen {
  documentoVinculadoId: number;
  ocs: OcVinculadaAlistamiento[];
  numeroReferenciaHoja: string;
  cliente: string | null;
  campoEntrega: string | null;
  elaboradoPor: string | null;
  // Cuándo Gerencia Comercial aprobó el primer paso de la OC (no cuándo se generó la hoja) — es el
  // reloj real de Transporte, ver HojaAlistamientoService en el backend.
  fechaAprobacionComercial: string;
  completa: boolean;
  enAlerta: boolean;
  totalRenglones: number;
  renglonesCompletos: number;
  // Informativo para Logística — valor completo del documento (misma fórmula que el PDF real).
  total: number;
  // Remisionado por renglón (2026-10-26) — ver nota en RenglonHojaAlistamiento. `remisionado` =
  // TODOS los renglones al 100%; `remisionadoParcial` = algo llegó pero no todo. Independiente de
  // `completa` — una hoja puede estar atrasada/incompleta en Alistamiento Y remisionada en World
  // Office al mismo tiempo.
  remisionado: boolean;
  remisionadoParcial: boolean;
}

export interface ActualizarCantidadRenglon {
  renglonId: number;
  cantidadDisponible: number;
}

export interface ActualizarCantidadesDisponibles {
  renglones: ActualizarCantidadRenglon[];
}

/** Una Remisión real de World Office que aportó cantidad a un renglón puntual — un mismo renglón puede tener varias si se despachó en partes. */
export interface DespachoRemision {
  numeroRemision: string;
  fecha: string;
  cantidad: number;
}

/** Un renglón visto desde la Hoja de Alistamiento propia (sin los datos de precio/IVA, no aplican acá). */
export interface RenglonHojaAlistamiento {
  id: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  unidadMedida: string | null;
  cantidadDisponible: number;
  // Remisionado (2026-10-26) — suma de despachosRemision, informativo (ya está implícito en la lista).
  cantidadRemisionada: number;
  despachosRemision: DespachoRemision[];
}

/** La Hoja de Alistamiento como pantalla propia — ver HojaAlistamientoDetalleDto en el backend. */
export interface HojaAlistamientoDetalle {
  id: number;
  ocs: OcVinculadaAlistamiento[];
  numeroReferencia: string;
  cliente: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  campoEntrega: string | null;
  fechaAprobacionComercial: string;
  completa: boolean;
  // Informativo para Logística — misma fórmula que el PDF real de la Hoja de Alistamiento.
  subtotal: number;
  totalIva: number;
  total: number;
  remisionado: boolean;
  remisionadoParcial: boolean;
  renglones: RenglonHojaAlistamiento[];
}
