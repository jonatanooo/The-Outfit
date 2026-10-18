"use client"
import { useEffect, useState } from "react";
import "./CarruselInfinito.css";
import { useProducto, useTallasProducto } from "@/lib/productos";
import { useFavoritos } from "@/lib/useFavoritos";
import { useCarrito } from "@/lib/CarritoContext";
import { calcularPrecioConDescuento } from "@/lib/descuentos";

// Carrusel de fotos + panel de precio/talla de la prenda real, cargada por su ID
// (viene de la ruta /prenda-pag/[id]).
function CarruselInfinito({ idProducto }) {
    const { producto, cargando } = useProducto(idProducto);
    const { tallas, cargando: cargandoTallas } = useTallasProducto(idProducto);
    const { esFavorito, alternarFavorito } = useFavoritos();
    const { agregarAlCarrito } = useCarrito();
    const [tallaSeleccionada, setTallaSeleccionada] = useState(null);

    // Si se navega a otra prenda, la talla elegida en la anterior no debe seguir marcada.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia la seleccion al cambiar de prenda (prop idProducto), no hay nada async que envolver.
        setTallaSeleccionada(null);
    }, [idProducto]);

    const tallaActiva = tallas.find((t) => t.idVariante === tallaSeleccionada);
    const estaEnOferta = Boolean(tallaActiva?.enOferta ?? producto?.enOferta);
    const pctDesc = Number(tallaActiva?.porcentajeDescuento || producto?.porcentajeDescuento || 0);
    const precioBaseVisual = Number(tallaActiva?.precioOriginal ?? producto?.precioOriginal ?? producto?.precio ?? 0);
    const precioFinalVisual = Number(
        tallaActiva?.precio ?? producto?.precioFinal ?? (estaEnOferta ? calcularPrecioConDescuento(precioBaseVisual, pctDesc) : precioBaseVisual)
    );

        if (cargando) {
        return (
            <main>
                <section className="carrusel">
                    <div className="carruselfotos">
                        {[1, 2].map(i => (
                            <div className="fotocarru skeleton" key={i} />
                        ))}
                    </div>
                    <div className="panelprecios" style={{ backgroundColor: 'transparent', backdropFilter: 'none' }}>
                        <div className="infosuperior">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em', flex: 1 }}>
                                <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.5em' }} />
                                <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                            </div>
                            <div className="skeleton skeleton-text" style={{ width: '20%', height: '1.5em', margin: '0 1em' }} />
                            <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                        </div>
                        <div className="skeleton skeleton-text" style={{ width: '30%', marginTop: '1em', marginLeft: '0.7em' }} />
                        <hr className="divisor" />
                        <div className="tallas">
                            <div className="skeleton skeleton-text" style={{ width: '20%' }} />
                            <div className="listatallas" style={{ display: 'flex', gap: '1em' }}>
                                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ width: '4em', height: '4em', borderRadius: '4px' }} />)}
                            </div>
                        </div>
                        <div className="skeleton" style={{ width: '90%', height: '4em', marginTop: '3em', marginInline: 'auto', borderRadius: '0' }} />
                    </div>
                </section>
            </main>
        );
    }

    if (!producto) {
        return <main><p className="cargando-prenda">No encontramos esta prenda.</p></main>;
    }

    const fotos = (producto?.fotos && producto.fotos.length > 0) ? producto.fotos : (producto?.imagen ? [producto.imagen] : ["/PrendasCarrusel/1.jpg"]);
    const precioFormateado = Number(producto?.precio ?? 0).toFixed(2);

    return(
        <>
        <main>
            <section className="carrusel">
                <div className="carruselfotos">
                    {/* map es quien se encarga de agarrar cada valor de la constante y se lo pasa a la funcion numero */}
                    {fotos.map((url, indice) => (
                        <div  className="fotocarru"  key={indice}>
                            <img src={url} alt={producto?.nombre || ''} />
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
                        <div style={{ textAlign: 'left' }}>
                            <h3 style={{ margin: 0 }}>{producto?.nombre || ''}</h3>
                            <span className="marca" style={{ display: 'block', marginTop: '0.2em' }}>{producto?.marca || 'The Outfit'}</span>
                        </div>
                        {estaEnOferta ? (
                            <div className="precio-wrap-detalle">
                                <span className="precio-tachado-detalle">${precioBaseVisual.toFixed(2)}</span>
                                <span className="precio-oferta-detalle">${precioFinalVisual.toFixed(2)}</span>
                                <span className="badge-oferta-detalle">-{pctDesc}%</span>
                            </div>
                        ) : (
                            <span className="precio">${precioBaseVisual.toFixed(2)}</span>
                        )}
                        <button
                            type="button"
                            className="favbutton"
                            aria-label={esFavorito(producto?.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
                            onClick={() => alternarFavorito(producto?.id)}
                        >
                            <img
                                src={esFavorito(producto?.id) ? "/ICONOS/Heart2.png" : "/ICONOS/Heart.png"}
                                alt="fav"
                                className="heart"
                            />
                        </button>
                    </div>
                    <p className="referencia">REF #<span>{producto?.id ?? ''}</span></p>
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
                                        className={`talla-btn ${talla.disponible ? 'talla-disponible' : 'talla-agotada'} ${tallaSeleccionada === talla.idVariante ? 'talla-seleccionada' : ''}`}
                                        disabled={!talla.disponible}
                                        aria-pressed={tallaSeleccionada === talla.idVariante}
                                        aria-label={talla.disponible ? `Talla ${talla.nombre}` : `Talla ${talla.nombre}, agotada`}
                                        onClick={() => setTallaSeleccionada(talla.idVariante)}
                                    >
                                        {talla.nombre}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="anadircesta"
                        disabled={!tallaSeleccionada}
                        onClick={() => {
                            const talla = tallas.find((t) => t.idVariante === tallaSeleccionada);
                            if (!talla) return;

                            const precioBaseItem = Number(talla.precioOriginal ?? producto.precioOriginal ?? producto.precio ?? 0);
                            const porcentajeItem = Number(talla.porcentajeDescuento || producto.porcentajeDescuento || 0);
                            const esOfertaItem = Boolean(talla.enOferta || producto.enOferta);
                            const precioFinalItem = esOfertaItem
                                ? (talla.precio != null ? Number(talla.precio) : calcularPrecioConDescuento(precioBaseItem, porcentajeItem))
                                : precioBaseItem;

                            agregarAlCarrito({
                                idVariante: talla.idVariante,
                                idProducto: producto.id,
                                nombre: producto.nombre,
                                marca: producto?.marca || 'The Outfit',
                                talla: talla.nombre,
                                precio: precioFinalItem,
                                precioOriginal: precioBaseItem,
                                enOferta: esOfertaItem,
                                porcentajeDescuento: esOfertaItem ? porcentajeItem : 0,
                                imagen: producto.imagen,
                                stockDisponible: talla.stock,
                            });
                            alert(`Se agregó "${producto.nombre}" (talla ${talla.nombre}) a la cesta.`);
                        }}
                    >
                        {!tallaSeleccionada ? 'ELIGE UNA TALLA' : 'AÑADIR A LA CESTA'}
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
