export type EstadoInstanciaDocumento = 'EnProceso' | 'Devuelto' | 'Completado' | 'Rechazado';

export type TipoAccion = 'Creado' | 'Aprobado' | 'Devuelto' | 'Rechazado' | 'Reenviado';

export interface RenglonInput {
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  unidadMedida: string | null;
  valorUnitario: number;
  porcentajeIva: number;
}

export interface Renglon extends RenglonInput {
  id: number;
  total: number;
}

export interface DocumentoCrear {
  tipoDocumentoId: number;
  numeroReferencia: string | null;
  proveedor: string | null;
  valor: number | null;
  fechaDocumento: string | null;
  datos: Record<string, string> | null;
  renglones: RenglonInput[] | null;
}

export interface HistorialAccionItem {
  id: number;
  pasoNombre: string | null;
  usuarioNombre: string;
  accion: TipoAccion;
  comentario: string | null;
  fecha: string;
}

export interface Adjunto {
  id: number;
  nombreArchivo: string;
  contentType: string | null;
  tamanoBytes: number;
  fechaCarga: string;
}

export interface DocumentoResumen {
  id: number;
  tipoDocumentoNombre: string;
  numeroReferencia: string | null;
  proveedor: string | null;
  valor: number | null;
  fechaDocumento: string | null;
  estado: EstadoInstanciaDocumento;
  pasoActualNombre: string | null;
  fechaCreacion: string;
}

export interface DocumentoDetalle {
  id: number;
  tipoDocumentoNombre: string;
  numeroReferencia: string | null;
  proveedor: string | null;
  valor: number | null;
  fechaDocumento: string | null;
  datos: Record<string, string> | null;
  estado: EstadoInstanciaDocumento;
  pasoActualId: number | null;
  pasoActualNombre: string | null;
  pasoActualPermiteDevolver: boolean;
  pasoActualPermiteRechazar: boolean;
  creadoPorNombre: string;
  fechaCreacion: string;
  adjuntos: Adjunto[];
  historial: HistorialAccionItem[];
  renglones: Renglon[];
}

export interface EjecutarAccion {
  accion: 'Aprobado' | 'Devuelto' | 'Rechazado';
  comentario: string | null;
}

export interface ReenvioNotificacionResultado {
  enviadas: number;
  fallidas: number;
}
