import { auth, db } from './firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
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
 * Espera a que Firebase Auth termine de restaurar la sesión local en el navegador.
 */
async function obtenerUsuarioFirebaseActual(userOverride = null) {
  if (userOverride) return userOverride;
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
  } catch {
    // ignorar
  }
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    let resuelto = false;
    const timer = setTimeout(() => {
      if (!resuelto) {
        resuelto = true;
        resolve(auth.currentUser || null);
      }
    }, 1200);

    try {
      const unsub = onAuthStateChanged(
        auth,
        (u) => {
          if (!resuelto) {
            resuelto = true;
            clearTimeout(timer);
            unsub();
            resolve(u || null);
          }
        },
        () => {
          if (!resuelto) {
            resuelto = true;
            clearTimeout(timer);
            resolve(auth.currentUser || null);
          }
        }
      );
    } catch {
      clearTimeout(timer);
      resolve(auth.currentUser || null);
    }
  });
}

/**
 * Determina la prioridad de privilegio de un documento User (1 = Admin, 2 = Empleado, 3 = Cliente).
 */
function calcularPrioridadRolDoc(data) {
  if (!data) return 3;
  const idRol = Number(data.ID_Rol);
  const puesto = String(data.Puesto || '').trim().toLowerCase();
  const rolCampo = String(data.Rol || '').trim().toLowerCase();

  if (
    idRol === 1 ||
    puesto === 'admin' ||
    puesto === 'administrador' ||
    rolCampo === 'admin' ||
    rolCampo === 'administrador'
  ) {
    return 1;
  }

  if (
    idRol === 2 ||
    data.Es_Empleado === true ||
    data.Es_Empleado === 'true' ||
    puesto === 'empleado' ||
    rolCampo === 'empleado'
  ) {
    return 2;
  }

  return 3;
}

/**
 * Sincroniza o crea automáticamente el registro del usuario en la colección `User` de Firestore
 * (especialmente al iniciar sesión con Google por primera vez o vincular un correo existente).
 * Si existen múltiples documentos asociados al mismo UID o Correo, consolida el rol de mayor privilegio
 * (Administrador / Empleado) para garantizar acceso inmediato al Panel de Administración.
 */
