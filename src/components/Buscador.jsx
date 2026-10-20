"use client"
import './Buscador.css'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebaseClient';
import { collection, getDocs } from 'firebase/firestore';

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

    // busca coincidencias en Firestore mientras el usuario escribe (con debounce)
    useEffect(() => {
        const termino = texto.trim()
        const timeoutId = setTimeout(async () => {
            if (termino.length < 2) {
                setSugerencias([])
                setBuscando(false)
                return
            }

            setBuscando(true)
            try {
                const [prodSnap, fotosSnap] = await Promise.all([
                    getDocs(collection(db, 'Productos')),
                    getDocs(collection(db, 'Fotos_Productos'))
                ])

                const queryL = termino.toLowerCase()
                const filtrados = prodSnap.docs
                    .map((d) => {
                        const data = d.data()
                        return {
                            ...data,
                            ID_Producto: data.ID_Producto ?? d.id
                        }
                    })
                    .filter((p) => (Number(p.ID_EstadoProducto) ?? 1) !== 2 && (p.Nombre_Producto || '').toLowerCase().includes(queryL))
                    .slice(0, 8)

                if (filtrados.length === 0) {
                    setSugerencias([])
                    setBuscando(false)
                    return
                }

                const fotosPorProd = {}
                fotosSnap.docs.forEach((d) => {
                    const f = d.data()
                    const pid = f.ID_Producto
                    if (pid != null) {
                        if (!fotosPorProd[pid]) fotosPorProd[pid] = []
                        fotosPorProd[pid].push(f)
                        if (!fotosPorProd[String(pid)]) fotosPorProd[String(pid)] = fotosPorProd[pid]
                    }
                })

                const resultados = filtrados.map((p) => ({
                    ...p,
                    Fotos_Productos: (fotosPorProd[p.ID_Producto] || fotosPorProd[String(p.ID_Producto)] || []).sort(
                        (a, b) => (Number(a.Orden) ?? 0) - (Number(b.Orden) ?? 0)
                    )
                }))

                setSugerencias(resultados)
            } catch (err) {
                console.error('Error buscando prendas en Firestore:', err)
                setSugerencias([])
            } finally {
                setBuscando(false)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [texto])

    const irALaPrenda = (idProducto) => {
        onClose()
        router.push(`/prenda-pag/${idProducto}`)
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
                                    onClick={() => irALaPrenda(producto.ID_Producto)}
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
