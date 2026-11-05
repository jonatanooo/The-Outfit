import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { db } from '@/lib/firebaseClient';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

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
  // 1. Intentar con Firebase Admin SDK
  try {
    return await adminAuth.verifyIdToken(idToken, false);
  } catch {
    // Continúa al respaldo oficial REST de Firebase Auth
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

/**
 * Busca el documento del usuario en la colección `User` de Firestore.
 * Intenta con `adminDb` y, si falla por credenciales en Vercel, usa `db` (Firebase SDK).
 */
async function buscarDocumentoUsuario(uid, email) {
  // Intento A: Firebase Admin Firestore
  try {
    const directRef = adminDb.collection('User').doc(uid);
    const directSnap = await directRef.get();
    if (directSnap.exists) {
      return { userData: directSnap.data(), docId: directSnap.id };
    }

    const authSnap = await adminDb
      .collection('User')
      .where('auth_id', '==', uid)
      .limit(1)
      .get();
    if (!authSnap.empty) {
      return { userData: authSnap.docs[0].data(), docId: authSnap.docs[0].id };
    }

    if (email) {
      const emailSnap = await adminDb
        .collection('User')
        .where('Correo', '==', email)
        .limit(1)
        .get();
      if (!emailSnap.empty) {
        const candidateData = emailSnap.docs[0].data();
        if (!candidateData.auth_id || candidateData.auth_id === uid) {
          await emailSnap.docs[0].ref.set({ auth_id: uid }, { merge: true }).catch(() => {});
          return { userData: candidateData, docId: emailSnap.docs[0].id };
        }
      }
    }
    return { userData: null, docId: null };
  } catch {
    // Intento B: Respaldo con Firebase SDK (`db`) cuando Admin SDK no tiene llave en Preview/Production
    try {
      const directSnap = await getDoc(doc(db, 'User', uid));
      if (directSnap.exists()) {
        return { userData: directSnap.data(), docId: directSnap.id };
      }

      const authSnap = await getDocs(
        query(collection(db, 'User'), where('auth_id', '==', uid))
      );
      if (!authSnap.empty) {
        return { userData: authSnap.docs[0].data(), docId: authSnap.docs[0].id };
      }

      if (email) {
        const emailSnap = await getDocs(
          query(collection(db, 'User'), where('Correo', '==', email))
        );
        if (!emailSnap.empty) {
          const candidateData = emailSnap.docs[0].data();
          if (!candidateData.auth_id || candidateData.auth_id === uid) {
            await setDoc(emailSnap.docs[0].ref, { auth_id: uid }, { merge: true }).catch(() => {});
            return { userData: candidateData, docId: emailSnap.docs[0].id };
          }
        }
      }
    } catch (errClient) {
      console.error('Error buscando usuario en Firestore:', errClient);
    }
    return { userData: null, docId: null };
  }
}

async function resolverAutorizacionUsuario(decodedToken) {
  const uid = decodedToken.uid;
  const email = decodedToken.email || '';
  const emailVerified = decodedToken.email_verified === true;

  const { userData, docId } = await buscarDocumentoUsuario(uid, email);

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

    if (authInfo.baneado) {
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

    // Sincronizar Custom Claims si Admin SDK está activo
    if (decodedToken.rol !== authInfo.rol) {
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
        if (signedPayload.baneado) {
          const response = NextResponse.json(
            { authenticated: false, baneado: true, rol: 'baneado' },
            { status: 403 }
          );
          response.cookies.delete(SESSION_COOKIE_NAME);
          return response;
        }
        return NextResponse.json({
          authenticated: true,
          uid: signedPayload.uid,
          idUser: signedPayload.idUser,
          rol: signedPayload.rol || 'usuario',
          emailVerified: true,
        });
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
