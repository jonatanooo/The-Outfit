"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import './Admin.css';

export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                // Verificar rol en Firestore
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
                    if (puesto === 'admin' || rolCampo === 'admin' || userData.ID_Rol === 1 || userData.ID_Rol === '1') {
                        rol = 'admin';
                    }
                }

                // Fallback por claims si existen
                const tokenResult = await user.getIdTokenResult().catch(() => null);
                if (tokenResult?.claims?.rol === 'admin' || tokenResult?.claims?.admin) {
                    rol = 'admin';
                }

                if (rol !== 'admin') {
                    router.push('/');
                    return;
                }

                router.push('/Inventario');
            } catch (err) {
                console.error('Error al verificar permisos de administrador:', err);
                router.push('/');
            }
        });

        return () => unsubscribe();
    }, [router]);

    return null;
}