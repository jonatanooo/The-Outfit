-- Ejecutar en Supabase Dashboard > SQL Editor.
-- Promueve la cuenta jonatanorellana94@gmail.com a rol "admin" en app_metadata

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol": "admin"}'::jsonb
where email = 'jonatanorellana94@gmail.com'
returning id, email, raw_app_meta_data ->> 'rol' as rol_nuevo;