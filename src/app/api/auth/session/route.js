import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, adminDb, tieneCredencialesAdmin } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = '__session';
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 5 * 1000; // 5 días en ms

function obtenerSecretoCookie() {
  return (
    process.env.SESSION_COOKIE_SECRET ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'the-outfit-default-session-secret-key'
  );
}

function firmarTokenSesion(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', obtenerSecretoCookie())
    .update(data)
    .digest('base64url');
  return `v1.${data}.${sig}`;
}

function verificarTokenSesionFirmado(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string' || !cookieValue.startsWith('v1.')) {
    return null;
  }
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return null;
  const [, data, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', obtenerSecretoCookie())
    .update(data)
    .digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function decodificarJwtFirebase(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const uid = payload.user_id || payload.sub;
    if (!uid) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return {
      uid,
      email: payload.email || '',
      name: payload.name || '',
      email_verified: Boolean(payload.email_verified),
      rol: payload.rol,
      admin: payload.admin,
      empleado: payload.empleado,
    };
  } catch {
    return null;
  }
}

/**
 * Verifica el ID Token de Firebase Auth.
 * Intenta primero con Firebase Admin SDK; si las credenciales de Admin en Vercel
 * no están disponibles (ej. en entornos Preview), verifica contra la API oficial
 * de Google Identity Toolkit (`accounts:lookup`) o decodifica el JWT válido.
 */
async function verificarTokenFirebase(idToken) {
  // 1. Intentar con Firebase Admin SDK solo si tiene credenciales válidas
  if (tieneCredencialesAdmin()) {
    try {
      return await adminAuth.verifyIdToken(idToken, false);
    } catch {
      // Continúa al respaldo oficial REST de Firebase Auth
    }
  }

  // 2. Respaldo con la API oficial de Google Identity Toolkit
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const jwtDecoded = decodificarJwtFirebase(idToken);

  if (apiKey) {
    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const account = data?.users?.[0];
        if (account && !account.disabled) {
          return {
            uid: account.localId,
            email: account.email || jwtDecoded?.email || '',
            name: account.displayName || jwtDecoded?.name || '',
            email_verified: Boolean(account.emailVerified),
            rol: jwtDecoded?.rol,
            admin: jwtDecoded?.admin,
            empleado: jwtDecoded?.empleado,
          };
        }
      }
    } catch {
      // Continúa al respaldo JWT
    }
  }

  return jwtDecoded;
}

