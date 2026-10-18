"use client"
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useProductosCatalogo } from "@/lib/productos";
import { useFavoritos } from "@/lib/useFavoritos";
import "./CarruselPrenda.css";

// Hook para calcular prendas visibles según el ancho de la ventana:
// Hook para calcular prendas visibles según el ancho de la ventana:
// Ancho máximo: 3 prendas
// Ancho intermedio: 2 prendas
// Ancho mínimo: 1 prenda
function useItemsVisibles() {
  const [itemsVisibles, setItemsVisibles] = useState(3);

  useEffect(() => {
    function calcular() {
      const ancho = window.innerWidth;
      if (ancho < 680) {
        setItemsVisibles(1);
      } else if (ancho < 1024) {
        setItemsVisibles(2);
      } else {
        setItemsVisibles(3);
      }
    }

    calcular();
    window.addEventListener("resize", calcular);
    return () => window.removeEventListener("resize", calcular);
  }, []);

  return itemsVisibles;
}

// Carrusel con animación de desplazamiento suave y ajuste responsivo (1 a 3 prendas)
function CarruselPrendas({ idGenero } = {}) {
  const { productos: prendas, cargando } = useProductosCatalogo(idGenero);
  const { esFavorito, alternarFavorito } = useFavoritos();
  const itemsVisibles = useItemsVisibles();

  const [indice, setIndice] = useState(0);

  const total = prendas?.length || 0;
  const maxIndice = Math.max(0, total - itemsVisibles);

  // Asegurar que el índice no supere el máximo si cambia la cantidad de items visibles
  useEffect(() => {
    setIndice((prev) => Math.min(prev, Math.max(0, (prendas?.length || 0) - itemsVisibles)));
  }, [itemsVisibles, prendas?.length]);

  const siguiente = () => {
    setIndice((prev) => (prev < maxIndice ? prev + 1 : prev));
  };

  const anterior = () => {
    setIndice((prev) => (prev > 0 ? prev - 1 : 0));
  };

  // Soporte para gestos táctiles (swipe) en dispositivos móviles
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 45) {
      siguiente();
    } else if (diff < -45) {
      anterior();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (cargando) {
    return (
      <div className="carrusel-wrap" style={{ '--items-visibles': itemsVisibles }}>
        <button disabled className="buttons-move-card" style={{ opacity: 0.25 }}>
          <img src="/ICONOS/previous.png" alt="" />
        </button>
        <div className="carrusel-viewport">
          <div className="carrusel-track">
            {Array.from({ length: itemsVisibles }).map((_, i) => (
              <div className="carrusel-item" key={i}>
                <div className="prenda-card">
                  <div className="prenda-imagen-wrap skeleton" />
                  <div className="prenda-info">
                    <div className="skeleton skeleton-title" />
                    <div className="skeleton skeleton-price" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button disabled className="buttons-move-card" style={{ opacity: 0.25 }}>
          <img src="/ICONOS/next.png" alt="" />
        </button>
      </div>
    );
  }

  if (!prendas || prendas.length === 0) {
    return null;
  }

  // Porcentaje de desplazamiento: al mover 1 prenda, el track se desplaza (100 / itemsVisibles)%
  const translateX = -(indice * (100 / itemsVisibles));

  return (
    <div className="carrusel-wrap" style={{ '--items-visibles': itemsVisibles }}>
      <motion.button
        whileHover={indice > 0 ? { scale: 1.1 } : {}}
        whileTap={indice > 0 ? { scale: 0.95 } : {}}
        onClick={anterior}
        disabled={indice <= 0}
        className="buttons-move-card"
        aria-label="Prenda anterior"
      >
        <img src="/ICONOS/previous.png" alt="" />
      </motion.button>

      <div
        className="carrusel-viewport"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="carrusel-track"
          style={{
            transform: `translateX(${translateX}%)`,
          }}
        >
          {prendas.map((prenda) => (
            <div className="carrusel-item" key={prenda.id}>
              <Link href={`/prenda-pag/${prenda.id}`} className="card-link">
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
                      <motion.img
                        whileHover={{ scale: 1.2 }}
                        src={prenda.imagen}
                        alt={prenda.nombre}
                        className="prenda-imagen"
                      />
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
            </div>
          ))}
        </div>
      </div>

      <motion.button
        whileHover={indice < maxIndice ? { scale: 1.1 } : {}}
        whileTap={indice < maxIndice ? { scale: 0.95 } : {}}
        onClick={siguiente}
        disabled={indice >= maxIndice}
        className="buttons-move-card"
        aria-label="Siguiente prenda"
      >
        <img src="/ICONOS/next.png" alt="" />
      </motion.button>
    </div>
  );
}

export default CarruselPrendas;
