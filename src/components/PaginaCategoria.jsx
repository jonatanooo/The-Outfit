"use client"
import { useState, useEffect, Suspense } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import FiltroMenu from "./FiltroMenu";
import ListadoPrendas from "./ListadoPrendas";

function PaginaCategoriaContenido({ idCategoriaPadre, categoriaFija = null }) {
  const searchParams = useSearchParams();
  const categoriaQuery = categoriaFija || searchParams.get('categoria') || searchParams.get('subcategoria') || searchParams.get('temporada');

  const [subcategorias, setSubcategorias] = useState([]);
  const [prevQuery, setPrevQuery] = useState(categoriaQuery);
  const [filtrosManuales, setFiltrosManuales] = useState(null);
  const [cantidadResultados, setCantidadResultados] = useState(0);

  // Sincronizar automáticamente cuando cambia el parámetro de categoría en la URL
  if (categoriaQuery !== prevQuery) {
    setPrevQuery(categoriaQuery);
    setFiltrosManuales(null);
  }

  const filtrosActivos = filtrosManuales ?? (categoriaQuery ? { Categorias: [categoriaQuery] } : {});

  useEffect(() => {
    async function cargarSubcategorias() {
      try {
        const snap = await getDocs(collection(db, "Categorias_Producto"));
        const subs = snap.docs
          .map((d) => d.data())
          .filter((c) => String(c.ID_CategoriaPadre) === String(idCategoriaPadre))
          .map((c) => c.Nombre_Categoria)
          .filter(Boolean);

        const tieneWinter = subs.some(
          (s) => String(s).trim().toUpperCase() === "WINTER SEASON"
        );
        const listaOpciones = tieneWinter ? subs : ["WINTER SEASON", ...subs];
        setSubcategorias(listaOpciones);
      } catch (error) {
        console.error("Error al cargar subcategorias desde Firestore:", error);
      }
    }
    cargarSubcategorias();
  }, [idCategoriaPadre]);

  const filtrosCombinados = {
    ...filtrosActivos,
    Categorias: filtrosActivos.Categorias?.length > 0 ? filtrosActivos.Categorias : null,
  };

  return (
    <>
      <FiltroMenu
        onAplicarFiltros={setFiltrosManuales}
        categoriasDisponibles={subcategorias}
        filtrosActivos={filtrosActivos}
        cantidadResultados={cantidadResultados}
      />
      <div className="prenda-wrap-listado">
        <ListadoPrendas filtros={filtrosCombinados} onResultados={setCantidadResultados} idCategoriaPadre={idCategoriaPadre} />
      </div>
    </>
  );
}

export default function PaginaCategoria({ idCategoriaPadre, categoriaFija = null }) {
  return (
    <Suspense fallback={<div>Cargando catálogo...</div>}>
      <PaginaCategoriaContenido idCategoriaPadre={idCategoriaPadre} categoriaFija={categoriaFija} />
    </Suspense>
  );
}