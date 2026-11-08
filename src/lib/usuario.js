import { auth, db } from './firebaseClient';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Resuelve en Firestore los datos de rol y estado de un usuario autenticado en Firebase Auth.
 */
async function resolverDatosUsuarioFirestore(user) {
  if (!user) return { idUser: null, rol: 'anonimo', baneado: false };

  let userData = null;
  let docId = null;

  try {
    // 1. Buscar por Document ID directo igual a user.uid
    const docSnap = await getDoc(doc(db, 'User', user.uid));
    if (docSnap.exists()) {
      userData = docSnap.data();
      docId = docSnap.id;
    }

    // 2. Buscar por campo inmutable auth_id === user.uid
    if (!userData) {
      const snapAuth = await getDocs(
        query(collection(db, 'User'), where('auth_id', '==', user.uid))
      );
      if (!snapAuth.empty) {
        userData = snapAuth.docs[0].data();
        docId = snapAuth.docs[0].id;
      }
    }

    // 3. Buscar por Correo siempre que no pertenezca a otro auth_id distinto
    if (!userData && user.email) {
      const snapEmail = await getDocs(
        query(collection(db, 'User'), where('Correo', '==', user.email))
      );
      if (!snapEmail.empty) {
        const docEncontrado = snapEmail.docs[0];
        const candidate = docEncontrado.data();
        if (!candidate.auth_id || candidate.auth_id === user.uid) {
          userData = candidate;
          docId = docEncontrado.id;
          if (!candidate.auth_id) {
            await updateDoc(docEncontrado.ref, { auth_id: user.uid }).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error('Error consultando usuario en Firestore:', err);
  }

  const estadoNum = userData ? Number(userData.ID_EstadoUsuario) : 1;
  const baneado = Boolean(userData && (estadoNum === 2 || estadoNum === 3));

  let rol = 'usuario';
  if (userData) {
    const puesto = String(userData.Puesto || '').trim().toLowerCase();
    const rolCampo = String(userData.Rol || '').trim().toLowerCase();
    const idRol = Number(userData.ID_Rol);

    if (
      idRol === 1 ||
      puesto === 'admin' ||
      puesto === 'administrador' ||
      rolCampo === 'admin' ||
      rolCampo === 'administrador'
    ) {
      rol = 'admin';
    } else if (
      idRol === 2 ||
      userData.Es_Empleado === true ||
      puesto === 'empleado' ||
      rolCampo === 'empleado'
    ) {
      rol = 'empleado';
    }
  }

  return {
    idUser: userData?.ID_User ?? docId ?? user.uid,
    rol,
    baneado,
  };
}

/**
 * Sincroniza el ID Token de Firebase Auth con la cookie HttpOnly (__session) del servidor
 * y devuelve la respuesta autoritativa ({ authenticated, uid, idUser, rol, baneado }).
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
      // Consultar si ya existe cookie de sesión válida antes de invalidar
      try {
        const resGet = await fetch('/api/auth/session', { method: 'GET' });
        if (resGet.ok) {
          const dataGet = await resGet.json().catch(() => null);
          if (dataGet?.authenticated) {
            return dataGet;
          }
        }
      } catch {
        // ignorar
      }
      return { authenticated: false, rol: 'anonimo' };
    }

    const idToken = await user.getIdToken(true);
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json().catch(() => null);
      if (data?.baneado || res.status === 403) {
        return {
          authenticated: false,
          baneado: true,
          rol: 'baneado',
        };
      }

      if (res.ok && data?.authenticated) {
        return data;
      }
    } catch {
      // Continuar al respaldo directo con Firestore si el endpoint falla
    }

    // Respaldo con Firestore para que el login funcione incluso en entornos Preview de Vercel
    const infoFallback = await resolverDatosUsuarioFirestore(user);
    if (infoFallback.baneado) {
      return {
        authenticated: false,
        baneado: true,
        rol: 'baneado',
      };
    }

    return {
      authenticated: true,
      uid: user.uid,
      idUser: infoFallback.idUser,
      rol: infoFallback.rol,
      emailVerified: Boolean(user.emailVerified),
    };
  } catch (error) {
    console.error('Error sincronizando sesión:', error);
    return { authenticated: false, rol: 'anonimo' };
  }
}

/**
 * Verifica la sesión y el rol del usuario contra el servidor (/api/auth/session) y Firestore.
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
    const sesion = await sincronizarSesionServidor(user || null);
    if (!sesion.authenticated || sesion.baneado) {
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
      uid: sesion.uid || user?.uid || null,
      idUser: sesion.idUser ?? null,
    };
  } catch (error) {
    console.error('Error verificando acceso en el servidor:', error);
    return { autorizado: false, rol: 'anonimo', uid: null, idUser: null };
  }
}

/**
 * Traduce el usuario logueado en Firebase Auth al ID_User de la colección "User" propia.
 */
export async function obtenerIdUsuario() {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    const user = auth.currentUser;
    if (!user) {
      try {
        const res = await fetch('/api/auth/session', { method: 'GET' });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.authenticated && data?.idUser != null) {
            return data.idUser;
          }
        }
      } catch {
        // ignorar
      }
      return null;
    }

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

    // 3. Buscar por Correo siempre que el documento no pertenezca a otro auth_id distinto
    if (user.email) {
      const qEmail = query(collection(db, 'User'), where('Correo', '==', user.email));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const docEncontrado = snapEmail.docs[0];
        const data = docEncontrado.data();

        if (data.auth_id && data.auth_id !== user.uid) {
          console.warn('Intento de vinculación bloqueado: el correo ya pertenece a otro auth_id.');
          return null;
        }

        if (!data.auth_id) {
          await updateDoc(docEncontrado.ref, { auth_id: user.uid }).catch(() => {});
        }

        return data.ID_User ?? docEncontrado.id;
      }
    }

    return user.uid;
  } catch (error) {
    console.error('Error al obtener ID de usuario desde Firestore:', error);
    return null;
  }
}

/**
 * Obtiene el perfil completo del usuario autenticado en Firestore.
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

    // 3. Buscar por Correo siempre que no pertenezca a otro auth_id distinto
    if (user.email) {
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
