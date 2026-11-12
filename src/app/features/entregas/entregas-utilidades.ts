import { Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Abre un PDF (Blob) en una pestaña nueva para imprimir. La pestaña se abre ANTES de la petición
 * (en el mismo clic): si se abre después, el celular la bloquea como ventana emergente.
 */
export function abrirPdfEnPestana(peticion: Observable<Blob>, snackBar: MatSnackBar): void {
  const ventana = window.open('', '_blank');
  peticion.subscribe({
    next: (blob) => {
      const url = URL.createObjectURL(blob);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    },
    error: () => {
      ventana?.close();
      snackBar.open('No se pudo generar el PDF.', 'Cerrar', { duration: 4000 });
    }
  });
}

/**
 * "hace 3 h", "hace 2 días". soloFecha = la fecha de WO es un día sin hora (se mide desde ese día,
 * en hora local) y por debajo de un día dice "hoy".
 */
export function haceCuanto(fechaIso: string, ahora: number, soloFecha = false): string {
  const fecha = soloFecha ? new Date(fechaIso.slice(0, 10) + 'T00:00:00') : new Date(fechaIso);
  const minutos = Math.max(0, Math.floor((ahora - fecha.getTime()) / 60_000));
  if (soloFecha) {
    const dias = Math.floor(minutos / 1440);
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return `hace ${dias} días`;
  }
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
