import { use, useState } from "react";
import "./CarruselPrenda.css";

const prendas = [
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/02139988643-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/07085775052-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
  {
    id: 1,
    nombre: "Blusa Floreada",
    marca: "Zara",
    precio: 30.99,
    imagen: "/Fotos/01165152330-e1 copia.jpg",
  },
];

function CarruselPrendas() {
  // para saber en que pagina del carrusel estamos
  const [indice, setIndice] = useState(0);
  // mostramos solo 3 a la vez
  const prendasVisibles = prendas.slice(indice, indice + 3);

  // botones que avanzan y retroceden de 1 en 1
  const siguiente = () => {
    if (indice + 3 < prendas.length) setIndice(indice + 1);
  };
  const anterior = () => {
    if (indice >= 0) setIndice(indice - 1);
  };

  return (
    <div className="carrusel-wrap">
      <button onClick={anterior} disabled={indice === 0} >◀</button>
      <div className="carrusel-fila">
        {prendasVisibles.map((prenda) => (
          <div className="prenda-card" key={prenda.id}>
            <div className="prenda-imagen-wrap">
              <button className="btn-favorito" aria-label="Agregar a favoritos">
                <img src="/ICONOS/Heart.png" alt="like" className="favicon" />
              </button>
              <img
                src={prenda.imagen}
                alt={prenda.nombre}
                className="prenda-imagen"
              />
            </div>

            <div className="prenda-info">
              <div>
                <p className="prenda-nombre">{prenda.nombre}</p>
                <p className="prenda-marca">{prenda.marca}</p>
              </div>
              <p className="prenda-precio">${prenda.precio}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={siguiente} disabled={indice + 3 >= prendas.length}>▶</button>
    </div>
  );
}

export default CarruselPrendas
