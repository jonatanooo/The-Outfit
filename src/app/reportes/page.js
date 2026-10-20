"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import SidebarAdmin from '@/components/SidebarAdmin';
import RevenueChart from '@/components/RevenueChart';
import './Reportes.css';

const UMBRAL_STOCK_BAJO = 10;
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const PERIODOS = [
    { valor: 7, etiqueta: 'Últimos 7 días' },
    { valor: 30, etiqueta: 'Últimos 30 días' },
    { valor: 90, etiqueta: 'Últimos 90 días' },
];

function inicioDelDia(fecha) {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    return d;
}

function claveDia(fecha) {
    return inicioDelDia(fecha).getTime();
}

function formatoMoneda(valor) {
    return `$${(valor ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcularVariacion(actual, anterior) {
    if (anterior === 0) {
        if (actual === 0) return { texto: 'Sin cambios', tono: 'neutro' };
        return { texto: 'Nuevo', tono: 'positivo' };
    }
    const pct = Math.round(((actual - anterior) / anterior) * 100);
    return {
        texto: `${pct > 0 ? '+' : ''}${pct}%`,
        tono: pct > 0 ? 'positivo' : pct < 0 ? 'negativo' : 'neutro',
    };
}

export default function ReportesPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState(null);
    const [verificando, setVerificando] = useState(true);

    const [dias, setDias] = useState(7);
    const [pedidos, setPedidos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    async function cargarDatos() {
        setCargando(true);
        setError('');

        try {
            const [
                pedidosSnap,
                detallesSnap,
                varSnap,
                prodSnap,
                invSnap,
                estadoProdSnap
            ] = await Promise.all([
                getDocs(collection(db, 'Pedido')),
                getDocs(collection(db, 'Pedido_Detalle')),
                getDocs(collection(db, 'Variante_Producto')),
                getDocs(collection(db, 'Productos')),
                getDocs(collection(db, 'Inventario')),
                getDocs(collection(db, 'Estado_Producto'))
            ]);

            // 1. Indexar productos y estados
            const prodMap = {};
            prodSnap.docs.forEach((d) => {
                const data = d.data();
                const pid = data.ID_Producto ?? d.id;
                prodMap[pid] = { ...data, ID_Producto: pid };
                prodMap[String(pid)] = prodMap[pid];
            });

            const estadoProdMap = {};
            estadoProdSnap.docs.forEach((d) => {
                const data = d.data();
                const eid = data.ID_Estado_Producto ?? d.id;
                estadoProdMap[eid] = data;
                estadoProdMap[String(eid)] = data;
            });

            // 2. Indexar inventario por variante
            const invPorVariante = {};
            invSnap.docs.forEach((d) => {
                const data = d.data();
                const vid = data.ID_Variante;
                if (vid != null) {
                    const cant = Number(data.Cantidad_Disponible ?? 0);
                    if (!invPorVariante[vid]) invPorVariante[vid] = { Cantidad_Disponible: 0 };
                    invPorVariante[vid].Cantidad_Disponible += cant;
                    invPorVariante[String(vid)] = invPorVariante[vid];
                }
            });

            // 3. Indexar variantes
            const varMap = {};
            const variantesPorProd = {};
            varSnap.docs.forEach((d) => {
                const v = d.data();
                const vid = v.ID_Variante ?? d.id;
                const pid = v.ID_Producto;
                const invObj = invPorVariante[vid] || invPorVariante[String(vid)] || { Cantidad_Disponible: 0 };
                const varObj = {
                    ...v,
                    ID_Variante: vid,
                    ID_Producto: pid,
                    Productos: prodMap[pid] || prodMap[String(pid)] || null,
                    Inventario: invObj
                };
                varMap[vid] = varObj;
                varMap[String(vid)] = varObj;

                if (pid != null) {
                    if (!variantesPorProd[pid]) variantesPorProd[pid] = [];
                    variantesPorProd[pid].push(varObj);
                    if (!variantesPorProd[String(pid)]) variantesPorProd[String(pid)] = variantesPorProd[pid];
                }
            });

            // 4. Indexar detalles por pedido
            const detallesPorPedido = {};
            detallesSnap.docs.forEach((d) => {
                const det = d.data();
                const pedId = det.ID_Pedido;
                if (pedId != null) {
                    const detObj = {
                        ...det,
                        ID_PedidoDetalle: det.ID_PedidoDetalle ?? d.id,
                        Variante_Producto: varMap[det.ID_Variante] || varMap[String(det.ID_Variante)] || null
                    };
                    if (!detallesPorPedido[pedId]) detallesPorPedido[pedId] = [];
                    detallesPorPedido[pedId].push(detObj);
                    if (!detallesPorPedido[String(pedId)]) detallesPorPedido[String(pedId)] = detallesPorPedido[pedId];
                }
            });

            // 5. Ensamblar lista de pedidos
            const listaPedidos = pedidosSnap.docs.map((d) => {
                const p = d.data();
                const pid = p.ID_Pedido ?? d.id;
                let fechaIso = p.Fecha_Pedido;
                if (fechaIso && typeof fechaIso.toDate === 'function') {
                    fechaIso = fechaIso.toDate().toISOString();
                }
                return {
                    ...p,
                    ID_Pedido: pid,
                    Fecha_Pedido: fechaIso,
                    Total: Number(p.Total ?? 0),
                    Pedido_Detalle: detallesPorPedido[pid] || detallesPorPedido[String(pid)] || []
                };
            });

            // 6. Ensamblar lista de productos
            const listaProductos = prodSnap.docs.map((d) => {
                const p = d.data();
                const pid = p.ID_Producto ?? d.id;
                return {
                    ...p,
                    ID_Producto: pid,
                    Estado_Producto: estadoProdMap[p.ID_EstadoProducto] || null,
                    Variante_Producto: variantesPorProd[pid] || variantesPorProd[String(pid)] || []
                };
            });

            setPedidos(listaPedidos);
            setProductos(listaProductos);
        } catch (err) {
            console.error('Error al cargar reportes desde Firestore:', err);
            setError(err.message);
            setPedidos([]);
            setProductos([]);
        } finally {
            setCargando(false);
        }
    }

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
                await cargarDatos();
            } catch (err) {
                console.error('Error verificando usuario en reportes:', err);
                router.push('/');
            }
        });

        return () => unsubscribe();
    }, [router]);

    // --- calculos derivados (ingresos, pedidos, ticket promedio, serie diaria, top productos) ---
    const reporte = useMemo(() => {
        const ahora = new Date();
        const inicioActual = inicioDelDia(ahora);
        inicioActual.setDate(inicioActual.getDate() - (dias - 1));
        const inicioAnterior = new Date(inicioActual);
        inicioAnterior.setDate(inicioAnterior.getDate() - dias);

        const actuales = pedidos.filter((p) => {
            if (!p.Fecha_Pedido) return false;
            const f = new Date(p.Fecha_Pedido);
            return f >= inicioActual && f <= ahora;
        });
        const anteriores = pedidos.filter((p) => {
            if (!p.Fecha_Pedido) return false;
            const f = new Date(p.Fecha_Pedido);
            return f >= inicioAnterior && f < inicioActual;
        });

        const sumaTotal = (lista) => lista.reduce((s, p) => s + Number(p.Total ?? 0), 0);

        const ingresosActual = sumaTotal(actuales);
        const ingresosAnterior = sumaTotal(anteriores);
        const pedidosActual = actuales.length;
        const pedidosAnterior = anteriores.length;
        const ticketActual = pedidosActual ? ingresosActual / pedidosActual : 0;
        const ticketAnterior = pedidosAnterior ? ingresosAnterior / pedidosAnterior : 0;

        // serie diaria de ingresos para el grafico
        const mapaDias = new Map();
        for (let i = 0; i < dias; i++) {
            const d = new Date(inicioActual);
            d.setDate(d.getDate() + i);
            mapaDias.set(claveDia(d), { fecha: d, total: 0 });
        }
        actuales.forEach((p) => {
            const k = claveDia(p.Fecha_Pedido);
            const bucket = mapaDias.get(k);
            if (bucket) bucket.total += Number(p.Total ?? 0);
        });

        const usarDiaSemana = dias <= 7;
        const serie = Array.from(mapaDias.values()).map(({ fecha, total }) => ({
            label: usarDiaSemana
                ? DIAS_SEMANA[fecha.getDay()]
                : fecha.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit' }),
            value: Math.round(total * 100) / 100,
        }));

        // productos mas vendidos dentro del periodo seleccionado
        const mapaProductos = new Map();
        actuales.forEach((p) => {
            (p.Pedido_Detalle ?? []).forEach((d) => {
                const variante = d['Variante Producto'] ?? d.Variante_Producto ?? null;
                const producto = variante?.Productos ?? null;
                if (!producto) return;
                const cantidad = Number(d.Cantidad ?? 0);
                const ingresos = Number(d.Subtotal ?? cantidad * Number(d.Precio_Unitario ?? 0));
                const actual = mapaProductos.get(producto.ID_Producto) ?? {
                    nombre: producto.Nombre_Producto ?? 'Producto',
                    unidades: 0,
                    ingresos: 0,
                };
                actual.unidades += cantidad;
                actual.ingresos += ingresos;
                mapaProductos.set(producto.ID_Producto, actual);
            });
        });
        const topProductos = Array.from(mapaProductos.values())
            .sort((a, b) => b.unidades - a.unidades)
            .slice(0, 5);

        // productos activos + stock bajo, a partir del catalogo (no depende del periodo)
        let productosActivos = 0;
        let stockBajo = 0;
        productos.forEach((p) => {
            const estado = (p.Estado_Producto?.Estado ?? '').toLowerCase();
            const esInactivo = estado.includes('inactivo') || Number(p.ID_EstadoProducto) === 2;
            if (esInactivo) return;
            productosActivos += 1;

            const variantes = p['Variante Producto'] ?? p.Variante_Producto ?? [];
            const stockTotal = variantes.reduce(
                (s, v) => s + Number(v.Inventario?.Cantidad_Disponible ?? v.Inventario?.[0]?.Cantidad_Disponible ?? 0),
                0
            );
            if (stockTotal < UMBRAL_STOCK_BAJO) stockBajo += 1;
        });

        return {
            ingresosActual,
            pedidosActual,
            ticketActual,
            productosActivos,
            stockBajo,
            serie,
            topProductos,
            variacionIngresos: calcularVariacion(ingresosActual, ingresosAnterior),
            variacionPedidos: calcularVariacion(pedidosActual, pedidosAnterior),
            variacionTicket: calcularVariacion(ticketActual, ticketAnterior),
        };
    }, [pedidos, productos, dias]);

    if (verificando) {
        return null;
    }

    const textoComparacion = dias === 7 ? 'vs la semana pasada' : `vs los ${dias} días anteriores`;

    return (
        <div className="admin-layout">
            <SidebarAdmin />

            <main className="reportes-content">
                <div className="reportes-top">
                    <h1>Reportes</h1>
                    <select
                        className="reportes-periodo"
                        value={dias}
                        onChange={(e) => setDias(Number(e.target.value))}
                    >
                        {PERIODOS.map((p) => (
                            <option key={p.valor} value={p.valor}>
                                {p.etiqueta}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <p className="reportes-error">No se pudieron cargar los reportes: {error}</p>
                )}

                {cargando ? (
                    <p>Cargando reportes...</p>
                ) : (
                    <>
                        <div className="reportes-stats-row">
                            <div className="reportes-stat-card">
                                <span className="reportes-stat-titulo">Ingresos</span>
                                <span className="reportes-stat-valor">{formatoMoneda(reporte.ingresosActual)}</span>
                                <span className={`reportes-stat-delta ${reporte.variacionIngresos.tono}`}>
                                    {reporte.variacionIngresos.texto} {textoComparacion}
                                </span>
                            </div>
                            <div className="reportes-stat-card">
                                <span className="reportes-stat-titulo">Pedidos</span>
                                <span className="reportes-stat-valor">{reporte.pedidosActual}</span>
                                <span className={`reportes-stat-delta ${reporte.variacionPedidos.tono}`}>
                                    {reporte.variacionPedidos.texto} {textoComparacion}
                                </span>
                            </div>
                            <div className="reportes-stat-card">
                                <span className="reportes-stat-titulo">Ticket promedio</span>
                                <span className="reportes-stat-valor">{formatoMoneda(reporte.ticketActual)}</span>
                                <span className={`reportes-stat-delta ${reporte.variacionTicket.tono}`}>
                                    {reporte.variacionTicket.texto} {textoComparacion}
                                </span>
                            </div>
                            <div className="reportes-stat-card">
                                <span className="reportes-stat-titulo">Productos activos</span>
                                <span className="reportes-stat-valor">{reporte.productosActivos}</span>
                                <span className="reportes-stat-delta stock-bajo">
                                    {reporte.stockBajo} con stock bajo
                                </span>
                            </div>
                        </div>

                        <div className="reportes-card">
                            <h2>Ingresos por día</h2>
                            <RevenueChart data={reporte.serie} />
                        </div>

                        <div className="reportes-card">
                            <h2>Productos más vendidos</h2>
                            <table className="reportes-tabla">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Producto</th>
                                        <th>Unidades</th>
                                        <th>Ingresos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reporte.topProductos.map((p, i) => (
                                        <tr key={p.nombre + i}>
                                            <td>{i + 1}</td>
                                            <td>{p.nombre}</td>
                                            <td>{p.unidades}</td>
                                            <td>{formatoMoneda(p.ingresos)}</td>
                                        </tr>
                                    ))}
                                    {reporte.topProductos.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', color: '#777' }}>
                                                No hay ventas registradas en este período.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
