"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SidebarAdmin from '@/components/SidebarAdmin';
import AdminHeader from '@/components/AdminHeader';
import AdminStats from '@/components/AdminStats';
import './Admin.css';

export default function AdminPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);

    useEffect(() => {
        const verificarUsuario = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const rol = user.user_metadata?.rol || 'usuario';
            if (rol !== 'admin') {
                router.push('/');
                return;
            }

            setUsuario(user);
        };

        verificarUsuario();
    }, [router]);

    // Stats de ejemplo (después se pueden conectar a Supabase)
    const stats = [
        { titulo: 'Productos activos', valor: 128, color: '#2e7d32' },
        { titulo: 'Productos inactivos', valor: 50, color: '#e65100' },
        { titulo: 'Stock bajo', valor: 10, color: '#f9a825' },
        { titulo: 'Sin stock', valor: 50, color: '#d32f2f' },
    ];

    return (
        <div className="admin-layout">
            <SidebarAdmin />

            <main className="admin-main">
                <AdminHeader
                    titulo="Panel de Administrador"
                    subtitulo={usuario ? `Bienvenido, ${usuario.email}` : 'Cargando...'}
                />

                <AdminStats stats={stats} />

                <div className="admin-bienvenida">
                    <h2>Bienvenido al panel</h2>
                    <p>
                        Desde aquí podés gestionar el inventario, las transacciones,
                        los empleados y más. Usá el menú lateral para navegar.
                    </p>
                </div>
            </main>
        </div>
    );
}