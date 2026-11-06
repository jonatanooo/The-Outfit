"use client";
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PaginaWinterSeason from '@/components/PaginaWinterSeason';
import '../productos/WomanPage.css';

function WinterSeasonPageContent() {
  const searchParams = useSearchParams();
  const generoParam = (searchParams.get('genero') || searchParams.get('gender') || 'mujer').toLowerCase();
  const esHombre = generoParam === 'hombre' || generoParam === 'hombres' || generoParam === '57';
  const idCategoriaPadre = esHombre ? 57 : 56;
  const generoLabel = esHombre ? 'HOMBRE' : 'MUJER';

  return (
    <>
      <Header />
      <main>
        {/* Banner / Imagen Principal Vacía (Placeholder limpio sin foto para futuro recurso visual) */}
        <section
          className="imgbanner banner-placeholder"
          style={{
            backgroundColor: '#111827',
            position: 'relative',
            display: 'block'
          }}
        >
          {/* Contenedor completamente vacío para imagen/video futuro */}
          <div
            className="hero-img-placeholder"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0f172a'
            }}
          />
          <h3 className="nombre-seccion">WINTER SEASON - {generoLabel}</h3>
          <p className="descripcion-seccion">
            Colección exclusiva de temporada de invierno para {generoLabel.toLowerCase()} en The Outfit.
          </p>
        </section>

        {/* Sección de Catálogo exclusiva de Winter Season con FiltroMenu y ListadoPrendas */}
        <section className="seccion-catalogo">
          <PaginaWinterSeason idCategoriaPadre={idCategoriaPadre} />
        </section>
      </main>
      <Footer />
    </>
  );
}

export default function WinterSeasonPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center' }}>Cargando Winter Season...</div>}>
      <WinterSeasonPageContent />
    </Suspense>
  );
}
