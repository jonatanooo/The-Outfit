"use client"
import { useEffect, useState } from "react";
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabaseClient'
import { normalizarProducto } from '@/lib/productos'
import { useFavoritos } from '@/lib/useFavoritos'
import { useCarrito } from '@/lib/CarritoContext'
import './favoritos.css'

// De las variantes de un producto, elige la primera con stock para el "agregar
// rápido" desde Favoritos (esta vista no tiene selector de talla).
function elegirVarianteDefault(variantes) {
  const activas = (variantes ?? []).filter((v) => (v.ID_EstadoProducto ?? 1) === 1);
  const conStock = activas
    .map((v) => ({
      idVariante: v.ID_Variante,
      precio: Number(v.Precio_Actual ?? 0),
      talla: v.Talla?.Tipos_Talla?.Nombre_TipoTalla?.trim() || '',
      stock: (v.Inventario ?? []).reduce(
        (total, inv) => total + (inv.Cantidad_Disponible ?? 0) - (inv.Cantidad_Reservada ?? 0),
        0
      ),
    }))
    .filter((v) => v.stock > 0);

  return conStock[0] ?? null;
}

export default function FavoritosPage() {
  const { alternarFavorito, idUsuario, cargando: cargandoUsuario } = useFavoritos();
  const { agregarAlCarrito } = useCarrito();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [agregado, setAgregado] = useState(null);

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
          .map((p) => ({
            ...normalizarProducto(p),
            varianteDefault: elegirVarianteDefault(p.Variante_Producto),
          }));
        setProductos(items);
      }
      setCargando(false);
    }

    cargarFavoritos();
    return () => { activo = false; };
  }, [idUsuario, cargandoUsuario]);

  // quita el favorito en Supabase y lo saca de la lista sin recargar todo
  function quitarFavorito(id) {
    alternarFavorito(id);
    setProductos((prev) => prev.filter((item) => item.id !== id));
  }

  function agregarACesta(item) {
    if (!item.varianteDefault) {
      alert('Este producto no tiene stock disponible en este momento.');
      return;
    }

    agregarAlCarrito({
      idVariante: item.varianteDefault.idVariante,
      idProducto: item.id,
      nombre: item.nombre,
      talla: item.varianteDefault.talla,
      precio: item.varianteDefault.precio,
      imagen: item.imagen,
      stockDisponible: item.varianteDefault.stock,
    });

    setAgregado(item.id);
    setTimeout(() => setAgregado((actual) => (actual === item.id ? null : actual)), 1500);
  }

  return (
    <>
      <Header siempreSolido />
      <main className="favoritos-main">
        <p className="favoritos-breadcrumb">Favoritos</p>

        <div className="favoritos-box">
          <h1 className="favoritos-titulo">FAVORITOS</h1>

          {cargandoUsuario || cargando ? (
            <p className="favoritos-vacio">Cargando...</p>
          ) : !idUsuario ? (
            <p className="favoritos-vacio">Iniciá sesión para ver tus favoritos.</p>
          ) : productos.length === 0 ? (
            <p className="favoritos-vacio">Todavía no tienes productos favoritos.</p>
          ) : (
            <div className="favoritos-grid">
              {productos.map((item) => (
                <div className="favorito-card" key={item.id}>
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
                      <p className="favorito-precio">${item.precio.toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      className="favorito-heart"
                      onClick={() => quitarFavorito(item.id)}
                      aria-label="Quitar de favoritos"
                    >
                      <img src="/ICONOS/Heart2.png" alt="" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="favorito-add"
                    onClick={() => agregarACesta(item)}
                    disabled={!item.varianteDefault}
                  >
                    {agregado === item.id
                      ? 'AGREGADO ✓'
                      : item.varianteDefault
                      ? 'AÑADIR A LA CESTA'
                      : 'SIN STOCK'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
