import { optimizarImagen } from './imagenes';
import { db, storage } from './firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Sube una imagen directamente a Firebase Storage (sin ninguna dependencia de Supabase)
 * previa optimización en cliente.
 *
 * @param {File|Blob} archivo - Archivo de imagen a subir
 * @param {string} nombreArchivo - Nombre de archivo destino (ej: '1792301010642_123456_0.jpg')
 * @returns {Promise<string>} URL pública de descarga desde Firebase Storage
 */
export async function subirImagenStorage(archivo, nombreArchivo) {
  if (!archivo) {
    throw new Error('Se requiere un archivo válido para subir a Firebase Storage.');
  }

  const archivoOptimizado = await optimizarImagen(archivo);
  const rutaStorage = `fotos-productos/${nombreArchivo}`;
  const storageRef = ref(storage, rutaStorage);

  await uploadBytes(storageRef, archivoOptimizado, {
    contentType: archivoOptimizado.type || 'image/jpeg',
  });

  return await getDownloadURL(storageRef);
}

/**
 * Crea o actualiza un documento en la colección 'products' de Firestore
 * guardando la URL segura de la imagen.
 *
 * @param {string} imageUrl - URL segura de la imagen
 * @param {string|number|null} [productId] - ID del documento en Firestore
 * @param {object} [extraData] - Datos adicionales del producto (nombre, precio, etc.)
 * @returns {Promise<string>} ID del documento creado o actualizado en Firestore
 */
export async function guardarImagenProductoFirestore(imageUrl, productId = null, extraData = {}) {
  if (!imageUrl) {
    throw new Error('Se requiere una URL válida de imagen.');
  }

  if (productId) {
    const productRef = doc(db, 'products', String(productId));
    await setDoc(
      productRef,
      {
        imageUrl,
        images: arrayUnion(imageUrl),
        updatedAt: serverTimestamp(),
        ...extraData
      },
      { merge: true }
    );
    return String(productId);
  }

  const docRef = await addDoc(collection(db, 'products'), {
    imageUrl,
    images: [imageUrl],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extraData
  });

  return docRef.id;
}
