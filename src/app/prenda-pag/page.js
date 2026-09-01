import './prenda-pag.css'
import Headerv2 from '@/components/Headerv2'
import Footer from '@/components/Footer'
import CarruselInfinito from '@/components/CarruselInfinito'
import PrendaIfo from '@/components/PrendaInfo'
import CarruselPrendas from '@/components/CarruselPrenda'

export default function Home() {
    return(
        <>
        <Headerv2 />
        <main>
            <CarruselInfinito />
            <PrendaIfo />
            <h2 className="recotittle">RECOMENDACIONES</h2>
            <div className='carru-prenda'>
                <CarruselPrendas />
            </div>
        </main>
        <Footer />
        
        </>
    )
}