import { Rol } from './rol.model';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  usuarioWO: string | null;
  nombresCompletosWO: string | null;
  /** Su usuario en el World Office de FERREALIADOS (vacío = el mismo de Jimaco). */
  usuarioWOFerrealiados?: string | null;
  /** Tercero "elaborado por" de WO para los documentos que crea desde el portal (ej. Laura = 9602). */
  idTerceroWO?: number | null;
  activo: boolean;
  roles: Rol[];
}

export interface UsuarioCrear {
  nombre: string;
  email: string;
  password: string;
  telefono: string | null;
  usuarioWO: string | null;
  nombresCompletosWO: string | null;
  /** Su usuario en el World Office de FERREALIADOS (vacío = el mismo de Jimaco). */
  usuarioWOFerrealiados?: string | null;
  /** Tercero "elaborado por" de WO para los documentos que crea desde el portal (ej. Laura = 9602). */
  idTerceroWO?: number | null;
  rolesIds: number[];
}

export interface UsuarioActualizar {
  nombre: string;
  email: string;
  telefono: string | null;
  usuarioWO: string | null;
  nombresCompletosWO: string | null;
  /** Su usuario en el World Office de FERREALIADOS (vacío = el mismo de Jimaco). */
  usuarioWOFerrealiados?: string | null;
  /** Tercero "elaborado por" de WO para los documentos que crea desde el portal (ej. Laura = 9602). */
  idTerceroWO?: number | null;
  activo: boolean;
  rolesIds: number[];
}

export interface CambiarPassword {
  passwordActual: string;
  passwordNueva: string;
}

export interface RestablecerPassword {
  passwordNueva: string;
}
