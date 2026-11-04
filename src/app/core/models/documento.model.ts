export type EstadoInstanciaDocumento = 'EnProceso' | 'Devuelto' | 'Completado' | 'Rechazado';

export type TipoAccion = 'Creado' | 'Aprobado' | 'Devuelto' | 'Rechazado' | 'Reenviado' | 'RedirigidoAContado';

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

/** Un paso anterior posible como destino de "Devolver" — ver PasoFlujo.DestinosDevolucion en el backend. */
export interface PasoResumen {
  id: number;
  nombre: string;
}

/** Una línea débito/crédito del Comprobante de Egreso, con la cuenta contable real de World Office. */
export interface RenglonComprobanteEgreso {
  id: number;
  codigoCuenta: string | null;
  nombreCuenta: string | null;
  concepto: string | null;
  tercero: string | null;
  debito: number;
  credito: number;
}

/** El Comprobante de Egreso real de World Office, ya encontrado por el Sincronizador y adjunto — ver ComprobanteEgreso en el backend. */
export interface ComprobanteEgreso {
  id: number;
  numeroReferencia: string;
  fecha: string;
  valor: number;
  beneficiario: string | null;
  nitBeneficiario: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  concepto: string | null;
  elaboradoPor: string | null;
  renglones: RenglonComprobanteEgreso[];
}

/** Un renglón de una Hoja de Alistamiento — ver RenglonDocumentoVinculado en el backend. */
export interface RenglonDocumentoVinculado {
  id: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  unidadMedida: string | null;
  valorUnitario: number;
  porcentajeIva: number;
  total: number;
  // Control de alistamiento — lo que Transporte va registrando, editable.
  cantidadDisponible: number;
}

/** Un documento externo ligado (ej. la Cotización de origen de una OC) — la "Hoja de Alistamiento" real. */
export interface DocumentoVinculado {
  id: number;
  prefijoOrigen: string;
  numeroReferencia: string;
  fecha: string;
  fechaVencimiento: string;
  cliente: string | null;
  nitCliente: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  elaboradoPor: string | null;
  formaDePago: string | null;
  campoEntrega: string | null;
  // Control de alistamiento — cuándo entró esta hoja al sistema, y si CantidadDisponible ya
  // alcanza a Cantidad en todos sus renglones.
  fechaCreacion: string;
  completa: boolean;
  renglones: RenglonDocumentoVinculado[];
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
  // Vacío = "Devolver" manda directo al emisor, sin elegir nada.
  destinosDevolucionDisponibles: PasoResumen[];
  // Si "Aprobar" en el paso actual exige el número del Comprobante de Egreso de World Office.
  pasoActualRequiereComprobanteEgreso: boolean;
  // Si "Aprobar" en el paso actual exige un comentario obligatorio (ej. "a quién le entregó el dinero").
  pasoActualRequiereComentarioAlAprobar: boolean;
  // Si el paso actual ofrece la acción "Redirigir a pago de contado" (ver backend).
  pasoActualPermiteRedirigirAPagoContado: boolean;
  // Si "Aprobar" en el paso actual exige adjuntar un PDF con el soporte de pago (ej. Gerencia General).
  pasoActualRequiereSoportePagoAlAprobar: boolean;
  creadoPorNombre: string;
  fechaCreacion: string;
  adjuntos: Adjunto[];
  historial: HistorialAccionItem[];
  renglones: Renglon[];
  idAsientoContableOrigen: number | null;
  prefijoOrigen: string | null;
  pendienteEscrituraWO: boolean;
  conflictoWO: string | null;
  fechaEscrituraWO: string | null;
  // Comprobante de Egreso pedido al aprobar el paso de Contabilidad — null mientras no se pidió
  // ninguno. Mientras pendienteBusquedaComprobanteEgresoWO sea true, comprobanteEgreso sigue null
  // y la notificación al siguiente paso está pospuesta (ver backend).
  numeroComprobanteEgresoSolicitado: string | null;
  pendienteBusquedaComprobanteEgresoWO: boolean;
  conflictoComprobanteEgresoWO: string | null;
  comprobanteEgreso: ComprobanteEgreso | null;
  documentosVinculados: DocumentoVinculado[];
  // El PDF que Gerencia General adjuntó al aprobar el pago — null si ese paso no lo exigía o no pasó todavía.
  soportePago: Adjunto | null;
}

export interface EjecutarAccion {
  accion: 'Aprobado' | 'Devuelto' | 'Rechazado' | 'RedirigidoAContado';
  comentario: string | null;
  // Solo aplica a Devolver cuando destinosDevolucionDisponibles tiene más de una opción.
  pasoDestinoId?: number | null;
  // Solo aplica a Aprobar cuando pasoActualRequiereComprobanteEgreso es true.
  numeroComprobanteEgreso?: string | null;
  // Solo aplica a Aprobar cuando pasoActualRequiereSoportePagoAlAprobar es true — el Id del
  // Adjunto ya subido (vía subirAdjunto con esSoportePago=true) que es el soporte de esta aprobación.
  soportePagoAdjuntoId?: number | null;
}

export interface ReenvioNotificacionResultado {
  enviadas: number;
  fallidas: number;
}
