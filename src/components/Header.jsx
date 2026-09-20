"use client"
import './Header.css'
import { useState, useEffect, useRef } from 'react';

// NUEVAS IMPORTACIONES PARA REDUX:
import { useSelector, useDispatch } from 'react-redux';
import { toggleCart } from '../store/slices/cartSlice'; // Ajusta la ruta a tu store si es necesario
import { toggleFavoritesOpen } from '../store/slices/favoritesSlice';
function Header () {
    
    const [scrolled, setScrolled] = useState(false)
    const [menuAbierto, setMenuAbierto] = useState(false)
    const categorias = [
        {id: 'mujer', 
            label: 'MUJERES ', 
            href:'',
            subcategorias: [
                {label: 'Ver Todo', href: '/productos'},
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
                {label: 'Ver Todo', href: '/productohombre'},
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
    const[categoriaActiva, setCategoriaActiva] = useState(null)

    const menuRef = useRef(null)
    const menuBtnRef = useRef(null)
    const menuSubcategoriaRef = useRef(null)

    // INICIALIZAMOS REDUX:
    const dispatch = useDispatch();
    const cartItems = useSelector((state) => state.cart.items);
    const favoriteItems = useSelector((state) => state.favorites.items);
    // Calculamos el total de prendas (sumando las cantidades de cada una)
    const totalItems = cartItems.reduce((total, item) => total + item.cantidad, 0);

    useEffect(() => {
        const manejarScroll = () => {
            setScrolled(window.scrollY>50)
        }
        window.addEventListener('scroll', manejarScroll)
        return () => window.removeEventListener('scroll', manejarScroll)
    }, [])

    useEffect (() => {
    const manejarClickFuera = (event) => {
        const clickDentroMenuSubcategoria = menuSubcategoriaRef.current?.contains(event.target)
        const clickDentroDelMenu = menuRef.current?.contains(event.target)
        const clickEnBotonMenu = menuBtnRef.current?.contains(event.target)
        if(!clickDentroDelMenu && !clickEnBotonMenu && !clickDentroMenuSubcategoria) {
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

               
{/* BOTÓN DE FAVORITOS CON GLOBITO DE NOTIFICACIÓN */}
                <a 
                    href="#favoritos" 
                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={(e) => {
                        e.preventDefault(); 
                        dispatch(toggleFavoritesOpen()); // Abre el Drawer de Favoritos
                    }}
                >
                    <img src="/ICONOS/Heart.png" alt="Favoritos" className="hearticon"/>
                    
                    {/* El globito solo aparece si hay 1 o más favoritos */}
                    {favoriteItems.length > 0 && (
                        <span 
                            style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-8px',
                                backgroundColor: '#E50000', 
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10
                            }}
                        >
                            {favoriteItems.length}
                        </span>
                    )}
                </a>
                {/* BOTÓN DEL CARRITO CON GLOBITO DE NOTIFICACIÓN */}
                <a 
                    href="#carrito" 
                    className='contenedor-carrito'
                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={(e) => {
                        e.preventDefault(); // Evita que recargue la página
                        dispatch(toggleCart()); // Abre tu Drawer lateral
                    }}
                >
                    <img src="/ICONOS/Shopping Cart.png" alt="Carrito" className="carritoicon"/>
                    
                    {/* El globito solo aparece si hay 1 o más productos */}
                    {totalItems > 0 && (
                        <span 
                            style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-8px',
                                backgroundColor: '#E50000', // Rojo llamativo para la notificación
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10
                            }}
                        >
                            {totalItems}
                        </span>
                    )}
                </a>

                </div>
        </nav>

        {/* <!-- Menu Despegable -->*/}
            <div ref={menuRef} className={`menu-desplegable ${menuAbierto ? 'abierto' : ''}`}>
                <div className="exitbuttondiv" onClick={() => setMenuAbierto(false)}>
                    <a><img src="/ICONOS/EXIT.png" alt="salir" className="exitbutton"/></a>
                </div>
                <div>
                    <ul>
                        {categorias.map((categoria) => (
                            <li key={categoria.id}>
                                <a href={categoria.href} className ="part1"
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

            {(menuAbierto || categoriaActiva) &&  (
                <div className="Overlay" onClick={() => {setMenuAbierto(false); setCategoriaActiva(null)}}></div>
            )}

            <div ref= {menuSubcategoriaRef} className={`menu-subca ${categoriaActiva ? 'abierto' : ''}`}>
                <div className="buttonsdiv">
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