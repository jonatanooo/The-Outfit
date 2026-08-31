"use client"
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
                    <span className='filtrar-titulo'>Filtrar</span>
                </button>
                <p className='items-cantidad'><span className='items-numero'>100</span> Items filtrados por <span className='filtro-cantidad'>CATEGORIA</span></p>
        </div> 

        <div ref={filtroRef} className={`menu-desplegable ${filtroAbierto ? 'abierto' : ''}`}>
                {/* anteriormente en Js removiamos la clase, pero ahora con el onClick simplemento se cambia a false, desactivando el menu desplegable */}
                <div className="exitbuttondiv" onClick={() => setFiltroAbierto(false)}>
                    <a><img src="/ICONOS/EXIT.png" alt="salir" className="exitbutton"/></a>
                </div>
                <div>
                    <ul>
                        <li><a href="" className="part1">MUJERES</a></li>
                    </ul>
                </div>
        </div>

        {filtroAbierto && (
                // quiere decir que si le hacemos click al overlay se desactiva el menu desplegable
                <div className="Overlay" onClick={() => setFiltroAbierto(false)}></div>
            )}

        <div className='filtro-linea2'>
            <p>Aqui es un resumen de todo los filtros que estan activos</p>
            <button>al dale click se elimina un filtro uno por uno, dependiendo de cual este activo</button>
        </div>
    </div>
    </>
    )
}

export default FiltroMenu;