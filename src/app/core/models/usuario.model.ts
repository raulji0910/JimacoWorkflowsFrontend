import { Rol } from './rol.model';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  usuarioWO: string | null;
  activo: boolean;
  roles: Rol[];
}

export interface UsuarioCrear {
  nombre: string;
  email: string;
  password: string;
  telefono: string | null;
  usuarioWO: string | null;
  rolesIds: number[];
}

export interface UsuarioActualizar {
  nombre: string;
  email: string;
  telefono: string | null;
  usuarioWO: string | null;
  activo: boolean;
  rolesIds: number[];
}

export interface CambiarPassword {
  passwordActual: string;
  passwordNueva: string;
}
