"use client"
import { useState } from "react";
// importamos libreria de animaciones
import { motion } from "motion/react";
import "./ListadoPrendas.css";

// creamos la costante prendas donde vamos a cargar las diferentes prendas
const prendas = [
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.91,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 2,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.92,
    imagen: "/Fotos/02139988643-e1 copia.jpg",
  },
  {
    id: 3,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.93,
    imagen: "/Fotos/07085775052-e1 copia.jpg",
  },
  {
    id: 4,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.94,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 5,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.95,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 6,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.96,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 7,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 8,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 9,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
];

// funcion que carga el carrusel
function ListadoPrendas() {

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
              <a href=""><motion.img  whileHover={{scale: 1.2}} src={prenda.imagen} alt={prenda.nombre} className="prenda-imagen" /></a>
            </div>

            <a href="" className="card-link"> 
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
