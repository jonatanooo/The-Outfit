"use client"
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import "./CarruselPrenda.css";
import { supabase } from "@/lib/supabaseClient";

// IMPORTAMOS REDUX Y LAS ACCIONES DEL CARRITO Y FAVORITOS
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, toggleCart } from '../store/slices/cartSlice'; 
import { toggleFavorite } from '../store/slices/favoritesSlice';

// trae las prendas mas recientes de una categoria padre (ej. Mujer = 56)
async function getPrendasRecientes(idCategoriaPadre, limite = 9) {
  // 1. subcategorias de esa categoria padre
  const { data: subcats, error: errorSubcats } = await supabase
    .from("Categorias_Producto")
    .select("ID_categoria")
    .eq("ID_CategoriaPadre", idCategoriaPadre);

  if (errorSubcats) {
    console.error("Error subcategorias:", JSON.stringify(errorSubcats, null, 2));
    return [];
  }

  const idsCategorias = subcats.map((c) => c.ID_categoria);
  if (idsCategorias.length === 0) return [];

  // 2. productos de esas subcategorias, mas recientes primero
  const { data, error } = await supabase
    .from("Productos")
    .select(`
      ID_Producto,
      Nombre_Producto,
      Fecha_Creacion,
      Marca ( Nombre_Marca ),
      Variante_Producto ( Precio_Actual ),
      Fotos_Productos ( URL_Foto, Orden )
    `)
    .in("ID_Categoria", idsCategorias)
    .order("Fecha_Creacion", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("Error productos:", JSON.stringify(error, null, 2));
    return [];
  }

  return data.map((producto) => {
    const precios = producto.Variante_Producto?.map((v) => v.Precio_Actual) ?? [];
    return {
      id: producto.ID_Producto,
      nombre: producto.Nombre_Producto,
      marca: producto.Marca?.Nombre_Marca ?? "",
      precio: precios.length ? Math.min(...precios) : null,
      imagen: producto.Fotos_Productos?.find((f) => f.Orden === 4)?.URL_Foto
        ?? "/Fotos/placeholder.jpg",
    };
  });
}

function CarruselPrendasHombres({ idCategoriaPadre = 57 }) {
  const [prendas, setPrendas] = useState([]);
  const [indice, setIndice] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getPrendasRecientes(idCategoriaPadre).then((data) => {
      setPrendas(data);
      setCargando(false);
    });
  }, [idCategoriaPadre]);

  const prendasVisibles = prendas.slice(indice, indice + 3);

  const dispatch = useDispatch();
  const favItems = useSelector((state) => state.favorites.items);

  const siguiente = () => {
    if (indice + 3 < prendas.length) setIndice(indice + 1);
  };
  const anterior = () => {
    if (indice > 0) setIndice(indice - 1);
  };

  if (cargando) return <p>Cargando recomendaciones...</p>;
  if (prendas.length === 0) return null;

  return (
    <div className="carrusel-wrap">
      <motion.button whileHover={{scale: 1.1}} onClick={anterior} disabled={indice === 0} className="buttons-move-card">
        <img src="/ICONOS/previous.png" alt="" />
      </motion.button>
      
      <div className="carrusel-fila">
        {prendasVisibles.map((prenda) => {
          const isFavorite = favItems.some((fav) => fav.id === prenda.id);

          return (
            <div className="prenda-card" key={prenda.id}>
              <div className="prenda-imagen-wrap" style={{ position: 'relative' }}>
                
                <button 
                  className="btn-favorito" 
                  aria-label="Agregar a favoritos"
                  style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, cursor: 'pointer', background: 'none', border: 'none' }}
                  onClick={(e) => {
                    e.preventDefault();
                    dispatch(toggleFavorite({
                      id: prenda.id,
                      nombre: prenda.nombre,
                      precio: prenda.precio,
                      imagen: prenda.imagen,
                      marca: prenda.marca
                    }));
                  }}
                >
                  <img 
                    src="/ICONOS/Heart.png" 
                    alt="like" 
                    className="favicon" 
                    style={{ 
                      filter: isFavorite ? 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)' : 'none',
                      transition: 'filter 0.3s'
                    }} 
                  />
                </button>
                
                <a href={`/producto/${prenda.id}`}> 
                  <motion.img whileHover={{scale: 1.2}} src={prenda.imagen} alt={prenda.nombre} className="prenda-imagen" />
                </a>

                <button 
                  onClick={(e) => {
                    e.preventDefault(); 
                    dispatch(addToCart({
                      id: prenda.id,
                      nombre: prenda.nombre,
                      precio: prenda.precio,
                      imagen: prenda.imagen,
                      marca: prenda.marca,
                      talla: 'M',
                      color: 'Único'
                    }));
                    dispatch(toggleCart()); 
                  }}
                  className="btn-añadir-bolsa"
                  style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255, 255, 255, 0.95)', color: 'black', border: '1px solid black', padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', zIndex: 10, width: '80%', textAlign: 'center' }}
                >
                  Añadir
                </button>
              </div>

              <a href={`/producto/${prenda.id}`} className="card-link"> 
                  <div className="prenda-info">
                      <div>
                          <p className="prenda-nombre">{prenda.nombre}</p>
                          <p className="prenda-marca">{prenda.marca}</p>
                      </div>
                      <p className="prenda-precio">${prenda.precio}</p>
                  </div>
              </a>
            </div>
          );
        })}
      </div>
      
      <motion.button whileHover={{scale: 1.1}} onClick={siguiente} disabled={indice + 3 >= prendas.length} className="buttons-move-card"> 
        <img src="/ICONOS/next.png" alt="" />
      </motion.button>
    </div>
  );
}

export default CarruselPrendasHombres;