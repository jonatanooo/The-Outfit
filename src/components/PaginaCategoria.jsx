"use client"
import { useState, useEffect, Suspense } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
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
      try {
        const snap = await getDocs(collection(db, "Categorias_Producto"));
        const subs = snap.docs
          .map((d) => d.data())
          .filter((c) => String(c.ID_CategoriaPadre) === String(idCategoriaPadre))
          .map((c) => c.Nombre_Categoria)
          .filter(Boolean);
        setSubcategorias(subs);
      } catch (error) {
        console.error("Error al cargar subcategorias desde Firestore:", error);
      }
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
        <ListadoPrendas filtros={filtrosCombinados} onResultados={setCantidadResultados} idCategoriaPadre={idCategoriaPadre} />
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