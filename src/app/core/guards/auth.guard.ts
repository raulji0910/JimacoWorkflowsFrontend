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

export const puedeVerCuentasPorPagarGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.puedeVerCuentasPorPagar()) return true;

  router.navigate(['/pendientes']);
  return false;
};
