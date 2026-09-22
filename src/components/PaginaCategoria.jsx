"use client"
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";
import FiltroMenu from "./FiltroMenu";
import ListadoPrendas from "./ListadoPrendas";

function PaginaCategoriaContenido({ idCategoriaPadre }) {
  const searchParams = useSearchParams();
  const categoriaQuery = searchParams.get('categoria');

  const [subcategorias, setSubcategorias] = useState([]);
  const [filtrosMenu, setFiltrosMenu] = useState({});
  const [cantidadResultados, setCantidadResultados] = useState(0);

  // Sincronizar siempre cuando cambia el parametro en la URL
  useEffect(() => {
    setFiltrosMenu((prev) => {
      if (categoriaQuery) {
        // Reemplaza la categoría actual con la que viene en la URL
        return { ...prev, Categorias: [categoriaQuery] };
      } else {
        // Si no hay categoría en la URL, limpiamos el filtro
        const { Categorias, ...resto } = prev;
        return resto;
      }
    });
  }, [categoriaQuery]);

  useEffect(() => {
    async function cargarSubcategorias() {
      const { data, error } = await supabase
        .from("Categorias_Producto")
        .select("Nombre_Categoria")
        .eq("ID_CategoriaPadre", idCategoriaPadre);

      if (error) {
        console.error("Error subcategorias:", JSON.stringify(error, null, 2));
        return;
      }
      setSubcategorias(data.map((c) => c.Nombre_Categoria));
    }
    cargarSubcategorias();
  }, [idCategoriaPadre]);

  const filtrosCombinados = {
    ...filtrosMenu,
    Categorias: filtrosMenu.Categorias?.length > 0 ? filtrosMenu.Categorias : subcategorias,
    idCategoriaPadre: idCategoriaPadre
  };

  return (
    <>
      <FiltroMenu
        onAplicarFiltros={setFiltrosMenu}
        categoriasDisponibles={subcategorias}
        filtrosActivos={filtrosMenu}
        cantidadResultados={cantidadResultados}
      />
      <div className="prenda-wrap-listado">
        <ListadoPrendas filtros={filtrosCombinados} onResultados={setCantidadResultados} />
      </div>
    </>
  );
}

export default function PaginaCategoria({ idCategoriaPadre }) {
  return (
    <Suspense fallback={<div>Cargando catálogo...</div>}>
      <PaginaCategoriaContenido idCategoriaPadre={idCategoriaPadre} />
    </Suspense>
  );
}