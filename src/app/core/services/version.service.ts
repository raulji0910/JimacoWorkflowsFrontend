import { Injectable, inject, signal } from '@angular/core';
import { GuardsCheckEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Cada cuánto se pregunta al servidor si hay versión nueva. */
const INTERVALO_MS = 2 * 60 * 1000;
/** Para no preguntar en cada clic del menú. */
const MINIMO_ENTRE_CONSULTAS_MS = 30 * 1000;
/** Marca (por pestaña) de que ya se recargó una vez buscando esa versión — evita un ciclo de recargas. */
const CLAVE_RECARGA = 'aprobaciones.recargadoPara';

/**
 * Control de versiones (2026-11-23, pedido real): Logística seguía trabajando con una versión vieja
 * guardada en el navegador ("marco el ítem y no se llena"). El servidor publica /version.json en cada
 * despliegue (lo genera el Dockerfile desde package.json); la app lo consulta cada 2 minutos y cuando
 * la pestaña vuelve a primer plano. Si hay una versión distinta a la que está corriendo:
 *  - muestra el aviso "Hay una versión nueva" con el botón Actualizar ahora;
 *  - se recarga sola en el siguiente cambio de pantalla (después de los guards: si hay cantidades sin
 *    guardar, el aviso de siempre pregunta primero) o al volver a la pestaña;
 *  - la recarga nunca pisa datos escritos: Alistamiento tiene su "beforeunload", el navegador pregunta.
 * index.html se sirve con "no-cache" (nginx.conf), así que recargar SIEMPRE trae la última.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly router = inject(Router);

  readonly versionActual = environment.version;
  /** La versión que está publicada en el servidor, si es distinta de la que corre esta pestaña. */
  readonly versionNueva = signal<string | null>(null);
  /** true = ya se recargó y siguió llegando la versión vieja: solo el aviso, sin recargas automáticas. */
  private recargaAutomaticaSuspendida = false;

  private ultimaConsulta = 0;
  private iniciado = false;

  iniciar(): void {
    // En desarrollo (ng serve) no hay version.json y no tiene sentido recargar.
    if (this.iniciado || !environment.production) return;
    this.iniciado = true;

    void this.consultar(true);
    setInterval(() => void this.consultar(true), INTERVALO_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      // Volvió a la pestaña: si ya sabíamos que hay versión nueva, es el mejor momento para recargar.
      if (this.versionNueva() && !this.recargaAutomaticaSuspendida) this.recargar();
      else void this.consultar(false);
    });

    // Cambio de pantalla: recargar a la pantalla pedida, ya con la versión nueva. Se hace al final de
    // los guards (GuardsCheckEnd), así el aviso de "cantidades sin guardar" pregunta antes.
    this.router.events
      .pipe(filter((e): e is GuardsCheckEnd => e instanceof GuardsCheckEnd))
      .subscribe((e) => {
        if (e.shouldActivate && this.versionNueva() && !this.recargaAutomaticaSuspendida) {
          this.recargar(e.urlAfterRedirects);
          return;
        }
        void this.consultar(false);
      });
  }

  /** Recarga la página (opcionalmente en otra ruta) para traer la versión nueva. */
  recargar(url?: string): void {
    const nueva = this.versionNueva();
    if (nueva) this.guardarMarca(nueva);
    if (url) window.location.assign(url);
    else window.location.reload();
  }

  private async consultar(forzar: boolean): Promise<void> {
    const ahora = Date.now();
    if (!forzar && ahora - this.ultimaConsulta < MINIMO_ENTRE_CONSULTAS_MS) return;
    this.ultimaConsulta = ahora;

    try {
      // fetch directo (no HttpClient): no dispara la rueda de espera global ni el token.
      const r = await fetch(`/version.json?t=${ahora}`, { cache: 'no-store' });
      if (!r.ok) return;
      const { version } = (await r.json()) as { version?: string };
      if (!version || version === this.versionActual) {
        this.versionNueva.set(null);
        return;
      }
      // Ya se recargó una vez buscando esta misma versión y sigue llegando la vieja (caché de algún
      // intermediario): se muestra el aviso, pero no se recarga sola otra vez — evita un ciclo.
      if (this.leerMarca() === version) {
        this.versionNueva.set(version);
        this.recargaAutomaticaSuspendida = true;
        return;
      }
      this.versionNueva.set(version);
    } catch {
      // Sin red o servidor reiniciándose: se vuelve a intentar en la próxima consulta.
    }
  }

  private guardarMarca(version: string): void {
    try {
      sessionStorage.setItem(CLAVE_RECARGA, version);
    } catch {
      // Navegación privada: sin marca, a lo sumo una recarga de más.
    }
  }

  private leerMarca(): string | null {
    try {
      return sessionStorage.getItem(CLAVE_RECARGA);
    } catch {
      return null;
    }
  }
}
