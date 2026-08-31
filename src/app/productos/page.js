import './WomanPage.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ListadoPrendas from '@/components/ListadoPrendas'


export default function Home() {
    return(
        <>
        <Header />
            <main>
                {/* <!-- section lo ocupamos porque es uan division tematica --> */}
        <section className="imgbanner">
            <img src="/Fotos/banner-women.jpg" alt="" className="hero-img"/>
        </section>

        <section className="filtros">
            <div className='filtro-linea1'>
                <p className='items-cantidad'><span className='items-numero'>100</span> Items filtrados por <span className='filtro-cantidad'>CATEGORIA</span></p>
                <button className='boton-filtro'><img src="/ICONOS/FILTRO.png" alt="filtro" className='img-filtro'/><span className='filtrar-titulo'>Filtrar y clasificar</span></button>
            </div>

            <div className='filtro-linea2'>
                <p>Aqui es un resument de todo los filtros que estan activos</p>
                <button>al dale click se elimina un filtro uno por uno, dependiendo de cual este activo</button>
            </div>
        </section>

        <section className='prenda-wrap-listado'>
            <ListadoPrendas />
        </section>
        
            </main>
            <Footer />
        </>
    )
}