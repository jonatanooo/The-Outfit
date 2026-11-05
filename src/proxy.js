import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

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

/**
 * Verifica en el servidor el token/cookie y obtiene el rol autoritativo desde Firestore Admin.
 */
async function verificarSesionYRolEnServidor(tokenValue) {
  let decoded = null;
  try {
    decoded = await adminAuth.verifySessionCookie(tokenValue, true);
  } catch {
    decoded = await adminAuth.verifyIdToken(tokenValue, true);
  }

  const uid = decoded.uid;
  const email = decoded.email || '';
  const emailVerified = decoded.email_verified === true;

  let userData = null;

  // 1. Buscar por UID directo
  const directSnap = await adminDb.collection('User').doc(uid).get();
  if (directSnap.exists) {
    userData = directSnap.data();
  }

  // 2. Buscar por auth_id === uid
  if (!userData) {
    const authSnap = await adminDb
      .collection('User')
      .where('auth_id', '==', uid)
      .limit(1)
      .get();
    if (!authSnap.empty) {
      userData = authSnap.docs[0].data();
    }
  }

  // 3. Fallback por correo ÚNICAMENTE si el correo está verificado y sin otro auth_id vinculado
  if (!userData && email && emailVerified) {
    const emailSnap = await adminDb
      .collection('User')
      .where('Correo', '==', email)
      .limit(1)
      .get();
    if (!emailSnap.empty) {
      const candidate = emailSnap.docs[0].data();
      if (!candidate.auth_id || candidate.auth_id === uid) {
        userData = candidate;
      }
    }
  }

  // Bloquear cuentas baneadas (ID_EstadoUsuario === 2)
  if (
    userData &&
    (Number(userData.ID_EstadoUsuario) === 2 || userData.ID_EstadoUsuario === '2')
  ) {
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

  // 1. Sin cookie de sesión en el servidor -> Redirigir a /login
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // 2. Validar firma criptográfica del token/cookie y rol en Firestore desde el servidor
    const sesion = await verificarSesionYRolEnServidor(sessionCookie);

    if (!sesion.valido || sesion.baneado) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    // 3. Control de Acceso Basado en Roles (RBAC) en servidor
    if (requiereAdmin && sesion.rol !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (requiereEmpleado && sesion.rol !== 'empleado' && sesion.rol !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Acceso denegado en proxy para ruta protegida:', error.message);
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/Inventario/:path*',
    '/transacciones/:path*',
    '/reportes/:path*',
    '/empleados/:path*',
    '/empleado/:path*',
    '/configuracion/:path*',
  ],
};
