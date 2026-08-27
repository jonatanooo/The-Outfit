import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

function Mainpage () {
    return(
        <>
            <Header />
            <main>
                {/* <!-- section lo ocupamos porque es uan division tematica --> */}
        <section className="videobanner">
            <video className="hero-video" autoplay muted loop playsinline preload="auto">
                <source src="/Videos/VideoPasarela.mov" type="video/mp4"/>
            </video>
        </section>

        <section className="nuevosingresos">
            <h2>NUEVOS INGRESOS</h2>
            <div id="" className="carruselnuevosingresos">
                <div>
                    <a href="#"><img src="\Fotos\01165152330-e1 copia.jpg" alt="Blusa" className="clothes"/></a>
                    <h3>Blusa Floreada</h3>
                    <a href="#"><img src="\ICONOS\Heart.png" alt="" className="favclothes"/></a>
                </div>

                <div>
                    <a href="#"><img src="\Fotos\02139988643-e1 copia.jpg" alt="Blusa2" className="clothes"/></a>
                    <h3>Blusa Floreada</h3>
                    <a href="#"><img src="\ICONOS\Heart.png" alt="" className="favclothes"/></a>
                </div>
                

                <div>
                    <a href="#"><img src="\Fotos\07085775052-e1 copia.jpg" alt="Blusa3" className="clothes"/></a>
                    <h3>Blusa Floreada</h3>
                    <a href="#"><img src="\ICONOS\Heart.png" alt="" className="favclothes"/></a>
                </div>
            </div>

            <div id="" className="carruselnuevosingresos">
                <div>
                    <a href="#"><img src="\Fotos\01165152330-e1 copia.jpg" alt="Blusa" className="clothes"/></a>
                    <h3>Blusa Floreada</h3>
                    <a href="#"><img src="\ICONOS\Heart.png" alt="" className="favclothes"/></a>
                    <h3></h3>
                </div>

                <div>
                    <a href="#"><img src="\Fotos\02139988643-e1 copia.jpg" alt="Blusa2" className="clothes"/></a>
                    <h3>Blusa Floreada</h3>
                    <a href="#"><img src="\ICONOS\Heart.png" alt="" className="favclothes"/></a>
                </div>
                

                <div>
                    <a href="#"><img src="\Fotos\07085775052-e1 copia.jpg" alt="Blusa3" className="clothes"/></a>
                    <h3>Blusa Floreada</h3>
                    <a href="#"><img src="\ICONOS\Heart.png" alt="" className="favclothes"/></a>
                </div>
            </div>
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