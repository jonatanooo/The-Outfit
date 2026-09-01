"use client"
import { div } from "motion/react-client";
import "./CarruselInfinito.css";

// creamos la costante prendas donde vamos a cargar las diferentes prendas


function CarruselInfinito() {

    const fotos = [1, 2, 3, 4, 5, 6]

    return(
        <>
        <main>
            <section className="carrusel">
                <div className="carruselfotos">
                    {/* map es quien se encarga de agarrar cada valor de la constante y se lo pasa a la funcion numero */}
                    {fotos.map((numero) => (
                        <div  className="fotocarru"  key={numero}>
                            <img src={`/PrendasCarrusel/${numero}.jpg`} alt="" />
                        </div>  
                    ))}
                </div>
{/* se repite para que se cree el efecto infinito */}
                <div aria-hidden className="carruselfotos">
                    {fotos.map((numero) => (
                        <div  className="fotocarru" key={numero}>
                            <img src={`/PrendasCarrusel/${numero}.jpg`} alt="" />
                        </div>  
                    ))}
                </div>

                <div className="panelprecios">
                    <div className="infosuperior">
                        <h3>SUDADERA RAYAS VERDE Y BLANCO</h3>
                        <span className="precio">$49.99</span>
                        <button className="favbutton"><img src="/ICONOS/Heart.png" alt="fav" className="heart" /></button>
                    </div>
                    <p className="referencia">REF #<span>7777</span></p>
                    <hr className="divisor" />

                    <div className="tallas">
                        <h4>TALLAS</h4>
                        <div className="listatallas">
                            <button>S</button>
                            <button>M</button>
                            <button>L</button>
                            <button>XL</button>
                            <button>XXL</button>
                        </div>
                    </div>

                    <button className="anadircesta">AÑADIR A LA CESTA</button>

                    <p className="disponibilidad">
                        <img src="/ICONOS/Store.png" alt="tienda" />Disponible para recoger en tienda
                    </p>
                </div>
            </section>
        </main>
        
        </>
    )
}

export default CarruselInfinito