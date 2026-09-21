"use client"
import './FiltroMenu.css'
import { useState, useEffect, useRef } from 'react';

function FiltroMenu({ onAplicarFiltros, categoriasDisponibles = [], filtrosActivos = {}, cantidadResultados = 0 }) {
    const[filtroAbierto, setFiltroAbierto] = useState(false);

    const filtroRef = useRef(null)
    const filtroBtnRef = useRef(null)

    useEffect (() => {
        const ClickFuera = (event) => {
            const clickDentroDelMenu = filtroRef.current?.contains(event.target)
            const clickEnBotonFiltro = filtroBtnRef.current?.contains(event.target)
            if (!clickDentroDelMenu && !clickEnBotonFiltro) {
                setFiltroAbierto(false)
            }
        }
        document.addEventListener('click', ClickFuera)
        return () => document.removeEventListener('click',ClickFuera)
    }, [])

    const [abiertoIds, setAbiertoIds] = useState([])

    const secciones = [
        {id: 1, titulo: "Categorias", tipo: "multiple", opciones: categoriasDisponibles},
        {id: 2, titulo: "Colores", tipo: "multiple", opciones: ["Negro", "Blanco", "Verde", "Azul"] },
        {id: 3, titulo: "Tallas", tipo: "multiple", opciones: ["S", "M", "L", "XL", "XXL"]},
        {id: 4, titulo: "Ordenar Por", tipo: "unica", opciones: ["Precio: menor a mayor", "Precio: mayor a menor", "Más nuevo"]},
    ]

    const toggleAcordeon =(id) => {
        setAbiertoIds((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        )
    }

    // el checkbox sigue usando su propio estado local mientras el usuario arma la seleccion
    const [filtrosSeleccionados, setFiltrosSeleccionados] = useState({})

    const toggleFiltro = (seccionTitulo, opcion) => {
        setFiltrosSeleccionados((prev) => {
            const actuales = prev[seccionTitulo] || []
            const yaEstaba = actuales.includes(opcion)
            const nuevosValores = yaEstaba
            ? actuales.filter((item) => item !== opcion)
            : [...actuales, opcion]
            return { ...prev, [seccionTitulo]: nuevosValores }
        })
    }

    const seleccionarUnica = (seccionTitulo, opcion) => {
        setFiltrosSeleccionados((prev) => ({ ...prev, [seccionTitulo]: [opcion] }))
    }

    const aplicarFiltros = () => {
        onAplicarFiltros(filtrosSeleccionados)
        setFiltroAbierto(false)
    }

    // 👇 arma la lista plana de etiquetas a partir de lo que YA esta aplicado (filtrosActivos)
    const etiquetas = Object.entries(filtrosActivos).flatMap(([seccionTitulo, opciones]) =>
        (opciones || []).map((opcion) => ({ seccionTitulo, opcion }))
    );

    // 👇 quita una etiqueta puntual y vuelve a aplicar automaticamente
    const quitarEtiqueta = (seccionTitulo, opcion) => {
        const nuevos = {
            ...filtrosActivos,
            [seccionTitulo]: (filtrosActivos[seccionTitulo] || []).filter((o) => o !== opcion),
        };
        onAplicarFiltros(nuevos);          // re-aplica ya sin ese filtro
        setFiltrosSeleccionados(nuevos);   // sincroniza los checkboxes por si reabre el menu
    };

    return (
    <>
    <div className='filtros-linea1-2'>
        <div className='filtro-linea1'>
                <button
                    ref = {filtroBtnRef}
                    className ="menu-toggle-filtro"
                    onClick = {() => setFiltroAbierto (!filtroAbierto)}
                    aria-label ="Abrir menú">
                    <img src="/ICONOS/FILTRO.png" alt="filtro" id="filtrobtn" className="filtroicon"/>
                    <span className='filtrar-titulo'>FILTRAR</span>
                </button>
                <p className='items-cantidad'>
                    <span className='items-numero'>{cantidadResultados}</span> Items filtrados
                    {etiquetas.length > 0 && (
                        <> por <span className='filtro-cantidad'>{etiquetas[0].opcion}</span>{etiquetas.length > 1 && ` y ${etiquetas.length - 1} más`}</>
                    )}
                </p>
        </div> 

        {/* 👇 resumen en formato de etiquetas, con boton para quitar cada una */}
        <div className='filtro-linea2'>
            {etiquetas.length === 0 ? (
                <p>No hay filtros activos</p>
            ) : (
                <div className="etiquetas-filtro">
                    {etiquetas.map(({ seccionTitulo, opcion }) => (
                        <span className="etiqueta-filtro" key={`${seccionTitulo}-${opcion}`}>
                            {opcion}
                            <button
                                type="button"
                                className="etiqueta-quitar"
                                onClick={() => quitarEtiqueta(seccionTitulo, opcion)}
                                aria-label={`Quitar filtro ${opcion}`}
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
                    <a><img src="/ICONOS/EXIT.png" alt="salir" className="exitbutton"/></a>
                </div>
                <div className="descripcionprenda">
                <div className="contenedordescripcion">
                    {secciones.map((seccion) => (
                        <div className={`acordeon  ${abiertoIds.includes(seccion.id) ? 'activo' : ''}`} key={seccion.id}>
                            <button className='titulo'
                            onClick={() => toggleAcordeon(seccion.id)}>
                                {seccion.titulo}
                                <img src="/ICONOS/Flechaabajo.png" alt="desplegar" id="bajar" />
                            </button>
                            <div className='contenido'>
                                {seccion.opciones.map((opcion) => (
                                    <label key={opcion} className='checkbox-opcion'>
                                        <input 
                                        type={seccion.tipo === "unica" ? "radio" : "checkbox"}
                                        name={seccion.tipo === "unica" ? seccion.titulo : undefined}
                                        checked={filtrosSeleccionados[seccion.titulo]?.includes(opcion) || false}
                                        onChange={() => 
                                        seccion.tipo === "unica"
                                        ? seleccionarUnica(seccion.titulo, opcion)
                                        : toggleFiltro(seccion.titulo, opcion)}
                                        />
                                        {opcion}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    <button className='filtrar-categorias' onClick={aplicarFiltros}>FILTRAR</button>
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