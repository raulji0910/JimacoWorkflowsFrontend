// Módulo de Cuentas por Pagar (2026-11-05) — ver CuentasPorPagarDtos.cs en el backend. Los montos
// vienen "al derecho": positivo = lo que Jimaco le debe al proveedor.

// El backend serializa los enums como texto (JsonStringEnumConverter en Program.cs).
export type EstadoPartida = 'Disponible' | 'EnTramite' | 'PagadaPendienteCruce' | 'NoPagable';

export interface ProveedorCuentaPorPagar {
  identificacion: string;
  nombre: string;
  facturas: number;
  pendiente: number;
  vencido: number;
  saldoAFavor: number;
  anticipos: number;
  neto: number;
  enTramite: number;
  vencimientoMasAntiguo: string | null;
  diasMaximoVencido: number;
}

export interface ResumenCuentasPorPagar {
  fechaCorte: string | null;
  totalPendiente: number;
  totalVencido: number;
  venceProximos7Dias: number;
  alDia: number;
  vencido1a30: number;
  vencido31a60: number;
  vencidoMas60: number;
  totalAnticipos: number;
  totalEnTramite: number;
  proveedores: ProveedorCuentaPorPagar[];
}

export interface PartidaCuentaPorPagar {
  idDocumentoDetalleWO: number | null;
  documento: string | null;
  prefijo: string | null;
  numeroDocumento: string | null;
  numeroDocumentoExterno: string | null;
  fecha: string;
  vencimiento: string | null;
  diasVencido: number | null;
  pendiente: number;
  codigoCuenta: string | null;
  estado: EstadoPartida;
  pagoInstanciaDocumentoId: number | null;
  pagoNumeroReferencia: string | null;
}

/** Un anticipo abierto del proveedor (cuenta 133005), por partida — se puede descontar en el mismo CE. */
export interface AnticipoPartida {
  idDocumentoDetalleWO: number | null;
  prefijo: string | null;
  numeroDocumento: string | null;
  fecha: string | null;
  nota: string | null;
  saldo: number;
  estado: EstadoPartida;
  pagoInstanciaDocumentoId: number | null;
  pagoNumeroReferencia: string | null;
}

export interface DetalleProveedorCuentaPorPagar {
  fechaCorte: string | null;
  proveedor: ProveedorCuentaPorPagar;
  partidas: PartidaCuentaPorPagar[];
  anticiposMovimientos: number;
  anticipos: AnticipoPartida[];
}


export interface CuentaBanco {
  idCuentaContableWO: number;
  codigo: string;
  nombre: string;
  porDefecto: boolean;
}

export interface AnticipoPagoProveedor {
  idDocumentoDetalleWO: number;
  prefijo: string | null;
  numeroDocumento: string | null;
  fecha: string | null;
  nota: string | null;
  valor: number;
}

/** Datos del pago real y del CE que el sistema crea en World Office (solo documentos "Pago a Proveedor"). */
export interface PagoProveedor {
  identificacion: string;
  totalFacturas: number;
  totalAnticipos: number;
  neto: number;
  anticipos: AnticipoPagoProveedor[];
  idCuentaBancoWO: number | null;
  nombreBanco: string | null;
  fechaPago: string | null;
  pendienteCreacionCE: boolean;
  conflictoCreacionCE: string | null;
  prefijoCE: string | null;
  numeroCE: number | null;
  fechaCreacionCE: string | null;
  esExtraordinario?: boolean;
  nombreTercero?: string | null;
  nombreTipoGiro?: string | null;
  concepto?: string | null;
  numeroRelacion?: number | null;
  numeroLote?: number | null;
}

// ---- Relación de pagos (2026-11-09): borrador en el servidor → ratificar = un solo correo al pagador ----

export interface BorradorFactura {
  idDocumentoDetalleWO: number;
  etiqueta: string;
  numeroDocumentoExterno: string | null;
  vencimiento: string | null;
  valor: number;
  disponible: boolean;
}

export interface BorradorAnticipo {
  idDocumentoDetalleWO: number;
  etiqueta: string;
  nota: string | null;
  valor: number;
  disponible: boolean;
}

export interface BorradorProveedor {
  identificacion: string;
  nombre: string;
  facturas: BorradorFactura[];
  anticipos: BorradorAnticipo[];
  totalFacturas: number;
  totalAnticipos: number;
  neto: number;
  problema: string | null;
}

export interface RelacionBorrador {
  proveedores: BorradorProveedor[];
  facturas: number;
  total: number;
}

export interface RelacionCreada {
  numero: number;
  ordenes: number;
  total: number;
}

// ---- Pago extraordinario ----

export interface TipoGiro {
  id: number;
  nombre: string;
  esAnticipo: boolean;
}

export interface TerceroWO {
  idTerceroWO: number;
  identificacion: string;
  nombre: string;
}

export interface CrearPagoExtraordinario {
  idTerceroWO: number;
  valor: number;
  tipoGiroId: number;
  concepto: string;
}

// ---- Menú "Pagos" del pagador ----

export interface LineaOrdenPago {
  etiqueta: string;
  detalle: string | null;
  valor: number;
}

export interface OrdenPagoPendiente {
  instanciaDocumentoId: number;
  numeroReferencia: string | null;
  esExtraordinario: boolean;
  identificacion: string;
  tercero: string;
  fechaCreacion: string;
  creadoPor: string | null;
  numeroRelacion: number | null;
  observaciones: string | null;
  lineas: LineaOrdenPago[];
  neto: number;
}

export interface LoteOrden {
  instanciaDocumentoId: number;
  numeroReferencia: string | null;
  tercero: string;
  esExtraordinario: boolean;
  neto: number;
  prefijoCE: string | null;
  numeroCE: number | null;
  pendienteCreacionCE: boolean;
  conflictoCreacionCE: string | null;
}

export interface LotePago {
  id: number;
  numero: number;
  fecha: string;
  fechaPago: string;
  nombreBanco: string | null;
  total: number;
  pagadoPor: string | null;
  tieneSoporte: boolean;
  ordenes: LoteOrden[];
}
