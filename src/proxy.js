import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { db } from '@/lib/firebaseClient';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

const SESSION_COOKIE_NAME = '__session';

// Rutas exclusivas para el rol "admin"
const RUTAS_SOLO_ADMIN = [
  '/admin',
  '/Inventario',
  '/transacciones',
  '/reportes',
  '/empleados',
  '/configuracion',
];

// Rutas permitidas para "empleado" o "admin"
const RUTAS_EMPLEADO = ['/empleado'];

function obtenerSecretoCookie() {
  return (
    process.env.SESSION_COOKIE_SECRET ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'the-outfit-default-session-secret-key'
  );
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

/**
 * Verifica en el servidor el token/cookie y obtiene el rol autoritativo.
 */
async function verificarSesionYRolEnServidor(tokenValue) {
  // 1. Verificar token de sesión firmado por /api/auth/session (HMAC-SHA256)
  const signedPayload = verificarTokenSesionFirmado(tokenValue);
  if (signedPayload && signedPayload.uid) {
    return {
      valido: !signedPayload.baneado,
      uid: signedPayload.uid,
      rol: signedPayload.rol || 'usuario',
      baneado: Boolean(signedPayload.baneado),
    };
  }

  // 2. Respaldo para cookies con ID Token o Session Cookie de Firebase
  let decoded = null;
  try {
    decoded = await adminAuth.verifySessionCookie(tokenValue, false);
  } catch {
    try {
      decoded = await adminAuth.verifyIdToken(tokenValue, false);
    } catch {
      const parts = String(tokenValue).split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload.exp && Date.now() / 1000 <= payload.exp) {
          decoded = {
            uid: payload.user_id || payload.sub,
            email: payload.email || '',
            rol: payload.rol,
            admin: payload.admin,
            empleado: payload.empleado,
          };
        }
      }
    }
  }

  if (!decoded || !decoded.uid) {
    return { valido: false, baneado: false, rol: 'anonimo' };
  }

  const uid = decoded.uid;
  const email = decoded.email || '';
  let userData = null;

  try {
    const directSnap = await adminDb.collection('User').doc(uid).get();
    if (directSnap.exists) {
      userData = directSnap.data();
    } else {
      const authSnap = await adminDb.collection('User').where('auth_id', '==', uid).limit(1).get();
      if (!authSnap.empty) {
        userData = authSnap.docs[0].data();
      } else if (email) {
        const emailSnap = await adminDb.collection('User').where('Correo', '==', email).limit(1).get();
        if (!emailSnap.empty) {
          const candidate = emailSnap.docs[0].data();
          if (!candidate.auth_id || candidate.auth_id === uid) userData = candidate;
        }
      }
    }
  } catch {
    try {
      const directSnap = await getDoc(doc(db, 'User', uid));
      if (directSnap.exists()) {
        userData = directSnap.data();
      } else {
        const authSnap = await getDocs(query(collection(db, 'User'), where('auth_id', '==', uid)));
        if (!authSnap.empty) {
          userData = authSnap.docs[0].data();
        } else if (email) {
          const emailSnap = await getDocs(query(collection(db, 'User'), where('Correo', '==', email)));
          if (!emailSnap.empty) {
            const candidate = emailSnap.docs[0].data();
            if (!candidate.auth_id || candidate.auth_id === uid) userData = candidate;
          }
        }
      }
    } catch {
      // Ignorar si no se pudo consultar
    }
  }

  const estadoNum = userData ? Number(userData.ID_EstadoUsuario) : 1;
  if (userData && (estadoNum === 2 || estadoNum === 3)) {
    return { valido: false, baneado: true, rol: 'baneado' };
  }

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

  if (decoded.rol === 'admin' || decoded.admin === true) {
    rol = 'admin';
  } else if (
    rol === 'usuario' &&
    (decoded.rol === 'empleado' || decoded.empleado === true)
  ) {
    rol = 'empleado';
  }

  return { valido: true, uid, rol, baneado: false };
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const requiereAdmin = RUTAS_SOLO_ADMIN.some(
    (ruta) =>
      pathname.toLowerCase() === ruta.toLowerCase() ||
      pathname.toLowerCase().startsWith(`${ruta.toLowerCase()}/`)
  );

  const requiereEmpleado = RUTAS_EMPLEADO.some(
    (ruta) =>
      pathname.toLowerCase() === ruta.toLowerCase() ||
      pathname.toLowerCase().startsWith(`${ruta.toLowerCase()}/`)
  );

  if (!requiereAdmin && !requiereEmpleado) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Sin cookie de sesión aún: permitir que el cliente valide con verificarAccesoServidor(user)
  // si el navegador acaba de autenticarse en Firebase Auth
  if (!sessionCookie) {
    return NextResponse.next();
  }

  try {
    const sesion = await verificarSesionYRolEnServidor(sessionCookie);

    if (!sesion.valido || sesion.baneado) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    if (requiereAdmin && sesion.rol !== 'admin') {
      const targetUrl =
        sesion.rol === 'empleado'
          ? new URL('/empleado', request.url)
          : new URL('/', request.url);
      return NextResponse.redirect(targetUrl);
    }

    if (requiereEmpleado && sesion.rol !== 'empleado' && sesion.rol !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/Inventario/:path*',
    '/inventario/:path*',
    '/transacciones/:path*',
    '/reportes/:path*',
    '/empleados/:path*',
    '/configuracion/:path*',
    '/empleado/:path*',
  ],
};
