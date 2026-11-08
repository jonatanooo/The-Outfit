import { auth, db } from './firebaseClient';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

function esDocPlantillaUser(docSnap) {
  if (!docSnap) return true;
  if (docSnap.id === '_schema_init' || docSnap.id === '_placeholder') return true;
  const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
  return Boolean(data?._is_schema_template || data?._info);
}

/**
 * Genera el siguiente ID_User estrictamente numérico entero secuencial en la colección User.
 */
async function generarSiguienteIdUserNumerico() {
  try {
    const snap = await getDocs(collection(db, 'User'));
    let maxId = 0;
    snap.docs.forEach((d) => {
      if (esDocPlantillaUser(d)) return;
      const data = d.data();
      const raw = data?.ID_User ?? d.id;
      const val = Number(raw);
      if (!isNaN(val) && Number.isInteger(val) && val > maxId && val < 2000000000) {
        maxId = val;
      }
    });
    return maxId + 1;
  } catch (err) {
    console.error('Error generando ID_User numérico secuencial:', err);
    return Math.floor(10000 + (Date.now() % 899999));
  }
}

/**
 * Separa un displayName completo en { nombres, apellidos }.
 */
export function separarDisplayName(displayName = '', fallbackEmail = '') {
  const limpio = String(displayName || '').trim().replace(/\s+/g, ' ');
  if (!limpio) {
    const baseCorreo = String(fallbackEmail || '').split('@')[0] || 'Usuario';
    return { nombres: baseCorreo, apellidos: '' };
  }
  const partes = limpio.split(' ');
  if (partes.length === 1) {
    return { nombres: partes[0], apellidos: '' };
  }
  return {
    nombres: partes[0],
    apellidos: partes.slice(1).join(' '),
  };
}

/**
 * Sincroniza o crea automáticamente el registro del usuario en la colección `User` de Firestore
 * (especialmente al iniciar sesión con Google por primera vez o vincular un correo existente).
 */
export async function sincronizarOCrearUsuarioEnFirestore(firebaseUser) {
  if (!firebaseUser || !firebaseUser.uid) return null;

  const uid = firebaseUser.uid;
  const emailRaw = String(firebaseUser.email || '').trim();
  const emailLower = emailRaw.toLowerCase();
  const candidatosCorreo = Array.from(new Set([emailRaw, emailLower].filter(Boolean)));

  try {
    // 1. Buscar por Document ID directo === uid
    const directRef = doc(db, 'User', uid);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists() && !esDocPlantillaUser(directSnap)) {
      const data = directSnap.data();
      if (!data.auth_id) {
        await updateDoc(directRef, { auth_id: uid }).catch(() => {});
      }
      return { ...data, auth_id: uid, _docId: directSnap.id };
    }

    // 2. Buscar por auth_id === uid
    const snapAuth = await getDocs(
      query(collection(db, 'User'), where('auth_id', '==', uid))
    );
    const docsAuth = snapAuth.docs.filter((d) => !esDocPlantillaUser(d));
    if (docsAuth.length > 0) {
      const d = docsAuth[0];
      return { ...d.data(), _docId: d.id };
    }

    // 3. Buscar por Correo (exacto o en minúsculas)
    if (candidatosCorreo.length > 0) {
      const snapEmail = await getDocs(
        query(collection(db, 'User'), where('Correo', 'in', candidatosCorreo))
      );
      const docsEmail = snapEmail.docs.filter((d) => !esDocPlantillaUser(d));
      if (docsEmail.length > 0) {
        const docEncontrado = docsEmail[0];
        const data = docEncontrado.data();
        // Vincular su auth_id si aún no lo tenía o actualizarlo al uid autenticado de Google
        if (data.auth_id !== uid) {
          await updateDoc(docEncontrado.ref, { auth_id: uid }).catch(() => {});
        }
        return { ...data, auth_id: uid, _docId: docEncontrado.id };
      }
    }

    // 4. Primera vez que entra con Google (No existe en User) -> Crear automáticamente
    const nuevoIdUser = await generarSiguienteIdUserNumerico();
    const { nombres, apellidos } = separarDisplayName(firebaseUser.displayName, emailLower);
    const baseUsername = (emailLower.split('@')[0] || 'usuario')
      .replace(/[^a-z0-9_.-]/gi, '_')
      .toLowerCase();

    // Garantizar que el nombre de Usuario sea único
    let nombreUsuarioUnico = baseUsername;
    try {
      const snapUserCheck = await getDocs(
        query(collection(db, 'User'), where('Usuario', '==', baseUsername))
      );
      if (!snapUserCheck.empty) {
        nombreUsuarioUnico = `${baseUsername}_${nuevoIdUser}`;
      }
    } catch {
      nombreUsuarioUnico = `${baseUsername}_${nuevoIdUser}`;
    }

    const nuevoRegistroUser = {
      ID_User: nuevoIdUser,
      auth_id: uid,
      Nombres: nombres,
      Apellidos: apellidos,
      Usuario: nombreUsuarioUnico,
      Correo: emailLower || emailRaw,
      Telefono: firebaseUser.phoneNumber || null,
      DUI: null,
      Password_Hash: null,
      Puesto: 'Usuario normal',
      ID_Rol: 3, // Rol Cliente
      ID_EstadoUsuario: 1, // Estado Activo
      Es_Empleado: false,
      Fecha_Creacion: new Date().toISOString(),
    };

    await setDoc(doc(db, 'User', String(nuevoIdUser)), nuevoRegistroUser);
    return { ...nuevoRegistroUser, _docId: String(nuevoIdUser) };
  } catch (err) {
    console.error('Error sincronizando o creando usuario en colección User:', err);
    return null;
  }
}

