import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    // Precarga en segundo plano el código de todas las pantallas apenas abre la app: al hacer clic
    // en el menú ya no hay que esperar a descargarlo (2026-11-24).
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([loadingInterceptor, authInterceptor])),
    provideAnimationsAsync(),
    provideNativeDateAdapter()
  ]
};
