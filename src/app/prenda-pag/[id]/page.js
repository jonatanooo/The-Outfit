"use client"
import { useParams } from 'next/navigation'
import './prenda-pag.css'
import Headerv2 from '@/components/Headerv2'
import Footer from '@/components/Footer'
import CarruselInfinito from '@/components/CarruselInfinito'
import PrendaIfo from '@/components/PrendaInfo'
import CarruselPrendas from '@/components/CarruselPrenda'
import { useProducto } from '@/lib/productos'

export default function PaginaPrenda() {
    const { id } = useParams()
    const idProducto = Number(id)
    const { producto } = useProducto(idProducto)

    return(
        <>
        <Headerv2 />
        <main>
            <CarruselInfinito idProducto={idProducto} />
            <PrendaIfo idProducto={idProducto} />
            <h2 className="recotittle">RECOMENDACIONES</h2>
            <div className='carru-prenda'>
                <CarruselPrendas idGenero={producto?.idGenero} />
            </div>
        </main>
        <Footer />

        </>
    )
}
