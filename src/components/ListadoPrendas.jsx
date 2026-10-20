"use client"
import Link from "next/link";
// importamos libreria de animaciones
import { useState, useEffect } from "react"
import { motion } from "motion/react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import { useFavoritos } from "@/lib/useFavoritos";
import { esOfertaActiva, calcularPrecioConDescuento } from "@/lib/descuentos";
import "./ListadoPrendas.css";

async function buscarProductosFiltrados(filtros = {}, idCategoriaPadre = null, soloOfertas = false) {
  try {
    const [
      prodSnap,
      varSnap,
      catSnap,
      marcasSnap,
      fotosSnap,
      tallaSnap,
      tiposTallaSnap,
      coloresSnap
    ] = await Promise.all([
      getDocs(collection(db, "Productos")),
      getDocs(collection(db, "Variante_Producto")),
      getDocs(collection(db, "Categorias_Producto")),
      getDocs(collection(db, "Marca")),
      getDocs(collection(db, "Fotos_Productos")),
      getDocs(collection(db, "Talla")),
      getDocs(collection(db, "Tipos_Talla")),
      getDocs(collection(db, "Colores"))
    ]);

    // 1. Indexar Tipos_Talla y Colores
    const tiposTallaMap = {};
    tiposTallaSnap.docs.forEach((d) => {
      const data = d.data();
      const id = data.ID_TipoTalla ?? d.id;
      tiposTallaMap[id] = data;
      tiposTallaMap[String(id)] = data;
    });

    const tallaMap = {};
    tallaSnap.docs.forEach((d) => {
      const data = d.data();
      const id = data.ID_Talla ?? d.id;
      const tipo = tiposTallaMap[data.ID_TipoTalla] || null;
      const item = { ...data, ID_Talla: id, Tipos_Talla: tipo };
      tallaMap[id] = item;
      tallaMap[String(id)] = item;
    });

    const coloresMap = {};
    coloresSnap.docs.forEach((d) => {
      const data = d.data();
      const id = data.ID_Color ?? d.id;
      coloresMap[id] = data;
      coloresMap[String(id)] = data;
    });

    // 2. Indexar Categorias y Marcas
    const catMap = {};
    catSnap.docs.forEach((d) => {
      const data = d.data();
      const id = data.ID_categoria ?? data.ID_Categoria ?? d.id;
      const item = { ...data, ID_categoria: id, ID_Categoria: id };
      catMap[id] = item;
      catMap[String(id)] = item;
    });

    const marcasMap = {};
    marcasSnap.docs.forEach((d) => {
      const data = d.data();
      const id = data.ID_Marca ?? d.id;
      marcasMap[id] = data;
      marcasMap[String(id)] = data;
    });

    // 3. Indexar Fotos por Producto
    const fotosPorProducto = {};
    fotosSnap.docs.forEach((d) => {
      const f = d.data();
      const pid = f.ID_Producto;
      if (pid != null) {
        if (!fotosPorProducto[pid]) fotosPorProducto[pid] = [];
        fotosPorProducto[pid].push(f);
        if (!fotosPorProducto[String(pid)]) fotosPorProducto[String(pid)] = fotosPorProducto[pid];
      }
    });

    // 4. Indexar Variantes por Producto ensamblando Talla y Color
    const variantesPorProducto = {};
    varSnap.docs.forEach((d) => {
      const v = d.data();
      const pid = v.ID_Producto;
      if (pid != null) {
        const varianteEnsamblada = {
          ...v,
          ID_Variante: v.ID_Variante ?? d.id,
          Precio_Actual: Number(v.Precio_Actual ?? 0),
          Talla: tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || null,
          Colores: coloresMap[v.ID_Color] || coloresMap[String(v.ID_Color)] || null
        };
        if (!variantesPorProducto[pid]) variantesPorProducto[pid] = [];
        variantesPorProducto[pid].push(varianteEnsamblada);
        if (!variantesPorProducto[String(pid)]) variantesPorProducto[String(pid)] = variantesPorProducto[pid];
      }
    });

    // 5. Filtros activos
    const filtroCategorias = filtros.Categorias?.length > 0 ? filtros.Categorias : null;
    const filtroColores = filtros.Colores?.length > 0 ? filtros.Colores : null;
    const filtroTallas = filtros.Tallas?.length > 0 ? filtros.Tallas : null;

    const vistos = new Map();

    for (const d of prodSnap.docs) {
      const p = d.data();
      const pid = p.ID_Producto ?? d.id;
      const estado = Number(p.ID_EstadoProducto ?? 1);
      if (estado === 2) continue; // Inactivo

      const categoria = catMap[p.ID_Categoria ?? p.ID_categoria] || null;

      // Filtro de género / ID_CategoriaPadre
      if (idCategoriaPadre != null) {
        const idGenero = categoria?.ID_CategoriaPadre ?? p.ID_Categoria ?? p.ID_categoria ?? null;
        if (String(idGenero) !== String(idCategoriaPadre)) continue;
      }

      // Filtro por nombre de categoría
      if (filtroCategorias) {
        const nombreCat = categoria?.Nombre_Categoria;
        if (!nombreCat || !filtroCategorias.includes(nombreCat)) continue;
      }

      // Obtener variantes del producto
      const vars = variantesPorProducto[pid] || variantesPorProducto[String(pid)] || [];

      // Filtro por variantes (colores o tallas)
      let variantesCoincidentes = vars;
      if (filtroColores) {
        variantesCoincidentes = variantesCoincidentes.filter((v) =>
          filtroColores.includes(v.Colores?.Nombre_Color)
        );
      }
      if (filtroTallas) {
        variantesCoincidentes = variantesCoincidentes.filter((v) =>
          filtroTallas.includes(v.Talla?.Tipos_Talla?.Nombre_TipoTalla)
        );
      }

      // Si había filtro de color o talla y ninguna variante cumplió, se descarta el producto
      if ((filtroColores || filtroTallas) && variantesCoincidentes.length === 0) {
        continue;
      }

      const precios = (vars.length > 0 ? vars : []).map((v) => v.Precio_Actual).filter((n) => n > 0);
      const fotos = [...(fotosPorProducto[pid] || fotosPorProducto[String(pid)] || [])].sort(
        (a, b) => (Number(a.Orden) ?? 0) - (Number(b.Orden) ?? 0)
      );

      const marcaObj = marcasMap[p.ID_Marca] || null;

      const ofertaProd = esOfertaActiva(p);
      const algunaVarOferta = vars.some((v) => esOfertaActiva(v));
      const enOferta = ofertaProd || algunaVarOferta;

      if (soloOfertas && !enOferta) {
        continue;
      }

      const porcentaje = Number(
        p.Porcentaje_Descuento ??
        p.porcentajeDescuento ??
        (vars.find((v) => esOfertaActiva(v))?.Porcentaje_Descuento) ??
        0
      );

      const precioBase = precios.length ? Math.min(...precios) : (Number(p.Precio ?? 0) || 0);
      const precioFinal = enOferta ? calcularPrecioConDescuento(precioBase, porcentaje) : precioBase;

      vistos.set(pid, {
        id: pid,
        nombre: p.Nombre_Producto || "",
        marca: (marcaObj?.Nombre_Marca && String(marcaObj.Nombre_Marca).trim()) ? String(marcaObj.Nombre_Marca).trim() : "The Outfit",
        precio: precioFinal,
        precioOriginal: precioBase,
        enOferta,
        porcentajeDescuento: enOferta ? porcentaje : 0,
        imagen: fotos[3]?.URL_Foto ?? fotos[0]?.URL_Foto ?? "/Fotos/placeholder.jpg",
      });
    }

    let resultado = Array.from(vistos.values());

    const orden = filtros["Ordenar Por"]?.[0];
    if (orden === "Precio: menor a mayor") resultado.sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0));
    if (orden === "Precio: mayor a menor") resultado.sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0));

    return resultado;
  } catch (error) {
    console.error("Error buscando productos filtrados en Firestore:", error);
    return [];
  }
}

