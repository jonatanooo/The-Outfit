"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import SidebarAdmin from '@/components/SidebarAdmin';
import AdminHeader from '@/components/AdminHeader';
import '../admin/Admin.css';

export default function ConfiguracionPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);
    const [verificando, setVerificando] = useState(true);

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
                    if (puesto === 'admin' || rolCampo === 'admin' || userData.ID_Rol === 1 || userData.ID_Rol === '1') {
                        rol = 'admin';
                    }
                }

                const tokenResult = await user.getIdTokenResult().catch(() => null);
                if (tokenResult?.claims?.rol === 'admin' || tokenResult?.claims?.admin) rol = 'admin';

                if (rol !== 'admin') {
                    router.push('/');
                    return;
                }

                setUsuario(user);
                setVerificando(false);
            } catch (err) {
                console.error('Error al verificar admin en configuracion:', err);
                router.push('/');
            }
        });

        return () => unsubscribe();
    }, [router]);

    const limpiarTallas = async () => {
        if (!confirm('¿Estás seguro de que deseas limpiar y unificar las tallas en la base de datos?')) return;
        
        try {
            // 1. Obtener todas las tallas
            const tiposSnap = await getDocs(collection(db, 'Tipos_Talla'));
            const tipos = tiposSnap.docs.map(d => ({ ...d.data(), _docId: d.id, ID_TipoTalla: d.data().ID_TipoTalla ?? d.id }));
            const standardNames = ['S', 'M', 'L', 'XL', 'XXL'];
            let standardIds = {};
            
            for (const name of standardNames) {
                let existing = tipos.find(t => t.Nombre_TipoTalla === name);
                if (!existing) {
                    const nuevoId = Date.now();
                    const nuevoTipo = { ID_TipoTalla: nuevoId, Nombre_TipoTalla: name };
                    await setDoc(doc(db, 'Tipos_Talla', String(nuevoId)), nuevoTipo);
                    standardIds[name] = nuevoId;
                } else {
                    standardIds[name] = existing.ID_TipoTalla;
                }
            }

            const tallasSnap = await getDocs(collection(db, 'Talla'));
            for (const d of tallasSnap.docs) {
                const talla = d.data();
                const tipoTalla = tipos.find(t => String(t.ID_TipoTalla) === String(talla.ID_TipoTalla));
                if (!tipoTalla) continue;
                
                let nombre = tipoTalla.Nombre_TipoTalla?.trim().toUpperCase() || 'S';
                if (nombre.includes('XLL') || nombre.includes('XXL')) nombre = 'XXL';
                else if (nombre.includes('XL')) nombre = 'XL';
                else if (nombre.includes('L')) nombre = 'L';
                else if (nombre.includes('M')) nombre = 'M';
                else nombre = 'S';
                
                const correctId = standardIds[nombre];
                if (correctId && String(talla.ID_TipoTalla) !== String(correctId)) {
                    await updateDoc(d.ref, { ID_TipoTalla: correctId });
                }
            }

            const keepIds = Object.values(standardIds).map(String);
            for (const d of tiposSnap.docs) {
                const tipo = d.data();
                const id = String(tipo.ID_TipoTalla ?? d.id);
                if (!keepIds.includes(id)) {
                    await deleteDoc(d.ref);
                }
            }

            alert('Base de datos de tallas limpiada y unificada correctamente.');
        } catch (err) {
            console.error(err);
            alert('Hubo un error al limpiar la base de datos.');
        }
    };

    if (verificando) {
        return null;
    }

    return (
        <div className="admin-layout">
            <SidebarAdmin />

            <main className="admin-main">
                <AdminHeader
                    titulo="Configuración"
                    subtitulo={`Ajustes de cuenta para ${usuario.email}`}
                />

                <div className="admin-configuracion">
                    <div className="config-header">
                        <img src="/ICONOS/configuracion.png" alt="Icono configuración" />
                        <h2>Configuración de Cuenta</h2>
                    </div>
                    <div className="config-datos">
                        <div className="dato-grupo">
                            <span className="dato-label">Correo electrónico</span>
                            <span className="dato-valor">{usuario.email}</span>
                        </div>
                        <div className="dato-grupo">
                            <span className="dato-label">Rol de usuario</span>
                            <span className="dato-valor" style={{ textTransform: 'capitalize' }}>
                                Administrador
                            </span>
                        </div>
                    </div>
                    <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                        <h3>Mantenimiento</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>
                            Unifica las tallas duplicadas de la base de datos dejando solo S, M, L, XL, XXL.
                        </p>
                        <button 
                            onClick={limpiarTallas}
                            style={{ padding: '10px 20px', backgroundColor: '#111', color: '#fff', borderRadius: '6px', cursor: 'pointer', border: 'none' }}
                        >
                            Limpiar Tallas de BD
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
