"use client"
import './Buscador.css'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function Buscador({ onClose }) {
    const [texto, setTexto] = useState('')
    const [sugerencias, setSugerencias] = useState([])
    const [buscando, setBuscando] = useState(false)
    const inputRef = useRef(null)
    const router = useRouter()

    // se monta solo mientras la ventana emergente está abierta, así que enfoca el input al aparecer
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // busca coincidencias en Supabase mientras el usuario escribe (con debounce)
    useEffect(() => {
        const termino = texto.trim()
        const timeoutId = setTimeout(async () => {
            if (termino.length < 2) {
                setSugerencias([])
                setBuscando(false)
                return
            }

            setBuscando(true)
            const { data, error } = await supabase
                .from('Productos')
                .select('ID_Producto, Nombre_Producto, Fotos_Productos ( URL_Foto, Orden )')
                .ilike('Nombre_Producto', `%${termino}%`)
                .limit(8)

            if (!error) setSugerencias(data ?? [])
            setBuscando(false)
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [texto])

    const irAlCatalogo = () => {
        onClose()
        router.push('/productos')
    }

    return (
        <div className="buscador-overlay" onClick={onClose}>
            <div className="buscador-modal" onClick={(event) => event.stopPropagation()}>
                <div className="buscador-barra">
                    <img src="/ICONOS/Search.png" alt="" className="buscador-icono" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar prenda por nombre..."
                        value={texto}
                        onChange={(event) => setTexto(event.target.value)}
                    />
                    <button type="button" className="buscador-cerrar" onClick={onClose} aria-label="Cerrar búsqueda">
                        ✕
                    </button>
                </div>

                {texto.trim().length >= 2 && (
                    <div className="buscador-resultados">
                        {buscando && <p className="buscador-mensaje">Buscando...</p>}

                        {!buscando && sugerencias.length === 0 && (
                            <p className="buscador-mensaje">No se encontraron prendas con &quot;{texto}&quot;</p>
                        )}

                        {!buscando && sugerencias.map((producto) => {
                            const fotos = [...(producto.Fotos_Productos ?? [])].sort((a, b) => (a.Orden ?? 0) - (b.Orden ?? 0))
                            const foto = fotos[0]
                            return (
                                <button
                                    key={producto.ID_Producto}
                                    type="button"
                                    className="buscador-sugerencia"
                                    onClick={irAlCatalogo}
                                >
                                    {foto ? (
                                        <img src={foto.URL_Foto} alt="" className="buscador-sugerencia-foto" />
                                    ) : (
                                        <div className="buscador-sugerencia-sinfoto" />
                                    )}
                                    <span>{producto.Nombre_Producto}</span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Buscador
