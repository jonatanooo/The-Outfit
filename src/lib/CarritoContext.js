"use client";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CarritoContext = createContext(null);
const CLAVE_STORAGE = 'the-outfit-carrito';

export function CarritoProvider({ children }) {
  const [items, setItems] = useState([]);
  const [cargado, setCargado] = useState(false);

  // Carga el carrito guardado (si existe) al montar en el navegador. Tiene que
  // ser un efecto (no un useState perezoso) porque localStorage no existe en el
  // render de servidor: leerlo antes del mount rompería la hidratación.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_STORAGE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage, debe ocurrir después del mount.
      if (guardado) setItems(JSON.parse(guardado));
    } catch {
      // localStorage puede fallar (modo privado, etc.); el carrito simplemente arranca vacío.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- idem: marca que ya se intentó cargar.
    setCargado(true);
  }, []);

  // Persiste cualquier cambio, una vez que ya se cargó el estado inicial
  // (evita sobreescribir lo guardado con [] durante el primer render).
  useEffect(() => {
    if (!cargado) return;
    try {
      window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(items));
    } catch {
      // si falla el guardado no bloqueamos la app, solo no persiste entre recargas.
    }
  }, [items, cargado]);

  // item: { idVariante, idProducto, nombre, talla, precio, imagen, stockDisponible }
  function agregarAlCarrito(item, cantidad = 1) {
    setItems((prev) => {
      const existente = prev.find((i) => i.idVariante === item.idVariante);
      if (existente) {
        const tope = existente.stockDisponible ?? Infinity;
        const nuevaCantidad = Math.min(existente.cantidad + cantidad, tope);
        return prev.map((i) =>
          i.idVariante === item.idVariante ? { ...i, cantidad: nuevaCantidad } : i
        );
      }
      const tope = item.stockDisponible ?? Infinity;
      return [...prev, { ...item, cantidad: Math.min(cantidad, tope) }];
    });
  }

  function cambiarCantidad(idVariante, nuevaCantidad) {
    setItems((prev) => {
      if (nuevaCantidad <= 0) return prev.filter((i) => i.idVariante !== idVariante);
      return prev.map((i) => {
        if (i.idVariante !== idVariante) return i;
        const tope = i.stockDisponible ?? Infinity;
        return { ...i, cantidad: Math.min(nuevaCantidad, tope) };
      });
    });
  }

  function quitarDelCarrito(idVariante) {
    setItems((prev) => prev.filter((i) => i.idVariante !== idVariante));
  }

  function vaciarCarrito() {
    setItems([]);
  }

  const subtotal = useMemo(
    () => items.reduce((suma, i) => suma + i.precio * i.cantidad, 0),
    [items]
  );

  const totalItems = useMemo(
    () => items.reduce((suma, i) => suma + i.cantidad, 0),
    [items]
  );

  const value = {
    items,
    cargado,
    agregarAlCarrito,
    cambiarCantidad,
    quitarDelCarrito,
    vaciarCarrito,
    subtotal,
    totalItems,
  };

  return <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}
