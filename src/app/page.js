import './Mainpage.css'
import CarruselPrendas from '../components/CarruselPrenda.jsx';
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ID_CATEGORIA_MUJER, ID_CATEGORIA_HOMBRE } from '@/lib/productos'
import Link from 'next/link';

export default function Home() {
    return(
        <>
        <Header />
            <main>
                {/* <!-- section lo ocupamos porque es uan division tematica --> */}
        <section className="videobanner">
            <video className="hero-video" autoPlay muted loop playsInline preload="auto">
                <source src="https://res.cloudinary.com/elcfbtuk/video/upload/f_auto,q_auto:best/v1793894591/VideoPasarela.mov" type="video/mp4" />
            </video>
        </section>

        <section className="nuevosingresos">
            <h2>NUEVOS INGRESOS</h2>
            <CarruselPrendas idGenero={ID_CATEGORIA_MUJER} />
            <CarruselPrendas idGenero={ID_CATEGORIA_HOMBRE} />
        </section>

        <section className="promobanner">
            <Link href='/productos/winter-season'>
                <video 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    style={{ pointerEvents: 'none', objectFit: 'cover', width: '100%', height: '100%' }}
                >
                    <source src="https://res.cloudinary.com/elcfbtuk/video/upload/f_auto,q_auto:best/v1793893721/BannerWeb-Invierno.mp4" />
                </video>
            </Link>
        
        </section>
            </main>
            <Footer />
        </>
    )
}
