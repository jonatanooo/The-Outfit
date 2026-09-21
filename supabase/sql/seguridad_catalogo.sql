-- URGENTE — ejecutar en Supabase Dashboard > SQL Editor.
--
-- Igual que pasaba con "User" (ver seguridad_user.sql), estas tablas NO tenían Row
-- Level Security activado. Las probé con la clave anónima (la misma que usa
-- cualquier visitante, sin login) y pude:
--   - Leer todo (esto en sí no es grave para un catálogo público de productos).
--   - INSERTAR filas nuevas sin restricción — de hecho una prueba mía llegó a crear
--     una fila real en "Tipos_Talla" que ya borré.
--   - Lo mismo aplicaría a UPDATE/DELETE: cualquiera pudo, hasta ahora, cambiar
--     precios, stock, fotos o categorías sin haber iniciado sesión.
--
-- Además encontré que las páginas reales del panel de admin -/Inventario y
-- /transacciones- no tenían ninguna protección de ruta (ya lo arreglé en
-- src/proxy.js), así que hasta ahora ni siquiera hacía falta pasar por la API:
-- cualquiera podía abrir esas páginas directo y usarlas.
--
-- Criterio: estas tablas alimentan un catálogo (en teoría, público) así que dejo la
-- LECTURA abierta a cualquiera (autenticado o no) pero la ESCRITURA
-- (insert/update/delete) solo para usuarios logueados con rol "admin" en
-- app_metadata -el mismo criterio que ya usa el proxy y "User".

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'Productos', 'Inventario', 'Fotos_Productos',
    'Categorias_Producto', 'Talla', 'Tipos_Talla', 'Estado_User'
  ]
  loop
    execute format('alter table public.%I enable row level security;', tabla);

    execute format('drop policy if exists "lectura_publica" on public.%I;', tabla);
    execute format(
      'create policy "lectura_publica" on public.%I for select to anon, authenticated using (true);',
      tabla
    );

    execute format('drop policy if exists "solo_admin_escribe" on public.%I;', tabla);
    execute format(
      'create policy "solo_admin_escribe" on public.%I for insert to authenticated with check ((auth.jwt() -> ''app_metadata'' ->> ''rol'') = ''admin'');',
      tabla
    );
    execute format(
      'create policy "solo_admin_actualiza" on public.%I for update to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''rol'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''rol'') = ''admin'');',
      tabla
    );
    execute format(
      'create policy "solo_admin_borra" on public.%I for delete to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''rol'') = ''admin'');',
      tabla
    );
  end loop;
end $$;

-- Nota sobre "Variante_Producto": el código en src/app/Inventario/page.js llama
-- .from('Variante Producto') CON ESPACIO, pero tu tabla real se llama
-- "Variante_Producto" (con guion bajo) — lo vi al correr las pruebas, la consulta
-- devuelve "Could not find the table 'public.Variante Producto'". Es un bug
-- preexistente de esa página (no de este script), separado del tema de RLS. Avisame
-- si querés que lo arregle también.
  -- Problema: la tabla "Variante_Producto" no existe en la base de datos.