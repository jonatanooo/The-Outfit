"use client";
import { useCallback, useEffect, useState } from 'react';
import { db } from './firebaseClient';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { obtenerIdUsuario } from './usuario';

// Maneja el estado de "favoritos" del usuario logueado contra la colección
// "Favoritos" de Firestore: qué IDs de producto tiene marcados, y agregar/quitar.
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

      try {
        const numId = Number(idUser);
        const qFav = query(
          collection(db, 'Favoritos'),
          where('ID_User', 'in', [idUser, !isNaN(numId) ? numId : idUser, String(idUser)])
        );
        const favSnap = await getDocs(qFav);

        if (!activo) return;
        const setIds = new Set();
        favSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.ID_Producto != null) {
            setIds.add(data.ID_Producto);
            if (!isNaN(Number(data.ID_Producto))) {
              setIds.add(Number(data.ID_Producto));
            }
          }
        });

        setFavoritos(setIds);
      } catch (err) {
        console.error('Error cargando favoritos desde Firestore:', err);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => { activo = false; };
  }, []);

  const esFavorito = useCallback((idProducto) => {
    return favoritos.has(idProducto) || favoritos.has(Number(idProducto)) || favoritos.has(String(idProducto));
  }, [favoritos]);

  const alternarFavorito = useCallback(async (idProducto) => {
    const idUser = idUsuario ?? await obtenerIdUsuario();
    if (!idUser) {
      alert('Iniciá sesión para guardar tus favoritos.');
      return;
    }
    if (idUsuario !== idUser) setIdUsuario(idUser);

    const yaEsFavorito = esFavorito(idProducto);

    // Actualización optimista: el corazón cambia al instante
    setFavoritos((prev) => {
      const copia = new Set(prev);
      if (yaEsFavorito) {
        copia.delete(idProducto);
        copia.delete(Number(idProducto));
        copia.delete(String(idProducto));
      } else {
        copia.add(idProducto);
      }
      return copia;
    });

    try {
      const numIdUser = Number(idUser);
      const numIdProd = Number(idProducto);

      if (yaEsFavorito) {
        const qFav = query(
          collection(db, 'Favoritos'),
          where('ID_User', 'in', [idUser, !isNaN(numIdUser) ? numIdUser : idUser, String(idUser)]),
          where('ID_Producto', 'in', [idProducto, !isNaN(numIdProd) ? numIdProd : idProducto, String(idProducto)])
        );
        const snap = await getDocs(qFav);
        await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'Favoritos', d.id))));
      } else {
        await addDoc(collection(db, 'Favoritos'), {
          ID_User: !isNaN(numIdUser) ? numIdUser : idUser,
          ID_Producto: !isNaN(numIdProd) ? numIdProd : idProducto,
          Fecha_Agregado: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error actualizando favorito en Firestore:', error);
      // Revertir el cambio optimista si falló
      setFavoritos((prev) => {
        const copia = new Set(prev);
        if (yaEsFavorito) copia.add(idProducto);
        else {
          copia.delete(idProducto);
          copia.delete(Number(idProducto));
          copia.delete(String(idProducto));
        }
        return copia;
      });
    }
  }, [favoritos, idUsuario, esFavorito]);

  return { favoritos, esFavorito, alternarFavorito, idUsuario, cargando };
}
