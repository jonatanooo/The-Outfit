"use client"
import './PrendaInfo.css';
import { useState } from 'react'
import { useProducto } from '@/lib/productos'

function PrendaIfo ({ idProducto }) {

    const [abiertoId, setAbiertoId] = useState(null)
    const { producto, cargando } = useProducto(idProducto)
    
    // Estados para el visor de imágenes
    const [visorAbierto, setVisorAbierto] = useState(false)
    const [indiceVisor, setIndiceVisor] = useState(0)

    const fotos = producto?.fotos?.length > 0 ? producto.fotos : (producto?.imagen ? [producto.imagen] : ["/PrendasCarrusel/5.jpg"]);

    const secciones = [
        {id: 1, titulo: "DETALLES DE PRODUCTO", texto: producto?.descripcion || "Esta prenda es una sudadera o camiseta gruesa de manga larga con un estilo casual y relajado. Destaca por su patrón de finas rayas horizontales blancas sobre un tono verde oscuro, acompañado de un clásico cuello redondo con acabado acanalado. Su diseño presenta un corte cuadrado (boxy fit) ligeramente corto, complementado con hombros caídos y mangas anchas que ofrecen una silueta holgada, muy cómoda y perfecta para el uso diario."},
        {id: 2, titulo: "CUIDADO DE MATERIALES", texto: "Para cuidar esta prenda, lávala a máquina con agua fría, siempre del revés y con colores similares. No utilices lejía ni blanqueador. Es preferible secarla al aire sobre una superficie plana para que no pierda su forma, o en secadora a un ciclo de temperatura baja. Si necesita planchado, hazlo a baja temperatura y por el reverso de la tela."},
        {id: 3, titulo: "NUESTRO COMPROMISO", texto: "En The Outfit, nuestro principal compromiso es ayudarte a verte y sentirte bien ofreciéndote ropa, zapatos y accesorios de excelente calidad. Nuestra misión es proporcionarte opciones de moda que sean accesibles para tu bolsillo y que, al mismo tiempo, se adapten con facilidad a tus diferentes actividades diarias. Para complementar este compromiso, también nos dedicamos a brindarte asesoría personalizada con el objetivo de acompañarte, elegir y crear junto a ti el atuendo perfecto para cualquier ocasión."},
    ]

    const siguienteFoto = () => setIndiceVisor((prev) => (prev + 1) % fotos.length)
    const anteriorFoto = () => setIndiceVisor((prev) => (prev - 1 + fotos.length) % fotos.length)

    return (
        <>
            <section className="prendainfo">
            <div className="galeria" style={{ position: 'relative' }}>
                {cargando ? (
                    <div className="skeleton" style={{ width: '100%', height: '100%', minHeight: '500px', borderRadius: '4px' }} />
                ) : (
                    <>
                        <img src={producto?.imagen || "/PrendasCarrusel/5.jpg"} alt={producto?.nombre || ""} />
                        
                        {/* Bot�n para expandir imagen */}
                        <button 
                            className="btn-expandir-img" 
                            onClick={() => {
                                setIndiceVisor(0);
                                setVisorAbierto(true);
                            }}
                            aria-label="Ver visor de im�genes"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                            </svg>
                        </button>
                    </>
                )}
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

            {/* Modal Visor de Imágenes */}
            {visorAbierto && (
                <div className="visor-overlay" onClick={() => setVisorAbierto(false)}>
                    <div className="visor-content" onClick={(e) => e.stopPropagation()}>
                        <button className="visor-close" onClick={() => setVisorAbierto(false)}>✕</button>
                        
                        <div className="visor-carrusel">
                            <button className="visor-btn visor-prev" onClick={anteriorFoto}>
                                <img src="/ICONOS/previous.png" alt="Anterior" />
                            </button>
                            
                            <img src={fotos[indiceVisor]} alt="Prenda ampliada" className="visor-img-principal" />
                            
                            <button className="visor-btn visor-next" onClick={siguienteFoto}>
                                <img src="/ICONOS/next.png" alt="Siguiente" />
                            </button>
                        </div>
                        
                        <div className="visor-indicadores">
                            {fotos.map((_, i) => (
                                <div key={i} className={`visor-punto ${i === indiceVisor ? 'activo' : ''}`} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default PrendaIfo
