"use client";
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { verificarAccesoServidor } from '@/lib/usuario';
import './SidebarAdmin.css';

function SidebarAdmin() {
    // expandido reemplaza el estado visual del sidebar (ancho grande vs angosto)
    const [expandido, setExpandido] = useState(true);
    const pathname = usePathname();
    const router = useRouter();
    const { user: authUser, loading: authLoading } = useAuth();
    const sidebarRef = useRef(null);
    const toggleBtnRef = useRef(null);

    // Guard global de seguridad del Panel de Administración:
    // Solo los usuarios en la lista de Empleados (ID_Rol administrativo/empleado o Es_Empleado == true)
    // tienen permiso para ver y navegar por el panel.
    useEffect(() => {
        if (authLoading) return;
        let activo = true;

        async function validarGuardPanel() {
            const acceso = await verificarAccesoServidor('admin');
            if (!activo) return;
            if (!acceso.autorizado) {
                router.replace(acceso.rol === 'anonimo' ? '/login' : '/');
            }
        }

        validarGuardPanel();
        return () => { activo = false; };
    }, [authUser, authLoading, pathname, router]);

    useEffect(() => {
        const manejarClickFuera = (event) => {
            // preguntamos si el click fue dentro del sidebar o en el boton toggle
            const clickDentroSidebar = sidebarRef.current?.contains(event.target);
            const clickEnBoton = toggleBtnRef.current?.contains(event.target);

            // si el click NO fue en ninguno de los dos, recogemos el sidebar
            if (!clickDentroSidebar && !clickEnBoton) {
                setExpandido(false);
            }
        };

        document.addEventListener('click', manejarClickFuera);
        // limpieza: quitamos el listener cuando el componente se desmonta
        return () => document.removeEventListener('click', manejarClickFuera);
    }, []);

    const menuItems = [
        { icon: '/ICONOS/inventario.png', label: 'Inventario', href: '/Inventario' },
        { icon: '/ICONOS/transacciones.png', label: 'Transacciones', href: '/transacciones' },
        { icon: '/ICONOS/empleados.png', label: 'Usuarios', href: '/usuarios' },
        { icon: '/ICONOS/reportes.png', label: 'Reportes', href: '/reportes' },
        { icon: '/ICONOS/configuracion.png', label: 'Configuración', href: '/configuracion' }
    ];

    return (
        <aside ref={sidebarRef} className={`sidebar ${expandido ? 'expandido' : 'recogido'}`}>
            
            <div className="sidebar-header">
                <button
                    ref={toggleBtnRef}
                    className="toggle-btn"
                    onClick={() => setExpandido(!expandido)}
                    aria-label="Expandir o recoger menú"
                >
                    ☰
                </button>
                {/* el && solo muestra el texto si expandido es true */}
                {expandido && <Link href="/" className="marca" style={{ color: 'inherit' }}>THE OUTFIT</Link>}
            </div>

            {/* el menuItems.map() recorre cada item del arreglo y genera un enlace <a> para cada uno, usando sus propios datos (icono, label, href) */}
            <nav>
                {menuItems.map((item) => {
                    // marca como activo el enlace cuya ruta coincide con la URL actual
                    const rutaActual = pathname?.toLowerCase() || '';
                    const activo =
                        item.href !== '#' &&
                        (rutaActual.startsWith(item.href.toLowerCase()) ||
                            (item.href === '/usuarios' && rutaActual.startsWith('/empleados')));
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={`menu-item ${activo ? 'activo' : ''}`}
                        >
                            <img src={item.icon} alt={item.label} className="menu-icon" />
                            {expandido && <span className="menu-label">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}

export default SidebarAdmin;