/**
 * Resuelve en Firestore los datos de rol y estado de un usuario autenticado en Firebase Auth.
 */
async function resolverDatosUsuarioFirestore(user) {
  if (!user) return { idUser: null, rol: 'anonimo', baneado: false };

  let userData = null;
  let docId = null;

  try {
    const sincronizado = await sincronizarOCrearUsuarioEnFirestore(user);
    if (sincronizado) {
      userData = sincronizado;
      docId = sincronizado._docId || String(sincronizado.ID_User ?? user.uid);
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
    idRol: userData?.ID_Rol ?? (rol === 'admin' ? 1 : rol === 'empleado' ? 2 : 3),
    rol,
    baneado,
    userData,
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

    // Sincronizar o crear automáticamente el documento del usuario en la colección User
    // antes de notificar al servidor para garantizar que ya tenga su ID_User entero secuencial
    const userDocSincronizado = await sincronizarOCrearUsuarioEnFirestore(user);

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
        return {
          ...data,
          idUser: userDocSincronizado?.ID_User ?? data.idUser,
          idRol: userDocSincronizado?.ID_Rol ?? data.idRol ?? (data.rol === 'admin' ? 1 : data.rol === 'empleado' ? 2 : 3),
          userData: userDocSincronizado || null,
        };
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
      idRol: infoFallback.idRol,
      rol: infoFallback.rol,
      userData: infoFallback.userData || null,
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

    // 3. Buscar por Correo o crear si es cuenta nueva de proveedor OAuth
    const sincronizado = await sincronizarOCrearUsuarioEnFirestore(user);
    if (sincronizado && sincronizado.ID_User != null) {
      return sincronizado.ID_User;
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

    const sincronizado = await sincronizarOCrearUsuarioEnFirestore(user);
    if (sincronizado) {
      return {
        id: sincronizado._docId || String(sincronizado.ID_User ?? user.uid),
        ...sincronizado,
        email: user.email,
      };
    }

    return null;
  } catch (error) {
    console.error('Error al obtener perfil del usuario desde Firestore:', error);
    return null;
  }
}
