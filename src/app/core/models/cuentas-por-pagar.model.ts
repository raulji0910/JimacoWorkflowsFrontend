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
  /** "código NOMBRE" tal cual lo usa Contabilidad (ej. "513595 OTROS"), o "Anticipo a proveedores". */
  nombre: string;
  esAnticipo: boolean;
  codigoCuenta: string;
  /** Grupo del PUC (ej. "Administración · Servicios"). */
  grupo: string | null;
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

export type EstadoSeguimientoPago = 'PorPagar' | 'Pagado' | 'Rechazado' | 'Otro';

/** Filtros de las listas paginadas de pagos (fechas "yyyy-MM-dd", días de Colombia). */
export interface FiltroPagos {
  estado?: EstadoSeguimientoPago | null;
  desde?: string | null;
  hasta?: string | null;
  buscar?: string | null;
  pagina?: number;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

export interface ConteoEstado {
  cantidad: number;
  monto: number;
}

export interface GrupoSeguimiento {
  clave: string;
  numeroRelacion: number | null;
  esExtraordinario: boolean;
  creadoPor: string | null;
  fecha: string;
  ordenes: SeguimientoPago[];
}

/** Una página del seguimiento: relaciones completas; los conteos son de todo el período + búsqueda. */
export interface SeguimientoPagina {
  grupos: GrupoSeguimiento[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  porPagar: ConteoEstado;
  pagados: ConteoEstado;
  rechazados: ConteoEstado;
  todos: ConteoEstado;
}

export function paramsFiltroPagos(f: FiltroPagos): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.estado) params['estado'] = f.estado;
  if (f.desde) params['desde'] = f.desde;
  if (f.hasta) params['hasta'] = f.hasta;
  if (f.buscar) params['buscar'] = f.buscar;
  params['pagina'] = String(f.pagina ?? 1);
  return params;
}

/** "Seguimiento de pagos" de Gerencia Comercial — GET api/CuentasPorPagar/seguimiento. */
export interface SeguimientoPago {
  instanciaDocumentoId: number;
  numeroReferencia: string | null;
  numeroRelacion: number | null;
  esExtraordinario: boolean;
  identificacion: string;
  tercero: string;
  neto: number;
  fechaCreacion: string;
  creadoPor: string | null;
  estado: EstadoSeguimientoPago;
  numeroLote: number | null;
  fechaPago: string | null;
  banco: string | null;
  prefijoCE: string | null;
  numeroCE: number | null;
  pendienteCreacionCE: boolean;
  conflictoCreacionCE: string | null;
  motivoRechazo: string | null;
  rechazadoPor: string | null;
  fechaRechazo: string | null;
  lineas: LineaOrdenPago[];
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

// ---- Configuración que maneja el administrador (2026-11-11) ----

export interface ConfiguracionCuentasPorPagar {
  prefijoCE: string;
  crearCEEnWorldOffice: boolean;
  fechaActualizacion: string | null;
  actualizadoPor: string | null;
}

export interface ActualizarConfiguracionCuentasPorPagar {
  prefijoCE: string;
  crearCEEnWorldOffice: boolean;
}
