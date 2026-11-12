/**
 * Lee el QR de una foto o de un PDF escaneado, en el navegador (2026-11-12, Entregas).
 * Gratis y sin enviar nada a terceros: jsQR sobre un canvas. Para PDF se dibujan las primeras
 * páginas con pdf.js (cargado solo cuando hace falta, es pesado). Devuelve el texto del primer QR
 * encontrado o null si no hay ninguno legible — nunca lanza: un QR ilegible no debe frenar la entrega.
 */
import jsQR from 'jsqr';

const ANCHOS_A_PROBAR = [1600, 1000, 2400];
const MAX_PAGINAS_PDF = 3;

export async function leerQrDeArchivo(archivo: File): Promise<string | null> {
  try {
    if (archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf')) {
      return await leerQrDePdf(archivo);
    }
    if (archivo.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp|gif)$/i.test(archivo.name)) {
      const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
      try {
        return buscarEnFuente(imagen, imagen.width, imagen.height);
      } finally {
        imagen.close();
      }
    }
  } catch {
    // Formato que el navegador no sabe abrir (ej. HEIC en algunos equipos): sin QR, no es error.
  }
  return null;
}

/** Prueba varios tamaños: muy grande o muy chico, jsQR a veces no lo encuentra. */
function buscarEnFuente(fuente: CanvasImageSource, ancho: number, alto: number): string | null {
  for (const objetivo of ANCHOS_A_PROBAR) {
    const escala = Math.min(1, objetivo / Math.max(ancho, alto));
    const w = Math.max(1, Math.round(ancho * escala));
    const h = Math.max(1, Math.round(alto * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(fuente, 0, 0, w, h);
    const datos = ctx.getImageData(0, 0, w, h);
    const qr = jsQR(datos.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (qr?.data) return qr.data;
    if (escala === 1) break; // ya está en tamaño real: agrandar no ayuda
  }
  return null;
}

async function leerQrDePdf(archivo: File): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    // Así esbuild empaqueta el worker como un .js propio (sin depender del tipo MIME de .mjs en nginx).
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('./pdf.worker', import.meta.url), {
      type: 'module'
    });
  }
  const pdf = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  try {
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGINAS_PDF); n++) {
      const pagina = await pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: 2000 / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      await pagina.render({ canvasContext: ctx, viewport }).promise;
      const qr = buscarEnFuente(canvas, canvas.width, canvas.height);
      if (qr) return qr;
    }
  } finally {
    await pdf.destroy();
  }
  return null;
}
