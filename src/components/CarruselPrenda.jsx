"use client"
import { useState } from "react";
import Link from "next/link";
// importamos libreria de animaciones
import { motion } from "motion/react";
import { useProductosCatalogo } from "@/lib/productos";
import { useFavoritos } from "@/lib/useFavoritos";
import "./CarruselPrenda.css";

// funcion que carga el carrusel con productos reales desde Supabase
// idGenero: ID_CATEGORIA_MUJER o ID_CATEGORIA_HOMBRE (@/lib/productos) para
// mostrar solo ese género; sin valor, muestra todos los productos activos.
function CarruselPrendas({ idGenero } = {}) {
  const { productos: prendas, cargando } = useProductosCatalogo(idGenero);
  const { esFavorito, alternarFavorito } = useFavoritos();

  // para saber en que pagina del carrusel estamos, es decir estamos en la 0 (la cual muestra las primeras 3 prendas)
  // si fuera useState(1) empezaria desde la prenda id=2
  const [indice, setIndice] = useState(0);
  // mostramos solo 3 a la vez, recorta el arreglo para quedarnos con 3 elementos
  // .slice(inicio, fin), es como poner .slice(0,3)
  const prendasVisibles = prendas.slice(indice, indice + 3);

  // botones que avanzan y retroceden de 1 en 1
  const siguiente = () => {
    // avanzamos solo si todavía queda más de 1 prenda después de las 3 que se están mostrando
    // (si indice+3 ya es igual o mayor al total, significa que llegamos al final)
    if (indice + 3 < prendas.length) setIndice(indice + 1);
  };
  const anterior = () => {
    // tenemos que asegurarnos que el indice sea mayor a 0, y si es mayor se le resta 1
    if (indice > 0) setIndice(indice - 1);
  };

  if (cargando) {
    return <p>Cargando recomendaciones...</p>;
  }

  return (
    <div className="carrusel-wrap">
      {/* con el disabled funciona cuando estamos en la posicion 0 se desactivo el boton de previous para que ya no se pueda retroceder */}
      <motion.button whileHover={{scale: 1.1}} onClick={anterior} disabled={indice === 0} className="buttons-move-card"><img src="/ICONOS/previous.png" alt="" /></motion.button>
      <div className="carrusel-fila">
        {/* con el .map() recorre las 3 prendas visibles y genera una card por cada una, usando sus propios datos, lo cual evita que tengamos que escribir una por una a mano */}
        {prendasVisibles.map((prenda) => (
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
                  <motion.img whileHover={{scale: 1.2}} src={prenda.imagen} alt={prenda.nombre} className="prenda-imagen" />
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
      {/* se desactiva "siguiente" cuando ya no caben 3 prendas más desde la posición actual
      (es decir, cuando indice+3 alcanza o pasa el total de prendas) */}
      <motion.button whileHover={{scale: 1.1}} onClick={siguiente} disabled={indice + 3 >= prendas.length} className="buttons-move-card"> <img src="/ICONOS/next.png" alt="" /></motion.button>
    </div>
  );
}

export default CarruselPrendas
