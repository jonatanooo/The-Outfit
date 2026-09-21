import './WomanPage.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PaginaCategoria from '@/components/PaginaCategoria'

export default function Home() {
    return(
        <>
        <Header />
            <main>
        <section className="imgbanner">
            <img src="/Fotos/banner-women.jpg" alt="" className="hero-img"/>
            <h3 className='nombre-seccion'>MUJER</h3>
            <p className='descripcion-seccion'>Ropa de mujer y accesorios de las más recientes colecciones en The Outfit.</p>
        </section>

        <section className="seccion-catalogo">
            <PaginaCategoria idCategoriaPadre={56} />
        </section>

            </main>
            <Footer />
        </>
    )
}