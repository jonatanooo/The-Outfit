/**
 * Utilidades para el cálculo y validación de ofertas y descuentos en The Outfit.
 */

/**
 * Determina si una oferta/descuento se considera VIGENTE en el sistema:
 * Regla estricta: Cumple ambas condiciones:
 * 1. Su estado Activo es 1 (o true) / Tiene_Descuento === true.
 * 2. Su Fecha_Fin existe y es mayor a la fecha y hora actual (new Date()).
 * @param {Object} item - Objeto de producto o variante.
 * @returns {boolean} True únicamente si la oferta sigue vigente y no ha expirado.
 */
export function esOfertaVigente(item) {
  if (!item) return false;

  const porcentaje = Number(
    item.Porcentaje_Descuento ??
    item.porcentajeDescuento ??
    item.porcentaje ??
    item.Productos?.Porcentaje_Descuento ??
    0
  );

  if (isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
    return false;
  }

  // Condición 1: El estado Activo debe ser 1 (o true). Si es 0 o false o Tiene_Descuento es false -> NO vigente
  const rawActivo = item.Activo ?? item.activo ?? item.Tiene_Descuento ?? item.tieneDescuento ?? item.Productos?.Activo ?? item.Productos?.Tiene_Descuento;
  const esActivo = rawActivo === 1 || rawActivo === true || rawActivo === '1';
  if (!esActivo) {
    return false;
  }

  // Condición 2: Fecha_Fin debe existir y ser mayor a la fecha y hora actual (new Date())
  const fechaFin = item.Fecha_Fin_Oferta ?? item.Fecha_Fin ?? item.fechaFinOferta ?? item.Productos?.Fecha_Fin_Oferta ?? null;
  if (!fechaFin) {
    return false;
  }

  const tFin = new Date(fechaFin).getTime();
  if (isNaN(tFin) || tFin <= Date.now()) {
    return false; // Ya venció / expiró
  }

  return true;
}

/**
 * Determina si un producto o variante tiene una oferta activa y lista para aplicar en catálogo / carrito.
 * Requiere que la oferta sea vigente Y que ya haya iniciado según su Fecha_Inicio (si se especificó).
 * @param {Object} item - Objeto de producto o variante con campos de descuento y fechas.
 * @returns {boolean} True si el descuento está activo y vigente en la fecha actual.
 */
export function esOfertaActiva(item) {
  if (!esOfertaVigente(item)) return false;

  const ahora = Date.now();
  const fechaInicio = item.Fecha_Inicio_Oferta ?? item.Fecha_Inicio ?? item.fechaInicioOferta ?? item.Productos?.Fecha_Inicio_Oferta ?? null;

  if (fechaInicio) {
    const tInicio = new Date(fechaInicio).getTime();
    // Margen de 1 minuto para tolerar pequeñas discrepancias de reloj cliente/servidor
    if (!isNaN(tInicio) && (ahora + 60000) < tInicio) {
      return false; // Aún no ha iniciado
    }
  }

  return true;
}

/**
 * Calcula el precio final con descuento aplicado.
 * @param {number} precioOriginal - Precio base del producto.
 * @param {number} porcentaje - Porcentaje entre 0 y 100.
 * @returns {number} Precio redondeado a 2 decimales.
 */
export function calcularPrecioConDescuento(precioOriginal, porcentaje) {
  const pBase = Number(precioOriginal ?? 0);
  const desc = Number(porcentaje ?? 0);
  if (isNaN(pBase) || pBase <= 0) return 0;
  if (isNaN(desc) || desc <= 0) return pBase;
  const precioFinal = pBase * (1 - Math.min(desc, 100) / 100);
  return Math.round(precioFinal * 100) / 100;
}

/**
 * Obtiene el objeto detallado de descuento para un item (producto o variante).
 * @param {Object} item - Producto o variante con precio y datos de oferta.
 * @returns {Object} { activo, porcentaje, precioOriginal, precioFinal, ahorro, fechaInicio, fechaFin }
 */
export function obtenerDetalleDescuento(item) {
  if (!item) {
    return {
      activo: false,
      porcentaje: 0,
      precioOriginal: 0,
      precioFinal: 0,
      ahorro: 0,
      fechaInicio: null,
      fechaFin: null
    };
  }

  const precioOriginal = Number(
    item.precio ??
    item.Precio_Actual ??
    item.Precio ??
    0
  );

  const porcentaje = Number(
    item.Porcentaje_Descuento ??
    item.porcentajeDescuento ??
    item.porcentaje ??
    item.Productos?.Porcentaje_Descuento ??
    0
  );

  const fechaInicio = item.Fecha_Inicio_Oferta ?? item.fechaInicioOferta ?? item.Productos?.Fecha_Inicio_Oferta ?? null;
  const fechaFin = item.Fecha_Fin_Oferta ?? item.fechaFinOferta ?? item.Productos?.Fecha_Fin_Oferta ?? null;

  const activo = esOfertaActiva(item);
  const precioFinal = activo ? calcularPrecioConDescuento(precioOriginal, porcentaje) : precioOriginal;
  const ahorro = activo ? Math.round((precioOriginal - precioFinal) * 100) / 100 : 0;

  return {
    activo,
    porcentaje: activo ? porcentaje : 0,
    precioOriginal,
    precioFinal,
    ahorro,
    fechaInicio,
    fechaFin
  };
}

