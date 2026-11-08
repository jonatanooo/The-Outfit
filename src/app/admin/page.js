"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { verificarAccesoServidor } from '@/lib/usuario';
import './Admin.css';

export default function AdminPage() {
    const router = useRouter();
    const { loading: authLoading } = useAuth();

    useEffect(() => {
        if (authLoading) return;

        let activo = true;
        async function verificar() {
            try {
                const acceso = await verificarAccesoServidor('admin');
                if (!activo) return;
                if (!acceso.autorizado) {
                    router.replace(acceso.rol === 'anonimo' ? '/login' : '/');
                    return;
                }
                router.replace('/Inventario');
            } catch (err) {
                console.error('Error al verificar permisos de administrador:', err);
                if (activo) router.replace('/');
            }
        }

        verificar();
        return () => { activo = false; };
    }, [authLoading, router]);

    return null;
}
