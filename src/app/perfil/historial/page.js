"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DetallePedidoModal from '@/components/DetallePedidoModal';
import { useAuth } from '@/lib/AuthContext';
import { sincronizarSesionServidor } from '@/lib/usuario';
import {
  cargarPedidosCliente,
  claveEstadoPedido,
  obtenerTimestampFecha,
} from '@/lib/pedidosCliente';
import './historial.css';

function obtenerClaseBadgeEstado(estado) {
  const k = claveEstadoPedido(estado);
  if (k.includes('entregado')) return 'badge-entregado';
  if (k.includes('camino')) return 'badge-encamino';
  if (k.includes('cancel')) return 'badge-cancelado';
  return 'badge-pendiente';
}

export default function HistorialComprasPage() {
  const router = useRouter();
  const { user: authUser, userProfile, loading: authLoading } = useAuth();

  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);

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

        const lista = await cargarPedidosCliente(
          firebaseUserObjetivo,
          userProfile || sesion.userData || null
        );
        if (!activo) return;
        setPedidos(lista);
      } catch (err) {
        console.error('Error al cargar historial de compras:', err);
        if (activo) {
          setErrorCarga('No se pudo cargar tu historial de compras. Inténtalo nuevamente.');
        }
      } finally {
        if (activo) {
          setCargandoPedidos(false);
        }
      }
    }

    verificarYCargar();
    return () => {
      activo = false;
    };
  }, [authUser, authLoading, userProfile, router]);

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pedidos
      .filter((p) => {
        const coincideBusqueda =
          !q ||
          String(p.id).toLowerCase().includes(q) ||
          (p.productos || []).some((pr) =>
            String(pr.nombre || '').toLowerCase().includes(q)
          );

        const k = claveEstadoPedido(p.estado);
        const coincideEstado =
          filtroEstado === 'todos' ||
          (filtroEstado === 'pendientes' && k.includes('pendiente')) ||
          (filtroEstado === 'encamino' && k.includes('camino')) ||
          (filtroEstado === 'entregados' && k.includes('entregado'));

        return coincideBusqueda && coincideEstado;
      })
      .sort(
        (a, b) =>
          obtenerTimestampFecha(b.fechaTimestamp || b.fechaISO) -
          obtenerTimestampFecha(a.fechaTimestamp || a.fechaISO)
      );
  }, [pedidos, busqueda, filtroEstado]);

  // Condición estricta: si está verificando o no ha iniciado sesión, no mostrar nada
  if (verificandoAcceso || !autorizado) {
    return null;
  }

  return (
    <div className="historial-wrapper">
      <Header siempreSolido />

      <main className="historial-main">
        {/* Encabezado superior centrado */}
        <div className="historial-top-bar">
          <div className="historial-titulo-row">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Regresar"
              className="historial-back-btn"
            >
              ←
            </button>
            <div className="historial-titulo-centro">
              <h1 className="historial-titulo">HISTORIAL DE COMPRAS</h1>
              <span className="historial-count-pill">
                {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
          </div>

          {/* Buscador y filtros rápidos centrados */}
          <div className="historial-controles">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por pedido o prenda..."
              className="historial-buscador"
            />
            <div className="historial-filtros">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'pendientes', label: 'Pendientes' },
                { id: 'encamino', label: 'En camino' },
                { id: 'entregados', label: 'Entregados' },
              ].map((tab) => {
                const activo = filtroEstado === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFiltroEstado(tab.id)}
                    className={`historial-filtro-btn ${activo ? 'activo' : ''}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {errorCarga && <div className="historial-error">{errorCarga}</div>}

        {cargandoPedidos ? (
          <div className="historial-lista">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="historial-card" style={{ cursor: 'default' }}>
                <div className="historial-thumb skeleton" />
                <div className="historial-card-info" style={{ gap: '8px' }}>
                  <div className="skeleton" style={{ height: '16px', width: '48%' }} />
                  <div className="skeleton" style={{ height: '20px', width: '90px' }} />
                  <div className="skeleton" style={{ height: '13px', width: '160px' }} />
                  <div className="skeleton" style={{ height: '13px', width: '130px' }} />
                </div>
                <div className="skeleton" style={{ height: '36px', width: '155px', borderRadius: '8px' }} />
              </div>
            ))}
          </div>
        ) : pedidos.length === 0 ? (
          <div className="historial-empty">
            <p className="historial-empty-titulo">Aún no has realizado compras</p>
            <p className="historial-empty-texto">
              Cuando completes tu primer pedido en The Outfit, aparecerá listado aquí para consultar su detalle.
            </p>
            <Link href="/productos" className="historial-cta-btn">
              Explorar catálogo
            </Link>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="historial-empty">
            <p className="historial-empty-titulo">
              No hay pedidos que coincidan con tu búsqueda o filtro.
            </p>
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setFiltroEstado('todos');
              }}
              className="historial-cta-btn"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="historial-lista">
            {pedidosFiltrados.map((pedido) => {
              const listaProductos = pedido.productos || [];
              const primerProducto = listaProductos[0] || null;
              const masProductos = Math.max(0, listaProductos.length - 1);
              const nombrePrincipal =
                primerProducto?.nombre || `Pedido #${pedido.id}`;
              const tituloPedido =
                masProductos > 0
                  ? `${nombrePrincipal} y ${masProductos} más`
                  : nombrePrincipal;

              return (
                <article
                  key={pedido.id}
                  onClick={() => setPedidoSeleccionado(pedido)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPedidoSeleccionado(pedido);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="historial-card"
                >
                  {/* Miniatura izquierda */}
                  {primerProducto?.foto ? (
                    <div className="historial-thumb">
                      <img src={primerProducto.foto} alt={tituloPedido} />
                    </div>
                  ) : (
                    <div className="historial-thumb-placeholder">100 x 100</div>
                  )}

                  {/* Información central */}
                  <div className="historial-card-info">
                    <h2 className="historial-card-titulo">{tituloPedido}</h2>
                    <p className="historial-card-precio">
                      ${Number(pedido.total ?? 0).toFixed(2)}
                    </p>
                    <p className="historial-card-fecha">{pedido.fechaHoraLista}</p>
                    <p className="historial-card-ver">Ver detalles del pedido</p>
                  </div>

                  {/* Badge de estado a la derecha */}
                  <span
                    className={`historial-badge ${obtenerClaseBadgeEstado(
                      pedido.estado
                    )}`}
                  >
                    {String(pedido.estado || 'Pendiente').toUpperCase()}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal con el diseño del Panel Admin en modo solo lectura */}
      <DetallePedidoModal
        detalle={pedidoSeleccionado}
        onClose={() => setPedidoSeleccionado(null)}
      />

      <Footer />
    </div>
  );
}
