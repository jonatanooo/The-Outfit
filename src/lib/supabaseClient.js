import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabase = createBrowserClient(supabaseUrl, supabaseKey)

// "Mantener sesión" (checkbox de login): si el usuario no la marca, reescribimos la
// cookie de sesión que @supabase/ssr acaba de guardar sin duración (cookie de
// navegador), para que se borre al cerrar el navegador en vez de durar semanas.
export function aplicarMantenerSesion(mantener) {
  if (mantener || typeof document === 'undefined') return
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const prefijo = `sb-${projectRef}-auth-token`
  document.cookie.split('; ').forEach((par) => {
    const separador = par.indexOf('=')
    const nombre = par.slice(0, separador)
    const valor = par.slice(separador + 1)
    if (nombre.startsWith(prefijo)) {
      document.cookie = `${nombre}=${valor}; path=/; SameSite=Lax`
    }
  })
}
