export interface PasoFlujo {
  id: number;
  nombre: string;
  orden: number;
  permiteDevolver: boolean;
  permiteRechazar: boolean;
  // Se combinan: si permiteDevolverAlEmisor, "El emisor" es una opción más, además de los pasos
  // anteriores puntuales en destinosDevolucionIds.
  permiteDevolverAlEmisor: boolean;
  destinosDevolucionIds: number[];
  // Si "Aprobar" en este paso exige el número de un Comprobante de Egreso de World Office (ver
  // ComprobanteEgreso en el backend) — la notificación al paso siguiente queda pospuesta hasta que
  // el Sincronizador lo encuentre y adjunte.
  requiereComprobanteEgresoAlAprobar: boolean;
  // Si "Aprobar" en este paso exige un comentario obligatorio (ej. "a quién le entregó el dinero").
  requiereComentarioAlAprobar: boolean;
  // Si está, "Aprobar" en este paso también ofrece "Redirigir a pago de contado" hacia este otro
  // paso (posterior) del mismo flujo — ver PasoFlujo.PasoRedirigirAPagoContadoId en el backend.
  pasoRedirigirAPagoContadoId: number | null;
  // Si "Aprobar" en este paso exige adjuntar un PDF con el soporte del pago (ej. Gerencia General
  // al hacer la transferencia) — ver PasoFlujo.RequiereSoportePagoAlAprobar en el backend.
  requiereSoportePagoAlAprobar: boolean;
  rolesIds: number[];
}

export interface PasoFlujoInput {
  nombre: string;
  orden: number;
  permiteDevolver: boolean;
  permiteRechazar: boolean;
  permiteDevolverAlEmisor: boolean;
  /** Órdenes (no ids) de los pasos anteriores a los que también puede devolver. */
  destinosDevolucionOrdenes: number[];
  requiereComprobanteEgresoAlAprobar: boolean;
  requiereComentarioAlAprobar: boolean;
  /** Orden (no id) de un paso POSTERIOR del mismo flujo, si "Redirigir a pago de contado" aplica. */
  redirigirAPagoContadoOrden: number | null;
  requiereSoportePagoAlAprobar: boolean;
  rolesIds: number[];
}

export interface DefinicionFlujo {
  id: number;
  nombre: string;
  tipoDocumentoId: number;
  activo: boolean;
  // Condición de cuándo aplica este flujo — todos null = aplica siempre. Puede haber varios
  // DefinicionFlujo activos a la vez para el mismo tipo de documento, cada uno con su condición.
  valorMinimo: number | null;
  valorMaximo: number | null;
  formaDePagoRequerida: string | null;
  pasos: PasoFlujo[];
}

export interface DefinicionFlujoCrear {
  nombre: string;
  tipoDocumentoId: number;
  valorMinimo: number | null;
  valorMaximo: number | null;
  formaDePagoRequerida: string | null;
  pasos: PasoFlujoInput[];
}
