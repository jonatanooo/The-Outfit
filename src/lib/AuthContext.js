"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';

const AuthContext = createContext({
  user: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;

    async function inicializarAuth() {
      try {
        await setPersistence(auth, browserLocalPersistence).catch(() => {});
        if (typeof auth.authStateReady === 'function') {
          await auth.authStateReady();
        }
      } catch {
        // ignorar errores de persistencia
      }

      if (!activo) return;

      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (!activo) return;
        setUser(currentUser || null);
        setLoading(false);
      });

      return unsubscribe;
    }

    let unsubscribeFn = null;
    inicializarAuth().then((unsub) => {
      unsubscribeFn = unsub;
    });

    return () => {
      activo = false;
      if (typeof unsubscribeFn === 'function') {
        unsubscribeFn();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
