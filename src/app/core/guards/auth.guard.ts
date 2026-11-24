import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado) return true;

  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.esAdmin()) return true;

  router.navigate(['/pendientes']);
  return false;
};

export const puedeDevolverCualquierDocumentoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeDevolverCualquierDocumento()) return true;

  router.navigate(['/pendientes']);
  return false;
};

export const puedeVerAlistamientoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerAlistamiento()) return true;

  router.navigate(['/pendientes']);
  return false;
};

export const puedeVerEntregasGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerEntregas()) return true;

  router.navigate(['/pendientes']);
  return false;
};

export const puedeVerAlistamientoFerrealiadosGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerAlistamientoFerrealiados()) return true;

  router.navigate(['/pendientes']);
  return false;
};

export const puedePagarCuentasGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedePagarCuentas()) return true;

  router.navigate(['/pendientes']);
  return false;
};

/** Menú "Pagos": el pagador o quien solo consulta (contable). */
export const puedeVerPagosGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerPagos()) return true;

  router.navigate(['/pendientes']);
  return false;
};

/** Seguimiento de pagos: Gerencia Comercial o quien consulta pagos. */
export const puedeVerSeguimientoPagosGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerSeguimientoPagos()) return true;

  router.navigate(['/pendientes']);
  return false;
};

export const puedeVerCuentasPorPagarGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerCuentasPorPagar()) return true;

  router.navigate(['/pendientes']);
  return false;
};

/** Conciliación de facturas de proveedor vs OC (rol Conciliador, 2026-11-24). */
export const puedeVerConciliacionGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerConciliacion()) return true;

  router.navigate(['/pendientes']);
  return false;
};
