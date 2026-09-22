"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import './Admin.css';

export default function AdminPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);

    const [verificando, setVerificando] = useState(true);

    useEffect(() => {
        const verificarUsuario = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            // El proxy ya bloquea /admin a quien no tenga este rol; esta verificación
            // es una segunda capa por si la página se sirve desde caché.
            const rol = user.app_metadata?.rol || 'usuario';
            if (rol !== 'admin') {
                router.push('/');
                return;
            }

            // Redirigir directamente al inventario como pantalla principal del admin
            router.push('/Inventario');
        };

        verificarUsuario();
    }, [router]);

    // Retornamos null porque la página redirige inmediatamente
    return null;
}