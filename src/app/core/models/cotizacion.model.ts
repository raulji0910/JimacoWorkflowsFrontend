// Cotizaciones armadas en el portal y creadas en World Office (2026-11-25) — ver Entidades/Cotizacion.cs
// y CatalogoWO.cs en el backend.

export type EstadoCotizacion = 'Borrador' | 'PorCrear' | 'Creada' | 'Error';

// ---- Catálogo de WO ----

export interface ExistenciaBodega {
  idBodega: string;
  bodega: string;
  existencia: number;
}

export interface ProductoCatalogo {
  idInventario: number;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  /** Fracción, como en WO (0.19). */
  iva: number;
  idClasificacion: number | null;
  precio1: number;
  existenciaTotal: number;
  existencias: ExistenciaBodega[];
}

export interface ClienteCatalogo {
  idTercero: number;
  identificacion: string;
  nombre: string;
}

export interface DireccionCliente {
  idDireccion: number;
  direccion: string | null;
  ciudad: string | null;
  telefonos: string | null;
  principal: boolean;
}

export interface EstadoCatalogo {
  ultimaVersionProductos: number;
  fechaProductos: string | null;
  fechaExistencias: string | null;
  fechaCatalogos: string | null;
}

export interface CatalogoCotizacion {
  bodegas: { idBodega: string; nombre: string }[];
  formasPago: { idFormaPago: number; nombre: string }[];
  camposMasDatos: { numero: number; etiqueta: string }[];
  estado: EstadoCatalogo;
}

// ---- Cotización ----

export interface CotizacionRenglonInput {
  idInventario: number;
  idBodega: string;
  cantidad: number;
  valorUnitario: number;
  nota: string | null;
}

export interface GuardarCotizacion {
  idTercero: number | null;
  idDireccion: number | null;
  idFormaPago: number | null;
  concepto: string | null;
  vigenciaDias: number;
  masDatos: Record<number, string>;
  renglones: CotizacionRenglonInput[];
}

export interface CotizacionRenglon {
  orden: number;
  idInventario: number;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  idBodega: string;
  cantidad: number;
  valorUnitario: number;
  iva: number;
  nota: string | null;
  subtotal: number;
  valorIva: number;
  total: number;
}

export interface Cotizacion {
  id: number;
  estado: EstadoCotizacion;
  usuarioId: number;
  usuarioNombre: string;
  idTercero: number | null;
  clienteIdentificacion: string | null;
  clienteNombre: string | null;
  idDireccion: number | null;
  direccionTexto: string | null;
  idFormaPago: number | null;
  formaPagoNombre: string | null;
  concepto: string | null;
  vigenciaDias: number;
  masDatos: Record<string, string>;
  subtotal: number;
  iva: number;
  total: number;
  totalCantidades: number;
  fechaCreacion: string;
  fechaActualizacion: string;
  fechaDocumento: string | null;
  fechaEnvio: string | null;
  prefijoWO: string | null;
  numeroWO: number | null;
  fechaCreacionWO: string | null;
  mensajeError: string | null;
  renglones: CotizacionRenglon[];
}

export interface CotizacionResumen {
  id: number;
  estado: EstadoCotizacion;
  usuarioNombre: string;
  clienteNombre: string | null;
  clienteIdentificacion: string | null;
  renglones: number;
  total: number;
  fechaActualizacion: string;
  fechaEnvio: string | null;
  prefijoWO: string | null;
  numeroWO: number | null;
  mensajeError: string | null;
}

/**
 * Totales como World Office (ver TotalesWO.cs): base e IVA redondeados A PESOS en cada renglón y
 * luego sumados — así lo que se ve en pantalla es exactamente lo que queda en WO.
 */
export function totalesRenglon(cantidad: number, valorUnitario: number, iva: number): { subtotal: number; iva: number; total: number } {
  const subtotal = redondearPesos(cantidad * valorUnitario);
  const valorIva = redondearPesos(cantidad * valorUnitario * iva);
  return { subtotal, iva: valorIva, total: subtotal + valorIva };
}

/** Redondeo "lejos de cero" como MidpointRounding.AwayFromZero del backend (Math.round no lo hace con negativos). */
function redondearPesos(valor: number): number {
  // Corrige el ruido binario (ej. 7683.499999999) antes de redondear.
  const limpio = Math.round(valor * 1e6) / 1e6;
  return Math.sign(limpio) * Math.round(Math.abs(limpio));
}

/** Administración → Config. de cotizaciones (2026-11-26). */
export interface ConfiguracionDocumentosWO {
  prefijoCotizacion: string;
  crearCotizacionesEnWorldOffice: boolean;
  fechaActualizacion: string | null;
  actualizadoPor: string | null;
  cotizacionesEnCola: number;
}
