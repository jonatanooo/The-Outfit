"use client"
import { useEffect, useState } from "react";
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { db } from '@/lib/firebaseClient';
import { collection, getDocs, query, where } from 'firebase/firestore';
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
      (total, inv) => total + (Number(inv.Cantidad_Disponible ?? 0) - Number(inv.Cantidad_Reservada ?? 0)),
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

      try {
        const opcionesUser = [idUsuario, String(idUsuario)];
        if (!isNaN(Number(idUsuario))) opcionesUser.push(Number(idUsuario));
        const qFav = query(collection(db, 'Favoritos'), where('ID_User', 'in', Array.from(new Set(opcionesUser))));
        const snapFav = await getDocs(qFav);

        if (snapFav.empty) {
          if (!activo) return;
          setProductos([]);
          setCargando(false);
          return;
        }

        const pidsFavoritos = new Set(snapFav.docs.map((d) => d.data().ID_Producto).filter(Boolean).map(String));

        const [
          prodSnap,
          marcasSnap,
          fotosSnap,
          varSnap,
          tallaSnap,
          tiposTallaSnap,
          invSnap
        ] = await Promise.all([
          getDocs(collection(db, 'Productos')),
          getDocs(collection(db, 'Marca')),
          getDocs(collection(db, 'Fotos_Productos')),
          getDocs(collection(db, 'Variante_Producto')),
          getDocs(collection(db, 'Talla')),
          getDocs(collection(db, 'Tipos_Talla')),
          getDocs(collection(db, 'Inventario'))
        ]);

        if (!activo) return;

        const marcasMap = {};
        marcasSnap.docs.forEach((d) => {
          const m = d.data();
          const id = m.ID_Marca ?? d.id;
          marcasMap[id] = m;
          marcasMap[String(id)] = m;
        });

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

        const invPorVariante = {};
        invSnap.docs.forEach((d) => {
          const i = d.data();
          const vid = i.ID_Variante;
          if (vid != null) {
            if (!invPorVariante[vid]) invPorVariante[vid] = [];
            invPorVariante[vid].push(i);
            if (!invPorVariante[String(vid)]) invPorVariante[String(vid)] = invPorVariante[vid];
          }
        });

        const fotosPorProducto = {};
        fotosSnap.docs.forEach((d) => {
          const f = d.data();
          const pid = f.ID_Producto;
          if (pid != null) {
            if (!fotosPorProducto[pid]) fotosPorProducto[pid] = [];
            fotosPorProducto[pid].push(f);
            if (!fotosPorProducto[String(pid)]) fotosPorProducto[String(pid)] = fotosPorProducto[pid];
          }
        });

        const variantesPorProducto = {};
        varSnap.docs.forEach((d) => {
          const v = d.data();
          const pid = v.ID_Producto;
          if (pid != null) {
            const item = {
              ...v,
              ID_Variante: v.ID_Variante ?? d.id,
              Talla: tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || null,
              Inventario: invPorVariante[v.ID_Variante ?? d.id] || []
            };
            if (!variantesPorProducto[pid]) variantesPorProducto[pid] = [];
            variantesPorProducto[pid].push(item);
            if (!variantesPorProducto[String(pid)]) variantesPorProducto[String(pid)] = variantesPorProducto[pid];
          }
        });

        const items = prodSnap.docs
          .map((d) => {
            const p = d.data();
            const pid = p.ID_Producto ?? d.id;
            return {
              ...p,
              ID_Producto: pid,
              Marca: marcasMap[p.ID_Marca] || null,
              Fotos_Productos: fotosPorProducto[pid] || fotosPorProducto[String(pid)] || [],
              Variante_Producto: variantesPorProducto[pid] || variantesPorProducto[String(pid)] || []
            };
          })
          .filter((p) => pidsFavoritos.has(String(p.ID_Producto)))
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
      } catch (err) {
        console.error('Error cargando favoritos desde Firestore:', err);
        setProductos([]);
      } finally {
        setCargando(false);
      }
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
      marca: productoModal.marca || 'The Outfit',
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
                    {item.enOferta && (
                      <span style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        backgroundColor: '#c62828',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        zIndex: 2
                      }}>
                        -{item.porcentajeDescuento}%
                      </span>
                    )}
                    {item.imagen ? (
                      <img src={item.imagen} alt={item.nombre} className="favorito-imagen" />
                    ) : (
                      <div className="favorito-imagen favorito-sin-imagen" />
                    )}
                  </div>

                  <div className="favorito-info">
                    <div>
                      <p className="favorito-nombre">{item.nombre}</p>
                      <p className="favorito-marca">{item.marca || 'The Outfit'}</p>
                      {item.enOferta ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                          <span style={{ textDecoration: 'line-through', color: '#888', fontSize: '0.85rem' }}>
                            ${item.precioOriginal ? Number(item.precioOriginal).toFixed(2) : ''}
                          </span>
                          <span style={{ color: '#c62828', fontWeight: 'bold' }}>
                            ${item.precio.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <p className="favorito-precio">${item.precio.toFixed(2)}</p>
                      )}
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
