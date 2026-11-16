"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { DetallePedidoContenido } from '@/components/DetallePedidoModal';
import { useAuth } from '@/lib/AuthContext';
import { sincronizarSesionServidor } from '@/lib/usuario';
import { cargarPedidoClientePorId } from '@/lib/pedidosCliente';
import '../historial.css';

export default function DetallePedidoClientePage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser, userProfile, loading: authLoading } = useAuth();

  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [cargandoPedido, setCargandoPedido] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const pedidoId = params?.id;

  useEffect(() => {
    if (authLoading) return;

    let activo = true;
    async function verificarYCargar() {
      try {
        const sesion = await sincronizarSesionServidor(authUser || null);
        if (!activo) return;

        if (!sesion?.authenticated || sesion?.baneado) {
          setAutorizado(false);
          setVerificandoAcceso(false);
          router.replace('/login');
          return;
        }

        const firebaseUserObjetivo = authUser || {
          uid: sesion.uid,
          email: sesion.email || '',
        };

        setAutorizado(true);
        setVerificandoAcceso(false);

        const encontrado = await cargarPedidoClientePorId(
          firebaseUserObjetivo,
          pedidoId,
          userProfile || sesion.userData || null
        );
        if (!activo) return;
        setPedido(encontrado);
      } catch (err) {
        console.error('Error al cargar detalle del pedido:', err);
        if (activo) {
          setErrorCarga('No se pudo cargar la información del pedido.');
        }
      } finally {
        if (activo) {
          setCargandoPedido(false);
        }
      }
    }

    verificarYCargar();
    return () => {
      activo = false;
    };
  }, [authUser, authLoading, userProfile, pedidoId, router]);

  // Condición estricta: si está verificando o no ha iniciado sesión, no mostrar nada
  if (verificandoAcceso || !autorizado) {
    return null;
  }

  return (
    <div className="historial-wrapper" style={{ backgroundColor: '#f8f7f6' }}>
      <Header siempreSolido />

      <main className="historial-detalle-main">
        <div className="historial-volver-wrap">
          <Link href="/perfil/historial" className="historial-volver-btn">
            <span aria-hidden="true">←</span>
            Volver al historial de compras
          </Link>
        </div>

        {errorCarga && <div className="historial-error">{errorCarga}</div>}

        {cargandoPedido ? (
          <div
            className="skeleton"
            style={{ width: '100%', height: '380px', borderRadius: '16px' }}
          />
        ) : !pedido ? (
          <div className="historial-empty">
            <h1 className="historial-empty-titulo">Pedido no encontrado</h1>
            <p className="historial-empty-texto">
              Este pedido no existe o no pertenece a tu cuenta actual.
            </p>
            <Link href="/perfil/historial" className="historial-cta-btn">
              Ver mis pedidos
            </Link>
          </div>
        ) : (
          <DetallePedidoContenido detalle={pedido} />
        )}
      </main>

      <Footer />
    </div>
  );
}
