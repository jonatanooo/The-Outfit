
import "./CarruselInfinito.css";

function CarruselInfinito({producto}) {

    const imagenes = producto?.imagenes ?? [];

    return(
        <>
        <main>
            <section className="carrusel">
                <div className="carruselfotos">
                    {/* map es quien se encarga de agarrar cada valor de la constante y se lo pasa a la funcion numero */}
                    {imagenes.map((url, index) => (
                        <div  className="fotocarru"  key={index}>
                            <img src={url} alt = {producto.nombre}/>
                        </div>  
                    ))}
                </div>
{/* se repite para que se cree el efecto infinito */}
                <div aria-hidden className="carruselfotos">
                    {imagenes.map((url, index) => (
                        <div className="fotocarru" key={`dup-${index}`}>
                            <img src={url} alt={producto.nombre} />
                        </div>  
                    ))}
                </div>

                <div className="panelprecios">
                    <div className="infosuperior">
                        <h3>{producto.nombre}</h3>
                        <span className="precio">${producto.precio}</span>
                        <button className="favbutton"><img src="/ICONOS/Heart.png" alt="fav" className="heart" /></button>
                    </div>
                    <p className="referencia">REF #{producto.id}</p>
                    <hr className="divisor" />

                    <div className="tallas">
                        <h4>TALLAS</h4>
                        <div className="listatallas">
                            {producto.tallas.map((talla) => (
                                <button key={talla}>{talla}</button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="anadircesta"
                        disabled={!tallaSeleccionada}
                        onClick={() => {
                            const talla = tallas.find((t) => t.idVariante === tallaSeleccionada);
                            if (!talla) return;

                            agregarAlCarrito({
                                idVariante: talla.idVariante,
                                idProducto: producto.id,
                                nombre: producto.nombre,
                                talla: talla.nombre,
                                precio: talla.precio || producto.precio,
                                imagen: producto.imagen,
                                stockDisponible: talla.stock,
                            });
                            alert(`Se agregó "${producto.nombre}" (talla ${talla.nombre}) a la cesta.`);
                        }}
                    >
                        {tallas.length > 1 && !tallaSeleccionada ? 'ELEGÍ UNA TALLA' : 'AÑADIR A LA CESTA'}
                    </button>

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