// funcion que carga el listado de productos reales desde Firestore, filtrado
function ListadoPrendas({ filtros, onResultados, idCategoriaPadre, soloOfertas = false }) {
  const [prendas, setPrendas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { esFavorito, alternarFavorito } = useFavoritos();

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      const data = await buscarProductosFiltrados(filtros, idCategoriaPadre, soloOfertas);
      if (!activo) return;
      setPrendas(data);
      setCargando(false);
      onResultados?.(data.length);
    }

    cargar();
    return () => { activo = false; };
  }, [filtros, idCategoriaPadre, soloOfertas]);

  if (cargando) {
    return (
      <div className="seccion-listado">
        <p>Cargando productos...</p>
      </div>
    );
  }

  if (prendas.length === 0) {
    return (
      <div className="seccion-listado">
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#666" }}>
          <h2>{soloOfertas ? "De momento no hay prendas en oferta" : "De momento no hay prendas disponibles"}</h2>
          <p style={{ marginTop: "10px" }}>
            {soloOfertas
              ? "Pronto publicaremos nuevas promociones y descuentos exclusivos. ¡Vuelve a consultar más adelante!"
              : "Intenta buscar otra subcategoría o quitar algunos filtros."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="seccion-listado">
      <div className="listado-grid">
        {/* con el .map() recorre las prendas visibles y genera una card por cada una, usando sus propios datos, lo cual evita que tengamos que escribir una por una a mano */}
        {prendas.map((prenda) => (
          // el key={prenda.id} es obligatoria en cualquier .map() que genere JSX en React, ya que le da a cada elemento una identidad unica para que Reatc pueda rastrear cual es cual si la lista cambia
          // el Link manda a la pagina propia de la prenda; el boton de favorito frena la propagacion para no navegar al tocarlo
          <Link href={`/prenda-pag/${prenda.id}`} className="card-link" key={prenda.id}>
            <div className="prenda-card">
              <div className="prenda-imagen-wrap">
                {prenda.enOferta && (
                  <span className="badge-oferta-card">
                    -{prenda.porcentajeDescuento}%
                  </span>
                )}
                <button
                  type="button"
                  className="btn-favorito"
                  aria-label={esFavorito(prenda.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    alternarFavorito(prenda.id);
                  }}
                >
                  <img
                    src={esFavorito(prenda.id) ? "/ICONOS/Heart2.png" : "/ICONOS/Heart.png"}
                    alt="like"
                    className="favicon"
                  />
                </button>
                {prenda.imagen ? (
                  <motion.img whileHover={{ scale: 1.2 }} src={prenda.imagen} alt={prenda.nombre} className="prenda-imagen" />
                ) : (
                  <div className="prenda-imagen prenda-sin-imagen" />
                )}
              </div>

              <div className="prenda-info">
                <div>
                  <p className="prenda-nombre">{prenda.nombre}</p>
                  <p className="prenda-marca">{prenda.marca || 'The Outfit'}</p>
                  {prenda.enOferta ? (
                    <div className="prenda-precios-oferta">
                      <span className="prenda-precio-original-tachado">
                        ${prenda.precioOriginal != null ? Number(prenda.precioOriginal).toFixed(2) : ''}
                      </span>
                      <span className="prenda-precio-oferta">
                        ${Number(prenda.precio).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <p className="prenda-precio">${Number(prenda.precio).toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default ListadoPrendas
