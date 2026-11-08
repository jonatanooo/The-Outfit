import '../../productos/WomanPage.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PaginaWinterSeason from '@/components/PaginaWinterSeason';

export default function WinterSeasonHombrePage() {
  return (
    <>
      <Header />
      <main>
        {/* Contenedor de Banner / Imagen Principal exclusivo para Winter Season - Hombre (vacío y listo para editar) */}
        <section
  className="imgbanner"
  style={{
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden'
  }}
>
  <img 
    src="https://res.cloudinary.com/elcfbtuk/image/upload/w_1920,f_auto,q_auto/v1794111560/banner_man_v3.jpg" 
    alt="Banner Hombre Temporada de Invierno" 
    style={{
      width: '100%',
      height: 'auto',
      objectFit: 'cover',
      objectPosition: 'center'
    }}
  />
</section>

        <section className="seccion-catalogo">
          <PaginaWinterSeason idCategoriaPadre={57} />
        </section>
      </main>
      <Footer />
    </>
  );
}
