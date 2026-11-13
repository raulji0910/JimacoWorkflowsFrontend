import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../models/auth.model';

const CLAVE_STORAGE = 'aprobaciones.sesion';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  private readonly sesion = signal<LoginResponse | null>(this.leerSesionValida());
  private temporizadorExpiracion: ReturnType<typeof setTimeout> | null = null;

  readonly usuario = this.sesion.asReadonly();

  constructor(private readonly http: HttpClient) {
    const sesionInicial = this.sesion();
    if (sesionInicial) {
      this.programarExpiracion(sesionInicial.token);
    }
  }

  login(dto: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, dto).pipe(
      tap((respuesta) => {
        localStorage.setItem(CLAVE_STORAGE, JSON.stringify(respuesta));
        this.sesion.set(respuesta);
        this.programarExpiracion(respuesta.token);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(CLAVE_STORAGE);
    this.sesion.set(null);
    if (this.temporizadorExpiracion) {
      clearTimeout(this.temporizadorExpiracion);
      this.temporizadorExpiracion = null;
    }
  }

  get token(): string | null {
    return this.sesion()?.token ?? null;
  }

  get estaAutenticado(): boolean {
    return this.sesion() !== null;
  }

  esAdmin(): boolean {
    return this.tieneRol('Admin');
  }

  tieneRol(nombreRol: string): boolean {
    return this.sesion()?.roles?.includes(nombreRol) ?? false;
  }

  /** Ver Rol.PuedeDevolverCualquierDocumento en el backend — gatilla la pantalla de "Buscar documento". */
  puedeDevolverCualquierDocumento(): boolean {
    return this.sesion()?.puedeDevolverCualquierDocumento ?? false;
  }

  /** Puede editar cantidades disponibles en cualquier Hoja de Alistamiento — ver Rol.PuedeGestionarAlistamiento. */
  puedeGestionarAlistamiento(): boolean {
    return this.sesion()?.puedeGestionarAlistamiento ?? false;
  }

  /** Puede ver el dashboard de alistamiento (gestionar también lo implica). */
  puedeVerAlistamiento(): boolean {
    const sesion = this.sesion();
    return (sesion?.puedeVerAlistamiento || sesion?.puedeGestionarAlistamiento) ?? false;
  }

  /** Empresa del grupo: 'Jimaco' (de siempre) o 'Ferrealiados' (2026-11-13). */
  puedeGestionarAlistamientoDe(empresa: 'Jimaco' | 'Ferrealiados'): boolean {
    return empresa === 'Ferrealiados'
      ? (this.sesion()?.puedeGestionarAlistamientoFerrealiados ?? false)
      : this.puedeGestionarAlistamiento();
  }

  /** Dashboard "Alistamiento Ferrealiados" (gestionar también lo implica). */
  puedeVerAlistamientoFerrealiados(): boolean {
    const sesion = this.sesion();
    return (sesion?.puedeVerAlistamientoFerrealiados || sesion?.puedeGestionarAlistamientoFerrealiados) ?? false;
  }

  /** Puede entrar al módulo de Cuentas por Pagar — ver Rol.PuedeVerCuentasPorPagar. */
  puedeVerCuentasPorPagar(): boolean {
    return this.sesion()?.puedeVerCuentasPorPagar ?? false;
  }

  /** Puede entrar al menú "Pagos" (pagar relaciones y pagos extraordinarios) — ver Rol.PuedePagarCuentas. */
  puedePagarCuentas(): boolean {
    return this.sesion()?.puedePagarCuentas ?? false;
  }

  /** Entregas: imprimir remisiones y confirmar entregas — ver Rol.PuedeGestionarEntregas. */
  puedeGestionarEntregas(): boolean {
    return this.sesion()?.puedeGestionarEntregas ?? false;
  }

  /** Ver el dashboard de entregas (gestionar, documentar o facturar también lo implican). */
  puedeVerEntregas(): boolean {
    const sesion = this.sesion();
    return (
      (sesion?.puedeVerEntregas || sesion?.puedeGestionarEntregas || sesion?.puedeDocumentarEntregas || sesion?.puedeFacturarEntregas) ??
      false
    );
  }

  /** Emisor de remisiones: adjunta los documentos para facturar de SUS remisiones. */
  puedeDocumentarEntregas(): boolean {
    return this.sesion()?.puedeDocumentarEntregas ?? false;
  }

  /** Contable: recibe las remisiones para facturar y puede devolverlas. */
  puedeFacturarEntregas(): boolean {
    return this.sesion()?.puedeFacturarEntregas ?? false;
  }

  private leerSesionValida(): LoginResponse | null {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (!crudo) return null;

    try {
      const sesion = JSON.parse(crudo) as LoginResponse;
      const expiracion = this.obtenerExpiracion(sesion.token);
      if (expiracion !== null && expiracion <= Date.now()) {
        localStorage.removeItem(CLAVE_STORAGE);
        return null;
      }
      return sesion;
    } catch {
      return null;
    }
  }

  private programarExpiracion(token: string): void {
    if (this.temporizadorExpiracion) {
      clearTimeout(this.temporizadorExpiracion);
      this.temporizadorExpiracion = null;
    }

    const expiracion = this.obtenerExpiracion(token);
    if (expiracion === null) return;

    const msRestantes = expiracion - Date.now();
    if (msRestantes <= 0) {
      this.expirarSesion();
      return;
    }

    this.temporizadorExpiracion = setTimeout(() => this.expirarSesion(), msRestantes);
  }

  private expirarSesion(): void {
    this.logout();
    this.snackBar.open('Tu sesión expiró. Por favor ingresá de nuevo.', 'Cerrar', { duration: 6000 });
    this.router.navigate(['/login']);
  }

  // Decodifica el payload del JWT solo para leer "exp"/"nameid" (no valida la firma — eso
  // siempre ocurre en el backend).
  private decodificarPayload(token: string): Record<string, string> | null {
    try {
      const payload = token.split('.')[1];
      let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
      );
      return JSON.parse(json) as Record<string, string>;
    } catch {
      return null;
    }
  }

  private obtenerExpiracion(token: string): number | null {
    const payload = this.decodificarPayload(token);
    const exp = payload?.['exp'];
    return exp ? Number(exp) * 1000 : null;
  }
}
