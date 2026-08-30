function Header () {
    return (
        <header>

        {/* <!-- Barra Iconos --> */}
        <nav>
            <div className="nav-left">
                {/* <!-- lo ponemos en el "a" para que sea clickeable --> */}
                <a href="#menu">
                    <img src="\ICONOS\Menu.png" alt="Menú" id="menubtn" className="menuicon"/>
                </a>
            </div> 
                <a href="/" className="Logo">THE OUTFIT</a>

                <div className="nav-right">

                    <a href="#buscar">
                        <img src="\ICONOS\Search.png" alt="Buscar" className="searchicon"/>
                    </a>

                <a href="#perfil">
                    <img src="\ICONOS\Person.png" alt="Perfil" className="profileicon"/>
                </a>

                <a href="#favoritos">
                    <img src="\ICONOS\Heart.png" alt="Favoritos" className="hearticon"/>
                </a>

                <a href="#carrito" >
                    <img src="\ICONOS\Shopping Cart.png" alt="Carrito" className="carritoicon"/>
                </a>

                </div>
        </nav>

        {/* <!-- Menu Despegable -->
            <!-- Se le crea un id para referenciarlo en Js y la clase es para aplicarle estilos en css --> */}
            <div id="menuDesplegable" className="menu-desplegable">
                <div className="exitbuttondiv" id="cerrarMenu">
                    <a><img src="\ICONOS\EXIT.png" alt="" className="exitbutton"/></a>
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
                        <button className="logout">CERRAR SESIÓN <img src="\ICONOS\logout.png" alt="" className="logouticon"/></button>
                    </div>
                </div>
            </div>

    </header>
    );
}
export default Header;