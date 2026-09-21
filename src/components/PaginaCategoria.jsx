"use client"
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import FiltroMenu from "./FiltroMenu";
import ListadoPrendas from "./ListadoPrendas";

export default function PaginaCategoria({ idCategoriaPadre }) {
  const [subcategorias, setSubcategorias] = useState([]);
  const [filtrosMenu, setFiltrosMenu] = useState({});
  const [cantidadResultados, setCantidadResultados] = useState(0);

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