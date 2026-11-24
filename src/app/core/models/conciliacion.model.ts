export type EstadoConciliacion = 'Cuadra' | 'Diferencia' | 'Parcial' | 'SinOrdenCompra';

export interface FacturaConciliada {
  facturaId: number;
  numero: string;
  fechaEmision: string;
  nitProveedor: string;
  nombreProveedor: string;
  subtotal: number;
  iva: number;
  total: number;
  referenciaOrden: string | null;
  estado: EstadoConciliacion;
  ordenCompraNumero: number | null;
  ordenCompraFecha: string | null;
  ordenCompraSubtotal: number | null;
  ordenCompraIva: number | null;
  diferenciaSubtotal: number | null;
  diferenciaIva: number | null;
  detalle: string;
  // Todas las OC del cruce (varias solo si salió de una FC de WO que cita más de una) y la FC de
  // World Office de donde salió el cruce, si fue por esa vía.
  ordenesCompra: number[];
  facturaCompraNumero: number | null;
  // Por dónde entró: correo de facturación, carga única por carpeta o ZIP subido de la DIAN.
  origen: OrigenFactura;
  // Adiciones de Jimaco: quién elaboró la(s) OC en World Office y la revisión de la factura
  // (observaciones en Parciales / Con diferencia, con la marca "Revisada").
  emisoresOrdenCompra: string[] | null;
  observaciones: number;
  ultimaObservacion: string | null;
  revisada: boolean;
}

export type OrigenFactura = 'Correo' | 'Carpeta' | 'Dian';

export type EstadoCarga = 'Nueva' | 'Duplicada' | 'NoReconocida' | 'OtroReceptor';

// Un XML leído de los ZIP subidos.
export interface FacturaCargada {
  nombreArchivo: string | null;
  numero: string | null;
  nitProveedor: string | null;
  nombreProveedor: string | null;
  fechaEmision: string | null;
  total: number | null;
  estado: EstadoCarga;
  origenExistente: OrigenFactura | null;
}

export interface CargaArchivosResultado {
  archivos: number;
  nuevas: number;
  duplicadas: number;
  noReconocidas: number;
  otroReceptor: number;
  facturas: FacturaCargada[];
  avisos: string[];
}

export interface OrdenPendiente {
  numero: number;
  fecha: string;
  nitProveedor: string;
  nombreProveedor: string;
  subtotal: number;
  iva: number;
  saldoSubtotal: number;
  idAsientoContable: number;
  // Historial de revisión: cuántas entradas tiene, la más reciente y si quedó marcada como que no
  // requiere factura (la OC sigue en la lista igual).
  observaciones: number;
  ultimaObservacion: string | null;
  noRequiereFactura: boolean;
  emisor: string | null;
}

export type AccionObservacionOrden = 'Observacion' | 'MarcarNoRequiereFactura' | 'QuitarMarcaNoRequiereFactura';

export interface ObservacionOrden {
  id: number;
  tipo: 'Observacion' | 'MarcaNoRequiereFactura' | 'QuitaMarcaNoRequiereFactura' | 'MarcaRevisada' | 'QuitaMarcaRevisada';
  texto: string;
  nombreUsuario: string;
  fecha: string; // UTC con zona
}

export interface ObservacionesOrden {
  idAsientoContable: number;
  numero: number;
  fecha: string;
  nitProveedor: string;
  nombreProveedor: string;
  subtotal: number;
  iva: number;
  noRequiereFactura: boolean;
  historial: ObservacionOrden[];
  emisor: string | null;
}

// Observaciones de una factura Parcial o Con diferencia (adición de Jimaco).
export type AccionObservacionFactura = 'Observacion' | 'MarcarRevisada' | 'QuitarMarcaRevisada';

export interface ObservacionesFactura {
  facturaId: number;
  numero: string;
  fechaEmision: string;
  nitProveedor: string;
  nombreProveedor: string;
  subtotal: number;
  iva: number;
  revisada: boolean;
  historial: ObservacionOrden[];
}

// OC que una FC de World Office dice cubrir, pero cuyo XML no llegó: falta bajarlo de la DIAN.
export interface OrdenFacturadaSinXml {
  numero: number;
  fecha: string;
  nitProveedor: string;
  nombreProveedor: string;
  subtotal: number;
  iva: number;
  facturaCompraNumero: number;
  facturaCompraFecha: string;
  documentoExterno: string | null;
  emisor: string | null;
}

// OC escrita por Contabilidad en una FC de WO que no se pudo usar (otro proveedor o no existe).
export interface ReferenciaOrdenInvalida {
  facturaCompraNumero: number;
  fecha: string;
  nitProveedor: string;
  nombreProveedor: string;
  documentoExterno: string | null;
  referenciaOrdenes: string | null;
  ordenCitada: number;
  motivo: string;
}

export interface ResumenConciliacion {
  cuadran: number;
  conDiferencia: number;
  parciales: number;
  sinOrdenCompra: number;
  ordenesPendientes: number;
  ordenesFacturadasSinXml: number;
  referenciasInvalidas: number;
}

export interface Conciliacion {
  desde: string;
  hasta: string;
  resumen: ResumenConciliacion;
  facturas: FacturaConciliada[];
  ordenesPendientes: OrdenPendiente[];
  ordenesFacturadasSinXml: OrdenFacturadaSinXml[];
  referenciasInvalidas: ReferenciaOrdenInvalida[];
  ultimaSincronizacionOrdenes: string | null;
  ultimaFacturaRecibida: string | null;
}

export interface RenglonComparacion {
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  subtotal: number;
  porcentajeIva: number | null;
}

export interface DetalleFacturaConciliada {
  conciliacion: FacturaConciliada;
  renglonesFactura: RenglonComparacion[];
  renglonesOrdenCompra: RenglonComparacion[];
}
