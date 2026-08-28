import './Header.css'
import { useState, useEffect, useRef } from 'react';

function Header () {
    const [scrolled, setScrolled] = useState(false)
    const [menuAbierto, setMenuAbierto] = useState(false)

    const menuRef = useRef(null)
    const menuBtnRef = useRef(null)

    // efecto de scroll
    useEffect(() => {
        const manejarScroll = () => {
            setScrolled(window.scrollY>50)
        }
        window.addEventListener('scroll', manejarScroll)
        return () => window.removeEventListener('scroll', manejarScroll)
    }, [])

    //cerrar menu al hacer click afuera
    useEffect (() => {
    const manejarClickFuera = (event) => {
        const clickDentroDelMenu = menuRef.current?.contains(event.target)
        const clickEnBotonMenu = menuBtnRed.current?.contains(event.target)
        if(!clickDentroDelMenu && !clickEnBotonMenu) {
            setMenuAbierto(false)
        }
    } 
    document.addEventListener('click', manejarClickFuera)
    return () => document.removeEventListener('click', manejarClickFuera)
    }, [] )


    return (
        <header className={scrolled ? 'scrolled' : ''}>

        {/* <!-- Barra Iconos --> */}
        <nav>
            <div className="nav-left">
                <button
                    ref = {menuBtnRef}
                    className ="menu-toggle"
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

        {/* <!-- Menu Despegable -->
            <!-- Se le crea un id para referenciarlo en Js y la clase es para aplicarle estilos en css --> */}
            <div ref={menuRef} className={`menu-desplegable ${menuAbierto ? 'abierto' : ''}`}>
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

            {menuAbierto && (
                <div className="Overlay activo" onClick={() => setMenuAbierto(false)}></div>
            )}

    </header>
    );
}
export default Header;