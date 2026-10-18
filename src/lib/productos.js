"use client";
import { useEffect, useState } from 'react';
import { db } from './firebaseClient';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from 'firebase/firestore';
import { esOfertaActiva, calcularPrecioConDescuento } from './descuentos';

// IDs de las categorías raíz (Categorias_Producto.ID_CategoriaPadre = null)
// que agrupan todas las subcategorías de cada género.
export const ID_CATEGORIA_MUJER = 56;
export const ID_CATEGORIA_HOMBRE = 57;

// Convierte un objeto de "Productos" (con sus relaciones ensambladas) al formato plano
// {id, nombre, marca, descripcion, imagen, fotos, precio, idGenero, enOferta, precioOriginal, precioFinal, porcentajeDescuento} que usan las tarjetas del catálogo.
export function normalizarProducto(p) {
  const fotos = [...(p.Fotos_Productos ?? [])].sort((a, b) => (Number(a.Orden) ?? 0) - (Number(b.Orden) ?? 0));

  // Sin dato, el producto/variante se considera activo (1).
  const variantesActivas = (p.Variante_Producto ?? []).filter((v) => {
    const estadoVar = v.ID_EstadoProducto != null ? Number(v.ID_EstadoProducto) : 1;
    return estadoVar === 1;
  });
  const precios = variantesActivas.map((v) => Number(v.Precio_Actual ?? 0)).filter((n) => n > 0);

  // Si la categoría del producto es una subcategoría (Vestidos, Camisas...), su
  // ID_CategoriaPadre es la raíz (Mujer/Hombre). Si el producto está clasificado
  // directo en la raíz, usamos su propio ID_Categoria.
  const cat = p.Categorias_Producto || {};
  const catPadre = cat.ID_CategoriaPadre ?? cat.ID_categoriapadre;
  const catPropio = cat.ID_Categoria ?? cat.ID_categoria ?? p.ID_Categoria ?? p.ID_categoria;
  const idGenero = Number(catPadre ?? catPropio ?? null);

  const precioBase = precios.length > 0 ? Math.min(...precios) : (Number(p.Precio ?? p.Precio_Actual ?? 0) || 0);
  
  // Calcular si tiene oferta activa (en producto o en alguna de sus variantes)
  const ofertaProducto = esOfertaActiva(p);
  const algunaVarEnOferta = variantesActivas.some((v) => esOfertaActiva(v));
  const enOferta = ofertaProducto || algunaVarEnOferta;
  
  const porcentaje = Number(
    p.Porcentaje_Descuento ??
    p.porcentajeDescuento ??
    (variantesActivas.find((v) => esOfertaActiva(v))?.Porcentaje_Descuento) ??
    0
  );

  const precioFinal = enOferta ? calcularPrecioConDescuento(precioBase, porcentaje) : precioBase;

  return {
    id: p.ID_Producto ?? p.id,
    nombre: p.Nombre_Producto || '',
    marca: (p.Marca?.Nombre_Marca && String(p.Marca.Nombre_Marca).trim()) ? String(p.Marca.Nombre_Marca).trim() : 'The Outfit',
    descripcion: p.Descripcion || '',
    // La imagen principal es la 5ta foto (índice 4) o la primera como respaldo.
    imagen: fotos[4]?.URL_Foto ?? fotos[0]?.URL_Foto ?? null,
    fotos: fotos.map((f) => f.URL_Foto).filter(Boolean),
    precio: precioFinal,
    precioOriginal: precioBase,
    precioFinal,
    enOferta,
    porcentajeDescuento: enOferta ? porcentaje : 0,
    fechaInicioOferta: p.Fecha_Inicio_Oferta ?? null,
    fechaFinOferta: p.Fecha_Fin_Oferta ?? null,
    idGenero,
  };
}

