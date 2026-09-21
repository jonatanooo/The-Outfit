"use client"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useCarrito } from '@/lib/CarritoContext'
import { useFavoritos } from '@/lib/useFavoritos'
import './carrito.css'

export default function CarritoPage() {
  const router = useRouter();
  const { items, cargado, cambiarCantidad, subtotal } = useCarrito();
  const { esFavorito, alternarFavorito } = useFavoritos();

  function restar(item) {
    if (item.cantidad === 1) {
      const confirmar = confirm(`¿Quitar "${item.nombre}" del carrito?`);
      if (!confirmar) return;
    }
    cambiarCantidad(item.idVariante, item.cantidad - 1);
  }

  function sumar(item) {
    if (item.stockDisponible != null && item.cantidad >= item.stockDisponible) {
      alert(`Solo hay ${item.stockDisponible} unidades disponibles de esta talla.`);
      return;
    }
    cambiarCantidad(item.idVariante, item.cantidad + 1);
  }

  return (
    <>
      <Header siempreSolido />
      <main className="carrito-main">

        <div className="carrito-box">
          <h1 className="carrito-titulo">CARRITO</h1>

          {!cargado ? (
            <p className="carrito-vacio">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="carrito-vacio">Tu carrito está vacío.</p>
          ) : (
            <>
              <div className="carrito-grid">
                {items.map((item) => (
                  <Link href={`/prenda-pag/${item.idProducto}`} className="carrito-card" key={item.idVariante} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="carrito-imagen-wrap">
                      {item.imagen ? (
                        <img src={item.imagen} alt={item.nombre} className="carrito-imagen" />
                      ) : (
                        <div className="carrito-imagen carrito-sin-imagen" />
                      )}
                    </div>

                    <div className="carrito-info">
                      <div>
                        <p className="carrito-nombre">{item.nombre}</p>
                          {item.marca && <p className="carrito-marca">{item.marca}</p>}
                        <p className="carrito-precio">${item.precio.toFixed(2)}</p>
                        <p className="carrito-detalle">
                          TALLA {item.talla || 'ÚNICA'} | #{item.idVariante}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="carrito-heart"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          alternarFavorito(item.idProducto);
                        }}
                        aria-label={esFavorito(item.idProducto) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <img
                          src={esFavorito(item.idProducto) ? '/ICONOS/Heart2.png' : '/ICONOS/Heart.png'}
                          alt=""
                        />
                      </button>
                    </div>

                    <div className="carrito-stepper">
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); restar(item); }} aria-label="Quitar una unidad">—</button>
                      <span>{item.cantidad}</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); sumar(item); }} aria-label="Agregar una unidad">+</button>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="carrito-resumen-barra">
                <div>
                  <span className="carrito-resumen-total">TOTAL ${subtotal.toFixed(2)}</span>
                  <span className="carrito-resumen-iva">(IVA INCLUIDO)</span>
                </div>
                <button type="button" className="carrito-proceder" onClick={() => router.push('/checkout')}>
                  PROCEDER COMPRA
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
