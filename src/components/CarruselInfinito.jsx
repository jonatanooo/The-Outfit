"use client"
import { useEffect, useState, useRef, useMemo } from "react";
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

    const rawFotos = (producto?.fotos && producto.fotos.length > 0) ? producto.fotos : (producto?.imagen ? [producto.imagen] : ["/PrendasCarrusel/1.jpg"]);
    const fotos = useMemo(() => {
        let f = [...rawFotos];
        while (f.length < 4) {
            f = [...f, ...rawFotos];
        }
        return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rawFotos se reconstruye si cambian fotos o imagen del producto
    }, [producto?.fotos, producto?.imagen]);

    const trackRef = useRef(null);
    // Duración calculada para velocidad uniforme (95 px/s)
    const [duracion, setDuracion] = useState(28);

    // Medición exacta en píxeles para que la velocidad sea 100% idéntica (95 px/s) en todas las prendas
    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;

        const VELOCIDAD_PX_S = 95; // píxeles por segundo constante para todas las prendas

        const actualizarDuracion = () => {
            const ancho = el.offsetWidth || el.scrollWidth;
            if (ancho > 0) {
                const segundos = Math.max(8, Math.round(ancho / VELOCIDAD_PX_S));
                setDuracion(segundos);
            }
        };

        actualizarDuracion();

        const ro = new ResizeObserver(() => {
            actualizarDuracion();
        });
        ro.observe(el);

        return () => ro.disconnect();
    }, [fotos]);

    if (cargando) {
        return (
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
        );
    }

    if (!producto) {
        return <p className="cargando-prenda">No encontramos esta prenda.</p>;
    }

    const precioFormateado = Number(producto?.precio ?? 0).toFixed(2);

    return(
        <>
        <section className="carrusel">
                {[0, 1, 2, 3].map((trackIdx) => (
                    <div
                        key={trackIdx}
                        ref={trackIdx === 0 ? trackRef : undefined}
                        className="carruselfotos"
                        style={{ animationDuration: `${duracion}s` }}
                        aria-hidden={trackIdx > 0 ? "true" : undefined}
                    >
                        {fotos.map((url, indice) => (
                            <div className="fotocarru" key={`${trackIdx}-${indice}`}>
                                <img
                                    src={url}
                                    alt={trackIdx === 0 ? (producto?.nombre || '') : ''}
                                    loading={trackIdx === 0 && indice === 0 ? 'eager' : 'lazy'}
                                />
                            </div>
                        ))}
                    </div>
                ))}

                <div className="panelprecios">
                    <div className="infosuperior">
                        <div style={{ textAlign: 'left' }}>
                            <h3 style={{ margin: 0 }}>{producto?.nombre || ''}</h3>
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
                    <div className="divmarca">
                            <span className="marca" style={{ display: 'block', marginTop: '0.2em' }}>{producto?.marca || 'The Outfit'}</span>
                    </div>
                    <p className="referencia">REF #<span>{producto?.id ?? ''}</span></p>
                    <hr className="divisor" />

                    <div className="tallas">
                        <h4>TALLAS</h4>
                        <div className="listatallas">
                            {cargandoTallas ? (
                                <p className="tallas-mensaje">Cargando tallas...</p>
                            ) : tallas.length === 0 ? (
                                <p className="tallas-mensaje tallas-no-disponibles">Tallas no disponibles</p>
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
                        className={`anadircesta ${(!tallaSeleccionada || tallas.length === 0) ? 'boton-inactivo' : ''}`}
                        disabled={!tallaSeleccionada || tallas.length === 0}
                        onClick={() => {
                            if (!tallaSeleccionada || tallas.length === 0) return;
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
                        {tallas.length === 0
                            ? 'TALLAS NO DISPONIBLES'
                            : (!tallaSeleccionada ? 'ELIGE UNA TALLA' : 'AÑADIR A LA CESTA')}
                    </button>

                    <p className="disponibilidad">
                        <img src="/ICONOS/Store.png" alt="tienda" />Disponible para recoger en tienda
                    </p>
                </div>
            </section>
        </>
    )
}

export default CarruselInfinito