// Carga el catálogo de productos activos desde Firestore para las páginas de cliente.
// Con idGenero (ID_CATEGORIA_MUJER / ID_CATEGORIA_HOMBRE) filtra solo ese género.
// Con soloOfertas = true filtra exclusivamente productos con oferta vigente.
export function useProductosCatalogo(idGenero, soloOfertas = false) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        // En Firestore ejecutamos las consultas a las colecciones relacionadas en paralelo
        const [
          prodSnap,
          fotosSnap,
          varSnap,
          marcasSnap,
          catSnap
        ] = await Promise.all([
          getDocs(collection(db, 'Productos')),
          getDocs(collection(db, 'Fotos_Productos')),
          getDocs(collection(db, 'Variante_Producto')),
          getDocs(collection(db, 'Marca')),
          getDocs(collection(db, 'Categorias_Producto'))
        ]);

        if (!activo) return;

        // 1. Indexar tablas de búsqueda rápida (Marca y Categorías)
        const marcasMap = {};
        marcasSnap.docs.forEach((d) => {
          const m = d.data();
          const id = m.ID_Marca ?? d.id;
          marcasMap[id] = m;
          marcasMap[String(id)] = m;
        });

        const catMap = {};
        catSnap.docs.forEach((d) => {
          const c = d.data();
          const id = c.ID_Categoria ?? c.ID_categoria ?? d.id;
          catMap[id] = c;
          catMap[String(id)] = c;
        });

        // 2. Agrupar fotos por ID_Producto
        const fotosPorProducto = {};
        fotosSnap.docs.forEach((d) => {
          const f = d.data();
          const pid = f.ID_Producto;
          if (pid != null) {
            const k = String(pid);
            if (!fotosPorProducto[k]) fotosPorProducto[k] = [];
            fotosPorProducto[k].push(f);
          }
        });

        // 3. Agrupar variantes por ID_Producto
        const variantesPorProducto = {};
        varSnap.docs.forEach((d) => {
          const v = d.data();
          const pid = v.ID_Producto;
          if (pid != null) {
            const k = String(pid);
            if (!variantesPorProducto[k]) variantesPorProducto[k] = [];
            variantesPorProducto[k].push(v);
          }
        });

        // 4. Filtrar productos activos y ensamblar relaciones NoSQL
        const productosActivos = prodSnap.docs
          .map((d) => {
            const data = d.data();
            const pid = data.ID_Producto ?? d.id;
            const k1 = String(pid);
            const k2 = data.ID_Producto != null ? String(data.ID_Producto) : null;
            const k3 = String(d.id);
            const fList = fotosPorProducto[k1] || (k2 ? fotosPorProducto[k2] : null) || fotosPorProducto[k3] || [];
            const vList = variantesPorProducto[k1] || (k2 ? variantesPorProducto[k2] : null) || variantesPorProducto[k3] || [];
            return {
              ...data,
              ID_Producto: pid,
              Fotos_Productos: fList,
              Variante_Producto: vList,
              Marca: marcasMap[data.ID_Marca] || null,
              Categorias_Producto: catMap[data.ID_Categoria ?? data.ID_categoria] || null,
            };
          })
          .filter((p) => {
            const estado = p.ID_EstadoProducto != null ? Number(p.ID_EstadoProducto) : 1;
            return estado === 1;
          });

        // 5. Normalizar productos y aplicar filtro de género u ofertas si aplica
        const normalizados = productosActivos.map(normalizarProducto);
        let filtrados = normalizados;

        if (soloOfertas) {
          filtrados = filtrados.filter((p) => p.enOferta);
        }

        if (idGenero != null) {
          filtrados = filtrados.filter((p) => p.idGenero === Number(idGenero));
        }

        setProductos(filtrados);
      } catch (error) {
        console.error('Error cargando catálogo desde Firestore:', error);
        if (activo) setProductos([]);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => { activo = false; };
  }, [idGenero, soloOfertas]);

  return { productos, cargando };
}

