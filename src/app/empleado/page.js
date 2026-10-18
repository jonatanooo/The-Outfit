"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export default function EmpleadoPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                let rol = 'usuario';

                const docRef = doc(db, 'User', user.uid);
                const docSnap = await getDoc(docRef);
                let userData = docSnap.exists() ? docSnap.data() : null;

                if (!userData) {
                    const q = query(collection(db, 'User'), where('auth_id', '==', user.uid));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        userData = snap.docs[0].data();
                    } else if (user.email) {
                        const qE = query(collection(db, 'User'), where('Correo', '==', user.email));
                        const snapE = await getDocs(qE);
                        if (!snapE.empty) userData = snapE.docs[0].data();
                    }
                }

                if (userData) {
                    const puesto = (userData.Puesto || '').toLowerCase();
                    const rolCampo = (userData.Rol || '').toLowerCase();
                    if (userData.Es_Empleado || puesto === 'empleado' || rolCampo === 'empleado' || userData.ID_Rol === 2 || userData.ID_Rol === '2') {
                        rol = 'empleado';
                    }
                    if (puesto === 'admin' || rolCampo === 'admin' || userData.ID_Rol === 1 || userData.ID_Rol === '1') {
                        rol = 'admin';
                    }
                }

                const tokenResult = await user.getIdTokenResult().catch(() => null);
                if (tokenResult?.claims?.rol === 'admin' || tokenResult?.claims?.admin) rol = 'admin';
                if (tokenResult?.claims?.rol === 'empleado' || tokenResult?.claims?.empleado) rol = 'empleado';

                if (rol !== 'empleado' && rol !== 'admin') {
                    router.push('/');
                    return;
                }

                setUsuario(user);
            } catch (err) {
                console.error('Error al verificar permisos de empleado:', err);
                router.push('/');
            }
        });

        return () => unsubscribe();
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
