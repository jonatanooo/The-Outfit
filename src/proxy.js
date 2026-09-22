import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Rutas y el rol (app_metadata) mínimo que necesitan para entrar.
// /Inventario y /transacciones son las páginas reales del panel (linkeadas desde
// SidebarAdmin.jsx) y viven fuera de /admin, así que hay que listarlas aparte.
// OJO con el orden: "/empleados" (directorio de admin) tiene que ir ANTES que
// "/empleado" (panel del propio empleado) porque el match de abajo es por
// startsWith y "/empleados".startsWith("/empleado") también da true.
const RUTAS_PROTEGIDAS = [
  { prefijo: '/admin', rolPermitido: 'admin' },
  { prefijo: '/Inventario', rolPermitido: 'admin' },
  { prefijo: '/transacciones', rolPermitido: 'admin' },
  { prefijo: '/reportes', rolPermitido: 'admin' },
  { prefijo: '/empleados', rolPermitido: 'admin' },
  { prefijo: '/empleado', rolPermitido: 'empleado' },
]

export async function proxy(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getUser() valida el token contra el servidor de Supabase (no solo lee la cookie),
  // así que un usuario sin sesión válida no puede pasar aunque falsifique la cookie.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const ruta = RUTAS_PROTEGIDAS.find((r) => pathname.startsWith(r.prefijo))

  if (ruta) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // El rol vive en app_metadata: solo se puede escribir desde el servidor
    // (trigger/SQL con permisos elevados), nunca desde el cliente con updateUser().
    const rol = user.app_metadata?.rol || 'usuario'
    if (rol !== ruta.rolPermitido) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/Inventario/:path*', '/transacciones/:path*', '/reportes/:path*', '/empleados/:path*', '/empleado/:path*'],
}