// Carga un único producto (para la página de detalle /prenda-pag/[id]).
export function useProducto(idProducto) {
  const [producto, setProducto] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      if (idProducto == null || idProducto === '' || Number.isNaN(idProducto)) {
        setProducto(null);
        setCargando(false);
        return;
      }

      setCargando(true);

      try {
        const numId = Number(idProducto);
        const searchIds = Array.from(new Set([
          idProducto,
          String(idProducto),
          !isNaN(numId) ? numId : null
        ].filter(v => v !== null && v !== undefined && v !== '')));

        // 1. Buscar documento de producto (por docId directo o campo ID_Producto)
        let prodData = null;
        const docRef = doc(db, 'Productos', String(idProducto));
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          prodData = { ...docSnap.data(), ID_Producto: docSnap.data().ID_Producto ?? docSnap.id };
        } else {
          const qProd = query(
            collection(db, 'Productos'),
            where('ID_Producto', 'in', searchIds)
          );
          const qSnap = await getDocs(qProd);
          if (!qSnap.empty) {
            prodData = { ...qSnap.docs[0].data(), ID_Producto: qSnap.docs[0].data().ID_Producto ?? qSnap.docs[0].id };
          }
        }

        if (!prodData || !activo) {
          setProducto(null);
          return;
        }

        const pid = prodData.ID_Producto ?? prodData.id;
        const pidValues = Array.from(new Set([
          pid,
          String(pid),
          !isNaN(Number(pid)) ? Number(pid) : null
        ].filter(v => v !== null && v !== undefined && v !== '')));

        // 2. Traer en paralelo sus fotos, variantes, marca y categoría
        const catId = prodData.ID_Categoria ?? prodData.ID_categoria;
        const marcaId = prodData.ID_Marca ?? prodData.ID_marca;

        const [fotosSnap, varSnap, marcaSnap, catSnap] = await Promise.all([
          getDocs(query(collection(db, 'Fotos_Productos'), where('ID_Producto', 'in', pidValues))),
          getDocs(query(collection(db, 'Variante_Producto'), where('ID_Producto', 'in', pidValues))),
          marcaId ? getDoc(doc(db, 'Marca', String(marcaId))).catch(() => null) : null,
          catId ? getDoc(doc(db, 'Categorias_Producto', String(catId))).catch(() => null) : null
        ]);

        if (!activo) return;

        const fotos = fotosSnap ? fotosSnap.docs.map((d) => d.data()) : [];
        const variantes = varSnap ? varSnap.docs.map((d) => d.data()) : [];
        const marca = marcaSnap && marcaSnap.exists() ? marcaSnap.data() : null;
        const categoria = catSnap && catSnap.exists() ? catSnap.data() : null;

        const productoCompleto = {
          ...prodData,
          Fotos_Productos: fotos,
          Variante_Producto: variantes,
          Marca: marca,
          Categorias_Producto: categoria,
        };

        setProducto(normalizarProducto(productoCompleto));
      } catch (error) {
        console.error('Error cargando producto desde Firestore:', error);
        if (activo) setProducto(null);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => { activo = false; };
  }, [idProducto]);

  return { producto, cargando };
}

