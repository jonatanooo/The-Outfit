"use client"
import './Header.css'
import { useState, useEffect, useRef } from 'react';

function Headerv2 () {
    // comentario Jona
    // Los 2 useState son las banderas que remplazan las clases CSS que antes agregaba/quitaba en JS con classList.scrolled reemplaza la clase .scrolled del header, 
    // menuAbierto reemplaza la clase .abierto del me    const [menuAbierto, setMenuAbierto] = useState(false)

    // antes en el JS usaba "document.getElementById("menuDespegable")" y  "document.getElementById("menubtn")"
    // useRef es el equivalente en React, te da una caja que apunta al elemento real una vez que se renderiza sin necesidad de buscarlo por ID
    const menuRef = useRef(null)
    const menuBtnRef = useRef(null)

    // se conectan al html asi
    // <div ref={menuRef} className="menu-desplegable">
    // <button ref={menuBtnRef} className="menu-toggle"></button>


    // React se encarga de reflejar eso en el HTML automaticamente por esta linea
    // <header className={scrolled ? 'scrolled' : ''}>
    // la cual es un operador condicional ternario en el cual si la condicion es scrolled dara como verdadero scrolled si es falso no dara ningun valor

    //cerrar menu al hacer click afuera
    useEffect (() => {
        // al dar click afuera se activara un evento/funcion
    const manejarClickFuera = (event) => {
        // event.target es el elemento del HTML donde ocurrio el click, ejemplo si hago click en THE OUTFIT seria h1
        // contains responde la pregunta "¿el elemento donde di click  (event.target) esta dentro de otro elemento (menuDesplegable), ya sea directamente o dentro de alguno de sus hijos?"
        // contains() devuelve true si el click fue dentro del menu, y devuelve false si fue fuera

        // el ?. (optional chaining) es una proteccion extra, si menuRef.current todavia es null, evita que truene con error, simplemente no hace nada en vez de crashear
        const clickDentroDelMenu = menuRef.current?.contains(event.target)
        const clickEnBotonMenu = menuBtnRef.current?.contains(event.target)
        if(!clickDentroDelMenu && !clickEnBotonMenu) {
            // con la condicion de que si no hacemos click en el boton de menu o dentro del menu (es decir hacemos click afuera).
            // setMenuAbierto dara false, es decir que se cerrara el menu
            setMenuAbierto(false)
        }
    } 
    // el evento que activara esto es el click, y cargara la funcion manejarClickFuera
    document.addEventListener('click', manejarClickFuera)
    // despues de eso hara limpieza y removera el evento listener click y la funcion
    return () => document.removeEventListener('click', manejarClickFuera)
    }, [] )


    return (
        <header >

        {/* <!-- Barra Iconos --> */}
        <nav>
            <div className="nav-left">
                <button
                    ref = {menuBtnRef}
                    className ="menu-toggle"
                    // el onClick remplaza el addEventListener('click') y !menuAbierto es el toggle, si estaba true pasa a false y viceversa
                    onClick = {() => setMenuAbierto (!menuAbierto)}
                    aria-label ="Abrir menú"
                >
                    <img src="/ICONOS/Menu.png" alt="Menú" id="menubtn" className="menuicon"/>
                </button>
            </div> 
                <a href="/" className="Logo">THE OUTFIT</a>

                <div className="nav-right">

                    <a href="#buscar">
                        <img src="/ICONOS/Search.png" alt="Buscar" className="searchicon"/>
                    </a>

                <a href="#perfil">
                    <img src="/ICONOS/Person.png" alt="Perfil" className="profileicon"/>
                </a>

                <a href="#favoritos">
                    <img src="/ICONOS/Heart.png" alt="Favoritos" className="hearticon"/>
                </a>

                <a href="#carrito" >
                    <img src="/ICONOS/Shopping Cart.png" alt="Carrito" className="carritoicon"/>
                </a>

                </div>
        </nav>

        {/* <!-- Menu Despegable -->*/}
        {/* lo referenciamos con menuRef */}
        {/* en el operador condicional ternario, la condicion es menuAbierto, si se cumple (true) nos dara abierto, activando el evento, si no se cumple no devuelve nada */}
            <div ref={menuRef} className={`menu-desplegable ${menuAbierto ? 'abierto' : ''}`}>
                {/* anteriormente en Js removiamos la clase, pero ahora con el onClick simplemento se cambia a false, desactivando el menu desplegable */}
                <div className="exitbuttondiv" onClick={() => setMenuAbierto(false)}>
                    <a><img src="/ICONOS/EXIT.png" alt="salir" className="exitbutton"/></a>
                </div>
                <div>
                    <ul>
                        <li><a href="" className="part1">MUJERES</a></li>
                        <li><a href="" className="part1" >HOMBRES</a></li>
                        <li><a href="" className="part1">SUMMER COLLECTION</a></li>
                        <li><hr className="divmenu"/></li>
                        <li className="part2">LOCACIÓN</li>
                        <li><a href="" className="partinfo">#41-B LOCAL 1 CP1502, CALLE DEL MEDITERRÁNEO</a></li>
                        <li className="part3">CONTACTANOS</li>
                        <li><a href="" className="partinfo">+503 2261-3004</a></li>
                    </ul>
                    <div>
                        <button className="logout">CERRAR SESIÓN <img src="/ICONOS/logout.png" alt="" className="logouticon"/></button>
                    </div>
                </div>
            </div>

            {/* el overlay antes siempre existia en el HTML (con estado oculto con display:none) y se le agregaba o quitaba la clase .activo */}
            {/* aqui el menuAbierto && significa que solo renderiza este div si menuAbierto es true, si es false, este div no va a existir en el DOM*/}

            {/* con el && es la forma abreviada del condicional ternario, forma abreviada de: */}
            {/* {menuAbierto ? <div className="Overlay activo">...</div> : null} */}
            {menuAbierto && (
                // quiere decir que si le hacemos click al overlay se desactiva el menu desplegable
                <div className="Overlay" onClick={() => setMenuAbierto(false)}></div>
            )}

    </header>
    );
}
export default Headerv2;