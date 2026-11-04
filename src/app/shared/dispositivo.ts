/**
 * Detección simple de celular por user agent. Se usa para NO incrustar el PDF en un `<iframe>`
 * ahí — el visor de PDF embebido de los navegadores móviles (sobre todo Safari en iOS, pero
 * también Chrome/Android en algunos casos) es muy limitado: a menudo solo deja ver/scrollear la
 * primera página del documento, sin forma clara de llegar a las siguientes. Eso rompe cualquier
 * documento de más de una página — ej. una OC con la Hoja de Alistamiento adjunta como página
 * extra — aunque el PDF esté generado bien (se ve completo en PC sin problema). La alternativa es
 * abrir el PDF con el visor nativo del sistema (pestaña/app aparte), que sí soporta multipágina.
 */
export function esDispositivoMovil(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