// Convierte una fila de "Variante_Producto" (con Talla/Tipos_Talla e Inventario)
// en {idVariante, nombre, precio, stock, disponible} para los botones de talla y carrito.
function normalizarTalla(v, tallaMap = {}, tiposTallaMap = {}, inventarioMap = {}, prodData = null) {
  const tallaDoc = tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || {};
  const idTipoTalla = tallaDoc.ID_TipoTalla ?? tallaDoc.ID_tipoTalla ?? v.ID_TipoTalla;
  const tipoTallaDoc = tiposTallaMap[idTipoTalla] || tiposTallaMap[String(idTipoTalla)] || {};
  const nombre = (tipoTallaDoc.Nombre_TipoTalla || tallaDoc.Nombre_Talla || tipoTallaDoc.Nombre_Talla || 'Única').trim();

  // Sin dato, la variante se considera activa.
  const idEstado = v.ID_EstadoProducto != null ? Number(v.ID_EstadoProducto) : 1;
  const activa = idEstado === 1;

  const invList = inventarioMap[v.ID_Variante] || inventarioMap[String(v.ID_Variante)] || [];
  const stock = invList.reduce(
    (total, inv) => total + (Number(inv.Cantidad_Disponible) ?? 0) - (Number(inv.Cantidad_Reservada) ?? 0),
    0
  );

  // La oferta aplica a toda talla: se verifica en la variante o en el producto padre
  const enOferta = esOfertaActiva(v) || esOfertaActiva(prodData);
  const porcentaje = Number(
    v.Porcentaje_Descuento ||
    prodData?.Porcentaje_Descuento ||
    0
  );
  const precioBase = Number(v.Precio_Actual ?? prodData?.Precio ?? 0);
  const precioFinal = enOferta ? calcularPrecioConDescuento(precioBase, porcentaje) : precioBase;

  return {
    idVariante: v.ID_Variante,
    nombre,
    precio: precioFinal,
    precioOriginal: precioBase,
    enOferta,
    porcentajeDescuento: enOferta ? porcentaje : 0,
    stock,
    disponible: activa && (stock > 0 || invList.length === 0),
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
      if (idProducto == null || idProducto === '' || Number.isNaN(idProducto)) {
        setTallas([]);
        setCargando(false);
        return;
      }

      setCargando(true);

      try {
        const numId = Number(idProducto);
        const searchIds = Array.from(new Set([
          idProducto,
          String(idProducto),
          !isNaN(numId) ? numId : null
        ].filter(v => v !== null && v !== undefined && v !== '')));

        // 1. Obtener las variantes del producto
        const varSnap = await getDocs(
          query(
            collection(db, 'Variante_Producto'),
            where('ID_Producto', 'in', searchIds)
          )
        );

        if (!activo) return;

        const variantes = varSnap.docs.map((d) => ({
          ...d.data(),
          ID_Variante: d.data().ID_Variante ?? d.id
        }));
        if (variantes.length === 0) {
          setTallas([]);
          return;
        }

        // 2. Cargar en paralelo tablas de Talla, Tipos_Talla e Inventario, y el Producto padre para heredar descuentos
        let prodData = null;
        const docRef = doc(db, 'Productos', String(idProducto));
        const [docSnap, tallaSnap, tiposTallaSnap, invSnap] = await Promise.all([
          getDoc(docRef).catch(() => null),
          getDocs(collection(db, 'Talla')),
          getDocs(collection(db, 'Tipos_Talla')),
          getDocs(collection(db, 'Inventario'))
        ]);

        if (docSnap && docSnap.exists()) {
          prodData = { ...docSnap.data(), ID_Producto: docSnap.data().ID_Producto ?? docSnap.id };
        } else {
          const qProd = query(collection(db, 'Productos'), where('ID_Producto', 'in', searchIds));
          const qSnap = await getDocs(qProd);
          if (!qSnap.empty) {
            prodData = { ...qSnap.docs[0].data(), ID_Producto: qSnap.docs[0].data().ID_Producto ?? qSnap.docs[0].id };
          }
        }

        if (!activo) return;

        // Mapear Tallas y Tipos_Talla
        const tallaMap = {};
        tallaSnap.docs.forEach((d) => {
          const t = d.data();
          const id = t.ID_Talla ?? d.id;
          tallaMap[id] = t;
          tallaMap[String(id)] = t;
        });

        const tiposTallaMap = {};
        tiposTallaSnap.docs.forEach((d) => {
          const tt = d.data();
          const id = tt.ID_TipoTalla ?? d.id;
          tiposTallaMap[id] = tt;
          tiposTallaMap[String(id)] = tt;
        });

        // Mapear Inventario por ID_Variante
        const inventarioMap = {};
        invSnap.docs.forEach((d) => {
          const inv = d.data();
          const vid = inv.ID_Variante;
          if (vid != null) {
            if (!inventarioMap[vid]) inventarioMap[vid] = [];
            inventarioMap[vid].push(inv);
            if (!inventarioMap[String(vid)]) inventarioMap[String(vid)] = inventarioMap[vid];
          }
        });

        const tallasNormalizadas = variantes
          .map((v) => normalizarTalla(v, tallaMap, tiposTallaMap, inventarioMap, prodData))
          .filter((t) => t.nombre);

        setTallas(tallasNormalizadas);
      } catch (error) {
        console.error('Error cargando tallas desde Firestore:', error);
        if (activo) setTallas([]);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => { activo = false; };
  }, [idProducto]);

  return { tallas, cargando };
}