export async function sincronizarOCrearUsuarioEnFirestore(firebaseUser) {
  if (!firebaseUser || !firebaseUser.uid) return null;

  const uid = firebaseUser.uid;
  const emailRaw = String(firebaseUser.email || '').trim();
  const emailLower = emailRaw.toLowerCase();
  const candidatosCorreo = Array.from(new Set([emailRaw, emailLower].filter(Boolean)));

  try {
    const docsEncontradosMap = new Map();

    // 1. Buscar por Document ID directo === uid
    const directRef = doc(db, 'User', uid);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists() && !esDocPlantillaUser(directSnap)) {
      docsEncontradosMap.set(directSnap.id, {
        ref: directRef,
        id: directSnap.id,
        data: directSnap.data(),
      });
    }

    // 2. Buscar por auth_id === uid
    const snapAuth = await getDocs(
      query(collection(db, 'User'), where('auth_id', '==', uid))
    );
    snapAuth.docs.forEach((d) => {
      if (!esDocPlantillaUser(d) && !docsEncontradosMap.has(d.id)) {
        docsEncontradosMap.set(d.id, { ref: d.ref, id: d.id, data: d.data() });
      }
    });

    // 3. Buscar por Correo (exacto o en minúsculas)
    if (candidatosCorreo.length > 0) {
      const snapEmail = await getDocs(
        query(collection(db, 'User'), where('Correo', 'in', candidatosCorreo))
      );
      snapEmail.docs.forEach((d) => {
        if (!esDocPlantillaUser(d) && !docsEncontradosMap.has(d.id)) {
          docsEncontradosMap.set(d.id, { ref: d.ref, id: d.id, data: d.data() });
        }
      });
    }

    const listaCoincidencias = Array.from(docsEncontradosMap.values());

    if (listaCoincidencias.length > 0) {
      // Ordenar para elegir el documento con mayor privilegio (Admin = 1, Empleado = 2, Cliente = 3)
      listaCoincidencias.sort(
        (a, b) => calcularPrioridadRolDoc(a.data) - calcularPrioridadRolDoc(b.data)
      );

      const mejorDoc = listaCoincidencias[0];
      const mejorPrioridad = calcularPrioridadRolDoc(mejorDoc.data);
      const mejorData = { ...mejorDoc.data };

      const camposSync = {};
      if (mejorData.auth_id !== uid) {
        camposSync.auth_id = uid;
        mejorData.auth_id = uid;
      }
      if (mejorPrioridad === 1 && Number(mejorData.ID_Rol) !== 1) {
        camposSync.ID_Rol = 1;
        camposSync.Es_Empleado = true;
        mejorData.ID_Rol = 1;
        mejorData.Es_Empleado = true;
      } else if (mejorPrioridad === 2 && Number(mejorData.ID_Rol) !== 1 && Number(mejorData.ID_Rol) !== 2) {
        camposSync.ID_Rol = 2;
        camposSync.Es_Empleado = true;
        mejorData.ID_Rol = 2;
        mejorData.Es_Empleado = true;
      }

      if (Object.keys(camposSync).length > 0) {
        await updateDoc(mejorDoc.ref, camposSync).catch(() => {});
      }

      // Si había otros documentos duplicados para el mismo usuario, sincronizarles el mismo rol
      if (listaCoincidencias.length > 1 && (mejorPrioridad === 1 || mejorPrioridad === 2)) {
        for (let i = 1; i < listaCoincidencias.length; i++) {
          const otro = listaCoincidencias[i];
          await updateDoc(otro.ref, {
            auth_id: uid,
            ID_Rol: mejorPrioridad,
            Es_Empleado: true,
            Puesto: mejorPrioridad === 1 ? 'Administrador' : 'Empleado',
          }).catch(() => {});
        }
      }

      return { ...mejorData, _docId: mejorDoc.id };
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
 * Determina si un documento de la colección `User` pertenece a la lista de Empleados/Administradores.
 */
export function esRegistroEmpleadoOAdmin(userData) {
  if (!userData) return false;
  const idRol = Number(userData.ID_Rol);
  const puesto = String(userData.Puesto || '').trim().toLowerCase();
  const rolCampo = String(userData.Rol || '').trim().toLowerCase();
  return (
    idRol === 1 ||
    idRol === 2 ||
    userData.Es_Empleado === true ||
    puesto === 'admin' ||
    puesto === 'administrador' ||
    puesto === 'empleado' ||
    rolCampo === 'admin' ||
    rolCampo === 'administrador' ||
    rolCampo === 'empleado'
  );
}

/**
 * Calcula el identificador de rol normalizado ('admin' | 'empleado' | 'usuario') a partir del documento `User`.
 */
export function obtenerRolDesdeUserDoc(userData) {
  if (!userData) return 'usuario';
  const idRol = Number(userData.ID_Rol);
  const puesto = String(userData.Puesto || '').trim().toLowerCase();
  const rolCampo = String(userData.Rol || '').trim().toLowerCase();

  if (
    idRol === 1 ||
    puesto === 'admin' ||
    puesto === 'administrador' ||
    rolCampo === 'admin' ||
    rolCampo === 'administrador'
  ) {
    return 'admin';
  }

  if (
    idRol === 2 ||
    userData.Es_Empleado === true ||
    puesto === 'empleado' ||
    rolCampo === 'empleado'
  ) {
    return 'empleado';
  }

  return 'usuario';
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
  const rol = obtenerRolDesdeUserDoc(userData);

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
    const user = await obtenerUsuarioFirebaseActual(userOverride);
    if (!user) {
      // Consultar si ya existe cookie de sesión válida antes de invalidar
      try {
        const resGet = await fetch('/api/auth/session', { method: 'GET' });
        if (resGet.ok) {
          const dataGet = await resGet.json().catch(() => null);
          if (dataGet?.authenticated && dataGet?.uid) {
            // Verificar el rol en tiempo real contra Firestore usando el uid/email de la cookie
            const userDocFromCookie = await sincronizarOCrearUsuarioEnFirestore({
              uid: dataGet.uid,
              email: dataGet.email || '',
            });
            if (userDocFromCookie) {
              const estadoCookie = Number(userDocFromCookie.ID_EstadoUsuario ?? 1);
              if (estadoCookie === 2 || estadoCookie === 3) {
                return { authenticated: false, baneado: true, rol: 'baneado' };
              }
              const rolReal = obtenerRolDesdeUserDoc(userDocFromCookie);
              return {
                ...dataGet,
                rol: rolReal,
                idUser: userDocFromCookie.ID_User ?? dataGet.idUser,
                idRol:
                  userDocFromCookie.ID_Rol ??
                  (rolReal === 'admin' ? 1 : rolReal === 'empleado' ? 2 : 3),
                userData: userDocFromCookie,
              };
            }
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
    const estadoLocal = userDocSincronizado ? Number(userDocSincronizado.ID_EstadoUsuario ?? 1) : 1;
    if (estadoLocal === 2 || estadoLocal === 3) {
      return {
        authenticated: false,
        baneado: true,
        rol: 'baneado',
      };
    }

    const rolFirestore = userDocSincronizado ? obtenerRolDesdeUserDoc(userDocSincronizado) : null;

    const idToken = await user.getIdToken();
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          idToken,
          rolClient: rolFirestore,
          idUserClient: userDocSincronizado?.ID_User,
        }),
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
        const rolEfectivo = rolFirestore || data.rol || 'usuario';
        return {
          ...data,
          rol: rolEfectivo,
          idUser: userDocSincronizado?.ID_User ?? data.idUser,
          idRol:
            userDocSincronizado?.ID_Rol ??
            data.idRol ??
            (rolEfectivo === 'admin' ? 1 : rolEfectivo === 'empleado' ? 2 : 3),
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
 * Verifica la sesión y el rol del usuario contra el servidor (/api/auth/session) y la colección `User` en Firestore.
 * Solo los usuarios que pertenecen a la lista de Empleados (`ID_Rol` administrativo/empleado o `Es_Empleado == true`)
 * tienen permiso para ver y navegar por el Panel de Administrador.
 *
 * @param {'admin' | 'empleado' | 'autenticado'} rolRequerido
 * @returns {Promise<{autorizado: boolean, rol: string, idRol: number|null, uid: string|null, idUser: any}>}
 */
export async function verificarAccesoServidor(rolRequerido = 'admin') {
  try {
    const user = await obtenerUsuarioFirebaseActual();
    const sesion = await sincronizarSesionServidor(user || null);
    if (!sesion.authenticated || sesion.baneado) {
      return { autorizado: false, rol: 'anonimo', idRol: null, uid: null, idUser: null };
    }

    const rol = sesion.rol || 'usuario';
    const idRol = Number(sesion.idRol ?? (rol === 'admin' ? 1 : rol === 'empleado' ? 2 : 3));
    const perteneceAEmpleados =
      rol === 'admin' ||
      rol === 'empleado' ||
      idRol === 1 ||
      idRol === 2 ||
      esRegistroEmpleadoOAdmin(sesion.userData);

    let autorizado = false;
    if (rolRequerido === 'admin' || rolRequerido === 'empleado') {
      autorizado = perteneceAEmpleados;
    } else {
      autorizado = true;
    }

    return {
      autorizado,
      rol: perteneceAEmpleados ? (idRol === 1 || rol === 'admin' ? 'admin' : 'empleado') : 'usuario',
      idRol,
      uid: sesion.uid || user?.uid || null,
      idUser: sesion.idUser ?? null,
    };
  } catch (error) {
    console.error('Error verificando acceso en el servidor:', error);
    return { autorizado: false, rol: 'anonimo', idRol: null, uid: null, idUser: null };
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
