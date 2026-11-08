"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { sincronizarOCrearUsuarioEnFirestore } from '@/lib/usuario';

const AuthContext = createContext({
  user: null,
  userProfile: null,
  idUser: null,
  idRol: null,
  loading: true,
  refrescarPerfilAuth: async () => null,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [idUser, setIdUser] = useState(null);
  const [idRol, setIdRol] = useState(null);
  const [loading, setLoading] = useState(true);

  const refrescarPerfilAuth = useCallback(async (firebaseUserOverride = null) => {
    const targetUser = firebaseUserOverride || auth.currentUser;
    if (!targetUser) {
      setUserProfile(null);
      setIdUser(null);
      setIdRol(null);
      return null;
    }

    try {
      const perfil = await sincronizarOCrearUsuarioEnFirestore(targetUser);
      if (perfil) {
        setUserProfile(perfil);
        setIdUser(perfil.ID_User ?? null);
        setIdRol(perfil.ID_Rol != null ? Number(perfil.ID_Rol) : 3);
      }
      return perfil;
    } catch (err) {
      console.error('Error refrescando perfil en AuthContext:', err);
      return null;
    }
  }, []);

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

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (!activo) return;

        if (!currentUser) {
          setUser(null);
          setUserProfile(null);
          setIdUser(null);
          setIdRol(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);
        try {
          const perfil = await sincronizarOCrearUsuarioEnFirestore(currentUser);
          if (activo && perfil) {
            setUserProfile(perfil);
            setIdUser(perfil.ID_User ?? null);
            setIdRol(perfil.ID_Rol != null ? Number(perfil.ID_Rol) : 3);
          }
        } catch (err) {
          console.error('Error sincronizando documento User en AuthContext:', err);
        } finally {
          if (activo) {
            setLoading(false);
          }
        }
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
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        idUser,
        idRol,
        loading,
        refrescarPerfilAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
