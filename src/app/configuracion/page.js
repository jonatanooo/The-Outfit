"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SidebarAdmin from '@/components/SidebarAdmin';
import AdminHeader from '@/components/AdminHeader';
import '../admin/Admin.css'; // Reusing the admin layout CSS

export default function ConfiguracionPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);
    const [verificando, setVerificando] = useState(true);

    useEffect(() => {
        const verificarUsuario = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const rol = user.app_metadata?.rol || 'usuario';
            if (rol !== 'admin') {
                router.push('/');
                return;
            }

            setUsuario(user);
            setVerificando(false);
        };

        verificarUsuario();
    }, [router]);

    const limpiarTallas = async () => {
        if (!confirm('¿Estás seguro de que deseas limpiar y unificar las tallas en la base de datos?')) return;
        
        try {
            // 1. Obtener todas las tallas
            const { data: tipos } = await supabase.from('Tipos_Talla').select('*');
            const standardNames = ['S', 'M', 'L', 'XL', 'XXL'];
            let standardIds = {};
            
            for (const name of standardNames) {
                let existing = tipos.find(t => t.Nombre_TipoTalla === name);
                if (!existing) {
                    const { data } = await supabase.from('Tipos_Talla').insert({ Nombre_TipoTalla: name }).select().single();
                    if(data) standardIds[name] = data.ID_TipoTalla;
                } else {
                    standardIds[name] = existing.ID_TipoTalla;
                }
            }

            const { data: tallas } = await supabase.from('Talla').select('*');
            for (const talla of tallas) {
                const tipoTalla = tipos.find(t => t.ID_TipoTalla === talla.ID_TipoTalla);
                if (!tipoTalla) continue;
                
                let nombre = tipoTalla.Nombre_TipoTalla?.trim().toUpperCase() || 'S';
                if (nombre.includes('XLL') || nombre.includes('XXL')) nombre = 'XXL';
                else if (nombre.includes('XL')) nombre = 'XL';
                else if (nombre.includes('L')) nombre = 'L';
                else if (nombre.includes('M')) nombre = 'M';
                else nombre = 'S';
                
                const correctId = standardIds[nombre];
                if (correctId && talla.ID_TipoTalla !== correctId) {
                    await supabase.from('Talla').update({ ID_TipoTalla: correctId }).eq('ID_Talla', talla.ID_Talla);
                }
            }

            const keepIds = Object.values(standardIds);
            for (const tipo of tipos) {
                if (!keepIds.includes(tipo.ID_TipoTalla)) {
                    await supabase.from('Tipos_Talla').delete().eq('ID_TipoTalla', tipo.ID_TipoTalla);
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
                                {usuario.app_metadata?.rol || 'Administrador'}
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

