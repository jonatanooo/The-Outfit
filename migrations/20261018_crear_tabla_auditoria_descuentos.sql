-- ====================================================================
-- MIGRACIÓN: Tabla de Auditoría de Descuentos y Ofertas
-- Proyecto: The Outfit E-Commerce
-- Descripción: Registra cada aplicación, actualización o eliminación de
--              ofertas y descuentos en productos con trazabilidad completa.
-- ====================================================================

CREATE TABLE IF NOT EXISTS "Auditoria_Descuentos" (
    "ID_AuditoriaDescuento" BIGSERIAL PRIMARY KEY,
    "ID_Producto" VARCHAR(100) NOT NULL,
    "ID_Variante" VARCHAR(100),
    "Nombre_Producto" VARCHAR(255),
    "ID_User" VARCHAR(100) NOT NULL,
    "Usuario" VARCHAR(255),
    "Correo" VARCHAR(255),
    "Fecha_Cambio" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Estado anterior
    "Precio_Original" NUMERIC(10, 2) DEFAULT 0,
    "Descuento_Anterior" NUMERIC(5, 2) DEFAULT 0,
    "Fecha_Inicio_Anterior" TIMESTAMP WITH TIME ZONE,
    "Fecha_Fin_Anterior" TIMESTAMP WITH TIME ZONE,
    
    -- Nuevo estado
    "Porcentaje_Descuento" NUMERIC(5, 2) NOT NULL,
    "Precio_Con_Descuento" NUMERIC(10, 2) NOT NULL,
    "Fecha_Inicio_Oferta" TIMESTAMP WITH TIME ZONE,
    "Fecha_Fin_Oferta" TIMESTAMP WITH TIME ZONE,
    "Vigente" BOOLEAN DEFAULT TRUE,
    "Detalle" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_auditoria_descuentos_prod" ON "Auditoria_Descuentos" ("ID_Producto");
CREATE INDEX IF NOT EXISTS "idx_auditoria_descuentos_fecha" ON "Auditoria_Descuentos" ("Fecha_Cambio" DESC);
CREATE INDEX IF NOT EXISTS "idx_auditoria_descuentos_user" ON "Auditoria_Descuentos" ("ID_User");

