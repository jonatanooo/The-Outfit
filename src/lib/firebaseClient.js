import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

/**
 * Configuración de Firebase Client leída desde variables de entorno (process.env).
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDummyKeyForBuildTimeOnly00000000',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'the-outfit-2480c.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'the-outfit-2480c',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'the-outfit-2480c.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:000000000000',
};

function getClientApp() {
  return !getApps().length ? initializeApp(firebaseConfig) : getApp();
}

function createLazyClientProxy(getter) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const instance = getter();
        const value = instance[prop];
        return typeof value === 'function' ? value.bind(instance) : value;
      },
    }
  );
}

export const app = getClientApp();
export const db = getFirestore(app);
export const auth =
  typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    ? getAuth(app)
    : createLazyClientProxy(() => getAuth(getClientApp()));
export const storage = getStorage(app);
