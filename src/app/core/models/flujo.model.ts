export interface PasoFlujo {
  id: number;
  nombre: string;
  orden: number;
  permiteDevolver: boolean;
  permiteRechazar: boolean;
  pasoDestinoDevolucionId: number | null;
  rolesIds: number[];
}

export interface PasoFlujoInput {
  nombre: string;
  orden: number;
  permiteDevolver: boolean;
  permiteRechazar: boolean;
  /** Orden (no id) del paso al que regresa una devolución — null = vuelve al emisor. */
  pasoDestinoDevolucionOrden: number | null;
  rolesIds: number[];
}

export interface DefinicionFlujo {
  id: number;
  nombre: string;
  tipoDocumentoId: number;
  activo: boolean;
  pasos: PasoFlujo[];
}

export interface DefinicionFlujoCrear {
  nombre: string;
  tipoDocumentoId: number;
  pasos: PasoFlujoInput[];
}
