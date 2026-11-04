import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/**
 * Cuenta toda petición HTTP en vuelo para mostrar la rueda de espera global (ver
 * LoadingOverlayComponent). No distingue endpoints — cualquier llamado, en cualquier módulo,
 * prende/apaga el mismo contador.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  loading.iniciar();
  return next(req).pipe(finalize(() => loading.finalizar()));
};
