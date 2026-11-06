-- ====================================================================
-- MIGRACIÓN: Arquitectura de Entradas de Inventario y SKU Numérico
-- Proyecto: The Outfit Boutique E-Commerce
-- Descripción:
--   1. Asegura restricciones de integridad referencial (Foreign Keys)
--      con ON DELETE RESTRICT para garantizar la independencia del Producto Base.
--   2. Agrega UNIQUE CONSTRAINT compuesto (ID_Producto, ID_Talla) para
--      garantizar que jamás se dupliquen ni crucen inventarios de prendas.
--   3. Actualiza y valida SKUs de variantes a formato 100% numérico
--      (concatenación de ID_Producto numérico + ID_Talla numérico).
--   4. Función/Procedimiento de migración retroactiva para convertir
--      SKUs antiguos con letras (ej: '10050M') a formato numérico (ej: '1005011').
-- ====================================================================

-- 1. Restricciones de Claves Foráneas (Foreign Keys)
DO $$
BEGIN
    -- FK Variante_Producto -> Productos (ON DELETE RESTRICT para proteger al padre)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_variante_producto_padre'
    ) THEN
        ALTER TABLE "Variante_Producto"
        ADD CONSTRAINT "fk_variante_producto_padre"
        FOREIGN KEY ("ID_Producto") REFERENCES "Productos" ("ID_Producto")
        ON DELETE RESTRICT;
    END IF;

    -- FK Variante_Producto -> Talla (ON DELETE RESTRICT)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_variante_talla'
    ) THEN
        ALTER TABLE "Variante_Producto"
        ADD CONSTRAINT "fk_variante_talla"
        FOREIGN KEY ("ID_Talla") REFERENCES "Talla" ("ID_Talla")
        ON DELETE RESTRICT;
    END IF;
END $$;

-- 2. Restricción de Unicidad Compuesta (UNIQUE CONSTRAINT)
-- Garantiza integridad estricta (cero cruces de datos): un producto base jamás
-- tendrá registros duplicados para la misma talla.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uq_variante_producto_talla'
    ) THEN
        ALTER TABLE "Variante_Producto"
        ADD CONSTRAINT "uq_variante_producto_talla"
        UNIQUE ("ID_Producto", "ID_Talla");
    END IF;
END $$;

-- 3. Función y Procedimiento de Migración Retroactiva
-- Busca variantes que usaban letras (ej: '10050M', '11S'), lee el ID numérico
-- de esa letra en Tipos_Talla y actualiza el código a formato 100% numérico.
CREATE OR REPLACE FUNCTION migrar_skus_alfanumericos_a_numericos()
RETURNS TABLE (
    id_variante_anterior TEXT,
    id_variante_nuevo NUMERIC,
    id_producto NUMERIC,
    nombre_talla TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    r RECORD;
    v_id_prod_num NUMERIC;
    v_letra_talla TEXT;
    v_id_tipo_talla NUMERIC;
    v_nuevo_sku NUMERIC;
BEGIN
    FOR r IN 
        SELECT 
            v."ID_Variante"::TEXT AS sku_antiguo,
            v."ID_Producto",
            v."ID_Talla",
            tt."ID_TipoTalla",
            tt."Nombre_TipoTalla"
        FROM "Variante_Producto" v
        LEFT JOIN "Talla" t ON v."ID_Talla" = t."ID_Talla"
        LEFT JOIN "Tipos_Talla" tt ON t."ID_TipoTalla" = tt."ID_TipoTalla"
        WHERE v."ID_Variante"::TEXT ~ '[A-Za-z]' -- Detecta SKUs que contienen letras
    LOOP
        -- Extraer parte numérica del producto base (ej: '10050' de '10050M')
        v_id_prod_num := NULLIF(regexp_replace(r.sku_antiguo, '[^0-9]', '', 'g'), '')::NUMERIC;
        IF v_id_prod_num IS NULL THEN
            v_id_prod_num := r."ID_Producto"::NUMERIC;
        END IF;

        -- Extraer la letra de la talla (ej: 'M' de '10050M')
        v_letra_talla := upper(regexp_replace(r.sku_antiguo, '[^a-zA-Z]', '', 'g'));

        -- Leer el id directamente de la tabla Tipos_Talla
        IF v_letra_talla <> '' THEN
            SELECT "ID_TipoTalla" INTO v_id_tipo_talla 
            FROM "Tipos_Talla" 
            WHERE upper("Nombre_TipoTalla") = v_letra_talla 
            LIMIT 1;
        ELSE
            v_id_tipo_talla := r."ID_TipoTalla";
        END IF;

        -- Fallback a ID_Talla si no se encuentra en Tipos_Talla
        IF v_id_tipo_talla IS NULL THEN
            v_id_tipo_talla := coalesce(r."ID_Talla"::NUMERIC, 1);
        END IF;

        -- Concatenar código numérico del Producto Base + ID numérico de la tabla de Tallas
        v_nuevo_sku := (v_id_prod_num::TEXT || v_id_tipo_talla::TEXT)::NUMERIC;

        -- Actualizar en cascada segura tablas relacionadas
        UPDATE "Inventario" 
        SET "ID_Variante" = v_nuevo_sku 
        WHERE "ID_Variante"::TEXT = r.sku_antiguo;

        UPDATE "Auditoria_Inventario" 
        SET "ID_Variante" = v_nuevo_sku 
        WHERE "ID_Variante"::TEXT = r.sku_antiguo;

        UPDATE "Detalle_Pedido" 
        SET "ID_Variante" = v_nuevo_sku 
        WHERE "ID_Variante"::TEXT = r.sku_antiguo;

        UPDATE "Variante_Producto" 
        SET "ID_Variante" = v_nuevo_sku 
        WHERE "ID_Variante"::TEXT = r.sku_antiguo;

        id_variante_anterior := r.sku_antiguo;
        id_variante_nuevo := v_nuevo_sku;
        id_producto := v_id_prod_num;
        nombre_talla := coalesce(r."Nombre_TipoTalla", v_letra_talla);
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Ejecutar la migración retroactiva
SELECT * FROM migrar_skus_alfanumericos_a_numericos();

