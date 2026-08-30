import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import './Mainpage.css'
import CarruselPrendas from '../components/CarruselPrenda.jsx';

function Mainpage () {
    return(
        <>
            <Header />
            <main>
                {/* <!-- section lo ocupamos porque es uan division tematica --> */}
        <section className="videobanner">
            <video className="hero-video" autoPlay muted loop playsInline preload="auto">
                <source src="/Videos/VideoPasarela.mov" type="video/mp4"/>
            </video>
        </section>

        <section className="nuevosingresos">
            <h2>NUEVOS INGRESOS</h2>
            <CarruselPrendas  />
            <CarruselPrendas  />
        </section>

        <section className="promobanner">
        <div className="bannerfotos">
            {/* <!-- foto 1 --> */}
            <div>
                <a href="#">
                    <img src="\Fotos\02142004104-a5.jpg" alt="" className="banners"/>
                </a>

                <a href="">
                    <h2 className="bannertitulos1">VER COLECCIÓN</h2>
                </a>
            </div> 
            {/* <!-- foto 2 --> */}
            <div>
                <a href="#"><img src="\Fotos\04813802712-a2.jpg" alt="" className="banners"/></a>
                <a href=""><h2 className="bannertitulos2">SALES</h2></a>
            </div>
        </div>
        
        </section>
            </main>
            <Footer />
        </>
    )
}

export default Mainpage;