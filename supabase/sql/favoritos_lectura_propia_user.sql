-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Favoritos no funciona para usuarios normales: seguridad_user.sql dejó "User"
-- con RLS activo y una sola política (admin_acceso_total_user), que solo deja
-- pasar a usuarios con app_metadata.rol = 'admin'. useFavoritos.js necesita
-- traducir el usuario logueado (auth.uid()) a su fila en "User" con
--   select "ID_User" from "User" where auth_id = auth.uid()
-- y como RLS no tiene ninguna política que cubra ese caso, la consulta siempre
-- devuelve 0 filas para un usuario no-admin (RLS filtra en silencio, no da
-- error). Resultado: idUsuario queda null y el corazón de favoritos siempre
-- muestra "Iniciá sesión para guardar tus favoritos", aunque sí haya sesión.
--
-- Esta política es PERMISSIVE y se suma (OR) a admin_acceso_total_user, no la
-- reemplaza: los admins siguen teniendo acceso total, y ahora cualquier
-- usuario autenticado puede además leer (solo SELECT) su propia fila.

drop policy if exists "usuario_lee_su_propia_fila" on public."User";
create policy "usuario_lee_su_propia_fila"
on public."User"
for select
to authenticated
using (auth_id = auth.uid());
