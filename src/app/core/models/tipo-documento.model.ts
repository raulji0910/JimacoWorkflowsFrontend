/** Empresa del grupo dueña del documento — ver Empresa.cs en el backend (0 = Jimaco, 1 = Ferrealiados). */
export type Empresa = 'Jimaco' | 'Ferrealiados' | 0 | 1;

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
  /** Empresa del grupo (2026-11-13). Cada documento hereda la de su tipo. */
  empresa?: Empresa;
  activo: boolean;
  campos: CampoTipoDocumento[];
}

export interface TipoDocumentoCrear {
  nombre: string;
  descripcion: string | null;
  prefijoWorldOffice: string;
  /** Empresa del grupo (2026-11-13). Cada documento hereda la de su tipo. */
  empresa?: Empresa;
  campos: CampoTipoDocumentoInput[];
}

export interface TipoDocumentoActualizar {
  nombre: string;
  descripcion: string | null;
  prefijoWorldOffice: string;
  /** Empresa del grupo (2026-11-13). Cada documento hereda la de su tipo. */
  empresa?: Empresa;
  activo: boolean;
  campos: CampoTipoDocumentoInput[];
}
