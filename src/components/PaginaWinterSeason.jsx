"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import FiltroMenu from "./FiltroMenu";
import ListadoPrendas from "./ListadoPrendas";

function PaginaWinterSeasonContenido({ idCategoriaPadre }) {
  const [subcategorias, setSubcategorias] = useState([]);
  const [filtrosActivos, setFiltrosActivos] = useState({});
  const [cantidadResultados, setCantidadResultados] = useState(0);

  useEffect(() => {
    let activo = true;
    async function cargarSubcategorias() {
      try {
        const snap = await getDocs(collection(db, "Categorias_Producto"));
        if (!activo) return;
        const subs = snap.docs
          .map((d) => d.data())
          .filter((c) => String(c.ID_CategoriaPadre) === String(idCategoriaPadre))
          .map((c) => c.Nombre_Categoria)
          .filter(Boolean)
          .filter((nombre) => String(nombre).trim().toUpperCase() !== "WINTER SEASON");
        setSubcategorias(subs);
      } catch (error) {
        console.error("Error al cargar subcategorias en PaginaWinterSeason:", error);
      }
    }
    cargarSubcategorias();
    return () => { activo = false; };
  }, [idCategoriaPadre]);

  const filtrosCombinados = {
    ...filtrosActivos,
    Categorias: filtrosActivos.Categorias?.length > 0 ? filtrosActivos.Categorias : null,
  };

  return (
    <>
      <FiltroMenu
        onAplicarFiltros={setFiltrosActivos}
        categoriasDisponibles={subcategorias}
        filtrosActivos={filtrosActivos}
        cantidadResultados={cantidadResultados}
      />
      <div className="prenda-wrap-listado">
        <ListadoPrendas
          filtros={filtrosCombinados}
          onResultados={setCantidadResultados}
          idCategoriaPadre={idCategoriaPadre}
          soloWinterSeason={true}
        />
      </div>
    </>
  );
}

export default function PaginaWinterSeason({ idCategoriaPadre }) {
  return (
    <Suspense fallback={<div>Cargando colección Winter Season...</div>}>
      <PaginaWinterSeasonContenido idCategoriaPadre={idCategoriaPadre} />
    </Suspense>
  );
}

