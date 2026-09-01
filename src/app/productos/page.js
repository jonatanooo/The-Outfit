import './WomanPage.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ListadoPrendas from '@/components/ListadoPrendas'
import FiltroMenu from '@/components/FiltroMenu'


export default function Home() {
    return(
        <>
        <Header />
            <main>
                {/* <!-- section lo ocupamos porque es uan division tematica --> */}
        <section className="imgbanner">
            <img src="/Fotos/banner-women.jpg" alt="" className="hero-img"/>
            <h3 className='nombre-seccion'>MUJER</h3>
            <p className='descripcion-seccion'>Compra ropa de mujer y accesorios de las más recientes colecciones en The Outfit.</p>
        </section>

        <section className="seccion-catalogo">
            
            <FiltroMenu />
        
            <div className='prenda-wrap-listado'>
                <ListadoPrendas />
            </div>
        </section>
        
            </main>
            <Footer />
        </>
    )
}