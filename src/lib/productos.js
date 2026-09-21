"use client";
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// IDs de las categorías raíz (Categorias_Producto.ID_CategoriaPadre = null)
// que agrupan todas las subcategorías de cada género.
export const ID_CATEGORIA_MUJER = 56;
export const ID_CATEGORIA_HOMBRE = 57;

const SELECT_PRODUCTO = `
  ID_Producto,
  Nombre_Producto,
  Descripcion,
  ID_EstadoProducto,
  ID_Categoria,
  Categorias_Producto ( ID_CategoriaPadre ),
  Fotos_Productos ( URL_Foto, Orden ),
  Variante_Producto ( ID_Variante, Precio_Actual, ID_EstadoProducto )
`;

// Convierte una fila de "Productos" (con sus relaciones) al formato plano
// {id, nombre, precio, imagen, idGenero} que usan las tarjetas del catálogo.
export function normalizarProducto(p) {
  const fotos = [...(p.Fotos_Productos ?? [])].sort((a, b) => (a.Orden ?? 0) - (b.Orden ?? 0));

  // Igual que en Inventario: sin dato, el producto/variante se considera activo (1).
  const variantesActivas = (p.Variante_Producto ?? []).filter((v) => (v.ID_EstadoProducto ?? 1) === 1);
  const precios = variantesActivas.map((v) => Number(v.Precio_Actual ?? 0)).filter((n) => n > 0);

  // Si la categoría del producto es una subcategoría (Vestidos, Camisas...), su
  // ID_CategoriaPadre es la raíz (Mujer/Hombre). Si el producto está clasificado
  // directo en la raíz, usamos su propio ID_Categoria.
  const idGenero = p.Categorias_Producto?.ID_CategoriaPadre ?? p.ID_Categoria ?? null;

  return {
    id: p.ID_Producto,
    nombre: p.Nombre_Producto,
    descripcion: p.Descripcion || '',
    // La imagen principal es la 4ta foto cargada (índice 3); si el producto
    // tiene menos de 4 fotos, se usa la primera como respaldo.
    imagen: fotos[3]?.URL_Foto ?? fotos[0]?.URL_Foto ?? null,
    fotos: fotos.map((f) => f.URL_Foto),
    precio: precios.length > 0 ? Math.min(...precios) : 0,
    idGenero,
  };
}

// Carga el catálogo de productos activos desde Supabase para las páginas de cliente.
// Con idGenero (ID_CATEGORIA_MUJER / ID_CATEGORIA_HOMBRE) filtra solo ese género.
export function useProductosCatalogo(idGenero) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      const { data, error } = await supabase
        .from('Productos')
        .select(SELECT_PRODUCTO);

      if (!activo) return;

      if (error) {
        console.error('Error cargando productos:', error.message);
        setProductos([]);
      } else {
        const productosActivos = (data ?? []).filter((p) => (p.ID_EstadoProducto ?? 1) === 1);
        const normalizados = productosActivos.map(normalizarProducto);
        const filtrados = idGenero == null
          ? normalizados
          : normalizados.filter((p) => p.idGenero === idGenero);
        setProductos(filtrados);
      }
      setCargando(false);
    }

    cargar();
    return () => { activo = false; };
  }, [idGenero]);

  return { productos, cargando };
}

// Carga un único producto (para la página de detalle /prenda-pag/[id]).
export function useProducto(idProducto) {
  const [producto, setProducto] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      if (!idProducto) {
        setProducto(null);
        setCargando(false);
        return;
      }

      setCargando(true);

      const { data, error } = await supabase
        .from('Productos')
        .select(SELECT_PRODUCTO)
        .eq('ID_Producto', idProducto)
        .maybeSingle();

      if (!activo) return;

      if (error || !data) {
        if (error) console.error('Error cargando producto:', error.message);
        setProducto(null);
      } else {
        setProducto(normalizarProducto(data));
      }
      setCargando(false);
    }

    cargar();
    return () => { activo = false; };
  }, [idProducto]);

  return { producto, cargando };
}

// Convierte una fila de "Variante_Producto" (con Talla/Tipos_Talla e Inventario
// embebidos) en {idVariante, nombre, precio, stock, disponible} para los
// botones de talla y para agregar la variante elegida al carrito.
function normalizarTalla(v) {
  const nombre = v.Talla?.Tipos_Talla?.Nombre_TipoTalla?.trim();
  // Igual que en el resto del catálogo: sin dato, la variante se considera activa.
  const activa = (v.ID_EstadoProducto ?? 1) === 1;
  const stock = (v.Inventario ?? []).reduce(
    (total, inv) => total + (inv.Cantidad_Disponible ?? 0) - (inv.Cantidad_Reservada ?? 0),
    0
  );

  return {
    idVariante: v.ID_Variante,
    nombre,
    precio: Number(v.Precio_Actual ?? 0),
    stock,
    disponible: activa && stock > 0,
  };
}

// Carga las tallas en las que existe el producto (una por variante) y si cada
// una tiene stock disponible, para la página de detalle /prenda-pag/[id].
export function useTallasProducto(idProducto) {
  const [tallas, setTallas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      if (!idProducto) {
        setTallas([]);
        setCargando(false);
        return;
      }

      setCargando(true);

      const { data, error } = await supabase
        .from('Variante_Producto')
        .select(`
          ID_Variante,
          ID_EstadoProducto,
          Precio_Actual,
          Talla ( Tipos_Talla ( Nombre_TipoTalla ) ),
          Inventario ( Cantidad_Disponible, Cantidad_Reservada )
        `)
        .eq('ID_Producto', idProducto);

      if (!activo) return;

      if (error) {
        console.error('Error cargando tallas:', error.message);
        setTallas([]);
      } else {
        // Descarta variantes con datos de talla rotos/incompletos (sin nombre).
        setTallas((data ?? []).map(normalizarTalla).filter((t) => t.nombre));
      }
      setCargando(false);
    }

    cargar();
    return () => { activo = false; };
  }, [idProducto]);

  return { tallas, cargando };
}
