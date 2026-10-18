import { NextResponse } from 'next/server';

// Rutas protegidas del panel administrativo
const RUTAS_PROTEGIDAS = [
  '/admin',
  '/Inventario',
  '/transacciones',
  '/reportes',
  '/empleados',
  '/empleado',
];

export async function proxy(request) {
  // Las páginas protegidas cuentan con verificación activa mediante Firebase Auth y roles en Firestore.
  // Este proxy mantiene la compatibilidad con Next.js sin dependencias de Supabase.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/Inventario/:path*',
    '/transacciones/:path*',
    '/reportes/:path*',
    '/empleados/:path*',
    '/empleado/:path*'
  ],
};
