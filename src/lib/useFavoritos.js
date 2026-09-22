"use client";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Traduce el usuario logueado (auth.users) al ID_User de la tabla "User" propia,
// que es la que usan las FK del resto del esquema (Fotos_Productos, Favoritos, etc.).
async function obtenerIdUsuario() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('User')
    .select('ID_User')
    .eq('auth_id', user.id)
    .maybeSingle();

  return data?.ID_User ?? null;
}

// Maneja el estado de "favoritos" del usuario logueado contra la tabla
// "Favoritos" de Supabase: qué IDs de producto tiene marcados, y agregar/quitar.
export function useFavoritos() {
  const [favoritos, setFavoritos] = useState(new Set());
  const [idUsuario, setIdUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      const idUser = await obtenerIdUsuario();
      if (!activo) return;
      setIdUsuario(idUser);

      if (!idUser) {
        setFavoritos(new Set());
        setCargando(false);
        return;
      }

      const { data, error } = await supabase
        .from('Favoritos')
        .select('ID_Producto')
        .eq('ID_User', idUser);

      if (!activo) return;
      if (!error) setFavoritos(new Set((data ?? []).map((f) => f.ID_Producto)));
      setCargando(false);
    }

    cargar();
    return () => { activo = false; };
  }, []);

  const esFavorito = useCallback((idProducto) => favoritos.has(idProducto), [favoritos]);

  const alternarFavorito = useCallback(async (idProducto) => {
    const idUser = idUsuario ?? await obtenerIdUsuario();
    if (!idUser) {
      alert('Iniciá sesión para guardar tus favoritos.');
      return;
    }
    if (idUsuario !== idUser) setIdUsuario(idUser);

    const yaEsFavorito = favoritos.has(idProducto);

    // Actualización optimista: el corazón cambia al toque, sin esperar la respuesta del servidor.
    setFavoritos((prev) => {
      const copia = new Set(prev);
      if (yaEsFavorito) copia.delete(idProducto);
      else copia.add(idProducto);
      return copia;
    });

    const { error } = yaEsFavorito
      ? await supabase.from('Favoritos').delete().eq('ID_User', idUser).eq('ID_Producto', idProducto)
      : await supabase.from('Favoritos').insert({ ID_User: idUser, ID_Producto: idProducto });

    if (error) {
      console.error('Error actualizando favorito:', error.message);
      // Revertir el cambio optimista si falló en el servidor.
      setFavoritos((prev) => {
        const copia = new Set(prev);
        if (yaEsFavorito) copia.add(idProducto);
        else copia.delete(idProducto);
        return copia;
      });
    }
  }, [favoritos, idUsuario]);

  return { favoritos, esFavorito, alternarFavorito, idUsuario, cargando };
}
