"use client"
import { useState } from "react";
import { motion } from "motion/react";
import "./CarruselPrenda.css";

// IMPORTAMOS REDUX Y LAS ACCIONES DEL CARRITO Y FAVORITOS
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, toggleCart } from '../store/slices/cartSlice'; 
import { toggleFavorite } from '../store/slices/favoritesSlice'; // <-- NUEVO

const prendas = [
  { id: 1, nombre: "Blusa Floreada", marca: "Zara", precio: 30.91, imagen: "/Fotos/01165152330-e1 copia.jpg" },
  { id: 2, nombre: "Blusa Floreada", marca: "Zara", precio: 30.92, imagen: "/Fotos/02139988643-e1 copia.jpg" },
  { id: 3, nombre: "Blusa Floreada", marca: "Zara", precio: 30.93, imagen: "/Fotos/07085775052-e1 copia.jpg" },
  { id: 4, nombre: "Blusa Floreada", marca: "Zara", precio: 30.94, imagen: "/Fotos/01165152330-e1 copia.jpg" },
  { id: 5, nombre: "Blusa Floreada", marca: "Zara", precio: 30.95, imagen: "/Fotos/01165152330-e1 copia.jpg" },
  { id: 6, nombre: "Blusa Floreada", marca: "Zara", precio: 30.96, imagen: "/Fotos/01165152330-e1 copia.jpg" },
  { id: 7, nombre: "Blusa Floreada", marca: "Zara", precio: 30.99, imagen: "/Fotos/01165152330-e1 copia.jpg" },
  { id: 8, nombre: "Blusa Floreada", marca: "Zara", precio: 30.99, imagen: "/Fotos/01165152330-e1 copia.jpg" },
  { id: 9, nombre: "Blusa Floreada", marca: "Zara", precio: 30.99, imagen: "/Fotos/01165152330-e1 copia.jpg" },
];

function CarruselPrendas() {
  const [indice, setIndice] = useState(0);
  const prendasVisibles = prendas.slice(indice, indice + 3);

  const dispatch = useDispatch();
  // LEEMOS LOS FAVORITOS GUARDADOS EN REDUX
  const favItems = useSelector((state) => state.favorites.items);

  const siguiente = () => {
    if (indice + 3 < prendas.length) setIndice(indice + 1);
  };
  const anterior = () => {
    if (indice > 0) setIndice(indice - 1);
  };

  return (
    <div className="carrusel-wrap">
      <motion.button whileHover={{scale: 1.1}} onClick={anterior} disabled={indice === 0} className="buttons-move-card">
        <img src="/ICONOS/previous.png" alt="" />
      </motion.button>
      
      <div className="carrusel-fila">
        {prendasVisibles.map((prenda) => {
          // VERIFICAMOS SI ESTA PRENDA YA ESTÁ EN FAVORITOS
          const isFavorite = favItems.some((fav) => fav.id === prenda.id);

          return (
            <div className="prenda-card" key={prenda.id}>
              <div className="prenda-imagen-wrap" style={{ position: 'relative' }}>
                
                {/* BOTÓN DE FAVORITOS ACTUALIZADO */}
                <button 
                  className="btn-favorito" 
                  aria-label="Agregar a favoritos"
                  style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, cursor: 'pointer', background: 'none', border: 'none' }}
                  onClick={(e) => {
                    e.preventDefault(); // Evita que la página recargue
                    dispatch(toggleFavorite({
                      id: prenda.id,
                      nombre: prenda.nombre,
                      precio: prenda.precio,
                      imagen: prenda.imagen,
                      marca: prenda.marca
                    }));
                  }}
                >
                  <img 
                    src="/ICONOS/Heart.png" 
                    alt="like" 
                    className="favicon" 
                    style={{ 
                      // Si es favorito, aplicamos un filtro CSS para pintarlo de rojo, si no, se queda normal
                      filter: isFavorite ? 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)' : 'none',
                      transition: 'filter 0.3s'
                    }} 
                  />
                </button>
                
                <a href="" onClick={(e) => e.preventDefault()}> 
                  <motion.img whileHover={{scale: 1.2}} src={prenda.imagen} alt={prenda.nombre} className="prenda-imagen" />
                </a>

                {/* BOTÓN DE CARRITO */}
                <button 
                  onClick={(e) => {
                    e.preventDefault(); 
                    dispatch(addToCart({
                      id: prenda.id,
                      nombre: prenda.nombre,
                      precio: prenda.precio,
                      imagen: prenda.imagen,
                      marca: prenda.marca,
                      talla: 'M',
                      color: 'Único'
                    }));
                    dispatch(toggleCart()); 
                  }}
                  className="btn-añadir-bolsa"
                  style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255, 255, 255, 0.95)', color: 'black', border: '1px solid black', padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', zIndex: 10, width: '80%', textAlign: 'center' }}
                >
                  Añadir
                </button>
              </div>

              <a href="" className="card-link" onClick={(e) => e.preventDefault()}> 
                  <div className="prenda-info">
                      <div>
                          <p className="prenda-nombre">{prenda.nombre}</p>
                          <p className="prenda-marca">{prenda.marca}</p>
                      </div>
                      <p className="prenda-precio">${prenda.precio}</p>
                  </div>
              </a>
            </div>
          );
        })}
      </div>
      
      <motion.button whileHover={{scale: 1.1}} onClick={siguiente} disabled={indice + 3 >= prendas.length} className="buttons-move-card"> 
        <img src="/ICONOS/next.png" alt="" />
      </motion.button>
    </div>
  );
}

export default CarruselPrendas;