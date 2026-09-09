export type TipoCampo = 'Texto' | 'Numero' | 'Fecha' | 'Adjunto' | 'Seleccion';

export interface CampoTipoDocumento {
  id: number;
  nombre: string;
  etiqueta: string;
  tipoCampo: TipoCampo;
  requerido: boolean;
  orden: number;
  opciones: string[] | null;
}

export interface CampoTipoDocumentoInput {
  nombre: string;
  etiqueta: string;
  tipoCampo: TipoCampo;
  requerido: boolean;
  orden: number;
  opciones: string[] | null;
}

export interface TipoDocumento {
  id: number;
  nombre: string;
  descripcion: string | null;
  prefijoWorldOffice: string;
  activo: boolean;
  campos: CampoTipoDocumento[];
}

export interface TipoDocumentoCrear {
  nombre: string;
  descripcion: string | null;
  prefijoWorldOffice: string;
  campos: CampoTipoDocumentoInput[];
}

export interface TipoDocumentoActualizar {
  nombre: string;
  descripcion: string | null;
  prefijoWorldOffice: string;
  activo: boolean;
  campos: CampoTipoDocumentoInput[];
}
