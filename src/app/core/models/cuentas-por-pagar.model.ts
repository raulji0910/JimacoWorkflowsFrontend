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

export interface DetalleProveedorCuentaPorPagar {
  fechaCorte: string | null;
  proveedor: ProveedorCuentaPorPagar;
  partidas: PartidaCuentaPorPagar[];
  anticiposMovimientos: number;
}

export interface CrearPagoProveedor {
  identificacion: string;
  idsDocumentoDetalleWO: number[];
  observaciones: string | null;
}
