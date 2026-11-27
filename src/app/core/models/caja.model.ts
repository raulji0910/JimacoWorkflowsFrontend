// Cajas menores de efectivo (2026-11-27). Ver CajaService en el backend.

export type Empresa = 'Jimaco' | 'Ferrealiados';
export type TipoMovimientoCaja = 'Recarga' | 'Giro' | 'Vuelta' | 'Reintegro' | 'Ajuste';
export type EstadoGiroCaja = 'Abierto' | 'VueltaPendiente' | 'Cerrado' | 'Anulado';

export interface CajaResumen {
  id: number;
  empresa: Empresa;
  nombre: string;
  tope: number;
  saldoMinimoAlerta: number;
  saldoActual: number;
  girosAbiertos: number;
  valorGirosAbiertos: number;
  girosConVueltaPendiente: number;
  valorVueltasPendientes: number;
  faltaParaTope: number;
  saldoBajo: boolean;
  esAdministrador: boolean;
  esGirador: boolean;
  fechaActualizacion: string | null;
  actualizadoPor: string | null;
}

export interface ConceptoCaja {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Beneficiario {
  id: number;
  nombre: string;
  cedula: string;
  telefono: string | null;
  correo: string | null;
  esInterno: boolean | null;
  activo: boolean;
}

export interface GuardarBeneficiario {
  nombre: string;
  cedula: string;
  telefono: string | null;
  correo: string | null;
  esInterno: boolean | null;
  activo?: boolean;
}

export interface MovimientoCaja {
  id: number;
  tipo: TipoMovimientoCaja;
  valor: number;
  saldoDespues: number;
  fecha: string;
  usuario: string;
  nota: string | null;
  giroId: number | null;
  giroNumero: number | null;
  beneficiario: string | null;
  concepto: string | null;
  anulado: boolean;
  motivoAnulacion: string | null;
  anuladoPor: string | null;
  fechaAnulacion: string | null;
}

export interface HistorialCaja {
  movimientos: MovimientoCaja[];
  total: number;
  totalEntradas: number;
  totalSalidas: number;
}

export interface FiltroHistorial {
  desde?: string | null;
  hasta?: string | null;
  tipo?: TipoMovimientoCaja | null;
  texto?: string | null;
  incluirAnulados?: boolean;
  pagina?: number;
  tamanoPagina?: number;
}

export interface OrdenCompraGiro {
  instanciaDocumentoId: number;
  numeroReferencia: string | null;
  proveedor: string | null;
  valor: number;
  pasoActual: string | null;
}

export interface OrdenCompraPendientePago {
  instanciaDocumentoId: number;
  numeroReferencia: string | null;
  proveedor: string | null;
  valor: number;
  fechaCreacion: string;
  pasoActual: string;
}

export interface GiroResumen {
  id: number;
  numero: number;
  estado: EstadoGiroCaja;
  fecha: string;
  beneficiario: string;
  beneficiarioCedula: string;
  concepto: string;
  valorEntregado: number;
  valorLegalizado: number | null;
  vueltaPendiente: number;
  giradoPor: string;
  horasPendiente: number;
  ordenesCompra: string[];
}

export interface Giro {
  id: number;
  cajaId: number;
  empresa: Empresa;
  numero: number;
  estado: EstadoGiroCaja;
  fecha: string;
  beneficiario: Beneficiario;
  concepto: ConceptoCaja;
  valorEntregado: number;
  nota: string | null;
  giradoPor: string;
  valorLegalizado: number | null;
  fechaLegalizacion: string | null;
  legalizadoPor: string | null;
  notaLegalizacion: string | null;
  valorVueltasRecibidas: number;
  vueltaPendiente: number;
  tieneSoporte: boolean;
  soporteNombreArchivo: string | null;
  fechaAnulacion: string | null;
  anuladoPor: string | null;
  motivoAnulacion: string | null;
  ordenesCompra: OrdenCompraGiro[];
  movimientos: MovimientoCaja[];
}

export interface CrearGiro {
  beneficiarioId: number;
  conceptoId: number;
  valorEntregado: number;
  nota: string | null;
  ordenesCompraIds: number[];
}

export interface ResultadoArqueo {
  saldoSistema: number;
  efectivoContado: number;
  diferencia: number;
  ajuste: MovimientoCaja | null;
}

export interface PasoPagoCaja {
  pasoId: number;
  flujo: string;
  orden: number;
  paso: string;
  requiereGiroCaja: boolean;
  ordenesEnElPaso: number;
}

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimientoCaja, string> = {
  Recarga: 'Recarga',
  Giro: 'Giro',
  Vuelta: 'Vuelta',
  Reintegro: 'Reintegro',
  Ajuste: 'Ajuste (arqueo)'
};

export const ETIQUETA_ESTADO_GIRO: Record<EstadoGiroCaja, string> = {
  Abierto: 'Por legalizar',
  VueltaPendiente: 'Vuelta pendiente',
  Cerrado: 'Cerrado',
  Anulado: 'Anulado'
};
