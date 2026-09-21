-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Al confirmar una compra (comprar() en src/app/checkout/page.js) se crea el
-- Pedido y su Pedido_Detalle, pero nada descontaba "Inventario": se podía
-- vender más unidades de las que realmente había en existencia.
--
-- "Inventario" solo tiene política de UPDATE para admin ("solo_admin_actualiza"
-- en seguridad_catalogo.sql), así que un cliente normal no puede restarle stock
-- con un UPDATE directo desde el navegador -y no debería poder, o cualquiera
-- podría poner el stock que quisiera. En su lugar, esta función corre con
-- SECURITY DEFINER (permiso elevado, salta esa política) pero SOLO hace una
-- cosa muy acotada: dado un ID_Pedido, valida que el pedido sea del usuario
-- que llama (o de un admin) y resta exactamente las cantidades de su propio
-- Pedido_Detalle -nunca cantidades arbitrarias que el cliente pueda inventar.
--
-- "for update" bloquea las filas de Inventario mientras se restan, para que
-- dos compras simultáneas de la última unidad no dejen el stock en negativo.
-- Si no alcanza el stock, aborta con una excepción (y el checkout no llega a
-- registrar el pago).

create or replace function public.descontar_inventario_pedido(p_id_pedido bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_user_pedido bigint;
  v_id_user_actual bigint;
  v_es_admin boolean;
  detalle record;
  fila record;
  restante integer;
  disponible_total integer;
begin
  select "ID_User" into v_id_user_pedido
  from public."Pedido"
  where "ID_Pedido" = p_id_pedido;

  if v_id_user_pedido is null then
    raise exception 'Pedido % no existe', p_id_pedido;
  end if;

  select "ID_User" into v_id_user_actual
  from public."User"
  where auth_id = auth.uid();

  v_es_admin := coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin', false);

  if not v_es_admin and (v_id_user_actual is null or v_id_user_actual <> v_id_user_pedido) then
    raise exception 'No autorizado a descontar inventario del pedido %', p_id_pedido;
  end if;

  for detalle in
    select "ID_Variante", sum("Cantidad")::integer as cantidad
    from public."Pedido_Detalle"
    where "ID_Pedido" = p_id_pedido and "ID_Variante" is not null
    group by "ID_Variante"
  loop
    restante := detalle.cantidad;
    continue when restante <= 0;

    select coalesce(sum("Cantidad_Disponible"), 0) into disponible_total
    from public."Inventario"
    where "ID_Variante" = detalle."ID_Variante";

    if disponible_total < restante then
      raise exception 'Stock insuficiente para la variante %: quedan % unidades, se pidieron %',
        detalle."ID_Variante", disponible_total, restante;
    end if;

    for fila in
      select "ID_Inventario", "Cantidad_Disponible"
      from public."Inventario"
      where "ID_Variante" = detalle."ID_Variante" and "Cantidad_Disponible" > 0
      order by "ID_Inventario"
      for update
    loop
      exit when restante <= 0;

      if fila."Cantidad_Disponible" >= restante then
        update public."Inventario"
          set "Cantidad_Disponible" = "Cantidad_Disponible" - restante,
              "Fecha_Actualizacion" = now()
          where "ID_Inventario" = fila."ID_Inventario";
        restante := 0;
      else
        update public."Inventario"
          set "Cantidad_Disponible" = 0,
              "Fecha_Actualizacion" = now()
          where "ID_Inventario" = fila."ID_Inventario";
        restante := restante - fila."Cantidad_Disponible";
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.descontar_inventario_pedido(bigint) from public;
grant execute on function public.descontar_inventario_pedido(bigint) to authenticated;
