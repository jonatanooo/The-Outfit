"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabaseClient'
import { obtenerIdUsuario } from '@/lib/usuario'
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
  const { items, cargado, subtotal, vaciarCarrito } = useCarrito();

  const [idUsuario, setIdUsuario] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  const [paso, setPaso] = useState(1);

  const [direcciones, setDirecciones] = useState([]);
  const [cargandoDirecciones, setCargandoDirecciones] = useState(true);
  const [metodoEntrega, setMetodoEntrega] = useState(null); // 'domicilio' | 'tienda'
  const [idDireccionSeleccionada, setIdDireccionSeleccionada] = useState(null);

  const [mostrarFormDireccion, setMostrarFormDireccion] = useState(false);
  const [nuevaCalle, setNuevaCalle] = useState('');
  const [nuevoDepartamento, setNuevoDepartamento] = useState('');
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);
  const [errorDireccion, setErrorDireccion] = useState('');

  const [procesandoCompra, setProcesandoCompra] = useState(false);
  const [errorCompra, setErrorCompra] = useState('');
  const [pedidoResumen, setPedidoResumen] = useState(null);

  // Sesión requerida: un pedido siempre queda ligado a un ID_User.
  useEffect(() => {
    obtenerIdUsuario().then((id) => {
      if (!id) {
        router.push('/login');
        return;
      }
      setIdUsuario(id);
      setVerificandoSesion(false);
    });
  }, [router]);

  // Sin productos en el carrito no hay nada que pagar.
  useEffect(() => {
    if (cargado && items.length === 0 && !pedidoResumen) {
      router.push('/carrito');
    }
  }, [cargado, items.length, pedidoResumen, router]);

  useEffect(() => {
    if (!idUsuario) return;
    let activo = true;

    async function cargarDirecciones() {
      setCargandoDirecciones(true);
      const { data, error } = await supabase
        .from('Direcciones')
        .select('ID_Direccion, Departamento, Calle')
        .eq('ID_User', idUsuario);

      if (!activo) return;
      if (!error) setDirecciones(data ?? []);
      setCargandoDirecciones(false);
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

    const { data, error } = await supabase
      .from('Direcciones')
      .insert({ ID_User: idUsuario, Calle: nuevaCalle.trim(), Departamento: nuevoDepartamento.trim() })
      .select('ID_Direccion, Departamento, Calle')
      .single();

    setGuardandoDireccion(false);

    if (error) {
      setErrorDireccion('No se pudo guardar la dirección: ' + error.message);
      return;
    }

    setDirecciones((prev) => [...prev, data]);
    setMetodoEntrega('domicilio');
    setIdDireccionSeleccionada(data.ID_Direccion);
    setMostrarFormDireccion(false);
    setNuevaCalle('');
    setNuevoDepartamento('');
  }

  async function comprar(metodoPago) {
    setProcesandoCompra(true);
    setErrorCompra('');

    const { data: estado } = await supabase
      .from('Estado_Pedido')
      .select('ID_EstadoPedido')
      .ilike('Estado', '%pendiente%')
      .limit(1)
      .maybeSingle();

    const { data: pedido, error: errorPedido } = await supabase
      .from('Pedido')
      .insert({
        ID_User: idUsuario,
        ID_Direccion: metodoEntrega === 'domicilio' ? idDireccionSeleccionada : null,
        Fecha_Pedido: new Date().toISOString(),
        Subtotal: subtotal,
        Descuento: 0,
        Total: subtotal,
        ID_EstadoPedidoo: estado?.ID_EstadoPedido ?? null,
      })
      .select('ID_Pedido')
      .single();

    if (errorPedido) {
      setErrorCompra('No se pudo crear el pedido: ' + errorPedido.message);
      setProcesandoCompra(false);
      return;
    }

    const { error: errorDetalle } = await supabase.from('Pedido_Detalle').insert(
      items.map((item) => ({
        ID_Pedido: pedido.ID_Pedido,
        ID_Variante: item.idVariante,
        Cantidad: item.cantidad,
        Precio_Unitario: item.precio,
        Subtotal: item.precio * item.cantidad,
      }))
    );

    if (errorDetalle) {
      setErrorCompra('No se pudo registrar el detalle del pedido: ' + errorDetalle.message);
      setProcesandoCompra(false);
      return;
    }

    // Descuenta el stock recién vendido antes de dar la compra por aprobada
    // (la función valida que alcance el stock y aborta si no).
    const { error: errorStock } = await supabase.rpc('descontar_inventario_pedido', {
      p_id_pedido: pedido.ID_Pedido,
    });

    if (errorStock) {
      setErrorCompra('No se pudo descontar el stock: ' + errorStock.message);
      setProcesandoCompra(false);
      return;
    }

    const { error: errorPago } = await supabase.from('Transacciones_Pago').insert({
      ID_Pedido: pedido.ID_Pedido,
      Monto: subtotal,
      Metodo_Pago: metodoPago,
      Fecha_Transaccion: new Date().toISOString(),
      Estado_transaccion: 'Aprobado',
    });

    if (errorPago) {
      setErrorCompra('No se pudo registrar el pago: ' + errorPago.message);
      setProcesandoCompra(false);
      return;
    }

    const direccionElegida = direcciones.find((d) => d.ID_Direccion === idDireccionSeleccionada);

    setPedidoResumen({
      id: pedido.ID_Pedido,
      items: [...items],
      total: subtotal,
      entrega: metodoEntrega === 'tienda' ? DIRECCION_TIENDA : textoDireccion(direccionElegida),
      metodoEntrega,
      pago: metodoPago,
    });

    vaciarCarrito();
    setProcesandoCompra(false);
    setPaso(3);
  }

  function atras() {
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
              {pedidoResumen.items.map((item) => (
                <div className="checkout-item-mini" key={item.idVariante}>
                  {item.imagen ? <img src={item.imagen} alt={item.nombre} /> : <div className="checkout-item-mini-sin-imagen" />}
                  <div>
                    <strong>{item.nombre}</strong>
                    <span>TALLA {item.talla || 'ÚNICA'} · x{item.cantidad}</span>
                  </div>
                  <span className="checkout-item-mini-precio">${(item.precio * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="checkout-resumen-linea">
              <span>{pedidoResumen.metodoEntrega === 'tienda' ? 'RECOGER EN' : 'ENVIAR A'}</span>
              <span>{pedidoResumen.entrega}</span>
            </div>
            <div className="checkout-resumen-linea">
              <span>MÉTODO DE PAGO</span>
              <span>{pedidoResumen.pago}</span>
            </div>
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
                        onClick={() => comprar('Tarjeta de crédito')}
                        disabled={procesandoCompra}
                      >
                        <IconTarjeta className="checkout-metodo-icono" />
                        TARJETA DE CRÉDITO
                      </button>
                      <button
                        type="button"
                        className="checkout-metodo-pago"
                        onClick={() => comprar('Tarjeta de regalo')}
                        disabled={procesandoCompra}
                      >
                        <IconRegalo className="checkout-metodo-icono" />
                        TARJETA DE REGALO
                      </button>
                    </div>
                    {procesandoCompra && <p className="checkout-cargando">Procesando compra...</p>}
                    {errorCompra && <p className="checkout-error">{errorCompra}</p>}
                  </div>
                )}
              </div>

              <div className="checkout-box checkout-resumen-lateral">
                <h4>RESUMEN</h4>
                <div className="checkout-resumen-items">
                  {items.map((item) => (
                    <div className="checkout-item-mini" key={item.idVariante}>
                      {item.imagen ? <img src={item.imagen} alt={item.nombre} /> : <div className="checkout-item-mini-sin-imagen" />}
                      <div>
                        <strong>{item.nombre}</strong>
                        <span>TALLA {item.talla || 'ÚNICA'} · x{item.cantidad}</span>
                      </div>
                      <span className="checkout-item-mini-precio">${(item.precio * item.cantidad).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="checkout-resumen-linea">
                  <span>SUBTOTAL</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="checkout-resumen-linea">
                  <span>GASTOS DE ENVÍO</span>
                  <span>GRATIS</span>
                </div>
              </div>
            </div>

            <div className="checkout-barra-inferior">
              <button type="button" className="checkout-atras" onClick={atras}>
                ATRÁS
              </button>
              <div className="checkout-total-inferior">
                <strong>TOTAL ${subtotal.toFixed(2)}</strong>
                <span>(IVA INCLUIDO)</span>
              </div>
              {paso === 1 ? (
                <button type="button" className="checkout-continuar" disabled={!puedeContinuar} onClick={() => setPaso(2)}>
                  CONTINUAR
                </button>
              ) : (
                <span className="checkout-hint">Elige un método de pago para completar la compra</span>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
