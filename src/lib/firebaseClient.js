import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

/**
 * Configuración de Firebase Client leída desde variables de entorno (process.env).
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'the-outfit-2480c.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'the-outfit-2480c',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'the-outfit-2480c.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
// Solo inicializar Firebase Auth en el navegador (o si existe la API key en el entorno)
// para evitar el error `auth/invalid-api-key` durante `next build` en entornos Preview de Vercel
export const auth =
  typeof window !== 'undefined' || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    ? getAuth(app)
    : /** @type {any} */ ({});
export const storage = getStorage(app);
