"use client";

import { useState, useEffect } from 'react';
import SidebarAdmin from '@/components/SidebarAdmin.jsx';
import { db } from '@/lib/firebaseClient';
import { collection, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import './transacciones.css';

function AdminTransacciones() {
    // estados de la tabla principal
    const [busqueda, setBusqueda] = useState('');
    const [pedidos, setPedidos] = useState([]);
    const [estadosCatalogo, setEstadosCatalogo] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    // filtro por estado
    const [filtroEstado, setFiltroEstado] = useState('todos');

    // modal de detalle
    const [detalle, setDetalle] = useState(null);
    const [nuevoEstado, setNuevoEstado] = useState('');
    const [guardando, setGuardando] = useState(false);

    // carga inicial
    useEffect(() => {
        cargarPedidos();
        cargarEstados();
    }, []);

    // catalogo de estados para el "guardar cambios"
    async function cargarEstados() {
        try {
            const snap = await getDocs(collection(db, 'Estado_Pedido'));
            const data = snap.docs.map((d) => ({
                ...d.data(),
                ID_EstadoPedido: d.data().ID_EstadoPedido ?? d.id,
            }));
            data.sort((a, b) => (Number(a.ID_EstadoPedido) || 0) - (Number(b.ID_EstadoPedido) || 0));
            setEstadosCatalogo(data);
        } catch (err) {
            console.error('Error cargando estados de pedido:', err);
        }
    }

    // trae los pedidos con cliente, estado, pagos, líneas de detalle y dirección.
    async function cargarPedidos() {
        setCargando(true);
        setError('');

        try {
            const [
                pedidosSnap,
                detallesSnap,
                transSnap,
                estadosSnap,
                userSnap,
                dirSnap,
                varSnap,
                prodSnap,
                fotosSnap,
                tallaSnap,
                tiposTallaSnap
            ] = await Promise.all([
                getDocs(collection(db, 'Pedido')),
                getDocs(collection(db, 'Pedido_Detalle')),
                getDocs(collection(db, 'Transacciones_Pago')),
                getDocs(collection(db, 'Estado_Pedido')),
                getDocs(collection(db, 'User')),
                getDocs(collection(db, 'Direcciones')),
                getDocs(collection(db, 'Variante_Producto')),
                getDocs(collection(db, 'Productos')),
                getDocs(collection(db, 'Fotos_Productos')),
                getDocs(collection(db, 'Talla')),
                getDocs(collection(db, 'Tipos_Talla'))
            ]);

            // 1. Fotos por producto
            const fotosPorProd = {};
            fotosSnap.docs.forEach((d) => {
                const f = d.data();
                const pid = f.ID_Producto;
                if (pid != null) {
                    if (!fotosPorProd[pid]) fotosPorProd[pid] = [];
                    fotosPorProd[pid].push(f);
                    if (!fotosPorProd[String(pid)]) fotosPorProd[String(pid)] = fotosPorProd[pid];
                }
            });

            // 2. Tipos de Talla y Talla
            const tiposTallaMap = {};
            tiposTallaSnap.docs.forEach((d) => {
                const t = d.data();
                const id = t.ID_TipoTalla ?? d.id;
                tiposTallaMap[id] = t;
                tiposTallaMap[String(id)] = t;
            });

            const tallaMap = {};
            tallaSnap.docs.forEach((d) => {
                const t = d.data();
                const id = t.ID_Talla ?? d.id;
                tallaMap[id] = { ...t, Tipos_Talla: tiposTallaMap[t.ID_TipoTalla] || null };
                tallaMap[String(id)] = tallaMap[id];
            });

            // 3. Productos y Variantes
            const prodMap = {};
            prodSnap.docs.forEach((d) => {
                const p = d.data();
                const pid = p.ID_Producto ?? d.id;
                prodMap[pid] = {
                    ...p,
                    Fotos_Productos: fotosPorProd[pid] || fotosPorProd[String(pid)] || []
                };
                prodMap[String(pid)] = prodMap[pid];
            });

            const varMap = {};
            varSnap.docs.forEach((d) => {
                const v = d.data();
                const vid = v.ID_Variante ?? d.id;
                varMap[vid] = {
                    ...v,
                    Productos: prodMap[v.ID_Producto] || prodMap[String(v.ID_Producto)] || null,
                    Talla: tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || null
                };
                varMap[String(vid)] = varMap[vid];
            });

            // 4. Detalles de pedido
            const detallesPorPedido = {};
            detallesSnap.docs.forEach((d) => {
                const det = d.data();
                const pedId = det.ID_Pedido;
                if (pedId != null) {
                    const item = {
                        ...det,
                        ID_PedidoDetalle: det.ID_PedidoDetalle ?? d.id,
                        Variante_Producto: varMap[det.ID_Variante] || varMap[String(det.ID_Variante)] || null
                    };
                    if (!detallesPorPedido[pedId]) detallesPorPedido[pedId] = [];
                    detallesPorPedido[pedId].push(item);
                    if (!detallesPorPedido[String(pedId)]) detallesPorPedido[String(pedId)] = detallesPorPedido[pedId];
                }
            });

            // 5. Transacciones de pago
            const transPorPedido = {};
            transSnap.docs.forEach((d) => {
                const t = d.data();
                const pedId = t.ID_Pedido;
                if (pedId != null) {
                    if (!transPorPedido[pedId]) transPorPedido[pedId] = [];
                    transPorPedido[pedId].push(t);
                    if (!transPorPedido[String(pedId)]) transPorPedido[String(pedId)] = transPorPedido[pedId];
                }
            });

            // 6. Estados, Usuarios, Direcciones
            const estadosMap = {};
            estadosSnap.docs.forEach((d) => {
                const e = d.data();
                const id = e.ID_EstadoPedido ?? d.id;
                estadosMap[id] = e;
                estadosMap[String(id)] = e;
            });

            const userMap = {};
            userSnap.docs.forEach((d) => {
                const u = d.data();
                const id = u.ID_User ?? d.id;
                userMap[id] = u;
                userMap[String(id)] = u;
            });

            const dirMap = {};
            dirSnap.docs.forEach((d) => {
                const dir = d.data();
                const id = dir.ID_Direccion ?? d.id;
                dirMap[id] = dir;
                dirMap[String(id)] = dir;
            });

            // 7. Ensamblar Pedidos
            const pedidosLista = pedidosSnap.docs.map((d) => {
                const p = d.data();
                const pid = p.ID_Pedido ?? d.id;
                let fechaIso = p.Fecha_Pedido;
                if (fechaIso && typeof fechaIso.toDate === 'function') {
                    fechaIso = fechaIso.toDate().toISOString();
                }
                const idEstado = p.ID_EstadoPedidoo ?? p.ID_EstadoPedido;
                return {
                    ...p,
                    _docId: d.id,
                    ID_Pedido: pid,
                    Fecha_Pedido: fechaIso,
                    Total: Number(p.Total ?? 0),
                    Subtotal: Number(p.Subtotal ?? 0),
                    Descuento: Number(p.Descuento ?? 0),
                    ID_User: p.ID_User,
                    ID_Direccion: p.ID_Direccion,
                    ID_EstadoPedidoo: idEstado,
                    Estado_Pedido: estadosMap[idEstado] || estadosMap[String(idEstado)] || null,
                    User: userMap[p.ID_User] || userMap[String(p.ID_User)] || null,
                    Direcciones: dirMap[p.ID_Direccion] || dirMap[String(p.ID_Direccion)] || null,
                    Transacciones_Pago: transPorPedido[pid] || transPorPedido[String(pid)] || [],
                    Pedido_Detalle: detallesPorPedido[pid] || detallesPorPedido[String(pid)] || []
                };
            });

            pedidosLista.sort((a, b) => {
                const fa = a.Fecha_Pedido ? new Date(a.Fecha_Pedido).getTime() : 0;
                const fb = b.Fecha_Pedido ? new Date(b.Fecha_Pedido).getTime() : 0;
                return fb - fa;
            });

            setPedidos(pedidosLista);
        } catch (err) {
            console.error('Error al cargar pedidos desde Firestore:', err);
            setError(err.message);
            setPedidos([]);
        } finally {
            setCargando(false);
        }
    }

    // normaliza un pedido a un formato único para la vista
    function normalizar(p) {
        const pagos = p.Transacciones_Pago ?? [];
        const pagoPrincipal = pagos[0] ?? null;

        const productos = (p.Pedido_Detalle ?? []).map((d) => {
            const variante = d['Variante Producto'] ?? d.Variante_Producto ?? null;
            const fotos = (variante?.Productos?.Fotos_Productos ?? [])
                .slice()
                .sort((a, b) => (a.Orden ?? 0) - (b.Orden ?? 0));
            return {
                id: d.ID_PedidoDetalle,
                idVariante: d.ID_Variante,
                nombre: variante?.Productos?.Nombre_Producto ?? 'Producto',
                talla: variante?.Talla?.Tipos_Talla?.Nombre_TipoTalla ?? '',
                foto: fotos[0]?.URL_Foto ?? null,
                cantidad: Number(d.Cantidad ?? 1),
                precio: Number(d.Precio_Unitario ?? 0),
                subtotal: Number(d.Subtotal ?? (d.Cantidad ?? 1) * (d.Precio_Unitario ?? 0)),
            };
        });

        const dir = p.Direcciones ?? null;

        return {
            id: p.ID_Pedido,
            cliente: p.User?.Usuario ?? 'Sin cliente',
            telefono: p.User?.Telefono ?? '',
            dui: p.User?.DUI ?? '',
            fechaISO: p.Fecha_Pedido ?? '',
            fechaCorta: p.Fecha_Pedido ? new Date(p.Fecha_Pedido).toLocaleDateString('es-SV') : '—',
            fechaLarga: p.Fecha_Pedido
                ? new Date(p.Fecha_Pedido).toLocaleString('es-SV', {
                      day: 'numeric', month: 'long', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                  })
                : '—',
            total: Number(p.Total ?? 0),
            subtotal: Number(p.Subtotal ?? 0),
            descuento: Number(p.Descuento ?? 0),
            envio: 0,
            entrega: dir ? `${dir.Calle ?? ''}${dir.Departamento ? ', ' + dir.Departamento : ''}`.trim() : 'Recoger en tienda',
            entregaSub: dir ? 'Envío a domicilio' : 'Sucursal principal',
            pago: pagoPrincipal?.Metodo_Pago ?? 'Sin registrar',
            pagoFecha: pagoPrincipal?.Fecha_Transaccion ?? null,
            montoPagado: pagos.reduce((s, x) => s + Number(x.Monto ?? 0), 0),
            hayPago: pagos.length > 0,
            idEstado: p.Estado_Pedido?.ID_EstadoPedido ?? p.ID_EstadoPedidoo ?? null,
            estado: (p.Estado_Pedido?.Estado ?? 'Pendiente').trim(),
            estadoDesc: p.Estado_Pedido?.Descripcion ?? '',
            productos,
        };
    }

    const filas = pedidos.map(normalizar);

    // clave de estado en minusculas y sin acentos para comparar
    const claveEstado = (estado) =>
        (estado ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    // filtro de busqueda + estado
    const filtradas = filas.filter((t) => {
        const q = busqueda.toLowerCase();
        const coincideBusqueda =
            String(t.id).toLowerCase().includes(q) ||
            t.cliente.toLowerCase().includes(q);

        const k = claveEstado(t.estado);
        const coincideEstado =
            filtroEstado === 'todos' ||
            (filtroEstado === 'pendientes' && k.includes('pendiente')) ||
            (filtroEstado === 'entregados' && k.includes('entregado')) ||
            (filtroEstado === 'encamino' && k.includes('camino'));

        return coincideBusqueda && coincideEstado;
    });

    // conteo para las tarjetas superiores
    const hoy = new Date().toDateString();
    const ventasHoy = filas
        .filter((t) => t.fechaISO && new Date(t.fechaISO).toDateString() === hoy)
        .reduce((suma, t) => suma + t.total, 0);

    const contar = (sub) => filas.filter((t) => claveEstado(t.estado).includes(sub)).length;
    const totalPendientes = contar('pendiente');
    const totalEnCamino = contar('camino');
    const totalEntregados = contar('entregado');

    // la clase de color segun el estado del pedido
    function claseEstado(estado) {
        const k = claveEstado(estado);
        if (k.includes('pendiente')) return 'estado-pendiente';
        if (k.includes('entregado')) return 'estado-entregado';
        if (k.includes('camino')) return 'estado-encamino';
        if (k.includes('cancel')) return 'estado-cancelado';
        return '';
    }

    // abrir / cerrar el detalle de transaccion
    function abrirDetalle(pedido) {
        setDetalle(pedido);
        setNuevoEstado(pedido.idEstado ? String(pedido.idEstado) : '');
    }

    function cerrarDetalle() {
        setDetalle(null);
        setGuardando(false);
    }

    // guardar cambio de estado
    async function guardarEstado() {
        if (!detalle || !nuevoEstado) return;
        setGuardando(true);

        try {
            const idEstadoNum = parseInt(nuevoEstado, 10);
            const refDirecta = doc(db, 'Pedido', String(detalle.id));
            const snapDirecta = await getDoc(refDirecta);
            if (snapDirecta.exists()) {
                await updateDoc(refDirecta, { ID_EstadoPedidoo: idEstadoNum });
            } else {
                const q = query(collection(db, 'Pedido'), where('ID_Pedido', 'in', [detalle.id, Number(detalle.id), String(detalle.id)]));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    await updateDoc(snap.docs[0].ref, { ID_EstadoPedidoo: idEstadoNum });
                }
            }

            await cargarPedidos();

            // refresca el modal con el nuevo estado
            const est = estadosCatalogo.find((e) => Number(e.ID_EstadoPedido) === idEstadoNum);
            setDetalle((d) => d && {
                ...d,
                idEstado: idEstadoNum,
                estado: est?.Estado ?? d.estado,
                estadoDesc: est?.Descripcion ?? d.estadoDesc,
            });
        } catch (err) {
            console.error('Error al actualizar estado:', err);
            alert('No se pudo actualizar el estado: ' + err.message);
        } finally {
            setGuardando(false);
        }
    }

    
    function pasosHistorial(t) {
        const k = claveEstado(t.estado);
        const enCamino = k.includes('camino') || k.includes('entregado');
        const entregado = k.includes('entregado');
        return [
            {
                texto: 'Pago confirmado',
                hora: t.pagoFecha ? new Date(t.pagoFecha).toLocaleTimeString('es-SV', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
                hecho: t.hayPago,
            },
            { texto: 'Listo para entrega', hora: '', hecho: !k.includes('pendiente') },
            { texto: 'En camino', hora: '', hecho: enCamino },
            { texto: 'Entregado', hora: '', hecho: entregado },
        ];
    }

    return (
        <div className="admin-layout">
            <SidebarAdmin />

            <main className="admin-content">
                {/* encabezado con título y filtros por estado */}
                <div className="admin-top">
                    <h1>Transacciones</h1>
                    <div className="filtros-estado">
                        <button
                            className={filtroEstado === 'todos' ? 'filtro activo' : 'filtro'}
                            onClick={() => setFiltroEstado('todos')}
                        >
                            Todos
                        </button>
                        <button
                            className={filtroEstado === 'pendientes' ? 'filtro activo' : 'filtro'}
                            onClick={() => setFiltroEstado('pendientes')}
                        >
                            Pendientes
                        </button>
                        <button
                            className={filtroEstado === 'encamino' ? 'filtro activo' : 'filtro'}
                            onClick={() => setFiltroEstado('encamino')}
                        >
                            En camino
                        </button>
                        <button
                            className={filtroEstado === 'entregados' ? 'filtro activo' : 'filtro'}
                            onClick={() => setFiltroEstado('entregados')}
                        >
                            Entregados
                        </button>
                    </div>
                </div>

                {/* lastarjetas de estadísticas */}
                <div className="stats-row">
                    <div className="stat-card">
                        <span className="stat-titulo">Ventas hoy</span>
                        <span className="stat-valor">${ventasHoy.toFixed(2)}</span>
                    </div>
                    <div 
                        className={`stat-card clickable ${filtroEstado === 'pendientes' ? 'activo' : ''}`}
                        onClick={() => setFiltroEstado('pendientes')}
                        style={{ cursor: 'pointer' }}
                    >
                        <span className="stat-titulo">Pendientes</span>
                        <span className="stat-valor" style={{ color: '#e65100' }}>{totalPendientes}</span>
                    </div>
                    <div 
                        className={`stat-card clickable ${filtroEstado === 'encamino' ? 'activo' : ''}`}
                        onClick={() => setFiltroEstado('encamino')}
                        style={{ cursor: 'pointer' }}
                    >
                        <span className="stat-titulo">En camino</span>
                        <span className="stat-valor" style={{ color: '#1a1a1a' }}>{totalEnCamino}</span>
                    </div>
                    <div 
                        className={`stat-card clickable ${filtroEstado === 'entregados' ? 'activo' : ''}`}
                        onClick={() => setFiltroEstado('entregados')}
                        style={{ cursor: 'pointer' }}
                    >
                        <span className="stat-titulo">Entregados</span>
                        <span className="stat-valor" style={{ color: '#2e7d32' }}>{totalEntregados}</span>
                    </div>
                </div>

                {/* elbuscador por ID de pedido o cliente */}
                <input
                    className="buscador"
                    placeholder="Buscar transacción"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />

                {error && (
                    <p style={{ color: '#d32f2f', marginBottom: 12 }}>
                        No se pudieron cargar los pedidos: {error}
                    </p>
                )}

                {cargando ? (
                    <p>Cargando transacciones...</p>
                ) : (
                    <table className="tabla-productos">
                        <thead>
                            <tr>
                                <th>ID Pedido</th>
                                <th>Cliente</th>
                                <th>Fecha</th>
                                <th>Total</th>
                                <th>Pago</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtradas.map((t) => (
                                <tr key={t.id}>
                                    <td>#{t.id}</td>
                                    <td>{t.cliente}</td>
                                    <td>{t.fechaCorta}</td>
                                    <td>${t.total.toFixed(2)}</td>
                                    <td>{t.pago}</td>
                                    <td className={claseEstado(t.estado)}>{t.estado}</td>
                                    <td>
                                        <button
                                            type="button"
                                            title="Ver detalle"
                                            onClick={() => abrirDetalle(t)}
                                            style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.1rem' }}
                                        >
                                            👁️
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filtradas.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', color: '#777' }}>
                                        No hay transacciones para mostrar.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </main>

            {/*loas detalle de transacción */}
            {detalle && (
                <div className="modal-overlay" onClick={cerrarDetalle}>
                    <div className="modal-pedido" onClick={(e) => e.stopPropagation()}>
                        {/* Encabezado */}
                        <div className="pedido-header">
                            <div>
                                <h2>Pedido #{detalle.id}</h2>
                                <p className="pedido-fecha">{detalle.fechaLarga}</p>
                            </div>
                            <div className="pedido-header-right">
                                <span className={`pedido-badge ${claseEstado(detalle.estado)}`}>
                                    {detalle.estado.toUpperCase()}
                                </span>
                                <button className="pedido-cerrar" onClick={cerrarDetalle}>✕</button>
                            </div>
                        </div>

                        {/* el cliente + envío */}
                        <div className="pedido-cards">
                            <div className="pedido-card">
                                <span className="pedido-card-titulo">CLIENTE</span>
                                <strong>{detalle.cliente}</strong>
                                {detalle.dui && <span>DUI: {detalle.dui}</span>}
                                {detalle.telefono && <span>{detalle.telefono}</span>}
                            </div>
                            <div className="pedido-card">
                                <span className="pedido-card-titulo">ENVÍO</span>
                                <strong>{detalle.entrega}</strong>
                                <span>{detalle.entregaSub}</span>
                            </div>
                        </div>

                        {/* los productos */}
                        <div className="pedido-seccion">
                            <span className="pedido-card-titulo">PRODUCTOS</span>
                            {detalle.productos.length === 0 && (
                                <p style={{ color: '#777', fontSize: '0.9rem', margin: '8px 0' }}>
                                    Este pedido no tiene líneas de detalle registradas.
                                </p>
                            )}
                            {detalle.productos.map((pr) => (
                                <div className="pedido-linea" key={pr.id}>
                                    <div className="pedido-linea-thumb">
                                        {pr.foto ? <img src={pr.foto} alt={pr.nombre} /> : <span>👕</span>}
                                    </div>
                                    <div className="pedido-linea-info">
                                        <strong>
                                            {pr.nombre}{pr.talla ? ` | Talla ${pr.talla}` : ''}
                                        </strong>
                                        <span>#{pr.idVariante}</span>
                                    </div>
                                    <div className="pedido-linea-precio">
                                        <span>x{pr.cantidad}</span>
                                        <strong>${pr.subtotal.toFixed(2)}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* totales */}
                        <div className="pedido-totales">
                            <div><span>Subtotal</span><span>${detalle.subtotal.toFixed(2)}</span></div>
                            {detalle.descuento > 0 && (
                                <div><span>Descuento</span><span>-${detalle.descuento.toFixed(2)}</span></div>
                            )}
                            <div><span>Envío</span><span>${detalle.envio.toFixed(2)}</span></div>
                            <div className="pedido-total-final">
                                <span>TOTAL</span>
                                <span>${detalle.total.toFixed(2)} | {detalle.pago}</span>
                            </div>
                        </div>

                        {/* el QR + historial + acción */}
                        <div className="pedido-footer">
                            <div className="pedido-qr">
                                <span className="pedido-card-titulo">CÓDIGO QR</span>
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=PEDIDO-${detalle.id}`}
                                    alt={`QR del pedido ${detalle.id}`}
                                    width={110}
                                    height={110}
                                />
                            </div>

                            <div className="pedido-historial">
                                <span className="pedido-card-titulo">HISTORIAL</span>
                                {pasosHistorial(detalle).map((paso) => (
                                    <div className={`hist-paso ${paso.hecho ? 'hecho' : ''}`} key={paso.texto}>
                                        <span className="hist-check">{paso.hecho ? '☑' : '○'}</span>
                                        <span>
                                            {paso.texto}{paso.hora ? `: ${paso.hora}` : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="pedido-accion">
                                <select
                                    value={nuevoEstado}
                                    onChange={(e) => setNuevoEstado(e.target.value)}
                                >
                                    {estadosCatalogo.map((e) => (
                                        <option key={e.ID_EstadoPedido} value={e.ID_EstadoPedido}>
                                            {e.Estado}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="btn-guardar-pedido"
                                    onClick={guardarEstado}
                                    disabled={
                                        guardando ||
                                        !nuevoEstado ||
                                        parseInt(nuevoEstado, 10) === detalle.idEstado
                                    }
                                >
                                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminTransacciones;
