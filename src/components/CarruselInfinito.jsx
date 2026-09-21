"use client"
import "./CarruselInfinito.css";
import { useProducto, useTallasProducto } from "@/lib/productos";
import { useFavoritos } from "@/lib/useFavoritos";

// Carrusel de fotos + panel de precio/talla de la prenda real, cargada por su ID
// (viene de la ruta /prenda-pag/[id]).
function CarruselInfinito({ idProducto }) {
    const { producto, cargando } = useProducto(idProducto);
    const { tallas, cargando: cargandoTallas } = useTallasProducto(idProducto);
    const { esFavorito, alternarFavorito } = useFavoritos();

    if (cargando) {
        return <main><p className="cargando-prenda">Cargando...</p></main>;
    }

    if (!producto) {
        return <main><p className="cargando-prenda">No encontramos esta prenda.</p></main>;
    }

    const fotos = producto.fotos.length > 0 ? producto.fotos : ["/PrendasCarrusel/1.jpg"];

    return(
        <>
        <main>
            <section className="carrusel">
                <div className="carruselfotos">
                    {/* map es quien se encarga de agarrar cada valor de la constante y se lo pasa a la funcion numero */}
                    {fotos.map((url, indice) => (
                        <div  className="fotocarru"  key={indice}>
                            <img src={url} alt={producto.nombre} />
                        </div>
                    ))}
                </div>
{/* se repite para que se cree el efecto infinito */}
                <div aria-hidden className="carruselfotos">
                    {fotos.map((url, indice) => (
                        <div  className="fotocarru" key={indice}>
                            <img src={url} alt="" />
                        </div>
                    ))}
                </div>

                <div className="panelprecios">
                    <div className="infosuperior">
                        <h3>{producto.nombre}</h3>
                        <span className="precio">${producto.precio.toFixed(2)}</span>
                        <button
                            type="button"
                            className="favbutton"
                            aria-label={esFavorito(producto.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
                            onClick={() => alternarFavorito(producto.id)}
                        >
                            <img
                                src={esFavorito(producto.id) ? "/ICONOS/Heart2.png" : "/ICONOS/Heart.png"}
                                alt="fav"
                                className="heart"
                            />
                        </button>
                    </div>
                    <p className="referencia">REF #<span>{producto.id}</span></p>
                    <hr className="divisor" />

                    <div className="tallas">
                        <h4>TALLAS</h4>
                        <div className="listatallas">
                            {cargandoTallas ? (
                                <p className="tallas-mensaje">Cargando tallas...</p>
                            ) : tallas.length === 0 ? (
                                <p className="tallas-mensaje">Sin tallas disponibles</p>
                            ) : (
                                tallas.map((talla) => (
                                    <button
                                        key={talla.idVariante}
                                        type="button"
                                        className={`talla-btn ${talla.disponible ? 'talla-disponible' : 'talla-agotada'}`}
                                        disabled={!talla.disponible}
                                        aria-label={talla.disponible ? `Talla ${talla.nombre}` : `Talla ${talla.nombre}, agotada`}
                                    >
                                        {talla.nombre}
                                    </button>
                                ))
                            )}
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
