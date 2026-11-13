export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  // Permiso administrativo transversal: puede buscar y devolver CUALQUIER documento, sin importar
  // su paso actual ni si tiene el rol habilitado ahí — ver Rol.PuedeDevolverCualquierDocumento
  // en el backend.
  puedeDevolverCualquierDocumento: boolean;
  // Control de alistamiento — ver Rol.PuedeGestionarAlistamiento/PuedeVerAlistamiento en el backend.
  puedeGestionarAlistamiento: boolean;
  puedeVerAlistamiento: boolean;
  // Módulo de Cuentas por Pagar — ver Rol.PuedeVerCuentasPorPagar en el backend.
  puedeVerCuentasPorPagar: boolean;
  // Menú "Pagos" — ver Rol.PuedePagarCuentas en el backend.
  puedePagarCuentas?: boolean;
  puedeGestionarAlistamientoFerrealiados?: boolean;
  puedeVerAlistamientoFerrealiados?: boolean;
}

export interface RolCrear {
  nombre: string;
  descripcion: string | null;
  puedeDevolverCualquierDocumento: boolean;
  puedeGestionarAlistamiento: boolean;
  puedeVerAlistamiento: boolean;
  // Módulo de Cuentas por Pagar — ver Rol.PuedeVerCuentasPorPagar en el backend.
  puedeVerCuentasPorPagar: boolean;
  // Menú "Pagos" — ver Rol.PuedePagarCuentas en el backend.
  puedePagarCuentas?: boolean;
  puedeGestionarAlistamientoFerrealiados?: boolean;
  puedeVerAlistamientoFerrealiados?: boolean;
}

export interface RolActualizar {
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  puedeDevolverCualquierDocumento: boolean;
  puedeGestionarAlistamiento: boolean;
  puedeVerAlistamiento: boolean;
  // Módulo de Cuentas por Pagar — ver Rol.PuedeVerCuentasPorPagar en el backend.
  puedeVerCuentasPorPagar: boolean;
  // Menú "Pagos" — ver Rol.PuedePagarCuentas en el backend.
  puedePagarCuentas?: boolean;
  puedeGestionarAlistamientoFerrealiados?: boolean;
  puedeVerAlistamientoFerrealiados?: boolean;
}
