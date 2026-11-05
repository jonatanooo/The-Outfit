import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = '__session';
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 5 * 1000; // 5 días en ms

/**
 * Resuelve de forma autoritativa en el servidor el rol y estado del usuario en Firestore.
 * Previene Account Takeover exigiendo email_verified === true antes de permitir
 * la vinculación inicial por correo electrónico.
 */
async function resolverAutorizacionUsuario(decodedToken) {
  const uid = decodedToken.uid;
  const email = decodedToken.email || '';
  const emailVerified = decodedToken.email_verified === true;

  let userData = null;
  let userDocRef = null;

  // 1. Buscar por Document ID directo igual al UID de Firebase Auth
  const directRef = adminDb.collection('User').doc(uid);
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    userData = directSnap.data();
    userDocRef = directRef;
  }

  // 2. Buscar por campo inmutable auth_id === uid
  if (!userData) {
    const authSnap = await adminDb
      .collection('User')
      .where('auth_id', '==', uid)
      .limit(1)
      .get();

    if (!authSnap.empty) {
      userData = authSnap.docs[0].data();
      userDocRef = authSnap.docs[0].ref;
    }
  }

  // 3. Vincular por correo SOLO si email_verified === true y el perfil aún no pertenece a otro auth_id
  if (!userData && email && emailVerified) {
    const emailSnap = await adminDb
      .collection('User')
      .where('Correo', '==', email)
      .limit(1)
      .get();

    if (!emailSnap.empty) {
      const candidateData = emailSnap.docs[0].data();
      if (!candidateData.auth_id || candidateData.auth_id === uid) {
        userData = candidateData;
        userDocRef = emailSnap.docs[0].ref;
        await userDocRef.set({ auth_id: uid }, { merge: true });
      }
    }
  }

  const baneado =
    userData &&
    (Number(userData.ID_EstadoUsuario) === 2 || userData.ID_EstadoUsuario === '2');

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

  // Respetar custom claims firmados si ya existen en el servidor
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
    idUser: userData?.ID_User ?? (userDocRef ? userDocRef.id : null),
    rol,
    baneado: Boolean(baneado),
  };
}

/**
 * POST /api/auth/session
 * Recibe el ID Token de Firebase Auth, lo verifica criptográficamente en el servidor,
 * comprueba el estado/rol en Firestore, sincroniza Custom Claims y emite una cookie HttpOnly.
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

    const decodedToken = await adminAuth.verifyIdToken(idToken, true);
    const authInfo = await resolverAutorizacionUsuario(decodedToken);

    if (authInfo.baneado) {
      // Revocar todos los refresh tokens y deshabilitar en Firebase Auth para impedir uso directo de la API
      await adminAuth.revokeRefreshTokens(authInfo.uid).catch(() => {});
      await adminAuth.updateUser(authInfo.uid, { disabled: true }).catch(() => {});

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

    // Sincronizar Custom Claims en Firebase Auth para que el token lleve el rol firmado por el servidor
    const claimActual = decodedToken.rol;
    if (claimActual !== authInfo.rol) {
      await adminAuth
        .setCustomUserClaims(authInfo.uid, {
          rol: authInfo.rol,
          admin: authInfo.rol === 'admin',
          empleado: authInfo.rol === 'empleado' || authInfo.rol === 'admin',
        })
        .catch(() => {});
    }

    // Crear cookie de sesión firmada por Firebase Admin (o usar el ID token verificado como respaldo)
    let cookieValue = idToken;
    try {
      cookieValue = await adminAuth.createSessionCookie(idToken, {
        expiresIn: SESSION_EXPIRES_IN,
      });
    } catch {
      cookieValue = idToken;
    }

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
 * Verifica la sesión actual desde el servidor (mediante cookie HttpOnly o Bearer token)
 * y devuelve el rol autoritativo del usuario.
 */
export async function GET(request) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!sessionCookie && !bearerToken) {
      return NextResponse.json(
        { authenticated: false, rol: 'anonimo' },
        { status: 401 }
      );
    }

    let decodedToken = null;

    if (sessionCookie) {
      try {
        decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
      } catch {
        decodedToken = await adminAuth.verifyIdToken(sessionCookie, true);
      }
    } else if (bearerToken) {
      decodedToken = await adminAuth.verifyIdToken(bearerToken, true);
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
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, rol: 'anonimo', error: 'Sesión no válida.' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Elimina la cookie HttpOnly de sesión al cerrar sesión.
 */
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

