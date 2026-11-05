"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { verificarAccesoServidor } from '@/lib/usuario';
import './Admin.css';

export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.replace('/login');
                return;
            }

            try {
                // Validación autoritativa de sesión y rol en el servidor (/api/auth/session)
                const acceso = await verificarAccesoServidor('admin');
                if (!acceso.autorizado) {
                    router.replace('/');
                    return;
                }

                router.replace('/Inventario');
            } catch (err) {
                console.error('Error al verificar permisos de administrador:', err);
                router.replace('/');
            }
        });

        return () => unsubscribe();
    }, [router]);

    return null;
}
