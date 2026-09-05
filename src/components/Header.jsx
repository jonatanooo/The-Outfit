"use client"
import './Header.css'
import { useState, useEffect, useRef } from 'react';

function Header () {
    // comentario Jona
    // Los 2 useState son las banderas que remplazan las clases CSS que antes agregaba/quitaba en JS con classList.scrolled reemplaza la clase .scrolled del header, 
    // menuAbierto reemplaza la clase .abierto del menu
    const [scrolled, setScrolled] = useState(false)
    const [menuAbierto, setMenuAbierto] = useState(false)
    const categorias = [
        {id: 'mujer', 
            label: 'MUJERES ', 
            href:'',
            subcategorias: [
                {label: 'Ver Todo', href: ''},
                {label: 'Blusas', href: ''},
                {label: 'Vestidos', href: ''},
                {label: 'Pantalones', href: ''},
                {label: 'Carteras', href: ''},
                {label: 'Zapatos', href: ''},
                {label: 'Accesorios', href: ''},
                {label: 'Chaquetas', href: ''}
            ]    
        },
        {
            id: 'hombre',
            label: 'HOMBRES',
            href:'',
            subcategorias: [
                {label: 'Ver Todo', href: ''},
                {label: 'Camisas', href: ''},
                {label: 'Camisetas', href: ''},
                {label: 'Pantalones', href: ''},
                {label: 'Sueteres', href: ''},
                {label: 'Zapatos', href: ''},
                {label: 'Accesorios', href: ''},
                {label: 'Chaquetas', href: ''}
            ]
        },
        {
            id: 'summer',
            label: 'SUMMER COLLECTION',
            href:'',
        }
    ]
    // empieza en null porque cuando abrimos el menu, ninguna categoria esta activalueg
    const[categoriaActiva, setCategoriaActiva] = useState(null)

    // antes en el JS usaba "document.getElementById("menuDespegable")" y  "document.getElementById("menubtn")"
    // useRef es el equivalente en React, te da una caja que apunta al elemento real una vez que se renderiza sin necesidad de buscarlo por ID
    const menuRef = useRef(null)
    const menuBtnRef = useRef(null)
    const menuSubcategoriaRef = useRef(null)

    // se conectan al html asi
    // <div ref={menuRef} className="menu-desplegable">
    // <button ref={menuBtnRef} className="menu-toggle"></button>

    // efecto de scroll
    useEffect(() => {
        // creamos una funcion la cual contiene una constante llamada manejarScroll, el cual va a ser una funcion que active el estado setScrolled cuando bajemos mas de 50px
        const manejarScroll = () => {
            setScrolled(window.scrollY>50)
        }
        // ponemos un listener, es decir que se active cuando se haga scroll
        window.addEventListener('scroll', manejarScroll)
        // el return es la limpieza, le dice a React que si el componente desaparece de la pantalla, deja de escuchar el scrolll
        return () => window.removeEventListener('scroll', manejarScroll)
        // el [] significa que se ejecute una sola vez, cuando el componente aparece por primera vez, es decir que solo corriera una vez al cargar la pag
    }, [])

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
        const clickDentroMenuSubcategoria = menuSubcategoriaRef.current?.contains(event.target)
        const clickDentroDelMenu = menuRef.current?.contains(event.target)
        const clickEnBotonMenu = menuBtnRef.current?.contains(event.target)
        if(!clickDentroDelMenu && !clickEnBotonMenu && !clickDentroMenuSubcategoria) {
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
        // la cual es un operador condicional ternario en el cual si la condicion es scrolled dara como verdadero scrolled si es falso no dara ningun valor
        <header className={scrolled ? 'scrolled' : ''}>

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
                        {/* de la constante categoria creo un map con una variable inventada 'categoria', en el cual con ella pondria los atributos como id etc */}
                        {categorias.map((categoria) => (
                            <li key={categoria.id}>
                                <a href={categoria.href} className ="part1"
                                    // el onClick remplaza el addEventListener('click') y !menuAbierto es el toggle, si estaba true pasa a false y viceversa
                                    onClick = {(event) => {{event.preventDefault(); setMenuAbierto(false)} 
                                    setCategoriaActiva(categoria.id)}}
                                    aria-label ="Abrir menú" >{categoria.label}</a>
                            </li>
                        ))}


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
            {/* pusimos las 2 condiciones */}
            {(menuAbierto || categoriaActiva) &&  (
                // quiere decir que si le hacemos click al overlay se desactiva el menu desplegable
                <div className="Overlay" onClick={() => {setMenuAbierto(false); setCategoriaActiva(null)}}></div>
            )}

                {/* en el operador ternario no comparamos nada, solo con preguntar si categoriaActiva tiene un valor verdadero (no es null). Si es cualquier string vacio lo toma como true  */}
            <div ref= {menuSubcategoriaRef} className={`menu-subca ${categoriaActiva ? 'abierto' : ''}`}>
                 {/* anteriormente en Js removiamos la clase, pero ahora con el onClick simplemento se cambia a false, desactivando el menu desplegable */}
                <div className="buttonsdiv">
                    {/* en el onClick para que se cumplan 2 eventos hay que ponerlos asi () => {algo; algo2} */}
                        <div className="exitbuttondiv" onClick={() => {setCategoriaActiva(null)}}>
                            <a><img src="/ICONOS/EXIT.png" alt="salir" className="exitbutton"/></a>
                        </div>
                        <div className="backbuttondiv" onClick={() => {setCategoriaActiva(null); setMenuAbierto(true)}}>
                            <a><img src="/ICONOS/previous.png" alt="atras" className="backbutton"/></a>
                        </div>
                </div>
            
                <div>
                    <ul>
                        {categorias.find((categoria) => categoria.id === categoriaActiva)
                        // el ?. le dice a JS que si lo que esta antes de este punto es undefined o null, no siga intentano acceder a la propiedas, simplemente para ahi y devuelve undefined"
                        ?.subcategorias?.map((subcategoria) => (
                            <li key={subcategoria.label}>
                                <a href={subcategoria.href} className="partsubca">
                                    {subcategoria.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

    </header>
    );
}
export default Header;