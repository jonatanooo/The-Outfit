"use client";
import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ListadoPrendas from '@/components/ListadoPrendas';
import { ID_CATEGORIA_MUJER, ID_CATEGORIA_HOMBRE } from '@/lib/productos';
import './ofertas.css';

export default function PaginaOfertas() {
  const [generoSeleccionado, setGeneroSeleccionado] = useState(null); // null = Todos, 56 = Mujer, 57 = Hombre
  const [orden, setOrden] = useState('Recomendados');
  const [cantidadOfertas, setCantidadOfertas] = useState(0);

  const filtros = {
    ...(orden !== 'Recomendados' ? { "Ordenar Por": [orden] } : {})
  };

  return (
    <>
      <Header />
      <main>
        {/* Banner de Ofertas */}
        <section className="ofertas-banner">
          <span className="ofertas-badge-top">Temporada de Descuentos</span>
          <h1 className="ofertas-titulo">OFERTAS EXCLUSIVAS</h1>
          <p className="ofertas-subtitulo">
            Aprovecha precios especiales en prendas seleccionadas. Descuentos por tiempo limitado en The Outfit.
          </p>
        </section>

        {/* Barra de Filtros y Orden */}
        <section className="ofertas-filtros-bar">
          <div className="ofertas-pills">
            <button
              type="button"
              className={`ofertas-pill-btn ${generoSeleccionado === null ? 'activo' : ''}`}
              onClick={() => setGeneroSeleccionado(null)}
            >
              Todos
            </button>
            <button
              type="button"
              className={`ofertas-pill-btn ${generoSeleccionado === ID_CATEGORIA_MUJER ? 'activo' : ''}`}
              onClick={() => setGeneroSeleccionado(ID_CATEGORIA_MUJER)}
            >
              Mujer
            </button>
            <button
              type="button"
              className={`ofertas-pill-btn ${generoSeleccionado === ID_CATEGORIA_HOMBRE ? 'activo' : ''}`}
              onClick={() => setGeneroSeleccionado(ID_CATEGORIA_HOMBRE)}
            >
              Hombre
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>
              {cantidadOfertas} {cantidadOfertas === 1 ? 'prenda en oferta' : 'prendas en oferta'}
            </span>
            <select
              className="ofertas-orden-select"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            >
              <option value="Recomendados">Recomendados</option>
              <option value="Precio: menor a mayor">Precio: menor a mayor</option>
              <option value="Precio: mayor a menor">Precio: mayor a menor</option>
            </select>
          </div>
        </section>

        {/* Listado de Productos Exclusivo para Ofertas */}
        <div style={{ minHeight: '400px', marginBottom: '60px' }}>
          <ListadoPrendas
            filtros={filtros}
            idCategoriaPadre={generoSeleccionado}
            soloOfertas={true}
            onResultados={setCantidadOfertas}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}

