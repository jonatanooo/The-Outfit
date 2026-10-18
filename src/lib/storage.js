import { optimizarImagen } from './imagenes';
import { storage } from './firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const SUPABASE_STORAGE_URL = 'https://obqarkmuvppaebltfynz.supabase.co/storage/v1/object/fotos-productos';
const SUPABASE_PUBLIC_URL = 'https://obqarkmuvppaebltfynz.supabase.co/storage/v1/object/public/fotos-productos';
const SUPABASE_API_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_e6HAWVH3G1wE9OCZw7SaWg_Rt6zIvEo';

/**
 * Sube una imagen a Storage de forma ultrarrápida.
 * Utiliza Supabase Storage (donde residen todas las fotos del catálogo actual) con
 * fallback a Firebase Storage (con timeout estricto de seguridad para evitar bloqueos).
 *
 * @param {File|Blob} archivo - Archivo de imagen a subir
 * @param {string} nombreArchivo - Nombre de archivo destino (ej: '1792301010642_123456_0.jpg')
 * @returns {Promise<string>} URL pública de la imagen subida
 */
export async function subirImagenStorage(archivo, nombreArchivo) {
  // 1. Optimizar imagen en el cliente (reduce de 5-10MB a ~150-250KB en milisegundos)
  const archivoOptimizado = await optimizarImagen(archivo);

  // 2. Subida directa a Supabase Storage (instantánea, bucket público activo y verificado)
  try {
    const uploadUrl = `${SUPABASE_STORAGE_URL}/${nombreArchivo}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`,
        'Content-Type': archivoOptimizado.type || 'image/jpeg'
      },
      body: archivoOptimizado
    });

    if (response.ok) {
      const publicUrl = `${SUPABASE_PUBLIC_URL}/${nombreArchivo}`;
      return publicUrl;
    }
  } catch (err) {
    console.warn('Aviso: Falló subida a Supabase Storage, probando Firebase Storage:', err.message);
  }

  // 3. Fallback a Firebase Storage con timeout de 6 segundos para no congelar la UI si el bucket no existe
  try {
    const storageRef = ref(storage, `fotos-productos/${nombreArchivo}`);
    const uploadPromise = (async () => {
      await uploadBytes(storageRef, archivoOptimizado);
      return await getDownloadURL(storageRef);
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: Firebase Storage no respondió en 6s')), 6000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.error('Error al subir imagen en storage:', err.message);
    throw new Error('No se pudo subir la foto del producto. Por favor intenta de nuevo.');
  }
}

