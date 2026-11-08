import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
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

// Inicialización perezosa (lazy proxy) de Firebase Auth para evitar que `next build`
// o entornos Preview de Vercel fallen con `auth/invalid-api-key` cuando falten variables de entorno
let _authInstance = null;
function obtenerAuthSeguro() {
  if (!_authInstance) {
    try {
      const tieneApiKey = Boolean(
        app?.options?.apiKey &&
        typeof app.options.apiKey === 'string' &&
        app.options.apiKey.trim().length > 0
      );
      if (typeof window !== 'undefined' || tieneApiKey) {
        _authInstance = getAuth(app);
        if (typeof window !== 'undefined') {
          setPersistence(_authInstance, browserLocalPersistence).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Advertencia: Firebase Auth client no se pudo inicializar en este entorno:', e?.message);
    }
  }
  return _authInstance || /** @type {any} */ ({});
}

export const auth = new Proxy(
  {},
  {
    get(_target, prop) {
      const instancia = obtenerAuthSeguro();
      const val = instancia[prop];
      return typeof val === 'function' ? val.bind(instancia) : val;
    },
  }
);

export const storage = getStorage(app);
