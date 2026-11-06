import '../WomanPage.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PaginaWinterSeason from '@/components/PaginaWinterSeason';

export default function WinterSeasonMujerPage() {
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
          <h3 className="nombre-seccion">WINTER SEASON - MUJER</h3>
          <p className="descripcion-seccion">
            Colección exclusiva de temporada de invierno para mujer en The Outfit.
          </p>
        </section>

        <section className="seccion-catalogo">
          <PaginaWinterSeason idCategoriaPadre={56} />
        </section>
      </main>
      <Footer />
    </>
  );
}
