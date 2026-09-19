'use client';
import { useSelector, useDispatch } from 'react-redux';
import { toggleCart, removeFromCart } from '../store/slices/cartSlice';

export default function CartDrawer() {
  const { isCartOpen, items } = useSelector((state) => state.cart);
  const dispatch = useDispatch();

  // Calcular el total
  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  return (
    <>
      {/* Overlay oscuro (Fondo transparente) */}
      {isCartOpen && (
        <div 
          onClick={() => dispatch(toggleCart())}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998 // Asegura que esté por encima de todo
          }}
        />
      )}

      {/* Menú lateral (Drawer) */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: '400px',
          height: '100vh',
          backgroundColor: 'white',
          zIndex: 9999, // Por encima del overlay
          boxShadow: '-5px 0 15px rgba(0,0,0,0.2)',
          /* La magia de la animación: si está abierto se mueve a 0, si está cerrado se esconde a la derecha (100%) */
          transform: isCartOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        
        {/* Encabezado con la X */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #eee' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
            Tu Bolsa ({items.length})
          </h2>
          <button 
            onClick={() => dispatch(toggleCart())}
            style={{ background: 'none', border: 'none', fontSize: '2.5rem', cursor: 'pointer', color: '#999', lineHeight: '0.5' }}
          >
            &times;
          </button>
        </div>

        {/* Lista de productos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {items.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>Tu carrito está vacío.</p>
          ) : (
            items.map((item) => (
              <div key={`${item.id}-${item.talla}`} style={{ display: 'flex', gap: '15px', marginBottom: '20px', borderBottom: '1px solid #f5f5f5', paddingBottom: '20px' }}>
                {/* Imagen */}
                <img 
                  src={item.imagen} 
                  alt={item.nombre} 
                  style={{ width: '80px', height: '110px', objectFit: 'cover', backgroundColor: '#f9f9f9' }} 
                />
                
                {/* Detalles */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 5px 0' }}>{item.nombre}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: '2px 0' }}>Marca: {item.marca}</p>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: '2px 0' }}>Talla: {item.talla} | Color: {item.color}</p>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: '2px 0' }}>Cant: {item.cantidad}</p>
                  </div>
                  
                  {/* Acciones (Precio y Eliminar) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <span style={{ fontWeight: 'bold' }}>${(item.precio * item.cantidad).toFixed(2)}</span>
                    <button 
                      onClick={() => dispatch(removeFromCart({ id: item.id, talla: item.talla }))}
                      style={{ background: 'none', border: 'none', color: '#999', textDecoration: 'underline', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pie con subtotal y botón de pagar */}
        <div style={{ padding: '20px', borderTop: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '20px', textTransform: 'uppercase' }}>
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <button style={{ width: '100%', backgroundColor: '#000', color: '#fff', border: 'none', padding: '15px', fontSize: '1rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer' }}>
            Procesar Compra
          </button>
        </div>

      </div>
    </>
  );
}