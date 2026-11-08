"use client"
import './FiltroMenu.css'
import { useState, useEffect, useMemo, useRef } from 'react';

function FiltroMenu({
    onAplicarFiltros,
    categoriasDisponibles = [],
    coloresDisponibles = [],
    filtrosActivos = {},
    cantidadResultados = 0
}) {
    const [filtroAbierto, setFiltroAbierto] = useState(false);

    const filtroRef = useRef(null);
    const filtroBtnRef = useRef(null);

    const listaColores = useMemo(() => {
        return [...coloresDisponibles].sort((a, b) =>
            (a.Nombre_Color || '').localeCompare(b.Nombre_Color || '')
        );
    }, [coloresDisponibles]);

    const coloresMap = useMemo(() => {
        const map = {};
        listaColores.forEach((c) => {
            map[c.ID_Color] = c;
            map[String(c.ID_Color)] = c;
        });
        return map;
    }, [listaColores]);

    useEffect(() => {
        const ClickFuera = (event) => {
            const clickDentroDelMenu = filtroRef.current?.contains(event.target);
            const clickEnBotonFiltro = filtroBtnRef.current?.contains(event.target);
            if (!clickDentroDelMenu && !clickEnBotonFiltro) {
                setFiltroAbierto(false);
            }
        };
        document.addEventListener('click', ClickFuera);
        return () => document.removeEventListener('click', ClickFuera);
    }, []);

    const [abiertoIds, setAbiertoIds] = useState([]);

    const secciones = [
        { id: 1, titulo: "Categorias", tipo: "multiple", opciones: categoriasDisponibles },
        {
            id: 2,
            titulo: "Colores",
            tipo: "multiple",
            opciones: listaColores.map((c) => ({
                valor: c.ID_Color,
                label: c.Nombre_Color,
                hex: c.Codigo_Hex
            }))
        },
        { id: 3, titulo: "Tallas", tipo: "multiple", opciones: ["XS", "S", "M", "L", "XL", "XXL"] },
        { id: 4, titulo: "Ordenar Por", tipo: "unica", opciones: ["Precio: menor a mayor", "Precio: mayor a menor", "Más nuevo"] },
    ];

    const toggleAcordeon = (id) => {
        setAbiertoIds((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    // el checkbox sigue usando su propio estado local mientras el usuario arma la seleccion
    const [filtrosSeleccionados, setFiltrosSeleccionados] = useState(filtrosActivos || {});

    const toggleFiltro = (seccionTitulo, valor) => {
        setFiltrosSeleccionados((prev) => {
            const actuales = prev[seccionTitulo] || [];
            const yaEstaba = actuales.some((item) => String(item) === String(valor));
            const nuevosValores = yaEstaba
                ? actuales.filter((item) => String(item) !== String(valor))
                : [...actuales, valor];
            return { ...prev, [seccionTitulo]: nuevosValores };
        });
    };

    const seleccionarUnica = (seccionTitulo, valor) => {
        setFiltrosSeleccionados((prev) => ({ ...prev, [seccionTitulo]: [valor] }));
    };

    const aplicarFiltros = () => {
        onAplicarFiltros(filtrosSeleccionados);
        setFiltroAbierto(false);
    };

    // 👇 arma la lista plana de etiquetas a partir de lo que YA esta aplicado (filtrosActivos)
    const etiquetas = Object.entries(filtrosActivos).flatMap(([seccionTitulo, opciones]) =>
        (opciones || []).map((opcion) => {
            let label = String(opcion);
            let hex = null;
            if (seccionTitulo === 'Colores') {
                const colorObj = coloresMap[opcion] || coloresMap[String(opcion)];
                if (colorObj) {
                    label = colorObj.Nombre_Color;
                    hex = colorObj.Codigo_Hex;
                }
            }
            return { seccionTitulo, opcion, label, hex };
        })
    );

    // 👇 quita una etiqueta puntual y vuelve a aplicar automaticamente
    const quitarEtiqueta = (seccionTitulo, opcion) => {
        const nuevos = {
            ...filtrosActivos,
            [seccionTitulo]: (filtrosActivos[seccionTitulo] || []).filter((o) => String(o) !== String(opcion)),
        };
        onAplicarFiltros(nuevos);          // re-aplica ya sin ese filtro
        setFiltrosSeleccionados(nuevos);   // sincroniza los checkboxes por si reabre el menu
    };

    return (
    <>
    <div className='filtros-linea1-2'>
        <div className='filtro-linea1'>
                <button
                    ref={filtroBtnRef}
                    className="menu-toggle-filtro"
                    onClick={() => {
                        setFiltrosSeleccionados(filtrosActivos || {});
                        setFiltroAbierto(!filtroAbierto);
                    }}
                    aria-label="Abrir menú"
                >
                    <img src="/ICONOS/FILTRO.png" alt="filtro" id="filtrobtn" className="filtroicon"/>
                    <span className='filtrar-titulo'>FILTRAR</span>
                </button>
                <p className='items-cantidad'>
                    <span className='items-numero'>{cantidadResultados}</span> Items filtrados
                    {etiquetas.length > 0 && (
                        <> por <span className='filtro-cantidad'>{etiquetas[0].label}</span>{etiquetas.length > 1 && ` y ${etiquetas.length - 1} más`}</>
                    )}
                </p>
        </div> 

        {/* 👇 resumen en formato de etiquetas, con boton para quitar cada una */}
        <div className='filtro-linea2'>
            {etiquetas.length === 0 ? (
                <p>No hay filtros activos</p>
            ) : (
                <div className="etiquetas-filtro">
                    {etiquetas.map(({ seccionTitulo, opcion, label, hex }) => (
                        <span className="etiqueta-filtro" key={`${seccionTitulo}-${opcion}`}>
                            {hex && (
                                <span
                                    className="color-bolita-filtro"
                                    style={{
                                        backgroundColor: hex,
                                        border: (hex.toLowerCase() === '#ffffff' || hex.toLowerCase() === '#fff') ? '1px solid #cbd5e1' : '1px solid rgba(0,0,0,0.15)',
                                        width: '12px',
                                        height: '12px',
                                        minWidth: '12px',
                                        minHeight: '12px',
                                        marginRight: '4px'
                                    }}
                                />
                            )}
                            {label}
                            <button
                                type="button"
                                className="etiqueta-quitar"
                                onClick={() => quitarEtiqueta(seccionTitulo, opcion)}
                                aria-label={`Quitar filtro ${label}`}
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    </div>

    <div ref={filtroRef} className={`menu-desplegable-filtro ${filtroAbierto ? 'abierto' : ''}`}>
                <div className="exitbuttondivfiltro" onClick={() => setFiltroAbierto(false)}>
                    <button type="button" className="exit-btn-filtro" aria-label="Cerrar menú de filtros">
                        <img src="/ICONOS/EXIT.png" alt="salir" className="exitbutton"/>
                    </button>
                </div>
                <div className="filtro-secciones descripcionprenda">
                <div className="filtro-contenedordescripcion contenedordescripcion">
                    {secciones.map((seccion) => (
                        <div className={`filtro-acordeon acordeon ${abiertoIds.includes(seccion.id) ? 'activo' : ''}`} key={seccion.id}>
                            <button
                                type="button"
                                className='filtro-acordeon-titulo titulo'
                                onClick={() => toggleAcordeon(seccion.id)}
                            >
                                {seccion.titulo}
                                <img src="/ICONOS/Flechaabajo.png" alt="desplegar" id="bajar" />
                            </button>
                            <div className='filtro-acordeon-contenido contenido'>
                                {seccion.opciones.length === 0 ? (
                                    <p style={{ fontSize: '0.85rem', color: '#888', margin: '0.5em 0' }}>
                                        Sin opciones disponibles
                                    </p>
                                ) : seccion.opciones.map((opcion) => {
                                    const esObjeto = typeof opcion === 'object' && opcion !== null;
                                    const valor = esObjeto ? opcion.valor : opcion;
                                    const label = esObjeto ? opcion.label : opcion;
                                    const hex = esObjeto ? opcion.hex : null;
                                    const estaSeleccionado = (filtrosSeleccionados[seccion.titulo] || []).some(
                                        (v) => String(v) === String(valor)
                                    );

                                    return (
                                        <label key={String(valor)} className='checkbox-opcion'>
                                            <input 
                                                type={seccion.tipo === "unica" ? "radio" : "checkbox"}
                                                name={seccion.tipo === "unica" ? seccion.titulo : undefined}
                                                checked={estaSeleccionado}
                                                onChange={() => 
                                                    seccion.tipo === "unica"
                                                    ? seleccionarUnica(seccion.titulo, valor)
                                                    : toggleFiltro(seccion.titulo, valor)
                                                }
                                            />
                                            {hex && (
                                                <span 
                                                    className="color-bolita-filtro" 
                                                    style={{ 
                                                        backgroundColor: hex,
                                                        border: (hex.toLowerCase() === '#ffffff' || hex.toLowerCase() === '#fff') ? '1px solid #cbd5e1' : '1px solid rgba(0,0,0,0.15)'
                                                    }} 
                                                />
                                            )}
                                            <span className="checkbox-texto">{label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    
                    <button type="button" className='filtrar-categorias' onClick={aplicarFiltros}>FILTRAR</button>
                </div>
    </div>
    </div>

        {filtroAbierto && (
                <div className="Overlayfiltro" onClick={() => setFiltroAbierto(false)}></div>
            )}
    </>
    )
}

export default FiltroMenu;