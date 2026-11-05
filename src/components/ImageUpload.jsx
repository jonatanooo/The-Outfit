"use client";

import { useState } from 'react';
import { CldUploadWidget } from 'next-cloudinary';
import { db } from '@/lib/firebaseClient';
import { collection, doc, addDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

/**
 * Componente de subida de imágenes con Cloudinary (<CldUploadWidget>) y Firebase Firestore.
 *
 * - Usa el preset sin firma (unsigned) desde process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.
 * - En onSuccess extrae info.secure_url de Cloudinary.
 * - Crea o actualiza un documento en la colección "products" de Firestore guardando la URL.
 */
export default function ImageUpload({ productId = null, onImageSaved }) {
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleSuccess(result) {
    const secureUrl = result?.info?.secure_url;
    if (!secureUrl) return;

    setImageUrl(secureUrl);
    setSaving(true);

    try {
      if (productId) {
        // Actualizar o crear documento existente en la colección 'products'
        const productRef = doc(db, 'products', String(productId));
        await setDoc(
          productRef,
          {
            imageUrl: secureUrl,
            images: arrayUnion(secureUrl),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        // Crear un nuevo documento en la colección 'products'
        await addDoc(collection(db, 'products'), {
          imageUrl: secureUrl,
          images: [secureUrl],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (onImageSaved) {
        onImageSaved(secureUrl);
      }
    } catch (error) {
      console.error('Error guardando la imagen en Firestore (products):', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CldUploadWidget
      uploadPreset={uploadPreset}
      onSuccess={handleSuccess}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={() => open()}
          disabled={saving}
          className="foto-box agregar"
        >
          {saving ? 'Guardando...' : '+ Subir imagen'}
        </button>
      )}
    </CldUploadWidget>
  );
}

