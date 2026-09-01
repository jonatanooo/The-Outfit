import './prenda-pag.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CarruselInfinito from '@/components/CarruselInfinito'
import PrendaIfo from '@/components/PrendaInfo'
import CarruselPrendas from '@/components/CarruselPrenda'

export default function Home() {
    return(
        <>
        <Header />
        <main>
            <CarruselInfinito />
            <PrendaIfo />
            <CarruselPrendas />
        </main>
        <Footer />
        
        </>
    )
}