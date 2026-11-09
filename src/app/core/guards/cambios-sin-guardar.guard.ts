import { CanDeactivateFn } from '@angular/router';

/** Pantallas que pueden tener datos escritos y todavía no guardados (o un guardado en curso). */
export interface ConCambiosSinGuardar {
  hayCambiosSinGuardar(): boolean;
}

// Pedido real (2026-11-09, Hoja 16100): salir de la página descartaba sin aviso lo tecleado y
// todavía no guardado. Confirm nativo a propósito: es simple y funciona igual en el celular de bodega.
export const cambiosSinGuardarGuard: CanDeactivateFn<ConCambiosSinGuardar> = (componente) =>
  !componente.hayCambiosSinGuardar() ||
  confirm('Hay cantidades sin guardar (o guardándose todavía). Si salís ahora se pierden. ¿Salir igual?');
