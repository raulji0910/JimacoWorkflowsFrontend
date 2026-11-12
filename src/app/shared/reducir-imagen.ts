/**
 * Reduce una foto antes de subirla (2026-11-12, Entregas): las fotos del celular pesan 3–8 MB y la
 * revisión con IA acepta hasta ~5 MB por imagen. Lado mayor 2000 px en JPEG 0.85 sigue siendo
 * de sobra legible (número, firma) y sube mucho más rápido con datos móviles. PDF y archivos
 * chicos se devuelven tal cual. Nunca lanza: si algo falla, devuelve el original.
 */
const LADO_MAXIMO = 2000;
const UMBRAL_BYTES = 1.5 * 1024 * 1024;

export async function reducirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') return archivo;
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    try {
      const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
      if (escala === 1 && archivo.size <= UMBRAL_BYTES && ['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
        return archivo;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(imagen.width * escala);
      canvas.height = Math.round(imagen.height * escala);
      const ctx = canvas.getContext('2d');
      if (!ctx) return archivo;
      ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
      if (!blob) return archivo;
      const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], nombre, { type: 'image/jpeg', lastModified: archivo.lastModified });
    } finally {
      imagen.close();
    }
  } catch {
    return archivo;
  }
}
