"use client";

import { useEffect } from 'react';
import '@/app/transacciones/transacciones.css';
import { claseEstadoPedido, pasosHistorialPedido } from '@/lib/pedidosCliente';

/**
 * Contenido reutilizable de "Descripción de pedido" basado exactamente en la UI del Panel Admin,
 * en modo solo lectura (sin selector de estado ni botón "Guardar cambios").
 */
export function DetallePedidoContenido({ detalle, onClose = null }) {
  if (!detalle) return null;

  const estadoTexto = String(detalle.estado || 'Pendiente').trim();
  const pasos = pasosHistorialPedido(detalle);

  return (
    <div
      className="modal-pedido w-full"
      style={{ fontFamily: '"DM Sans", sans-serif' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Encabezado */}
      <div className="pedido-header">
        <div>
          <h2>Pedido #{detalle.id}</h2>
          <p className="pedido-fecha">{detalle.fechaLarga}</p>
        </div>
        <div className="pedido-header-right shrink-0">
          <span
            className={`pedido-badge whitespace-nowrap px-5 py-1.5 text-center ${claseEstadoPedido(
              estadoTexto
            )}`}
          >
            {estadoTexto.toUpperCase()}
          </span>
          {onClose && (
            <button
              type="button"
              className="pedido-cerrar"
              onClick={onClose}
              aria-label="Cerrar detalle del pedido"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas: Cliente + Envío */}
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

      {/* Productos */}
      <div className="pedido-seccion">
        <span className="pedido-card-titulo">PRODUCTOS</span>
        {(!detalle.productos || detalle.productos.length === 0) && (
          <p style={{ color: '#777', fontSize: '0.9rem', margin: '8px 0' }}>
            Este pedido no tiene líneas de detalle registradas.
          </p>
        )}
        {(detalle.productos || []).map((pr, idx) => (
          <div className="pedido-linea" key={pr.id || `${pr.idVariante}-${idx}`}>
            <div className="pedido-linea-thumb">
              {pr.foto ? <img src={pr.foto} alt={pr.nombre} /> : <span>👕</span>}
            </div>
            <div className="pedido-linea-info">
              <strong>
                {pr.nombre}
                {pr.talla ? ` | Talla ${pr.talla}` : ''}
              </strong>
              <span>#{pr.idVariante}</span>
            </div>
            <div className="pedido-linea-precio">
              <span>x{pr.cantidad}</span>
              <strong>${Number(pr.subtotal ?? 0).toFixed(2)}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="pedido-totales">
        <div>
          <span>Subtotal</span>
          <span>${Number(detalle.subtotal ?? 0).toFixed(2)}</span>
        </div>
        {Number(detalle.descuento ?? 0) > 0 && (
          <div>
            <span>Descuento</span>
            <span>-${Number(detalle.descuento).toFixed(2)}</span>
          </div>
        )}
        <div>
          <span>Envío</span>
          <span>${Number(detalle.envio ?? 0).toFixed(2)}</span>
        </div>
        <div className="pedido-total-final">
          <span>TOTAL</span>
          <span>
            ${Number(detalle.total ?? 0).toFixed(2)} | {detalle.pago}
          </span>
        </div>
      </div>

      {/* Código QR + Historial (sin controles de administrador) */}
      <div className="pedido-footer !grid-cols-1 md:!grid-cols-[auto_1fr]">
        <div className="pedido-qr">
          <span className="pedido-card-titulo">CÓDIGO QR</span>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=PEDIDO-${encodeURIComponent(
              String(detalle.id)
            )}`}
            alt={`QR del pedido ${detalle.id}`}
            width={110}
            height={110}
          />
        </div>

        <div className="pedido-historial">
          <span className="pedido-card-titulo">HISTORIAL</span>
          {pasos.map((paso) => (
            <div className={`hist-paso ${paso.hecho ? 'hecho' : ''}`} key={paso.texto}>
              <span className="hist-check">{paso.hecho ? '☑' : '○'}</span>
              <span>
                {paso.texto}
                {paso.hora ? `: ${paso.hora}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de detalle del pedido para el cliente (idéntico al Admin pero solo lectura).
 */
export default function DetallePedidoModal({ detalle, onClose }) {
  useEffect(() => {
    if (!detalle) return;
    const manejarEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', manejarEsc);
    return () => window.removeEventListener('keydown', manejarEsc);
  }, [detalle, onClose]);

  if (!detalle) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle del pedido ${detalle.id}`}
    >
      <DetallePedidoContenido detalle={detalle} onClose={onClose} />
    </div>
  );
}

