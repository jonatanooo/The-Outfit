-- URGENTE — ejecutar esto YA en Supabase Dashboard > SQL Editor.
--
-- Probé la tabla "User" con la clave anónima (la misma que usa el navegador de
-- cualquier visitante) y no tenía Row Level Security activado. Resultado:
-- cualquier persona, sin haber iniciado sesión, puede leer y ESCRIBIR sobre toda la
-- tabla vía la API REST pública de Supabase. Esto incluye la columna "Password_Hash"
-- (que además guarda la contraseña en texto plano, no un hash real: la fila del
-- usuario "admin" tiene el valor literal "contraseña123") y "DUI" (documento de
-- identidad). Cualquiera pudo haber leído o modificado esos datos hasta ahora.
--
-- Acción inmediata recomendada además de correr este script:
-- cambiá la contraseña real de la cuenta "admin" (en Supabase Auth, no en esta
-- tabla) porque "contraseña123" ya estuvo expuesta.

-- 1) Activar RLS: a partir de acá, sin una política explícita, nadie puede leer
--    ni escribir en "User" (ni siquiera con la clave anónima).
alter table public."User" enable row level security;

-- 2) Solo los usuarios logueados con rol "admin" (el mismo app_metadata.rol que
--    ya usa el proxy) pueden leer/crear/editar/borrar filas de "User". Esto es lo
--    que necesita el panel de administrador (Inventario, Transacciones).
drop policy if exists "admin_acceso_total_user" on public."User";
create policy "admin_acceso_total_user"
on public."User"
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

-- Nota: el trigger de perfil_usuario.sql (crear_perfil_usuario) sigue funcionando
-- igual después de esto — corre como "security definer", así que no lo bloquea RLS.

-- 3) Opcional pero recomendado: "Password_Hash" no lo usa ningún código de la app
--    (users.md lo revisó, cero referencias). Es un resabio de un sistema de login
--    viejo, previo a Supabase Auth. Si confirmás que no lo necesitás, lo más limpio
--    es borrar la columna en vez de dejar una contraseña en texto plano dando
--    vueltas, aunque ahora esté detrás de RLS:
-- alter table public."User" drop column "Password_Hash";
