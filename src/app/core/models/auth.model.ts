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
}
