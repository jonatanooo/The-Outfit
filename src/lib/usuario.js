import { supabase } from './supabaseClient';

// Traduce el usuario logueado (auth.users) al ID_User de la tabla "User" propia,
// que es la que usan las FK del resto del esquema (Favoritos, Pedido, Direcciones...).
export async function obtenerIdUsuario() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('User')
    .select('ID_User')
    .eq('auth_id', user.id)
    .maybeSingle();

  return data?.ID_User ?? null;
}
