import { Injectable, computed, signal } from '@angular/core';

/**
 * Contador global de peticiones HTTP en vuelo (ver loading.interceptor.ts). `activo` se usa en
 * LoadingOverlayComponent, montado una sola vez en app.html — así cualquier botón que dispare una
 * petición, en cualquier módulo (incluida la vista sin login de accion-correo), muestra la rueda
 * de espera sin que cada componente tenga que manejarla a mano.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly peticionesEnVuelo = signal(0);

  readonly activo = computed(() => this.peticionesEnVuelo() > 0);

  iniciar(): void {
    this.peticionesEnVuelo.update((n) => n + 1);
  }

  finalizar(): void {
    this.peticionesEnVuelo.update((n) => Math.max(0, n - 1));
  }
}
