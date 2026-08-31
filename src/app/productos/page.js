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