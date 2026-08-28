import './Footer.css'

function Footer () {
    return (
        <footer>
            <div className="contenedor">
        <div className="izquierda">
            <div>
                <h2>The Outfit</h2>
            </div>
            <div>
                <a href="https://www.facebook.com/TheOutfitClothes/?locale=es_LA" target="_blank"><img src="\ICONOS\facebook.png" alt="facebook" className="finalicons"/></a>
                <a href="https://www.instagram.com/the_outfitsv?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==&igsi=ZDNlZDc0MzIxNw==" target="_blank" ><img src="\ICONOS\instagram.png" alt="instagran" className="finalicons"/></a>
                <a href="#" target="_blank"><img src="\ICONOS\tiktok.png" alt="tiktok" className="finalicons"/></a>
                <a href="https://maps.app.goo.gl/fQw39kJBKJiJ8jci8" target="_blank"><img src="\ICONOS\maps.png" alt="maps" className="finalicons"/></a>
            </div>
        </div>

        <div className="derecha">
            <div>
                <ul>
                        <li className="Titulosfooter">AYUDA</li>
                        <li><a href="" className="direccionefooter">Pagos</a></li>
                        <li><a href="" className="direccionefooter">Devoluciones</a></li>
                        <li><a href="" className="direccionefooter">Envíos</a></li>
                </ul>
            </div>

            <div>
                <ul>
                        <li className="Titulosfooter">SOBRE NOSOTROS</li>
                        <li><a href="" className="direccionefooter">Historia</a></li>
                        <li><a href="" className="direccionefooter">Ubicación</a></li>
                </ul>
            </div>

            <div>
                <ul>
                        <li className="Titulosfooter">RECOMENDACIONES</li>
                        <li><a href="" className="direccionefooter">Temporada de Verano</a></li>
                        <li><a href="" className="direccionefooter">Ofertas Agostinas</a></li>
                </ul>
            </div>
        </div>
    </div>
        </footer>
    )
}
export default Footer;