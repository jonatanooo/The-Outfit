"use client"
import { useState } from "react";
// importamos libreria de animaciones
import { motion } from "motion/react";
import "./CarruselPrenda.css";

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
function CarruselPrendas() {
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

  return (
    <div className="carrusel-wrap">
      {/* con el disabled funciona cuando estamos en la posicion 0 se desactivo el boton de previous para que ya no se pueda retroceder */}
      <motion.button whileHover={{scale: 1.1}} onClick={anterior} disabled={indice === 0} className="buttons-move-card"><img src="/ICONOS/previous.png" alt="" /></motion.button>
      <div className="carrusel-fila">
        {/* con el .map() recorre las 3 prendas visibles y genera una card por cada una, usando sus propios datos, lo cual evita que tengamos que escribir una por una a mano */}
        {prendasVisibles.map((prenda) => (
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
      {/* se desactiva "siguiente" cuando ya no caben 3 prendas más desde la posición actual 
      (es decir, cuando indice+3 alcanza o pasa el total de prendas) */}
      <motion.button whileHover={{scale: 1.1}} onClick={siguiente} disabled={indice + 3 >= prendas.length} className="buttons-move-card"> <img src="/ICONOS/next.png" alt="" /></motion.button>
    </div>
  );
}

export default CarruselPrendas
