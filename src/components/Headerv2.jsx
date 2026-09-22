"use client"
import './Headerv2.css'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import PerfilPanel from './PerfilPanel';
import Buscador from './Buscador';
import { useCarrito } from '@/lib/CarritoContext';

function Headerv2 () {
    // comentario Jona
    // Los 2 useState son las banderas que remplazan las clases CSS que antes agregaba/quitaba en JS con classList.scrolled reemplaza la clase .scrolled del header,
    // menuAbierto reemplaza la clase .abierto del menu
    const [scrolled, setScrolled] = useState(false)
    const [menuAbierto, setMenuAbierto] = useState(false)
    const { totalItems } = useCarrito();
    const [buscadorAbierto, setBuscadorAbierto] = useState(false)
    const [usuario, setUsuario] = useState(null)
    const [perfilAbierto, setPerfilAbierto] = useState(false)
    const perfilPanelRef = useRef(null)
    const router = useRouter();
    const sesionActiva = !!usuario
    const [categorias, setCategorias] = useState([
        {id: 'mujer', label: 'MUJERES ', href: '', subcategorias: [{label: 'Ver Todo', href: '/productos'}]},
        {id: 'hombre', label: 'HOMBRES', href: '', subcategorias: [{label: 'Ver Todo', href: '/productos-hombre'}]},
        {id: 'summer', label: 'SUMMER COLLECTION', href: ''}
    ]);

    useEffect(() => {
        async function cargarCategoriasMenu() {
            const { data, error } = await supabase
                .from("Categorias_Producto")
                .select("ID_CategoriaPadre, Nombre_Categoria")
                .in("ID_CategoriaPadre", [56, 57]);

            if (error || !data) {
                console.error("Error cargando categorias del header:", error);
                return;
            }

            const subMujer = data.filter(c => c.ID_CategoriaPadre === 56).map(c => ({
                label: c.Nombre_Categoria,
                href: `/productos?categoria=${encodeURIComponent(c.Nombre_Categoria)}`
            }));
            const subHombre = data.filter(c => c.ID_CategoriaPadre === 57).map(c => ({
                label: c.Nombre_Categoria,
                href: `/productos-hombre?categoria=${encodeURIComponent(c.Nombre_Categoria)}`
            }));

            setCategorias([
                {
                    id: 'mujer',
                    label: 'MUJERES ',
                    href: '',
                    subcategorias: [
                        { label: 'Ver Todo', href: '/productos' },
                        ...subMujer
                    ]
                },
                {
                    id: 'hombre',
                    label: 'HOMBRES',
                    href: '',
                    subcategorias: [
                        { label: 'Ver Todo', href: '/productos-hombre' },
                        ...subHombre
                    ]
                },
                {
                    id: 'summer',
                    label: 'SUMMER COLLECTION',
                    href: ''
                }
            ]);
        }
        cargarCategoriasMenu();
    }, []);
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

    // guarda el usuario logueado (o null) para mostrar el botón de perfil/cerrar sesión
    useEffect(() => {
        const verificarBaneo = async (userObj) => {
            if (!userObj) return false;
            const { data } = await supabase.from('User').select('ID_EstadoUsuario').eq('Correo', userObj.email).maybeSingle();
            if (data && data.ID_EstadoUsuario === 2) {
                alert('Tu cuenta fue baneada. No tienes acceso al sitio.');
                await supabase.auth.signOut();
                router.push('/login');
                return true;
            }
            return false;
        };

        supabase.auth.getUser().then(async ({ data: { user } }) => {
            const baneado = await verificarBaneo(user);
            if (!baneado) setUsuario(user);
        });

        const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const baneado = await verificarBaneo(session?.user);
            if (!baneado) setUsuario(session?.user ?? null);
        });

        return () => listener.subscription.unsubscribe();
    }, [router]);

    const handleClickPerfil = () => {
        if (sesionActiva) {
            perfilPanelRef.current?.refrescar()
            setPerfilAbierto(true)
        } else {
            router.push('/login')
        }
    }

    const handleCerrarSesion = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        // la cual es un operador condicional ternario en el cual si la condicion es scrolled dara como verdadero scrolled si es falso no dara ningun valor
        <header className={`header-v2 ${scrolled ? 'scrolled' : ''}`}>

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

                    <button
                        type="button"
                        className="search-toggle"
                        onClick={() => setBuscadorAbierto(true)}
                        aria-label="Buscar"
                    >
                        <img src="/ICONOS/Search.png" alt="Buscar" className="searchicon"/>
                    </button>
                {/* En el proyecto solo hay 2 roles con panel propio: admin y empleado.
                    Este acceso rapido solo se muestra para admin (empleado ya tiene su
                    propio panel en /empleado). */}
                {usuario?.app_metadata?.rol === 'admin' && (
                    <Link href="/Inventario" className="btn-admin">
                        ADMIN
                    </Link>
                )}


                <button
                    type="button"
                    onClick={handleClickPerfil}
                    aria-label="Perfil"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <img src="/ICONOS/Person.png" alt="Perfil" className="profileicon"/>
                </button>

                <a href="/favoritos">
                    <img src="/ICONOS/Heart.png" alt="Favoritos" className="hearticon"/>
                </a>

                <a href="/carrito" className='contenedor-carrito'>
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
                <div className="menu-contenido">
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
                    <div className="logout-container">
                        {!sesionActiva && (
                            <a className="logout" href="/login">
                                INICIAR SESI�N
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* el overlay antes siempre existia en el HTML (con estado oculto con display:none) y se le agregaba o quitaba la clase .activo */}
            {/* aqui el menuAbierto && significa que solo renderiza este div si menuAbierto es true, si es false, este div no va a existir en el DOM*/}

            {/* con el && es la forma abreviada del condicional ternario, forma abreviada de: */}
            {/* {menuAbierto ? <div className="Overlay activo">...</div> : null} */}
            {/* pusimos las 2 condiciones */}
            {(menuAbierto || categoriaActiva || perfilAbierto) &&  (
                // quiere decir que si le hacemos click al overlay se desactiva el menu desplegable
                <div className="Overlay" onClick={() => {setMenuAbierto(false); setCategoriaActiva(null); setPerfilAbierto(false)}}></div>
            )}

            <PerfilPanel
                ref={perfilPanelRef}
                abierto={perfilAbierto}
                usuario={usuario}
                onClose={() => setPerfilAbierto(false)}
                onSesionCerrada={() => setUsuario(null)}
            />

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
                                {subcategoria.href ? (
                                    <Link
                                        href={subcategoria.href}
                                        className="partsubca"
                                        onClick={() => { setCategoriaActiva(null); setMenuAbierto(false) }}
                                    >
                                        {subcategoria.label}
                                    </Link>
                                ) : (
                                    <a href={subcategoria.href} className="partsubca">
                                        {subcategoria.label}
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {buscadorAbierto && <Buscador onClose={() => setBuscadorAbierto(false)} />}

    </header>
    );
}
export default Headerv2;