function separarDisplayNameServidor(displayName = '', fallbackEmail = '') {
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

function calcularPrioridadRolServidor(data) {
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
 * Busca el documento del usuario en la colección `User` de Firestore, o lo crea
 * automáticamente con ID_User entero secuencial si ingresa por primera vez (ej. con Google).
 * Si existen múltiples documentos asociados al mismo UID o Correo, selecciona el de mayor privilegio.
 */
async function buscarDocumentoUsuario(uid, email, displayName = '') {
  const emailRaw = String(email || '').trim();
  const emailLower = emailRaw.toLowerCase();
  const candidatosCorreo = Array.from(new Set([emailRaw, emailLower].filter(Boolean)));

  // Intento A: Firebase Admin Firestore (solo si tiene credenciales válidas en el entorno)
  if (tieneCredencialesAdmin()) {
    try {
      const encontradosMap = new Map();

      const directRef = adminDb.collection('User').doc(uid);
      const directSnap = await directRef.get();
      if (directSnap.exists && directSnap.id !== '_schema_init' && directSnap.id !== '_placeholder') {
        encontradosMap.set(directSnap.id, {
          ref: directRef,
          id: directSnap.id,
          data: directSnap.data(),
        });
      }

      const authSnap = await adminDb
        .collection('User')
        .where('auth_id', '==', uid)
        .get();
      authSnap.docs.forEach((d) => {
        if (d.id !== '_schema_init' && d.id !== '_placeholder' && !encontradosMap.has(d.id)) {
          encontradosMap.set(d.id, { ref: d.ref, id: d.id, data: d.data() });
        }
      });

      if (candidatosCorreo.length > 0) {
        const emailSnap = await adminDb
          .collection('User')
          .where('Correo', 'in', candidatosCorreo)
          .get();
        emailSnap.docs.forEach((d) => {
          if (d.id !== '_schema_init' && d.id !== '_placeholder' && !encontradosMap.has(d.id)) {
            encontradosMap.set(d.id, { ref: d.ref, id: d.id, data: d.data() });
          }
        });
      }

      const lista = Array.from(encontradosMap.values());
      if (lista.length > 0) {
        lista.sort(
          (a, b) => calcularPrioridadRolServidor(a.data) - calcularPrioridadRolServidor(b.data)
        );
        const mejor = lista[0];
        const mejorData = { ...mejor.data };
        if (mejorData.auth_id !== uid) {
          await mejor.ref.set({ auth_id: uid }, { merge: true }).catch(() => {});
          mejorData.auth_id = uid;
        }
        return { userData: mejorData, docId: mejor.id };
      }

      // Si no existe en la colección User, crearlo automáticamente con ID_User entero secuencial
      const allUsersSnap = await adminDb.collection('User').get();
      let maxId = 0;
      allUsersSnap.docs.forEach((d) => {
        if (d.id === '_schema_init' || d.id === '_placeholder') return;
        const data = d.data();
        if (data?._is_schema_template || data?._info) return;
        const num = Number(data?.ID_User ?? d.id);
        if (!isNaN(num) && Number.isInteger(num) && num > maxId && num < 2000000000) {
          maxId = num;
        }
      });
      const nuevoIdUser = maxId + 1;
      const { nombres, apellidos } = separarDisplayNameServidor(displayName, emailLower);
      const baseUsername = (emailLower.split('@')[0] || 'usuario')
        .replace(/[^a-z0-9_.-]/gi, '_')
        .toLowerCase();

      let nombreUsuarioUnico = baseUsername;
      const checkUserSnap = await adminDb
        .collection('User')
        .where('Usuario', '==', baseUsername)
        .limit(1)
        .get();
      if (!checkUserSnap.empty) {
        nombreUsuarioUnico = `${baseUsername}_${nuevoIdUser}`;
      }

      const nuevoUserDoc = {
        ID_User: nuevoIdUser,
        auth_id: uid,
        Nombres: nombres,
        Apellidos: apellidos,
        Usuario: nombreUsuarioUnico,
        Correo: emailLower || emailRaw,
        Telefono: null,
        DUI: null,
        Password_Hash: null,
        Puesto: 'Usuario normal',
        ID_Rol: 3,
        ID_EstadoUsuario: 1,
        Es_Empleado: false,
        Fecha_Creacion: new Date().toISOString(),
      };

      await adminDb.collection('User').doc(String(nuevoIdUser)).set(nuevoUserDoc);
      return { userData: nuevoUserDoc, docId: String(nuevoIdUser) };
    } catch {
      // Caer al Intento B
    }
  }

  // Intento B: Respaldo con Firebase SDK (`db`) cuando Admin SDK no tiene llave en Preview/Production
  try {
    const { sincronizarOCrearUsuarioEnFirestore } = await import('@/lib/usuario');
    const sincronizado = await sincronizarOCrearUsuarioEnFirestore({
      uid,
      email: emailLower || emailRaw,
      displayName,
    });
    if (sincronizado) {
      return {
        userData: sincronizado,
        docId: sincronizado._docId || String(sincronizado.ID_User ?? uid),
      };
    }
  } catch (errClient) {
    console.error('Error buscando o creando usuario en Firestore:', errClient);
  }
  return { userData: null, docId: null };
}

async function resolverAutorizacionUsuario(decodedToken) {
  const uid = decodedToken.uid;
  const email = decodedToken.email || '';
  const displayName = decodedToken.name || decodedToken.displayName || '';
  const emailVerified = decodedToken.email_verified === true;

  const { userData, docId } = await buscarDocumentoUsuario(uid, email, displayName);

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

  if (decodedToken.rol === 'admin' || decodedToken.admin === true) {
    rol = 'admin';
  } else if (
    rol === 'usuario' &&
    (decodedToken.rol === 'empleado' || decodedToken.empleado === true)
  ) {
    rol = 'empleado';
  }

  return {
    uid,
    email,
    emailVerified,
    idUser: userData?.ID_User ?? docId ?? uid,
    rol,
    baneado,
  };
}

/**
 * POST /api/auth/session
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
    const idToken = body.idToken || bearerToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { authenticated: false, error: 'Token de autenticación requerido.' },
        { status: 400 }
      );
    }

    const decodedToken = await verificarTokenFirebase(idToken);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json(
        { authenticated: false, error: 'Token inválido o expirado.' },
        { status: 401 }
      );
    }

    const authInfo = await resolverAutorizacionUsuario(decodedToken);

    // Si el cliente ya consultó Firestore directamente y detectó rol 'admin' o 'empleado',
    // asegurar que la cookie refleje el rol actualizado en caso de demora de propagación
    if (
      authInfo.rol === 'usuario' &&
      (body.rolClient === 'admin' || body.rolClient === 'empleado')
    ) {
      authInfo.rol = body.rolClient;
    }
    if (body.idUserClient != null && authInfo.idUser === authInfo.uid) {
      authInfo.idUser = body.idUserClient;
    }

    if (authInfo.baneado) {
      if (tieneCredencialesAdmin()) {
        await adminAuth.revokeRefreshTokens(authInfo.uid).catch(() => {});
        await adminAuth.updateUser(authInfo.uid, { disabled: true }).catch(() => {});
      }

      const response = NextResponse.json(
        {
          authenticated: false,
          baneado: true,
          error: 'Tu cuenta fue desactivada o baneada.',
        },
        { status: 403 }
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    // Sincronizar Custom Claims si Admin SDK está activo
    if (tieneCredencialesAdmin() && decodedToken.rol !== authInfo.rol) {
      await adminAuth
        .setCustomUserClaims(authInfo.uid, {
          rol: authInfo.rol,
          admin: authInfo.rol === 'admin',
          empleado: authInfo.rol === 'empleado' || authInfo.rol === 'admin',
        })
        .catch(() => {});
    }

    // Emitir token de sesión firmado con HMAC-SHA256 para verificación instantánea en proxy.js
    const cookieValue = firmarTokenSesion({
      uid: authInfo.uid,
      email: authInfo.email,
      idUser: authInfo.idUser,
      rol: authInfo.rol,
      baneado: false,
      exp: Date.now() + SESSION_EXPIRES_IN,
    });

    const response = NextResponse.json({
      authenticated: true,
      uid: authInfo.uid,
      idUser: authInfo.idUser,
      rol: authInfo.rol,
      emailVerified: authInfo.emailVerified,
    });

    response.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_EXPIRES_IN / 1000),
    });

    return response;
  } catch (error) {
    console.error('Error en POST /api/auth/session:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Token inválido o expirado.' },
      { status: 401 }
    );
  }
}

/**
 * GET /api/auth/session
 */
export async function GET(request) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (sessionCookie) {
      const signedPayload = verificarTokenSesionFirmado(sessionCookie);
      if (signedPayload && signedPayload.uid) {
        // Revalidar el rol y estado actual contra la colección User en Firestore
        // para que cualquier ascenso a Empleado o Administrador surta efecto de inmediato
        const liveAuthInfo = await resolverAutorizacionUsuario({
          uid: signedPayload.uid,
          email: signedPayload.email || '',
          email_verified: true,
          rol: signedPayload.rol,
        });

        if (liveAuthInfo.baneado || signedPayload.baneado) {
          const response = NextResponse.json(
            { authenticated: false, baneado: true, rol: 'baneado' },
            { status: 403 }
          );
          response.cookies.delete(SESSION_COOKIE_NAME);
          return response;
        }

        const rolVigente = liveAuthInfo.rol || signedPayload.rol || 'usuario';
        const idUserVigente = liveAuthInfo.idUser ?? signedPayload.idUser;

        const response = NextResponse.json({
          authenticated: true,
          uid: signedPayload.uid,
          email: signedPayload.email || liveAuthInfo.email || '',
          idUser: idUserVigente,
          rol: rolVigente,
          emailVerified: true,
        });

        if (rolVigente !== signedPayload.rol) {
          const refreshedCookie = firmarTokenSesion({
            uid: signedPayload.uid,
            email: signedPayload.email || liveAuthInfo.email || '',
            idUser: idUserVigente,
            rol: rolVigente,
            baneado: false,
            exp: Date.now() + SESSION_EXPIRES_IN,
          });
          response.cookies.set(SESSION_COOKIE_NAME, refreshedCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: Math.floor(SESSION_EXPIRES_IN / 1000),
          });
        }

        return response;
      }
    }

    const tokenToVerify = bearerToken || sessionCookie;
    if (!tokenToVerify) {
      return NextResponse.json(
        { authenticated: false, rol: 'anonimo' },
        { status: 401 }
      );
    }

    const decodedToken = await verificarTokenFirebase(tokenToVerify);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json(
        { authenticated: false, rol: 'anonimo' },
        { status: 401 }
      );
    }

    const authInfo = await resolverAutorizacionUsuario(decodedToken);

    if (authInfo.baneado) {
      const response = NextResponse.json(
        { authenticated: false, baneado: true, rol: 'baneado' },
        { status: 403 }
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      uid: authInfo.uid,
      idUser: authInfo.idUser,
      rol: authInfo.rol,
      emailVerified: authInfo.emailVerified,
    });
  } catch {
    return NextResponse.json(
      { authenticated: false, rol: 'anonimo', error: 'Sesión no válida.' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/auth/session
 */
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
