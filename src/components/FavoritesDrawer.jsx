'use client';
import { useSelector, useDispatch } from 'react-redux';
import { toggleFavoritesOpen, toggleFavorite } from '../store/slices/favoritesSlice';
import { addToCart, toggleCart } from '../store/slices/cartSlice';

export default function FavoritesDrawer() {
  const { isFavoritesOpen, items } = useSelector((state) => state.favorites);
  const dispatch = useDispatch();

  return (
    <>
      {/* Overlay oscuro */}
      {isFavoritesOpen && (
        <div 
          onClick={() => dispatch(toggleFavoritesOpen())}
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9998 }}
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
          zIndex: 9999,
          boxShadow: '-5px 0 15px rgba(0,0,0,0.2)',
          transform: isFavoritesOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        
        {/* Encabezado con la X */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #eee' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
            Favoritos ({items.length})
          </h2>
          <button 
            onClick={() => dispatch(toggleFavoritesOpen())}
            style={{ background: 'none', border: 'none', fontSize: '2.5rem', cursor: 'pointer', color: '#999', lineHeight: '0.5' }}
          >
            &times;
          </button>
        </div>

        {/* Lista de productos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {items.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>No tienes artículos guardados.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: '15px', marginBottom: '20px', borderBottom: '1px solid #f5f5f5', paddingBottom: '20px' }}>
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
                    <span style={{ fontWeight: 'bold', display: 'block', marginTop: '5px' }}>${item.precio.toFixed(2)}</span>
                  </div>
                  
                  {/* Acciones */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <button 
                      onClick={() => dispatch(toggleFavorite({ id: item.id }))}
                      style={{ background: 'none', border: 'none', color: '#999', textDecoration: 'underline', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}
                    >
                      Eliminar
                    </button>
                    
                    <button 
                      onClick={() => {
                        // Agrega al carrito y abre el cajón del carrito
                        dispatch(addToCart({ ...item, talla: 'M', color: 'Único' }));
                        dispatch(toggleFavoritesOpen()); // Cierra favoritos
                        dispatch(toggleCart()); // Abre el carrito
                      }}
                      style={{ backgroundColor: 'black', color: 'white', border: 'none', padding: '5px 10px', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      Añadir a bolsa
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}