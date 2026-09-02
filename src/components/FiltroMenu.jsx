"use client"
import { label } from 'motion/react-client';
import './FiltroMenu.css'
import { useState, useEffect, useRef } from 'react';

function FiltroMenu() {
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


    const [abiertoId, setAbiertoId] = useState(null)

    const secciones = [
        {id: 1, titulo: "Categorias", opciones: ["Zapatos","Camisas","Pantalones","Chaquetas","Faldas"]},
        {id: 2, titulo: "Colores", opciones: ["Negro", "Blanco", "Verde", "Azul"] },
        {id: 3, titulo: "Materiales", opciones: ["Algodón", "Poliéster", "Lino"]},
        {id: 4, titulo: "Tallas", opciones: ["S", "M", "L", "XL", "XXL"]},
        {id: 5, titulo: "Ordenar Por", opciones: ["Precio: menor a mayor", "Precio: mayor a menor", "Más nuevo"]},
        
    ]

const [filtrosSeleccionados, setFiltrosSeleccionados] = useState({})

const toggleFiltro = (seccionTitulo, opcion) => {
    setFiltrosSeleccionados((prev) => {
        //sacamos el array actual de esa seccion (o vacio si no existe aun)
        const actuales = prev[seccionTitulo] || []

        const yaEstaba = actuales.includes(opcion)

        const nuevosValores = yaEstaba
        ? actuales.filter((item) => item !== opcion) //lo quitamos
        : [...actuales, opcion] //lo agregamos

        return {
            ...prev,
            [seccionTitulo]: nuevosValores
        }
    })
}

const aplicarFiltros =() => {
    console.log("Filtros a aplicar:", filtrosSeleccionados)
    setFiltroAbierto(false)
}

    return (
    // fragmento
    <>
    <div className='filtros-linea1-2'>
        <div className='filtro-linea1'>
                <button
                    ref = {filtroBtnRef}
                    className ="menu-toggle"
                    // el onClick remplaza el addEventListener('click') y !menuAbierto es el toggle, si estaba true pasa a false y viceversa
                    onClick = {() => setFiltroAbierto (!filtroAbierto)}
                    aria-label ="Abrir menú">
                    <img src="/ICONOS/FILTRO.png" alt="filtro" id="filtrobtn" className="filtroicon"/>
                    <span className='filtrar-titulo'>FILTRAR</span>
                </button>
                <p className='items-cantidad'><span className='items-numero'>100</span> Items filtrados por <span className='filtro-cantidad'>CATEGORIA</span></p>
        </div> 


        <div className='filtro-linea2'>
            <p>Aqui es un resumen de todo los filtros que estan activos</p>
            <button>al dale click se elimina un filtro uno por uno, dependiendo de cual este activo</button>
        </div>
    </div>


    <div ref={filtroRef} className={`menu-desplegable ${filtroAbierto ? 'abierto' : ''}`}>
                {/* anteriormente en Js removiamos la clase, pero ahora con el onClick simplemento se cambia a false, desactivando el menu desplegable */}
                <div className="exitbuttondiv" onClick={() => setFiltroAbierto(false)}>
                    <a><img src="/ICONOS/EXIT.png" alt="salir" className="exitbutton"/></a>
                </div>
                <div className="descripcionprenda">
                <div className="contenedordescripcion">
                    {secciones.map((seccion) => (
                        <div className={`acordeon  ${abiertoId === seccion.id? 'activo' : ''}`} key={seccion.id}>
                            <button className='titulo'
                            onClick={() => setAbiertoId(abiertoId === seccion.id ? null : seccion.id)}>
                                {seccion.titulo}
                                <img src="/ICONOS/Flechaabajo.png" alt="desplegar" id="bajar" />
                            </button>
                            <div className='contenido'>
                                {seccion.opciones.map((opcion) => (
                                    <label key={opcion} className='checkbox-opcion'>
                                        <input type="checkbox" 
                                        checked={filtrosSeleccionados[seccion.titulo]?.includes(opcion) || false}
                                        onChange={() => toggleFiltro(seccion.titulo, opcion)}/>
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
                // quiere decir que si le hacemos click al overlay se desactiva el menu desplegable
                <div className="Overlay" onClick={() => setFiltroAbierto(false)}></div>
            )}
    </>
    )
}

export default FiltroMenu;