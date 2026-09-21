-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Promueve la cuenta ezequielamaya129@gmail.com a rol "admin" en app_metadata,
-- siguiendo el patrón ya documentado en roles.sql (sección 3): el rol vive en
-- app_metadata (no en user_metadata) porque solo se puede escribir desde el
-- backend, nunca desde el cliente con supabase.auth.updateUser(). Con esto,
-- src/proxy.js va a dejar pasar a /admin, /Inventario y /transacciones.

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"rol": "admin"}'::jsonb
where email = 'ezequielamaya129@gmail.com'
returning id, email, raw_app_meta_data ->> 'rol' as rol_nuevo;
