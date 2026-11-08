"use client";
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebaseClient';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useCarrito } from '@/lib/CarritoContext';
import './PerfilPanel.css';

// El padre (Header) llama a ref.current.refrescar() justo antes de abrir el panel,
// para recargar los campos con los datos actuales del usuario.
const PerfilPanel = forwardRef(function PerfilPanel({ abierto, usuario, onClose, onSesionCerrada }, ref) {
    const router = useRouter();
    const { limpiarCarritoLocal } = useCarrito();
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

    useImperativeHandle(ref, () => ({
        refrescar() {
            if (!usuario) return;
            setNombre(usuario.displayName || usuario.Nombres || usuario.user_metadata?.nombre || '');
            setTelefono(usuario.Telefono || usuario.phoneNumber || usuario.user_metadata?.telefono || '');
            setMensaje(null);
        },
    }), [usuario]);

    const handleGuardar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        setMensaje(null);

        try {
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: nombre });

                // Actualizar en Firestore colección User y registrar en Auditoria_Actualizacion_User
                let datosPrevios = null;
                let idUserTarget = auth.currentUser.uid;
                try {
                    const directRef = doc(db, 'User', auth.currentUser.uid);
                    const directSnap = await getDoc(directRef);
                    if (directSnap.exists()) {
                        datosPrevios = directSnap.data();
                        idUserTarget = datosPrevios.ID_User ?? directSnap.id;
                        await updateDoc(directRef, {
                            Nombres: nombre,
                            Telefono: telefono,
                        });
                    } else {
                        throw new Error('Buscar por auth_id');
                    }
                } catch (errDoc) {
                    const q = query(collection(db, 'User'), where('auth_id', '==', auth.currentUser.uid));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        datosPrevios = snap.docs[0].data();
                        idUserTarget = datosPrevios.ID_User ?? snap.docs[0].id;
                        await updateDoc(doc(db, 'User', snap.docs[0].id), {
                            Nombres: nombre,
                            Telefono: telefono,
                        });
                    }
                }

                try {
                    const auditRef = doc(collection(db, 'Auditoria_Actualizacion_User'));
                    await setDoc(auditRef, {
                        ID_Auditoria: auditRef.id,
                        ID_User: idUserTarget,
                        ID_UserAccion: idUserTarget,
                        ValorAntiguo: `Nombre: ${datosPrevios?.Nombres || ''}, Teléfono: ${datosPrevios?.Telefono || ''}`,
                        ValorNuevo: `Nombre: ${nombre}, Teléfono: ${telefono}`,
                        Fecha_Registro: new Date().toISOString(),
                    });
                } catch (errAudit) {
                    console.error('Error guardando Auditoria_Actualizacion_User:', errAudit);
                }
            }
            setMensaje({ tipo: 'ok', texto: 'Perfil actualizado.' });
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            setMensaje({ tipo: 'error', texto: error.message || 'No se pudo guardar el cambio.' });
        } finally {
            setGuardando(false);
        }
    };

    const handleCerrarSesion = async () => {
        limpiarCarritoLocal();
        await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        await signOut(auth);
        onSesionCerrada?.();
        onClose();
        router.push('/login');
    };

    if (!usuario) return null;

    return (
        <div className={`perfil-panel ${abierto ? 'abierto' : ''}`}>
            <div className="perfil-exitbuttondiv" onClick={onClose}>
                <img src="/ICONOS/EXIT.png" alt="cerrar" className="perfil-exitbutton" />
            </div>

            <div className="perfil-contenido">
                <div className="perfil-avatar">
                    {(nombre || usuario.email || '?').charAt(0).toUpperCase()}
                </div>

                <h2 className="perfil-titulo">Mi perfil</h2>

                <form onSubmit={handleGuardar} className="perfil-form">
                    <label className="perfil-label">
                        Nombre
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="perfil-input"
                            placeholder="Nombre completo"
                        />
                    </label>

                    <label className="perfil-label">
                        Correo
                        <input
                            type="email"
                            value={usuario.email || ''}
                            disabled
                            className="perfil-input perfil-input-disabled"
                        />
                    </label>

                    <label className="perfil-label">
                        Teléfono
                        <input
                            type="tel"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                            maxLength={8}
                            className="perfil-input"
                            placeholder="00000000"
                        />
                    </label>

                    {mensaje && (
                        <p className={`perfil-mensaje perfil-mensaje-${mensaje.tipo}`}>{mensaje.texto}</p>
                    )}

                    <button type="submit" disabled={guardando} className="perfil-guardar">
                        {guardando ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                    </button>
                </form>

                <button type="button" className="logout perfil-logout" onClick={handleCerrarSesion}>
                    CERRAR SESIÓN <img src="/ICONOS/logout.png" alt="" className="logouticon" />
                </button>
            </div>
        </div>
    );
});

export default PerfilPanel;
