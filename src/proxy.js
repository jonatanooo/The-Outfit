import { NextResponse } from 'next/server';

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
 * Decodifica Base64URL de forma compatible con Edge y Node.js sin dependencias pesadas.
 */
function decodificarBase64Url(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Lee el payload del token de sesión (`v1.<payload>.<sig>` o JWT) en el proxy
 * sin cargar `firebase-admin` (gRPC) que causa 500 Internal Server Error en Vercel Middleware.
 */
function leerSesionDesdeCookie(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string') return null;

  // Formato emitido por /api/auth/session: v1.<base64urlPayload>.<hmac>
  if (cookieValue.startsWith('v1.')) {
    const parts = cookieValue.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = decodificarBase64Url(parts[1]);
    if (!jsonStr) return null;
    try {
      const payload = JSON.parse(jsonStr);
      if (payload.exp && Date.now() > payload.exp) return null;
      return {
        valido: !payload.baneado && Boolean(payload.uid),
        uid: payload.uid,
        rol: payload.rol || 'usuario',
        baneado: Boolean(payload.baneado),
      };
    } catch {
      return null;
    }
  }

  // Respaldo si la cookie contiene un JWT de Firebase
  const jwtParts = cookieValue.split('.');
  if (jwtParts.length === 3) {
    const jsonStr = decodificarBase64Url(jwtParts[1]);
    if (!jsonStr) return null;
    try {
      const payload = JSON.parse(jsonStr);
      if (payload.exp && Date.now() / 1000 > payload.exp) return null;
      const uid = payload.user_id || payload.sub;
      if (!uid) return null;
      let rol = 'usuario';
      if (payload.rol === 'admin' || payload.admin === true) {
        rol = 'admin';
      } else if (payload.rol === 'empleado' || payload.empleado === true) {
        rol = 'empleado';
      }
      return { valido: true, uid, rol, baneado: false };
    } catch {
      return null;
    }
  }

  return null;
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

  // Si aún no hay cookie (o el cliente está sincronizando tras login), la página
  // ejecutará verificarAccesoServidor(user) para autorizar o redirigir sin producir error 500
  if (!sessionCookie) {
    return NextResponse.next();
  }

  const sesion = leerSesionDesdeCookie(sessionCookie);
  if (!sesion) {
    return NextResponse.next();
  }

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
