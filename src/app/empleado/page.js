"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { verificarAccesoServidor } from '@/lib/usuario';

export default function EmpleadoPage() {
    const router = useRouter();
    const { user: authUser, loading: authLoading } = useAuth();
    const [usuario, setUsuario] = useState(null);
    const [verificando, setVerificando] = useState(true);

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

                setUsuario(authUser || { uid: acceso.uid, email: '' });
                setVerificando(false);
            } catch (err) {
                console.error('Error al verificar permisos de empleado:', err);
                if (activo) router.replace('/');
            }
        }

        verificar();
        return () => { activo = false; };
    }, [authUser, authLoading, router]);

    if (verificando || !usuario) {
        return null;
    }

    return (
        <div style={{ padding: '40px' }}>
            <h1>Panel de Empleado</h1>
            <p>Bienvenido, {usuario.email}. Esta sección está en construcción.</p>
        </div>
    );
}
