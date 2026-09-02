export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface RolCrear {
  nombre: string;
  descripcion: string | null;
}

export interface RolActualizar {
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}
