export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  nombre: string;
  email: string;
  roles: string[];
  // Si alguno de los roles del usuario tiene el permiso administrativo de buscar y devolver
  // cualquier documento — ver Rol.PuedeDevolverCualquierDocumento en el backend.
  puedeDevolverCualquierDocumento: boolean;
  // Control de alistamiento — ver Rol.PuedeGestionarAlistamiento/PuedeVerAlistamiento en el backend.
  puedeGestionarAlistamiento: boolean;
  puedeVerAlistamiento: boolean;
  // Módulo de Cuentas por Pagar — ver Rol.PuedeVerCuentasPorPagar en el backend.
  puedeVerCuentasPorPagar: boolean;
  // Menú "Pagos" (pagador de cuentas) — ver Rol.PuedePagarCuentas en el backend.
  puedePagarCuentas?: boolean;
  // Entregas (Remisiones) — ver Rol.PuedeGestionarEntregas/PuedeVerEntregas en el backend.
  puedeGestionarEntregas?: boolean;
  puedeVerEntregas?: boolean;
  // Entregas fase 2 (2026-11-13): emisor que adjunta los documentos para facturar / contable.
  puedeDocumentarEntregas?: boolean;
  puedeFacturarEntregas?: boolean;
  // Alistamiento de FERREALIADOS (2026-11-13) — dashboard aparte, permisos aparte.
  puedeGestionarAlistamientoFerrealiados?: boolean;
  puedeVerAlistamientoFerrealiados?: boolean;
  // Consulta de pagos, solo lectura (contable, 2026-11-23) — ver Rol.PuedeConsultarPagos en el backend.
  puedeConsultarPagos?: boolean;
  // Conciliación de facturas de proveedor vs OC (2026-11-24) — ver Rol.PuedeVerConciliacion en el backend.
  puedeVerConciliacion?: boolean;
}
