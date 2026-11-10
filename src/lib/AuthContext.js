"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { sincronizarOCrearUsuarioEnFirestore, esRegistroEmpleadoOAdmin } from '@/lib/usuario';

const AUTH_CACHE_KEY = 'the_outfit_auth_profile_v1';

function leerCachePerfil() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function guardarCachePerfil(perfil) {
  if (typeof window === 'undefined') return;
  try {
    if (!perfil) {
      window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    } else {
      window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(perfil));
    }
  } catch {
    // ignorar
  }
}

const AuthContext = createContext({
  user: null,
  userProfile: null,
  idUser: null,
  idRol: null,
  esAdminOEmpleado: false,
  loading: true,
  refrescarPerfilAuth: async () => null,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth?.currentUser || null);
  const [userProfile, setUserProfile] = useState(() => leerCachePerfil());
  const [idUser, setIdUser] = useState(() => {
    const cached = leerCachePerfil();
    return cached?.ID_User ?? null;
  });
  const [idRol, setIdRol] = useState(() => {
    const cached = leerCachePerfil();
    if (!cached) return null;
    if (cached.ID_Rol != null) return Number(cached.ID_Rol);
    return esRegistroEmpleadoOAdmin(cached) ? 2 : 3;
  });
  const [loading, setLoading] = useState(true);

  const aplicarPerfil = useCallback((perfil) => {
    if (!perfil) {
      setUserProfile(null);
      setIdUser(null);
      setIdRol(null);
      guardarCachePerfil(null);
      return;
    }
    const rolCalculado =
      perfil.ID_Rol != null
        ? Number(perfil.ID_Rol)
        : esRegistroEmpleadoOAdmin(perfil)
        ? 2
        : 3;
    setUserProfile(perfil);
    setIdUser(perfil.ID_User ?? null);
    setIdRol(rolCalculado);
    guardarCachePerfil({ ...perfil, ID_Rol: rolCalculado });
  }, []);

  const refrescarPerfilAuth = useCallback(async (firebaseUserOverride = null) => {
    const targetUser = firebaseUserOverride || auth.currentUser;
    if (!targetUser) {
      aplicarPerfil(null);
      return null;
    }

    try {
      const perfil = await sincronizarOCrearUsuarioEnFirestore(targetUser);
      if (perfil) {
        aplicarPerfil(perfil);
      }
      return perfil;
    } catch (err) {
      console.error('Error refrescando perfil en AuthContext:', err);
      return null;
    }
  }, [aplicarPerfil]);

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
          aplicarPerfil(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);
        // Si ya tenemos caché del mismo UID, liberamos loading de inmediato para renderizado instantáneo
        const cached = leerCachePerfil();
        if (cached && cached.auth_id === currentUser.uid) {
          aplicarPerfil(cached);
          setLoading(false);
        }

        try {
          const perfil = await sincronizarOCrearUsuarioEnFirestore(currentUser);
          if (activo && perfil) {
            aplicarPerfil(perfil);
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
  }, [aplicarPerfil]);

  const esAdminOEmpleado = Boolean(
    user &&
      (Number(idRol) === 1 ||
        Number(idRol) === 2 ||
        esRegistroEmpleadoOAdmin(userProfile))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        idUser,
        idRol,
        esAdminOEmpleado,
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
