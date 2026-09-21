-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Problema que resuelve: el registro (supabase.auth.signUp) solo crea la cuenta en el
-- sistema interno de Supabase Auth (auth.users). Tu tabla propia "User" -la que usan
-- Inventario y Transacciones para el campo ID_User- nunca se entera de nada, así que
-- se queda vacía para cualquier cuenta creada desde /register.
--
-- Solución: un trigger en auth.users que, apenas se crea la cuenta, inserta la fila
-- correspondiente en "User". Como "User"."ID_User" es serial (autonumérico) y no tiene
-- relación con el uuid que usa auth.users, agregamos una columna nueva "auth_id" para
-- poder encontrar la fila de "User" que le corresponde a cada usuario logueado.
--
-- v2: la primera versión fallaba (23502, "ID_Rol") por dos columnas obligatorias que
-- no sabía que existían: "ID_Rol" (FK a una tabla "Roles" vacía, sin uso en el código)
-- e "ID_EstadoUsuario" (FK a "Estado_User", que sí tiene un valor real: 1 = "Activo").
--
-- v3: probando de nuevo apareció OTRA columna obligatoria: "Password_Hash" (la misma
-- que guardaba la contraseña de "admin" en texto plano). No hay ningún código que la
-- use, así que igual que con "ID_Rol" le saco el NOT NULL en vez de inventar/duplicar
-- una contraseña ahí — bastante tuvimos con la que ya quedó expuesta.
--
-- v4: la última columna obligatoria que faltaba era "DUI". A diferencia de ID_Rol y
-- Password_Hash, este sí es un dato real que usa transacciones/page.js, así que en vez
-- de sacarle el NOT NULL se agregó el campo al formulario de registro
-- (src/app/register/page.js) y el trigger ya lo puede insertar.
--
-- Si ya corriste alguna versión anterior, volvé a correr este archivo completo: todo
-- acá es seguro de repetir (add column if not exists, drop not null, create or replace).

-- 1) Columna que vincula tu tabla "User" con auth.users.
alter table public."User"
  add column if not exists auth_id uuid unique references auth.users(id) on delete cascade;

-- 2) "ID_Rol" no tiene ningún dato real detrás (la tabla "Roles" está vacía y ningún
--    código del proyecto la usa: el rol de verdad vive en app_metadata, ver roles.sql).
--    Como sigue siendo NOT NULL, cualquier insert nuevo en "User" lo necesita. Se lo
--    saco para no inventar un valor falso; si más adelante armás el sistema de Roles
--    de verdad, volvé a ponerle NOT NULL vos mismo.
alter table public."User"
  alter column "ID_Rol" drop not null;

-- 2b) Lo mismo con "Password_Hash": queda sin usar, no vamos a guardar ahí ni
--     contraseñas en texto plano ni una copia del hash real de Supabase Auth.
alter table public."User"
  alter column "Password_Hash" drop not null;

-- 3) Trigger: crea la fila en "User" apenas se registra una cuenta nueva.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."User" ("Usuario", "Telefono", "DUI", "ID_EstadoUsuario", auth_id)
  values (
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'dui',
    1, -- Estado_User.ID_EstadoUsuario = 1 ("Activo")
    new.id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_perfil on auth.users;
create trigger on_auth_user_created_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- 4) Backfill opcional para cuentas creadas ANTES de este trigger (ej. las que ya
--    probaste). Les crea una fila en "User" vinculada por auth_id; después podés
--    completar Usuario/Telefono a mano desde el Table Editor si hace falta.
-- insert into public."User" ("ID_EstadoUsuario", auth_id)
-- select 1, id from auth.users
-- where id not in (select auth_id from public."User" where auth_id is not null);
