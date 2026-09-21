"use client";
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import './PerfilPanel.css';

// El padre (Header) llama a ref.current.refrescar() justo antes de abrir el panel,
// para recargar los campos con los datos actuales del usuario.
const PerfilPanel = forwardRef(function PerfilPanel({ abierto, usuario, onClose, onSesionCerrada }, ref) {
    const router = useRouter();
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

    useImperativeHandle(ref, () => ({
        refrescar() {
            if (!usuario) return;
            setNombre(usuario.user_metadata?.nombre || '');
            setTelefono(usuario.user_metadata?.telefono || '');
            setMensaje(null);
        },
    }), [usuario]);

    const handleGuardar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        setMensaje(null);

        const { error } = await supabase.auth.updateUser({
            data: { nombre, telefono },
        });

        setGuardando(false);
        if (error) {
            setMensaje({ tipo: 'error', texto: error.message || 'No se pudo guardar el cambio.' });
        } else {
            setMensaje({ tipo: 'ok', texto: 'Perfil actualizado.' });
        }
    };

    const handleCerrarSesion = async () => {
        await supabase.auth.signOut();
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
