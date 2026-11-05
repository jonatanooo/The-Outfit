import { auth, db } from './firebaseClient';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Sincroniza el ID Token de Firebase Auth con la cookie HttpOnly (__session) del servidor
 * y devuelve la respuesta autoritativa del backend ({ authenticated, uid, idUser, rol }).
 *
 * @param {import('firebase/auth').User | null} [userOverride]
 * @returns {Promise<{authenticated: boolean, uid?: string, idUser?: any, rol?: string, baneado?: boolean}>}
 */
export async function sincronizarSesionServidor(userOverride = null) {
  try {
    if (!userOverride && typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    const user = userOverride || auth.currentUser;
    if (!user) {
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      return { authenticated: false, rol: 'anonimo' };
    }

    const idToken = await user.getIdToken(true);
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ idToken }),
    });

    const data = await res.json().catch(() => ({ authenticated: false }));
    if (!res.ok || !data.authenticated) {
      return {
        authenticated: false,
        baneado: Boolean(data?.baneado),
        rol: 'anonimo',
      };
    }

    return data;
  } catch (error) {
    console.error('Error sincronizando sesión con el servidor:', error);
    return { authenticated: false, rol: 'anonimo' };
  }
}

/**
 * Verifica la sesión y el rol del usuario contra el endpoint de servidor (/api/auth/session).
 * Evita que la autorización dependa de lecturas manipulables en el cliente.
 *
 * @param {'admin' | 'empleado' | 'autenticado'} rolRequerido
 * @returns {Promise<{autorizado: boolean, rol: string, uid: string|null, idUser: any}>}
 */
export async function verificarAccesoServidor(rolRequerido = 'admin') {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    const user = auth.currentUser;
    if (!user) {
      return { autorizado: false, rol: 'anonimo', uid: null, idUser: null };
    }

    // Sincroniza y verifica el token en el servidor (también asegura que la cookie __session esté vigente)
    const sesion = await sincronizarSesionServidor(user);
    if (!sesion.authenticated) {
      return { autorizado: false, rol: 'anonimo', uid: null, idUser: null };
    }

    const rol = sesion.rol || 'usuario';
    let autorizado = false;

    if (rolRequerido === 'admin') {
      autorizado = rol === 'admin';
    } else if (rolRequerido === 'empleado') {
      autorizado = rol === 'empleado' || rol === 'admin';
    } else {
      autorizado = true;
    }

    return {
      autorizado,
      rol,
      uid: sesion.uid || user.uid,
      idUser: sesion.idUser ?? null,
    };
  } catch (error) {
    console.error('Error verificando acceso en el servidor:', error);
    return { autorizado: false, rol: 'anonimo', uid: null, idUser: null };
  }
}

/**
 * Traduce el usuario logueado en Firebase Auth al ID_User de la colección "User" propia.
 * Mitiga Account Takeover (OWASP A01):
 * - Prioriza coincidencia exacta por UID inmutable (doc ID === user.uid o campo auth_id === user.uid).
 * - Solo permite vinculación por correo si user.emailVerified === true Y el documento no tiene otro auth_id.
 */
export async function obtenerIdUsuario() {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    const user = auth.currentUser;
    if (!user) return null;

    // 1. Buscar por Document ID directo igual a user.uid
    const docRef = doc(db, 'User', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.ID_User ?? docSnap.id;
    }

    // 2. Buscar por el campo inmutable auth_id en la colección User
    const qAuth = query(collection(db, 'User'), where('auth_id', '==', user.uid));
    const snapAuth = await getDocs(qAuth);
    if (!snapAuth.empty) {
      const data = snapAuth.docs[0].data();
      return data.ID_User ?? snapAuth.docs[0].id;
    }

    // 3. Fallback por Correo electrónico SOLO si el correo está verificado (user.emailVerified === true)
    // y el registro preexistente no está vinculado a otro UID distinto.
    if (user.email && user.emailVerified === true) {
      const qEmail = query(collection(db, 'User'), where('Correo', '==', user.email));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const docEncontrado = snapEmail.docs[0];
        const data = docEncontrado.data();

        if (data.auth_id && data.auth_id !== user.uid) {
          console.warn('Intento de vinculación bloqueado: el correo ya pertenece a otro auth_id.');
          return null;
        }

        // Vincular de forma permanente el auth_id al primer acceso verificado
        if (!data.auth_id) {
          await updateDoc(docEncontrado.ref, { auth_id: user.uid }).catch(() => {});
        }

        return data.ID_User ?? docEncontrado.id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error al obtener ID de usuario desde Firestore:', error);
    return null;
  }
}

/**
 * Obtiene el perfil completo del usuario autenticado en Firestore.
 * Exige user.emailVerified === true para el fallback por correo y previene colisión de auth_id.
 */
export async function obtenerPerfilUsuario() {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    const user = auth.currentUser;
    if (!user) return null;

    // 1. Buscar documento directo por UID
    const docRef = doc(db, 'User', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data(), email: user.email };
    }

    // 2. Buscar por campo inmutable auth_id
    const qAuth = query(collection(db, 'User'), where('auth_id', '==', user.uid));
    const snapAuth = await getDocs(qAuth);
    if (!snapAuth.empty) {
      const d = snapAuth.docs[0];
      return { id: d.id, ...d.data(), email: user.email };
    }

    // 3. Buscar por Correo únicamente si user.emailVerified === true y no pertenece a otro auth_id
    if (user.email && user.emailVerified === true) {
      const qEmail = query(collection(db, 'User'), where('Correo', '==', user.email));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const d = snapEmail.docs[0];
        const data = d.data();

        if (data.auth_id && data.auth_id !== user.uid) {
          console.warn('Intento de acceso a perfil bloqueado: auth_id no coincide.');
          return null;
        }

        if (!data.auth_id) {
          await updateDoc(d.ref, { auth_id: user.uid }).catch(() => {});
        }

        return { id: d.id, ...data, email: user.email };
      }
    }

    return null;
  } catch (error) {
    console.error('Error al obtener perfil del usuario desde Firestore:', error);
    return null;
  }
}
