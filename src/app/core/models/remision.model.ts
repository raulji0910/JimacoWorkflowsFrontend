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
  // ---- Facturación (fase 2, 2026-11-13) ----
  estadoFacturacion: EstadoFacturacion | null;
  /** Tipos documentales obligatorios sin archivo. */
  documentosFaltantes: number;
  /** Documentos con advertencia de la IA. */
  documentosConAviso: number;
  /** La elaboró en WO quien está consultando. */
  esMia: boolean;
  fechaEnvioFacturacion: string | null;
}

export type EstadoFacturacion = 'PendienteDocumentos' | 'EnFacturacion' | 'Devuelta' | 'Facturada';

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
  /** Cumplió la regla: es esta remisión y (con IA) tiene la firma o el sello del cliente. */
  valido: boolean;
  iaNumeroLeido: string | null;
  iaHayFirma: boolean | null;
  iaObservacion: string | null;
  /** Sello del cliente: vale igual que la firma. */
  iaHaySello: boolean | null;
  // ---- Documentos para facturar (fase 2) ----
  tipoDocumentoFacturacionId: number | null;
  tipoDocumentoFacturacion: string | null;
  iaTipoDetectado: string | null;
  /** Advertencia de la IA (no bloquea). */
  aviso: string | null;
  puedeEliminar: boolean;
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
  iaHaySello: boolean;
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
  // ---- Facturación (fase 2, 2026-11-13) ----
  estadoFacturacion: EstadoFacturacion | null;
  documentosRequeridos: DocumentoRequerido[] | null;
  historial: EventoFacturacion[] | null;
  /** Usuario(s) del sistema que la elaboraron en WO; null = nadie tiene ese Usuario WO. */
  emisor: string | null;
  puedeAdjuntarDocumentos: boolean;
  puedeEnviarAFacturacion: boolean;
  puedeDevolver: boolean;
  fechaEnvioFacturacion: string | null;
}

export interface DocumentoRequerido {
  tipoId: number;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  completo: boolean;
}

export interface EventoFacturacion {
  accion: 'EnviadaAFacturacion' | 'Devuelta' | 'Facturada';
  comentario: string | null;
  usuario: string;
  fecha: string;
}

/** Administración → tipos documentales para facturar. nitsClientes vacío = todos los clientes. */
export interface TipoDocumentoFacturacion {
  id: number;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  nitsClientes: string | null;
  orden: number;
  activo: boolean;
}

export type GuardarTipoDocumentoFacturacion = Omit<TipoDocumentoFacturacion, 'id'>;

/** Administración → Config. de entregas — ver ConfiguracionEntregasDto en el backend. */
export interface ConfiguracionEntregas {
  verificacionIAActiva: boolean;
  /** El servidor tiene la clave de Anthropic (sin ella, encender no revisa nada). */
  iaConClave: boolean;
  fechaInicio: string;
  fechaActualizacion: string | null;
  actualizadoPor: string | null;
}
