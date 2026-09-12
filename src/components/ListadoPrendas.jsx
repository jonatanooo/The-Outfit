"use client"
// importamos libreria de animaciones
import {useState, useEffect} from "react"
import { motion } from "motion/react";
import { supabase } from "@/lib/supabaseClient";
import "./ListadoPrendas.css";

async function buscarProductosFiltrados(filtros ={}) {
  const filtroCategorias = filtros.Categorias?.length > 0;
  const filtroColores = filtros.Colores?.length > 0;
  const filtroTallas = filtros.Tallas?.length > 0;

  //usamos !inner solo en las relaciones donde hay filtro activo
  // para no excluir productos que no tengan filtro aplicado en esa dimensión
  const joinCategoria = filtroCategorias ? "Categorias_Producto!inner" : "Categorias_Producto";
  const joinVariante = (filtroColores || filtroTallas) ? "Variante_Producto!inner" : "Variante_Producto";
  const joinColor = filtroColores ? "Colores!inner" : "Colores";
  const joinTalla = filtroTallas ? "Talla!inner" : "Talla";
  const joinTipoTalla = filtroTallas ? "Tipos_Talla!inner" : "Tipos_Talla";

  let query = supabase.from("Productos").select(`
    ID_Producto,
    Nombre_Producto,
    ${joinCategoria} ( Nombre_Categoria ),
    Marca ( Nombre_Marca ),
    ${joinVariante} (
      Precio_Actual,
      ${joinTalla} ( ${joinTipoTalla} ( Nombre_TipoTalla ) ),
      ${joinColor} ( Nombre_Color )
    ),
    Fotos_Productos ( URL_Foto, Orden )
  `);

  if (filtroCategorias) query = query.in("Categorias_Producto.Nombre_Categoria", filtros.Categorias);
  if (filtroColores) query = query.in("Variante_Producto.Colores.Nombre_Color", filtros.Colores);
  if (filtroTallas) query = query.in("Variante_Producto.Talla.Tipos_Talla.Nombre_TipoTalla", filtros.Tallas);

  const { data, error } = await query;

  if (error) {
    console.error("Supabase error:", JSON.stringify(error, null, 2));
    return [];
  }

  // un producto puede repetirse si matchea con varias variantes -> dedupe
  const vistos = new Map();
  for (const producto of data) {
    if (!vistos.has(producto.ID_Producto)) {
      const precios = producto.Variante_Producto?.map((v) => v.Precio_Actual) ?? [];
      vistos.set(producto.ID_Producto, {
        id: producto.ID_Producto,
        nombre: producto.Nombre_Producto,
        marca: producto.Marca?.Nombre_Marca ?? "",
        precio: precios.length ? Math.min(...precios) : null,
        imagen: producto.Fotos_Productos?.find((f) => f.Orden === 4)?.URL_Foto
          ?? "/Fotos/placeholder.jpg",
      });
    }
  }

  let resultado = Array.from(vistos.values());

  const orden = filtros["Ordenar Por"]?.[0];
  if (orden === "Precio: menor a mayor") resultado.sort((a, b) => a.precio - b.precio);
  if (orden === "Precio: mayor a menor") resultado.sort((a, b) => b.precio - a.precio);

  return resultado;


}
// funcion que carga el carrusel
function ListadoPrendas({filtros, onResultados}) {
  const [prendas, setPrendas] = useState([]);
  const [cargando, setCargando] = useState(true);


  useEffect(() => {
    setCargando(true);
    buscarProductosFiltrados(filtros).then((data) => {
      setPrendas(data);
      setCargando(false);
      onResultados?.(data.length);
    });
  }, [filtros]);

  if (cargando) return <p>Cargando prendas...</p>;

  return (
    <div className="seccion-listado">

      <div className="listado-grid">
        {/* con el .map() recorre las  prendas visibles y genera una card por cada una, usando sus propios datos, lo cual evita que tengamos que escribir una por una a mano */}
        {prendas.map((prenda) => (
          // el key={prenda.id} es obligatoria en cualquier .map() que genere JSX en React, ya que le da a cada elemento una identidad unica para que Reatc pueda rastrear cual es cual si la lista cambia
          <div className="prenda-card" key={prenda.id}>
            <div className="prenda-imagen-wrap">
              <button className="btn-favorito" aria-label="Agregar a favoritos">
                <img src="/ICONOS/Heart.png" alt="like" className="favicon" />
              </button>
              <a href={`/producto/${prenda.id}`}><motion.img  whileHover={{scale: 1.2}} src={prenda.imagen} alt={prenda.nombre} className="prenda-imagen" /></a>
            </div>

            <a href={`/producto/${prenda.id}`} className="card-link"> 
                <div className="prenda-info">
                    <div>
                        <p className="prenda-nombre">{prenda.nombre}</p>
                        <p className="prenda-marca">{prenda.marca}</p>
                    </div>
                    <p className="prenda-precio">${prenda.precio}</p>
                </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListadoPrendas
