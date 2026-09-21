-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.
-- Mueve el rol del usuario de "user_metadata" (editable por el propio usuario desde
-- el cliente con supabase.auth.updateUser) a "app_metadata" (solo lo puede escribir
-- el backend / una función con privilegios elevados). El código de la app ya lee
-- el rol desde app_metadata (ver src/proxy.js, src/app/admin/page.js, src/app/login/page.js).

-- 1) Todo usuario nuevo entra con rol "usuario" por defecto en app_metadata.
create or replace function public.asignar_rol_por_defecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.raw_app_meta_data :=
    coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('rol', 'usuario');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_rol on auth.users;
create trigger on_auth_user_created_rol
  before insert on auth.users
  for each row execute function public.asignar_rol_por_defecto();

-- 2) Para usuarios que ya existen (creados antes de este cambio), fijamos "usuario"
--    como valor por defecto si todavía no tienen rol en app_metadata.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('rol', 'usuario')
where raw_app_meta_data->>'rol' is null;

-- 3) Promover a un usuario a admin o empleado: SOLO se puede hacer así (SQL Editor o
--    Dashboard > Authentication > Users), nunca desde la app ni desde el navegador.
--    Reemplazá el email antes de correrlo.
-- update auth.users
-- set raw_app_meta_data = raw_app_meta_data || '{"rol": "admin"}'::jsonb
-- where email = 'admin@tudominio.com';
