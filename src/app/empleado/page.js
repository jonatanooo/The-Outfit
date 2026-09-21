"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function EmpleadoPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);

    useEffect(() => {
        const verificarUsuario = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const rol = user.app_metadata?.rol || 'usuario';
            if (rol !== 'empleado' && rol !== 'admin') {
                router.push('/');
                return;
            }

            setUsuario(user);
        };

        verificarUsuario();
    }, [router]);

    if (!usuario) {
        return null;
    }

    return (
        <div style={{ padding: '40px' }}>
            <h1>Panel de Empleado</h1>
            <p>Bienvenido, {usuario.email}. Esta sección está en construcción.</p>
        </div>
    );
}
