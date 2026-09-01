"use client"
import './PrendaInfo.css';
import CarruselInfinito from '@/components/CarruselInfinito';
import { useState } from 'react'

function PrendaIfo () {

    const [abiertoId, setAbiertoId] = useState(null)

    const secciones = [
        {id: 1, titulo: "DETALLES DE PRODUCTO", texto: "Esta prenda es una sudadera o camiseta gruesa de manga larga con un estilo casual y relajado. Destaca por su patrón de finas rayas horizontales blancas sobre un tono verde oscuro, acompañado de un clásico cuello redondo con acabado acanalado. Su diseño presenta un corte cuadrado (boxy fit) ligeramente corto, complementado con hombros caídos y mangas anchas que ofrecen una silueta holgada, muy cómoda y perfecta para el uso diario."},
        {id: 2, titulo: "CUIDADO DE MATERIALES", texto: "Para cuidar esta prenda, lávala a máquina con agua fría, siempre del revés y con colores similares. No utilices lejía ni blanqueador. Es preferible secarla al aire sobre una superficie plana para que no pierda su forma, o en secadora a un ciclo de temperatura baja. Si necesita planchado, hazlo a baja temperatura y por el reverso de la tela."},
        {id: 3, titulo: "NUESTRO COMPROMISO", texto: "En The Outfit, nuestro principal compromiso es ayudarte a verte y sentirte bien ofreciéndote ropa, zapatos y accesorios de excelente calidad. Nuestra misión es proporcionarte opciones de moda que sean accesibles para tu bolsillo y que, al mismo tiempo, se adapten con facilidad a tus diferentes actividades diarias. Para complementar este compromiso, también nos dedicamos a brindarte asesoría personalizada con el objetivo de acompañarte, elegir y crear junto a ti el atuendo perfecto para cualquier ocasión."},
    ]

    return (
        <>
            <section className="prendainfo">
            <div className="galeria">
                <img src="/PrendasCarrusel/5.jpg" alt="" />
            </div>

            <div className="descripcionprenda">
                <div className="contenedordescripcion">
                    {secciones.map((seccion) => (
                        <div className={`acordeon  ${abiertoId === seccion.id? 'activo' : ''}`}
                        key={seccion.id}>
                            <button className='titulo'
                            onClick={() => setAbiertoId(abiertoId === seccion.id ? null : seccion.id)}>
                                {seccion.titulo}
                                <img src="/ICONOS/Flechaabajo.png" alt="desplegar" id="bajar" />
                            </button>
                            <div className='contenido'>
                                <p>{seccion.texto}</p>
                            </div>
                        </div>
                    ))}
                    
                </div>
            </div>
            </section>
        </>
    )
}

export default PrendaIfo