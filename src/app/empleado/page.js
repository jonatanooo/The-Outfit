"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { verificarAccesoServidor } from '@/lib/usuario';

export default function EmpleadoPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);
    const [verificando, setVerificando] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.replace('/login');
                return;
            }

            try {
                // Validación autoritativa de sesión y rol en el servidor (/api/auth/session)
                const acceso = await verificarAccesoServidor('empleado');
                if (!acceso.autorizado) {
                    router.replace('/');
                    return;
                }

                setUsuario(user);
                setVerificando(false);
            } catch (err) {
                console.error('Error al verificar permisos de empleado:', err);
                router.replace('/');
            }
        });

        return () => unsubscribe();
    }, [router]);

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
