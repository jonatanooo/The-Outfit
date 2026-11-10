"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { verificarAccesoServidor } from '@/lib/usuario';

export default function EmpleadoPage() {
    const router = useRouter();
    const { user: authUser, loading: authLoading } = useAuth();

    useEffect(() => {
        if (authLoading) return;

        let activo = true;
        async function verificar() {
            try {
                const acceso = await verificarAccesoServidor('empleado');
                if (!activo) return;
                if (!acceso.autorizado) {
                    router.replace(acceso.rol === 'anonimo' ? '/login' : '/');
                    return;
                }

                router.replace('/Inventario');
            } catch (err) {
                console.error('Error al verificar permisos de empleado:', err);
                if (activo) router.replace('/');
            }
        }

        verificar();
        return () => { activo = false; };
    }, [authUser, authLoading, router]);

    return null;
}
