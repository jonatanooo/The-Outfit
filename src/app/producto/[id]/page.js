import { supabase } from "@/lib/supabaseClient";
import './prenda-pag.css'
import Headerv2 from '@/components/Headerv2'
import Footer from '@/components/Footer'
import CarruselInfinito from '@/components/CarruselInfinito'
import PrendaIfo from '@/components/PrendaInfo'
import CarruselPrendas from '@/components/CarruselPrenda'

async function getProducto(idProducto) {
    const {data, error} = await supabase
    .from("Productos")
    .select(`
        ID_Producto,
        Nombre_Producto,
        Descripcion,
        Marca ( Nombre_Marca ),
        Variante_Producto (
        ID_Variante,
        Precio_Actual,
        Talla ( Tipos_Talla ( Nombre_TipoTalla ) )
        ),
        Fotos_Productos ( URL_Foto, Orden )
    `)
    .eq("ID_Producto", idProducto)
    .single();

    if(error) {
        console.error("Error producto:", JSON.stringify(error,null,2));
        return null;
    }

    // ordenamos las fotos del 1 al 6 segun la columna de orden
    const imagenes = [...(data.Fotos_Productos ?? [])]
    .sort((a,b) => a.Orden - b.Orden)
    .map((f) => f.URL_Foto);

    // Tallas unicas disponibles entre todas las variantes de este producto
    const tallas = [...new Set(
        (data.Variante_Producto ?? [])
        .map((v) => v.Talla?.Tipos_Talla?.Nombre_TipoTalla)
        .filter(Boolean)
    )];

    const precios = (data.Variante_Producto ?? []).map((v) => v.Precio_Actual);
    const precio = precios.length ? Math.min(...precios) : null;

    return {
    id: data.ID_Producto,
    nombre: data.Nombre_Producto,
    descripcion: data.Descripcion,
    marca: data.Marca?.Nombre_Marca ?? "",
    precio,
    imagenes,
    tallas,
    };
}

export default async function Home({params}) {
    const { id } = await params;   // 👈 corregido
    const producto = await getProducto(id);

    if(!producto) {
        return <p>Producto no encontrado</p>
    }

    return(
        <>
        <Headerv2/>
        <main>
            <CarruselInfinito producto={producto} />
            <PrendaIfo producto={producto} />
            <h2 className="recotittle">RECOMENDACIONES</h2>
            <div className='carru-prenda'>
                <CarruselPrendas />
            </div>
        </main>
        <Footer/>
        </>
    )    
}