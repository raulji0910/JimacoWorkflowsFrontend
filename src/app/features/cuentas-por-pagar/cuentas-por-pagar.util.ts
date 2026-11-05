/** "hace 4 min", "hace 2 h" — a partir de la hora de corte (UTC) de la foto de World Office. */
export function haceCuanto(fechaIso: string | null): string {
  if (!fechaIso) return 'todavía no se ha sincronizado';
  const minutos = Math.max(0, Math.round((Date.now() - new Date(fechaIso).getTime()) / 60_000));
  if (minutos < 1) return 'hace menos de un minuto';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

/** Texto del vencimiento de una partida: "Vencida hace 12 días", "Vence hoy", "Vence en 5 días". */
export function textoVencimiento(diasVencido: number | null): string {
  if (diasVencido === null) return 'Sin vencimiento';
  if (diasVencido > 0) return `Vencida hace ${diasVencido} día${diasVencido === 1 ? '' : 's'}`;
  if (diasVencido === 0) return 'Vence hoy';
  const faltan = -diasVencido;
  return `Vence en ${faltan} día${faltan === 1 ? '' : 's'}`;
}
