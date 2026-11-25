import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/**
 * Peticiones que NO prenden la rueda de espera (2026-11-25): búsquedas mientras se escribe
 * (productos, clientes) y consultas automáticas en segundo plano (¿ya se creó la cotización en
 * WO?). Si bloquearan la pantalla, el usuario no podría seguir escribiendo.
 */
export const SIN_RUEDA = new HttpContextToken<boolean>(() => false);

/**
 * Cuenta toda petición HTTP en vuelo para mostrar la rueda de espera global (ver
 * LoadingOverlayComponent). No distingue endpoints — cualquier llamado, en cualquier módulo,
 * prende/apaga el mismo contador, salvo las marcadas con SIN_RUEDA.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SIN_RUEDA)) return next(req);
  const loading = inject(LoadingService);
  loading.iniciar();
  return next(req).pipe(finalize(() => loading.finalizar()));
};
