-- Ejecutar en Supabase Dashboard > SQL Editor, después de descontar_inventario_pedido.sql.
--
-- Verificando los permisos de la función descontar_inventario_pedido() encontré
-- que "anon" (sin sesión) también puede invocarla: Supabase le otorga EXECUTE a
-- anon/authenticated/service_role a toda función nueva del schema "public" por
-- defecto, y eso no lo quita un "revoke ... from public" (PUBLIC es un pseudo-rol
-- aparte; anon tiene su propio permiso directo).
--
-- No es explotable -la función exige que auth.uid() resuelva al dueño del
-- pedido, y para anon eso siempre es null-, pero no debería depender solo de
-- esa validación interna: se cierra también a nivel de permisos.

revoke execute on function public.descontar_inventario_pedido(bigint) from anon;
revoke execute on function public.descontar_inventario_pedido(bigint) from public;
grant execute on function public.descontar_inventario_pedido(bigint) to authenticated;
