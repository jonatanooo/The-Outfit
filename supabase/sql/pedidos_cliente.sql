-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Contexto: hasta ahora "Pedido", "Pedido_Detalle", "Direcciones" y
-- "Transacciones_Pago" solo las usaba el panel de admin (/transacciones), que ya
-- corre detrás del rol "admin" (ver src/proxy.js). De hecho transacciones/page.js
-- ya señala que "Pedido" ni siquiera tiene una política de UPDATE funcional para
-- el admin. Con el checkout de cliente (src/app/checkout/page.js) un usuario
-- normal (rol "usuario") necesita, por primera vez, poder:
--   - gestionar sus propias direcciones (Direcciones)
--   - crear su propio pedido (Pedido, Pedido_Detalle, Transacciones_Pago)
--   - leer el catálogo de estados (Estado_Pedido) para saber cuál es "Pendiente"
-- Sin estas políticas, el checkout va a fallar con errores de RLS apenas
-- intente insertar. El admin conserva acceso total sobre las 4 tablas.
--
-- IMPORTANTE — verificar antes de correr: este script asume que "Direcciones"
-- tiene una columna "ID_User" (dueño de la dirección, igual que en "Favoritos" /
-- "Fotos_Productos"), y que "Pedido_Detalle" y "Transacciones_Pago" tienen una
-- columna "ID_Pedido" (FK a "Pedido"). Son los nombres que sigue el resto del
-- esquema, pero no se verificaron contra la base real -revisá el Table Editor
-- de Supabase y ajustá los nombres de columna aquí si difieren.

-- 1) DIRECCIONES: cada usuario logueado gestiona solo las suyas.
alter table public."Direcciones" enable row level security;

drop policy if exists "usuario_gestiona_sus_direcciones" on public."Direcciones";
create policy "usuario_gestiona_sus_direcciones"
on public."Direcciones"
for all
to authenticated
using ("ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid()))
with check ("ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid()));

drop policy if exists "admin_acceso_total_direcciones" on public."Direcciones";
create policy "admin_acceso_total_direcciones"
on public."Direcciones"
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

-- 2) PEDIDO: el cliente crea y lee solo los suyos; el admin puede todo
--    (esto de paso arregla el UPDATE de admin que faltaba, ver nota arriba).
alter table public."Pedido" enable row level security;

drop policy if exists "usuario_crea_y_ve_sus_pedidos" on public."Pedido";
create policy "usuario_crea_y_ve_sus_pedidos"
on public."Pedido"
for select
to authenticated
using ("ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid()));

drop policy if exists "usuario_inserta_su_pedido" on public."Pedido";
create policy "usuario_inserta_su_pedido"
on public."Pedido"
for insert
to authenticated
with check ("ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid()));

drop policy if exists "admin_acceso_total_pedido" on public."Pedido";
create policy "admin_acceso_total_pedido"
on public."Pedido"
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

-- 3) PEDIDO_DETALLE: el cliente inserta/lee líneas de SU PROPIO pedido
--    (se valida a través del ID_User del pedido padre).
alter table public."Pedido_Detalle" enable row level security;

drop policy if exists "usuario_gestiona_detalle_de_su_pedido" on public."Pedido_Detalle";
create policy "usuario_gestiona_detalle_de_su_pedido"
on public."Pedido_Detalle"
for all
to authenticated
using (
  "ID_Pedido" in (
    select "ID_Pedido" from public."Pedido"
    where "ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid())
  )
)
with check (
  "ID_Pedido" in (
    select "ID_Pedido" from public."Pedido"
    where "ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid())
  )
);

drop policy if exists "admin_acceso_total_pedido_detalle" on public."Pedido_Detalle";
create policy "admin_acceso_total_pedido_detalle"
on public."Pedido_Detalle"
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

-- 4) TRANSACCIONES_PAGO: mismo criterio, a través del pedido padre.
alter table public."Transacciones_Pago" enable row level security;

drop policy if exists "usuario_gestiona_pago_de_su_pedido" on public."Transacciones_Pago";
create policy "usuario_gestiona_pago_de_su_pedido"
on public."Transacciones_Pago"
for all
to authenticated
using (
  "ID_Pedido" in (
    select "ID_Pedido" from public."Pedido"
    where "ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid())
  )
)
with check (
  "ID_Pedido" in (
    select "ID_Pedido" from public."Pedido"
    where "ID_User" = (select "ID_User" from public."User" where auth_id = auth.uid())
  )
);

drop policy if exists "admin_acceso_total_transacciones_pago" on public."Transacciones_Pago";
create policy "admin_acceso_total_transacciones_pago"
on public."Transacciones_Pago"
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

-- 5) ESTADO_PEDIDO: catálogo de solo lectura (igual que Categorias_Producto,
--    Talla, etc. en seguridad_catalogo.sql). El checkout lo lee para encontrar
--    el ID del estado "Pendiente" al crear un pedido nuevo.
alter table public."Estado_Pedido" enable row level security;

drop policy if exists "lectura_publica_estado_pedido" on public."Estado_Pedido";
create policy "lectura_publica_estado_pedido"
on public."Estado_Pedido"
for select
to anon, authenticated
using (true);
