-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- pedidos_cliente.sql agregó políticas propias para "Pedido", "Pedido_Detalle"
-- y "Transacciones_Pago" (dueño ve/crea lo suyo, admin tiene acceso total),
-- pero no tocó unas políticas viejas que ya existían con rol "public" y
-- qual "true": "lectura publica pedidos" / "update publico pedido" en Pedido,
-- y "lectura publica ..." en Pedido_Detalle y Transacciones_Pago.
--
-- Como son políticas PERMISSIVE, se combinan con OR: aunque ahora cada usuario
-- tiene su propia política, esas viejas políticas públicas seguían dejando que
-- cualquiera, sin haber iniciado sesión, lea y en el caso de Pedido incluso
-- MODIFIQUE los pedidos de cualquier cliente vía la API pública. Revisé el
-- código (src/app/checkout/page.js y src/app/transacciones/page.js) y ningún
-- flujo de la app depende de leer/actualizar estas tablas sin sesión, así que
-- se pueden borrar sin romper nada.

drop policy if exists "lectura publica pedidos" on public."Pedido";
drop policy if exists "update publico pedido" on public."Pedido";
drop policy if exists "lectura publica pedido_detalle" on public."Pedido_Detalle";
drop policy if exists "lectura publica transacciones_pago" on public."Transacciones_Pago";
