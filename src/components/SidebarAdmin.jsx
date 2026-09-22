"use client";
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import './SidebarAdmin.css';

function SidebarAdmin() {
    // expandido reemplaza el estado visual del sidebar (ancho grande vs angosto)
    const [expandido, setExpandido] = useState(true);
    const pathname = usePathname();
     const sidebarRef = useRef(null);
    const toggleBtnRef = useRef(null);
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
    { icon: '/ICONOS/empleados.png', label: 'Empleados', href: '/empleados' },
    { icon: '/ICONOS/reportes.png', label: 'Reportes', href: '/reportes' },
    { icon: '/ICONOS/configuracion.png', label: 'Configuración', href: '#' }
];


    return (
        // 
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
                {expandido && <span className="marca">THE OUTFIT</span>}
            </div>

            {/* el menuItems.map() recorre cada item del arreglo y genera un enlace <a> para cada uno, usando sus propios datos (icono, label, href) */}
            <nav>
                {menuItems.map((item) => {
                    // marca como activo el enlace cuya ruta coincide con la URL actual
                    const activo = item.href !== '#' && pathname?.toLowerCase().startsWith(item.href.toLowerCase());
                    return (
                        <a
                            key={item.label}
                            href={item.href}
                            className={`menu-item ${activo ? 'activo' : ''}`}
                        >
                         <img src={item.icon} alt={item.label} className="menu-icon" />
                         {expandido && <span className="menu-label">{item.label}</span>}
                         {/* el && solo muestra el texto si expandido es true y el span con el texto desaparece cuando el sidebar está recogido */}
                        </a>
                    );
                })}
            </nav>
        </aside>
    );
}

export default SidebarAdmin;