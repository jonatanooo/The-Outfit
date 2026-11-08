"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { db, auth } from '@/lib/firebaseClient'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  runTransaction,
  query,
  where,
  limit
} from 'firebase/firestore'
import { obtenerIdUsuario } from '@/lib/usuario'
import { useAuth } from '@/lib/AuthContext'
import { esOfertaActiva, calcularPrecioConDescuento } from '@/lib/descuentos'
import { useCarrito } from '@/lib/CarritoContext'
import './checkout.css'

const DIRECCION_TIENDA = '#41-B LOCAL 1 CP1502, CALLE DEL MEDITERRÁNEO';

const IconTarjeta = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </svg>
);

const IconRegalo = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
    <rect x="3" y="9" width="18" height="12" rx="1" />
    <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3" />
    <path d="M12 5v16" />
    <path d="M12 5C10.5 2.5 6 2 6 5s4 2 6 0z" />
    <path d="M12 5c1.5-2.5 6-3 6 0s-4 2-6 0z" />
  </svg>
);

function textoDireccion(dir) {
  if (!dir) return '';
  return `${dir.Calle ?? ''}${dir.Departamento ? `, ${dir.Departamento}` : ''}`.trim();
}

export default function CheckoutPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const {
    items,
    cargado,
    subtotal,
    subtotalOriginal,
    totalAhorro,
    vaciarCarrito,
    sincronizarPreciosConBD
  } = useCarrito();

  const [idUsuario, setIdUsuario] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  const [paso, setPaso] = useState(1);

  const [direcciones, setDirecciones] = useState([]);
  const [cargandoDirecciones, setCargandoDirecciones] = useState(true);
  const [metodoEntrega, setMetodoEntrega] = useState(null); // 'domicilio' | 'tienda'
  const [idDireccionSeleccionada, setIdDireccionSeleccionada] = useState(null);
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState('Tarjeta de crédito');

  const [mostrarFormDireccion, setMostrarFormDireccion] = useState(false);
  const [nuevaCalle, setNuevaCalle] = useState('');
  const [nuevoDepartamento, setNuevoDepartamento] = useState('');
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);
  const [errorDireccion, setErrorDireccion] = useState('');

  // Estados y cerrojo síncrono (useRef) para PREVENCIÓN DE DOBLE COBRO
  const [isSubmitting, setIsSubmitting] = useState(false);
  const compraEnCursoRef = useRef(false);
  const [errorCompra, setErrorCompra] = useState('');
  const [pedidoResumen, setPedidoResumen] = useState(null);

  // Sesión requerida: un pedido siempre queda ligado a un ID_User.
  useEffect(() => {
    if (authLoading) return;
    obtenerIdUsuario().then((id) => {
      if (!id) {
        router.push('/login');
        return;
      }
      setIdUsuario(id);
      setVerificandoSesion(false);
    });
  }, [authLoading, router]);

  // Revalidar precios reales desde Firestore al entrar al checkout
  useEffect(() => {
    if (cargado && items.length > 0) {
      sincronizarPreciosConBD();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, paso]);

  // Sin productos en el carrito no hay nada que pagar.
  useEffect(() => {
    if (cargado && items.length === 0 && !pedidoResumen && !isSubmitting) {
      router.push('/carrito');
    }
  }, [cargado, items.length, pedidoResumen, isSubmitting, router]);

  useEffect(() => {
    if (!idUsuario) return;
    let activo = true;

    async function cargarDirecciones() {
      setCargandoDirecciones(true);
      try {
        const opcionesUser = [idUsuario, String(idUsuario)];
        if (!isNaN(Number(idUsuario))) opcionesUser.push(Number(idUsuario));
        const qDir = query(collection(db, 'Direcciones'), where('ID_User', 'in', Array.from(new Set(opcionesUser))));
        const snap = await getDocs(qDir);
        const list = snap.docs.map((d) => ({
          ...d.data(),
          ID_Direccion: d.data().ID_Direccion ?? d.id,
          _docId: d.id
        }));

        if (!activo) return;
        setDirecciones(list);
      } catch (err) {
        console.error('Error al cargar direcciones desde Firestore:', err);
      } finally {
        if (activo) setCargandoDirecciones(false);
      }
    }

    cargarDirecciones();
    return () => { activo = false; };
  }, [idUsuario]);

  async function guardarDireccion() {
    if (!nuevaCalle.trim() || !nuevoDepartamento.trim()) {
      setErrorDireccion('Completa calle y departamento.');
      return;
    }
    setGuardandoDireccion(true);
    setErrorDireccion('');

    try {
      // Generación de ID único y seguro mediante doc(collection(db, ...)).id (reemplaza Date.now())
      const dirRef = doc(collection(db, 'Direcciones'));
      const nuevoId = dirRef.id;
      const nuevaDir = {
        ID_Direccion: nuevoId,
        ID_User: idUsuario,
        Calle: nuevaCalle.trim(),
        Departamento: nuevoDepartamento.trim(),
        Fecha_Creacion: new Date().toISOString()
      };
      await setDoc(dirRef, nuevaDir);

      setDirecciones((prev) => [...prev, nuevaDir]);
      setMetodoEntrega('domicilio');
      setIdDireccionSeleccionada(nuevoId);
      setMostrarFormDireccion(false);
      setNuevaCalle('');
      setNuevoDepartamento('');
    } catch (err) {
      console.error('Error al guardar dirección en Firestore:', err);
      setErrorDireccion('No se pudo guardar la dirección: ' + err.message);
    } finally {
      setGuardandoDireccion(false);
    }
  }

  /**
   * Respaldo transaccional en cliente con runTransaction en caso de que el endpoint de servidor
   * no esté disponible. Recalcula precios desde Firestore y descuenta stock atómicamente.
   */
  async function ejecutarTransaccionSeguraFirestore(metodoPago) {
    let idEstado = 1;
    const qEstado = query(collection(db, 'Estado_Pedido'), where('Estado', '==', 'Pendiente'), limit(1));
    const snapEstado = await getDocs(qEstado);
    if (!snapEstado.empty) {
      idEstado = snapEstado.docs[0].data().ID_EstadoPedido ?? 1;
    }

    // Localizar referencias de Variante_Producto e Inventario
    const referenciasItems = [];
    for (const item of items) {
      const opcionesVar = [item.idVariante, String(item.idVariante)];
      if (!isNaN(Number(item.idVariante))) opcionesVar.push(Number(item.idVariante));

      const [varSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'Variante_Producto'), where('ID_Variante', 'in', Array.from(new Set(opcionesVar))), limit(1))),
        getDocs(query(collection(db, 'Inventario'), where('ID_Variante', 'in', Array.from(new Set(opcionesVar))), limit(1))),
      ]);

      if (varSnap.empty || invSnap.empty) {
        throw new Error(`No se encontró información o inventario para "${item.nombre}".`);
      }

      const varData = varSnap.docs[0].data();
      let prodRef = null;
      if (varData.ID_Producto != null) {
        const opcionesProd = [varData.ID_Producto, String(varData.ID_Producto)];
        if (!isNaN(Number(varData.ID_Producto))) opcionesProd.push(Number(varData.ID_Producto));
        const prodSnap = await getDocs(query(collection(db, 'Productos'), where('ID_Producto', 'in', Array.from(new Set(opcionesProd))), limit(1)));
        if (!prodSnap.empty) prodRef = prodSnap.docs[0].ref;
      }

      referenciasItems.push({
        item,
        varRef: varSnap.docs[0].ref,
        invRef: invSnap.docs[0].ref,
        prodRef,
      });
    }

    return await runTransaction(db, async (transaction) => {
      const datosLeidos = [];
      for (const refObj of referenciasItems) {
        const varDoc = await transaction.get(refObj.varRef);
        const invDoc = await transaction.get(refObj.invRef);
        const prodDoc = refObj.prodRef ? await transaction.get(refObj.prodRef) : null;
        datosLeidos.push({
          ...refObj,
          varData: varDoc.data(),
          invData: invDoc.data(),
          prodData: prodDoc?.exists() ? prodDoc.data() : null,
        });
      }

      let subtotalOrigCalc = 0;
      let subtotalFinalCalc = 0;
      const itemsValidados = [];

      for (const entry of datosLeidos) {
        const cantidadSolicitada = Math.floor(Number(entry.item.cantidad ?? 1));
        const stockActual = Number(entry.invData?.Cantidad_Disponible ?? 0);
        const nombreReal = entry.prodData?.Nombre_Producto || entry.item.nombre;

        if (stockActual < cantidadSolicitada) {
          throw new Error(`Stock insuficiente para "${nombreReal}". Disponible: ${stockActual}.`);
        }

        const precioBase = Number(entry.varData?.Precio_Actual ?? 0);
        let enOferta = false;
        let porcentaje = 0;
        if (esOfertaActiva(entry.varData)) {
          enOferta = true;
          porcentaje = Number(entry.varData.Porcentaje_Descuento ?? 0);
        } else if (entry.prodData && esOfertaActiva(entry.prodData)) {
          enOferta = true;
          porcentaje = Number(entry.prodData.Porcentaje_Descuento ?? 0);
        }

        const precioReal = enOferta ? calcularPrecioConDescuento(precioBase, porcentaje) : precioBase;
        subtotalOrigCalc = Math.round((subtotalOrigCalc + precioBase * cantidadSolicitada) * 100) / 100;
        subtotalFinalCalc = Math.round((subtotalFinalCalc + precioReal * cantidadSolicitada) * 100) / 100;

        itemsValidados.push({
          ...entry.item,
          nombre: nombreReal,
          precioOriginal: precioBase,
          precio: precioReal,
          enOferta,
          porcentajeDescuento: enOferta ? porcentaje : 0,
          cantidad: cantidadSolicitada,
          invRef: entry.invRef,
          stockAnterior: stockActual,
          nuevoStock: stockActual - cantidadSolicitada,
        });
      }

      const ahorroCalc = Math.max(0, Math.round((subtotalOrigCalc - subtotalFinalCalc) * 100) / 100);
      const ahoraIso = new Date().toISOString();

      const pedidoRef = doc(collection(db, 'Pedido'));
      const idPedido = pedidoRef.id;

      transaction.set(pedidoRef, {
        ID_Pedido: idPedido,
        ID_User: idUsuario,
        ID_Direccion: metodoEntrega === 'domicilio' ? idDireccionSeleccionada : null,
        Fecha_Pedido: ahoraIso,
        Subtotal: subtotalOrigCalc,
        Descuento: ahorroCalc,
        Total: subtotalFinalCalc,
        ID_EstadoPedidoo: idEstado
      });

      for (const itemVal of itemsValidados) {
        const detalleRef = doc(collection(db, 'Pedido_Detalle'));
        transaction.set(detalleRef, {
          ID_PedidoDetalle: detalleRef.id,
          ID_Pedido: idPedido,
          ID_Variante: itemVal.idVariante,
          Cantidad: itemVal.cantidad,
          Precio_Unitario: itemVal.precio,
          Precio_Original: itemVal.precioOriginal,
          Subtotal: Math.round(itemVal.precio * itemVal.cantidad * 100) / 100,
        });

        transaction.update(itemVal.invRef, {
          Cantidad_Disponible: itemVal.nuevoStock,
          Fecha_Actualizacion: ahoraIso,
        });

        const auditInvRef = doc(collection(db, 'Auditoria_Inventario'));
        transaction.set(auditInvRef, {
          ID_Auditoria: auditInvRef.id,
          ID_Variante: itemVal.idVariante,
          ID_UserAccion: idUsuario,
          Cantidad_Anterior: itemVal.stockAnterior,
          Cantidad_Nueva: itemVal.nuevoStock,
          Tipo_Movimiento: 'Salida',
          Motivo: `Venta en línea (Pedido #${idPedido})`,
          Fecha_Accion: ahoraIso,
        });
      }

      const transRef = doc(collection(db, 'Transacciones_Pago'));
      transaction.set(transRef, {
        ID_Transaccion: transRef.id,
        ID_Pedido: idPedido,
        Monto: subtotalFinalCalc,
        Metodo_Pago: metodoPago,
        Fecha_Transaccion: ahoraIso,
        Estado_transaccion: 'Aprobado'
      });

      return {
        idPedido,
        subtotalOriginal: subtotalOrigCalc,
        totalAhorro: ahorroCalc,
        total: subtotalFinalCalc,
        items: itemsValidados.map(({ invRef, nuevoStock, ...rest }) => rest),
      };
    });
  }

  async function comprar(metodoPago = metodoPagoSeleccionado) {
    // Bloqueo inmediato síncrono y de estado para impedir doble o triple clic (Prevención de Doble Cobro)
    if (compraEnCursoRef.current || isSubmitting) return;
    compraEnCursoRef.current = true;
    setIsSubmitting(true);
    setErrorCompra('');

    try {
      if (typeof auth?.authStateReady === 'function') {
        await auth.authStateReady();
      }

      if (!auth?.currentUser) {
        throw new Error('Debes iniciar sesión para procesar la compra.');
      }

      // Obtener el ID Token real y fresco del usuario autenticado
      const token = await auth.currentUser.getIdToken(true);
      if (!token || typeof token !== 'string' || token === 'undefined' || token === 'null' || !token.trim()) {
        throw new Error('No se pudo obtener el token de autenticación del usuario. Por favor vuelve a iniciar sesión.');
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            idVariante: i.idVariante,
            cantidad: i.cantidad,
            nombre: i.nombre,
            talla: i.talla,
            imagen: i.imagen,
          })),
          metodoEntrega,
          idDireccionSeleccionada,
          metodoPago,
        }),
      });

      let resultadoCompra = null;
      if (response.ok) {
        resultadoCompra = await response.json();
      } else {
        const errData = await response.json().catch(() => ({}));
        if (errData.error) {
          throw new Error(errData.error);
        }
        // Fallback transaccional atómico con runTransaction si el servidor API devolvió error sin mensaje
        resultadoCompra = await ejecutarTransaccionSeguraFirestore(metodoPago);
      }

      const direccionElegida = direcciones.find((d) => d.ID_Direccion === idDireccionSeleccionada);

      setPedidoResumen({
        id: resultadoCompra.idPedido,
        items: resultadoCompra.items,
        subtotalOriginal: resultadoCompra.subtotalOriginal,
        totalAhorro: resultadoCompra.totalAhorro,
        total: resultadoCompra.total,
        entrega: metodoEntrega === 'tienda' ? DIRECCION_TIENDA : textoDireccion(direccionElegida),
        metodoEntrega,
        pago: metodoPago,
      });

      vaciarCarrito();
      setPaso(3);
    } catch (err) {
      console.error('Error en proceso de compra:', err);
      setErrorCompra('Hubo un error al procesar la compra: ' + err.message);
      compraEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  }

  function atras() {
    if (isSubmitting) return;
    if (paso === 1) router.push('/carrito');
    else setPaso((p) => p - 1);
  }

  const puedeContinuar =
    metodoEntrega === 'tienda' || (metodoEntrega === 'domicilio' && idDireccionSeleccionada != null);

  if (verificandoSesion || (!cargado && !pedidoResumen)) return null;

  return (
    <>
      <Header siempreSolido />
      <main className="checkout-main">
        <div className="checkout-stepper">
          <span className={paso === 1 ? 'activo' : ''}>ELEGIR MÉTODO DE ENVÍO</span>
          <span className="checkout-sep">›</span>
          <span className={paso === 2 ? 'activo' : ''}>MÉTODO DE PAGO</span>
          <span className="checkout-sep">›</span>
          <span className={paso === 3 ? 'activo' : ''}>RESUMEN</span>
        </div>

        {paso === 3 && pedidoResumen ? (
          <div className="checkout-box checkout-confirmacion">
            <div className="checkout-check">✓</div>
            <h2>¡Pedido confirmado!</h2>
            <p className="checkout-pedido-numero">Pedido #{pedidoResumen.id}</p>

            <div className="checkout-resumen-items">
              {pedidoResumen.items.map((item) => {
                const precioOrig = Number(item.precioOriginal ?? item.precio);
                const precioReal = Number(item.precio);
                const tieneDesc = Boolean(item.enOferta || precioOrig > precioReal);
                return (
                  <div className="checkout-item-mini" key={item.idVariante}>
                    {item.imagen ? <img src={item.imagen} alt={item.nombre} /> : <div className="checkout-item-mini-sin-imagen" />}
                    <div>
                      <strong>{item.nombre}</strong>
                      <span>TALLA {item.talla || 'ÚNICA'} · x{item.cantidad}</span>
                      {tieneDesc && item.porcentajeDescuento > 0 && (
                        <span className="checkout-item-mini-badge">-{item.porcentajeDescuento}%</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {tieneDesc ? (
                        <>
                          <div style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.8rem' }}>
                            ${(precioOrig * item.cantidad).toFixed(2)}
                          </div>
                          <span className="checkout-item-mini-precio" style={{ color: '#d32f2f', fontWeight: 600 }}>
                            ${(precioReal * item.cantidad).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="checkout-item-mini-precio">${(precioReal * item.cantidad).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="checkout-resumen-linea">
              <span>{pedidoResumen.metodoEntrega === 'tienda' ? 'RECOGER EN' : 'ENVIAR A'}</span>
              <span>{pedidoResumen.entrega}</span>
            </div>
            <div className="checkout-resumen-linea">
              <span>MÉTODO DE PAGO</span>
              <span>{pedidoResumen.pago}</span>
            </div>
            {pedidoResumen.totalAhorro > 0 && (
              <>
                <div className="checkout-resumen-linea">
                  <span>SUBTOTAL ORIGINAL</span>
                  <span>${pedidoResumen.subtotalOriginal.toFixed(2)}</span>
                </div>
                <div className="checkout-resumen-linea checkout-linea-ahorro">
                  <span>AHORRO EN TU COMPRA</span>
                  <span>-${pedidoResumen.totalAhorro.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="checkout-resumen-linea checkout-resumen-total-linea">
              <span>TOTAL</span>
              <span>${pedidoResumen.total.toFixed(2)}</span>
            </div>

            <button type="button" className="checkout-volver" onClick={() => router.push('/')}>
              VOLVER AL INICIO
            </button>
          </div>
        ) : (
          <>
            <div className="checkout-layout">
              <div className="checkout-box checkout-caja-principal">
                {paso === 1 && (
                  <div className="checkout-paso-envio">
                    <div className="checkout-seccion">
                      <h4>DOMICILIO</h4>

                      {cargandoDirecciones ? (
                        <p className="checkout-cargando">Cargando direcciones...</p>
                      ) : (
                        <div className="checkout-direcciones-lista">
                          {direcciones.map((dir) => (
                            <label className="checkout-direccion-opcion" key={dir.ID_Direccion}>
                              <input
                                type="radio"
                                name="entrega"
                                checked={metodoEntrega === 'domicilio' && idDireccionSeleccionada === dir.ID_Direccion}
                                onChange={() => {
                                  setMetodoEntrega('domicilio');
                                  setIdDireccionSeleccionada(dir.ID_Direccion);
                                }}
                              />
                              <span>{textoDireccion(dir)}</span>
                            </label>
                          ))}
                          {direcciones.length === 0 && !mostrarFormDireccion && (
                            <p className="checkout-sin-direcciones">Todavía no tienes direcciones guardadas.</p>
                          )}
                        </div>
                      )}

                      {!mostrarFormDireccion ? (
                        <button type="button" className="checkout-link-agregar" onClick={() => setMostrarFormDireccion(true)}>
                          AGREGAR DIRECCIÓN +
                        </button>
                      ) : (
                        <div className="checkout-form-direccion">
                          <input
                            placeholder="Calle, colonia, referencia"
                            value={nuevaCalle}
                            onChange={(e) => setNuevaCalle(e.target.value)}
                          />
                          <input
                            placeholder="Departamento"
                            value={nuevoDepartamento}
                            onChange={(e) => setNuevoDepartamento(e.target.value)}
                          />
                          <div className="checkout-form-direccion-botones">
                            <button type="button" onClick={guardarDireccion} disabled={guardandoDireccion}>
                              {guardandoDireccion ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button type="button" onClick={() => setMostrarFormDireccion(false)}>
                              Cancelar
                            </button>
                          </div>
                          {errorDireccion && <p className="checkout-error">{errorDireccion}</p>}
                        </div>
                      )}
                    </div>

                    <div className="checkout-seccion">
                      <h4>TIENDA</h4>
                      <label className="checkout-direccion-opcion">
                        <input
                          type="radio"
                          name="entrega"
                          checked={metodoEntrega === 'tienda'}
                          onChange={() => setMetodoEntrega('tienda')}
                        />
                        <span>
                          {DIRECCION_TIENDA}
                          <em className="checkout-gratis">GRATIS</em>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {paso === 2 && (
                  <div className="checkout-paso-pago">
                    <h4>MÉTODO DE PAGO</h4>
                    <div className="checkout-metodos-pago">
                      <button
                        type="button"
                        className="checkout-metodo-pago"
                        style={{
                          outline: metodoPagoSeleccionado === 'Tarjeta de crédito' ? '2px solid #000' : 'none',
                        }}
                        onClick={() => setMetodoPagoSeleccionado('Tarjeta de crédito')}
                        disabled={isSubmitting}
                      >
                        <IconTarjeta className="checkout-metodo-icono" />
                        TARJETA DE CRÉDITO
                      </button>
                      <button
                        type="button"
                        className="checkout-metodo-pago"
                        style={{
                          outline: metodoPagoSeleccionado === 'Tarjeta de regalo' ? '2px solid #000' : 'none',
                        }}
                        onClick={() => setMetodoPagoSeleccionado('Tarjeta de regalo')}
                        disabled={isSubmitting}
                      >
                        <IconRegalo className="checkout-metodo-icono" />
                        TARJETA DE REGALO
                      </button>
                    </div>

                    {isSubmitting && <p className="checkout-cargando">Verificando stock y procesando compra de forma segura...</p>}
                    {errorCompra && <p className="checkout-error">{errorCompra}</p>}
                  </div>
                )}
              </div>

              <div className="checkout-box checkout-resumen-lateral">
                <h4>RESUMEN</h4>
                <div className="checkout-resumen-items">
                  {items.map((item) => {
                    const precioOrig = Number(item.precioOriginal ?? item.precio);
                    const precioReal = Number(item.precio);
                    const tieneDesc = Boolean(item.enOferta || precioOrig > precioReal);
                    return (
                      <div className="checkout-item-mini" key={item.idVariante}>
                        {item.imagen ? <img src={item.imagen} alt={item.nombre} /> : <div className="checkout-item-mini-sin-imagen" />}
                        <div>
                          <strong>{item.nombre}</strong>
                          <span>TALLA {item.talla || 'ÚNICA'} · x{item.cantidad}</span>
                          {tieneDesc && item.porcentajeDescuento > 0 && (
                            <span className="checkout-item-mini-badge">-{item.porcentajeDescuento}%</span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {tieneDesc ? (
                            <>
                              <div style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.8rem' }}>
                                ${(precioOrig * item.cantidad).toFixed(2)}
                              </div>
                              <span className="checkout-item-mini-precio" style={{ color: '#d32f2f', fontWeight: 600 }}>
                                ${(precioReal * item.cantidad).toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className="checkout-item-mini-precio">${(precioReal * item.cantidad).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="checkout-resumen-linea">
                  <span>SUBTOTAL</span>
                  <span>${subtotalOriginal.toFixed(2)}</span>
                </div>
                {totalAhorro > 0 && (
                  <div className="checkout-resumen-linea checkout-linea-ahorro">
                    <span>AHORRO</span>
                    <span>-${totalAhorro.toFixed(2)}</span>
                  </div>
                )}
                <div className="checkout-resumen-linea">
                  <span>GASTOS DE ENVÍO</span>
                  <span>GRATIS</span>
                </div>
                <div className="checkout-resumen-linea checkout-resumen-total-linea">
                  <span>TOTAL A PAGAR</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="checkout-barra-inferior">
              <button type="button" className="checkout-atras" onClick={atras} disabled={isSubmitting}>
                ATRÁS
              </button>
              <div className="checkout-total-inferior">
                <strong>TOTAL ${subtotal.toFixed(2)}</strong>
                {totalAhorro > 0 && (
                  <span style={{ color: '#81c784', fontWeight: 600, fontSize: '0.75rem', marginTop: '2px' }}>
                    Ahorro: -${totalAhorro.toFixed(2)}
                  </span>
                )}
                <span>(IVA INCLUIDO)</span>
              </div>
              {paso === 1 ? (
                <button type="button" className="checkout-continuar" disabled={!puedeContinuar} onClick={() => setPaso(2)}>
                  CONTINUAR
                </button>
              ) : (
                <button
                  type="button"
                  className="checkout-continuar"
                  disabled={isSubmitting}
                  onClick={() => comprar(metodoPagoSeleccionado)}
                >
                  {isSubmitting ? 'PROCESANDO...' : 'REALIZAR COMPRA'}
                </button>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
