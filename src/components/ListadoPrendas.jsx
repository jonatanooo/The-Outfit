"use client"
import Link from "next/link";
// importamos libreria de animaciones
import { motion } from "motion/react";
import { useProductosCatalogo } from "@/lib/productos";
import { useFavoritos } from "@/lib/useFavoritos";
import "./ListadoPrendas.css";

// funcion que carga el listado de productos reales desde Supabase
function ListadoPrendas() {
  const { productos, cargando } = useProductosCatalogo();
  const { esFavorito, alternarFavorito } = useFavoritos();

  if (cargando) {
    return (
      <div className="seccion-listado">
        <p>Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="seccion-listado">
      <div className="listado-grid">
        {/* con el .map() recorre las prendas visibles y genera una card por cada una, usando sus propios datos, lo cual evita que tengamos que escribir una por una a mano */}
        {productos.map((prenda) => (
          // el key={prenda.id} es obligatoria en cualquier .map() que genere JSX en React, ya que le da a cada elemento una identidad unica para que Reatc pueda rastrear cual es cual si la lista cambia
          // el Link manda a la pagina propia de la prenda; el boton de favorito frena la propagacion para no navegar al tocarlo
          <Link href={`/prenda-pag/${prenda.id}`} className="card-link" key={prenda.id}>
            <div className="prenda-card">
              <div className="prenda-imagen-wrap">
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
                <p className="prenda-nombre">{prenda.nombre}</p>
                <p className="prenda-precio">${prenda.precio.toFixed(2)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default ListadoPrendas
