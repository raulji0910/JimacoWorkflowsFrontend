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

export interface CrearPagoProveedor {
  identificacion: string;
  idsDocumentoDetalleWO: number[];
  observaciones: string | null;
  idsAnticiposWO: number[];
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
}
