import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Token de "acción desde el correo" (ver accion-correo.component.ts) para una petición puntual —
 * cuando viene seteado, pisa el token de sesión normal (aunque haya una sesión logueada en esta
 * misma máquina/navegador) y un 401 NO dispara logout/redirect a /login, porque no hay sesión que
 * cerrar: solo significa que ese link puntual venció o ya no aplica.
 */
export const TOKEN_CORREO = new HttpContextToken<string | null>(() => null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const tokenCorreo = req.context.get(TOKEN_CORREO);
  const token = tokenCorreo ?? authService.token;

  const solicitud = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(solicitud).pipe(
    catchError((error) => {
      if (error.status === 401 && !tokenCorreo) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
