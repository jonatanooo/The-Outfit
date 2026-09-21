-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- La nueva página /empleados (panel de admin) necesita un puñado de datos que
-- "User" todavía no guarda: correo (vive solo en auth.users, no en la tabla
-- pública), nombres y apellidos por separado (hoy solo existe "Usuario" como
-- nombre completo) y una forma de marcar qué filas de "User" son personal de
-- la tienda y no clientes. Todo esto son columnas nuevas, aditivas: no tocan
-- nada de lo que ya lee el resto de la app (Usuario/Telefono/DUI/auth_id
-- siguen igual). No hace falta tocar RLS: "User" ya tiene "admin_acceso_total_user"
-- (ver seguridad_user.sql), que cubre cualquier columna nueva de la misma tabla.

-- 1) Columnas nuevas.
alter table public."User"
  add column if not exists "Correo" text,
  add column if not exists "Nombres" text,
  add column if not exists "Apellidos" text,
  add column if not exists "Puesto" text,
  add column if not exists "Es_Empleado" boolean not null default false,
  add column if not exists "Fecha_Incorporacion" timestamptz;

-- "Telefono" es NOT NULL en "User" y el formulario de /empleados no lo pide,
-- así que el insert fallaba por eso apenas se resolvía lo de las columnas de
-- arriba. Mismo criterio que ya se usó con "Password_Hash" en perfil_usuario.sql.
alter table public."User"
  alter column "Telefono" drop not null;

-- 2) Backfill para cuentas que ya existían antes de este cambio:
--    - "Correo" se copia desde auth.users (por auth_id).
--    - "Nombres"/"Apellidos" se derivan de "Usuario" partiendo en el primer
--      espacio (best-effort; para nombres compuestos puede no ser perfecto,
--      pero deja algo mejor que vacío y el admin puede corregirlo a mano).
update public."User" u
set "Correo" = au.email
from auth.users au
where au.id = u.auth_id
  and u."Correo" is null;

update public."User"
set
  "Nombres" = split_part("Usuario", ' ', 1),
  "Apellidos" = nullif(substring("Usuario" from position(' ' in "Usuario") + 1), '')
where "Usuario" is not null
  and "Nombres" is null;

-- 3) A partir de ahora, el trigger que crea la fila de "User" al registrarse
--    (crear_perfil_usuario, ver perfil_usuario.sql) también guarda el correo.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."User" ("Usuario", "Telefono", "DUI", "ID_EstadoUsuario", auth_id, "Correo")
  values (
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'dui',
    1, -- Estado_User.ID_EstadoUsuario = 1 ("Activo")
    new.id,
    new.email
  );
  return new;
end;
$$;

-- Nota: "Es_Empleado" / "Puesto" / "Fecha_Incorporacion" son organizativos —
-- los gestiona /empleados para tener un directorio de personal. NO le dan a
-- nadie acceso a /admin ni /empleado: eso lo sigue controlando exclusivamente
-- app_metadata.rol (ver roles.sql), que solo se puede cambiar desde el SQL
-- Editor o el Dashboard de Supabase, nunca desde el navegador. Marcar a
-- alguien como empleado acá es solo un registro; darle acceso real todavía
-- requiere correr el UPDATE de roles.sql para esa cuenta.
