/**
 * Comprime y redimensiona una imagen en el navegador mediante HTML5 Canvas.
 * Reduce drásticamente el peso de fotos pesadas (de 5-10 MB a ~150-300 KB)
 * acelerando la subida a Firebase Storage hasta 20 veces.
 *
 * @param {File|Blob} archivo - Archivo de imagen original
 * @param {number} maxWidth - Ancho máximo permitido (default: 1600px)
 * @param {number} maxHeight - Alto máximo permitido (default: 1600px)
 * @param {number} quality - Calidad de compresión JPEG (0 a 1, default: 0.82)
 * @returns {Promise<File>} Archivo optimizado o el original si no se puede optimizar
 */
export async function optimizarImagen(archivo, maxWidth = 1600, maxHeight = 1600, quality = 0.82) {
  if (!archivo || typeof window === 'undefined') return archivo;
  if (!archivo.type || !archivo.type.startsWith('image/')) return archivo;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(archivo);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < archivo.size) {
              const baseName = (archivo.name || 'foto').replace(/\.[^/.]+$/, '');
              const optimizado = new File([blob], `${baseName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(optimizado);
            } else {
              resolve(archivo);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(archivo);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(archivo);
    reader.readAsDataURL(archivo);
  });
}

