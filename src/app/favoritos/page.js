"use client"
import { useEffect, useState } from "react";
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabaseClient'
import { normalizarProducto } from '@/lib/productos'
import { useFavoritos } from '@/lib/useFavoritos'
import Link from 'next/link';
import { useCarrito } from '@/lib/CarritoContext'
import './favoritos.css'

function obtenerVariantes(variantes) {
  const activas = (variantes ?? []).filter((v) => (v.ID_EstadoProducto ?? 1) === 1);
  return activas.map((v) => ({
    idVariante: v.ID_Variante,
    precio: Number(v.Precio_Actual ?? 0),
    talla: v.Talla?.Tipos_Talla?.Nombre_TipoTalla?.trim() || '',
    stock: (v.Inventario ?? []).reduce(
      (total, inv) => total + (inv.Cantidad_Disponible ?? 0) - (inv.Cantidad_Reservada ?? 0),
      0
    ),
  }));
}

export default function FavoritosPage() {
  const { alternarFavorito, idUsuario, cargando: cargandoUsuario } = useFavoritos();
  const { agregarAlCarrito } = useCarrito();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [agregado, setAgregado] = useState(null);
  
  // Estado para el modal de tallas
  const [productoModal, setProductoModal] = useState(null);
  const [tallaModalSeleccionada, setTallaModalSeleccionada] = useState(null);

  useEffect(() => {
    if (cargandoUsuario) return;

    let activo = true;

    async function cargarFavoritos() {
      if (!idUsuario) {
        setProductos([]);
        setCargando(false);
        return;
      }

      setCargando(true);

      const { data, error } = await supabase
        .from('Favoritos')
        .select(`
          ID_Producto,
          Productos (
            ID_Producto,
            Nombre_Producto,
              Marca ( Nombre_Marca ),
            ID_EstadoProducto,
            Fotos_Productos ( URL_Foto, Orden ),
            Variante_Producto (
              ID_Variante,
              Precio_Actual,
              ID_EstadoProducto,
              Talla ( Tipos_Talla ( Nombre_TipoTalla ) ),
              Inventario ( Cantidad_Disponible, Cantidad_Reservada )
            )
          )
        `)
        .eq('ID_User', idUsuario);

      if (!activo) return;

      if (error) {
        console.error('Error cargando favoritos:', error.message);
        setProductos([]);
      } else {
        const items = (data ?? [])
          .map((f) => f.Productos)
          .filter(Boolean)
          .map((p) => {
            const variantes = obtenerVariantes(p.Variante_Producto);
            const hayStock = variantes.some((v) => v.stock > 0);
            return {
              ...normalizarProducto(p),
              variantes,
              hayStock
            };
          });
        setProductos(items);
      }
      setCargando(false);
    }

    cargarFavoritos();
    return () => { activo = false; };
  }, [idUsuario, cargandoUsuario]);

  function quitarFavorito(id) {
    alternarFavorito(id);
    setProductos((prev) => prev.filter((item) => item.id !== id));
  }

  function abrirModal(item) {
    if (!item.hayStock) {
      alert('Este producto no tiene stock disponible en este momento.');
      return;
    }
    setProductoModal(item);
    setTallaModalSeleccionada(null);
  }

  function confirmarAgregarACesta() {
    if (!productoModal || !tallaModalSeleccionada) return;
    
    const variante = productoModal.variantes.find((v) => v.idVariante === tallaModalSeleccionada);
    if (!variante) return;

    agregarAlCarrito({
      idVariante: variante.idVariante,
      idProducto: productoModal.id,
      nombre: productoModal.nombre,
        marca: productoModal.marca,
      talla: variante.talla,
      precio: variante.precio,
      imagen: productoModal.imagen,
      stockDisponible: variante.stock,
    });

    setAgregado(productoModal.id);
    setTimeout(() => setAgregado((actual) => (actual === productoModal.id ? null : actual)), 1500);
    setProductoModal(null);
  }

  return (
    <>
      <Header siempreSolido />
      <main className="favoritos-main">

        <div className="favoritos-box">
          <h1 className="favoritos-titulo">FAVORITOS</h1>

          {cargandoUsuario || cargando ? (
            <p className="favoritos-vacio">Cargando...</p>
          ) : !idUsuario ? (
            <p className="favoritos-vacio">Inicia sesión para ver tus favoritos.</p>
          ) : productos.length === 0 ? (
            <p className="favoritos-vacio">Todavía no tienes productos favoritos.</p>
          ) : (
            <div className="favoritos-grid">
              {productos.map((item) => (
                <Link href={`/prenda-pag/${item.id}`} className="favorito-card" key={item.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="favorito-imagen-wrap">
                    {item.imagen ? (
                      <img src={item.imagen} alt={item.nombre} className="favorito-imagen" />
                    ) : (
                      <div className="favorito-imagen favorito-sin-imagen" />
                    )}
                  </div>

                  <div className="favorito-info">
                    <div>
                      <p className="favorito-nombre">{item.nombre}</p>
                      {item.marca && <p className="favorito-marca">{item.marca}</p>}
                      <p className="favorito-precio">${item.precio.toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      className="favorito-heart"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        quitarFavorito(item.id);
                      }}
                      aria-label="Quitar de favoritos"
                    >
                      <img src="/ICONOS/Heart2.png" alt="" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="favorito-add"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      abrirModal(item);
                    }}
                    disabled={!item.hayStock}
                  >
                    {agregado === item.id
                      ? 'AGREGADO ✓'
                      : item.hayStock
                      ? 'AÑADIR A LA CESTA'
                      : 'SIN STOCK'}
                  </button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      
      {/* Modal de Tallas */}
      {productoModal && (
        <div className="modal-tallas-overlay" onClick={() => setProductoModal(null)}>
          <div className="modal-tallas-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-tallas-close" onClick={() => setProductoModal(null)}>✕</button>
            <h3 className="modal-tallas-titulo">SELECCIONA UNA TALLA</h3>
            <p className="modal-tallas-nombre">{productoModal.nombre}</p>
            <div className="modal-tallas-grid">
              {productoModal.variantes.map((v) => (
                <button
                  key={v.idVariante}
                  className={`modal-talla-btn ${v.stock > 0 ? 'modal-talla-disponible' : 'modal-talla-agotada'} ${tallaModalSeleccionada === v.idVariante ? 'modal-talla-seleccionada' : ''}`}
                  disabled={v.stock <= 0}
                  onClick={() => setTallaModalSeleccionada(v.idVariante)}
                >
                  {v.talla || 'ÚNICA'}
                </button>
              ))}
            </div>
            <button
              className="modal-tallas-ok"
              disabled={!tallaModalSeleccionada}
              onClick={confirmarAgregarACesta}
            >
              {!tallaModalSeleccionada ? 'ELIGE UNA TALLA' : 'AÑADIR A LA CESTA'}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
