"use client";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebaseClient';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { esOfertaActiva, calcularPrecioConDescuento } from '@/lib/descuentos';

const CarritoContext = createContext(null);
const CLAVE_STORAGE = 'the-outfit-carrito';

export function CarritoProvider({ children }) {
  const [items, setItems] = useState([]);
  const [cargado, setCargado] = useState(false);

  // Carga el carrito guardado al montar en el navegador
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_STORAGE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage después del mount.
      if (guardado) setItems(JSON.parse(guardado));
    } catch {
      // localStorage puede fallar; el carrito arranca vacío.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargado(true);
  }, []);

  // Persiste cualquier cambio una vez cargado el estado inicial
  useEffect(() => {
    if (!cargado) return;
    try {
      window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(items));
    } catch {
      // ignorar fallos de escritura en localStorage
    }
  }, [items, cargado]);

  /**
   * Sincroniza precios, descuentos y stock disponible directamente desde Firestore.
   * Si un usuario altera el precio o el stock en localStorage desde DevTools,
   * esta función restaura inmediatamente los valores reales de la base de datos.
   */
  async function sincronizarPreciosConBD() {
    if (!cargado || items.length === 0) return;

    try {
      const idsVariantes = Array.from(
        new Set(
          items.flatMap((i) => [
            i.idVariante,
            String(i.idVariante),
            !isNaN(Number(i.idVariante)) ? Number(i.idVariante) : null,
          ]).filter((v) => v != null)
        )
      ).slice(0, 30);

      if (idsVariantes.length === 0) return;

      const [varSnap, prodSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'Variante_Producto'), where('ID_Variante', 'in', idsVariantes))),
        getDocs(collection(db, 'Productos')),
        getDocs(query(collection(db, 'Inventario'), where('ID_Variante', 'in', idsVariantes))),
      ]);

      const prodMap = {};
      prodSnap.docs.forEach((d) => {
        const p = d.data();
        const pid = p.ID_Producto ?? d.id;
        prodMap[pid] = p;
        prodMap[String(pid)] = p;
      });

      const varMap = {};
      varSnap.docs.forEach((d) => {
        const v = d.data();
        const vid = v.ID_Variante ?? d.id;
        varMap[vid] = v;
        varMap[String(vid)] = v;
      });

      const invMap = {};
      invSnap.docs.forEach((d) => {
        const inv = d.data();
        const vid = inv.ID_Variante;
        if (vid != null) {
          invMap[vid] = Number(inv.Cantidad_Disponible ?? 0);
          invMap[String(vid)] = Number(inv.Cantidad_Disponible ?? 0);
        }
      });

      setItems((prev) =>
        prev.map((item) => {
          const v = varMap[item.idVariante] || varMap[String(item.idVariante)];
          if (!v) return item;

          const p = prodMap[v.ID_Producto] || prodMap[String(v.ID_Producto)] || null;
          const precioOriginalReal = Number(v.Precio_Actual ?? p?.Precio_Base ?? p?.Precio ?? item.precioOriginal ?? item.precio ?? 0);

          let enOferta = false;
          let porcentajeDescuento = 0;
          if (esOfertaActiva(v)) {
            enOferta = true;
            porcentajeDescuento = Number(v.Porcentaje_Descuento ?? 0);
          } else if (p && esOfertaActiva(p)) {
            enOferta = true;
            porcentajeDescuento = Number(p.Porcentaje_Descuento ?? 0);
          }

          const precioReal = enOferta
            ? calcularPrecioConDescuento(precioOriginalReal, porcentajeDescuento)
            : precioOriginalReal;

          const stockReal =
            invMap[item.idVariante] ??
            invMap[String(item.idVariante)] ??
            item.stockDisponible ??
            Infinity;

          return {
            ...item,
            precioOriginal: precioOriginalReal,
            precio: precioReal,
            enOferta,
            porcentajeDescuento: enOferta ? porcentajeDescuento : 0,
            stockDisponible: stockReal,
            cantidad: Math.min(Math.max(1, Number(item.cantidad) || 1), Math.max(1, stockReal)),
          };
        })
      );
    } catch (err) {
      console.error('Error sincronizando precios del carrito con Firestore:', err);
    }
  }

  // Revalidar automáticamente contra Firestore al cargar el carrito y cuando la ventana recupera el foco
  useEffect(() => {
    if (!cargado || items.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sincronizarPreciosConBD();

    const alEnfocar = () => sincronizarPreciosConBD();
    window.addEventListener('focus', alEnfocar);
    window.addEventListener('storage', alEnfocar);
    return () => {
      window.removeEventListener('focus', alEnfocar);
      window.removeEventListener('storage', alEnfocar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, items.length]);

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
    () => items.reduce((suma, i) => suma + Number(i.precio ?? 0) * i.cantidad, 0),
    [items]
  );

  const subtotalOriginal = useMemo(
    () => items.reduce((suma, i) => suma + Number(i.precioOriginal ?? i.precio ?? 0) * i.cantidad, 0),
    [items]
  );

  const totalAhorro = useMemo(
    () => Math.max(0, Math.round((subtotalOriginal - subtotal) * 100) / 100),
    [subtotalOriginal, subtotal]
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
    sincronizarPreciosConBD,
    subtotal,
    subtotalOriginal,
    totalAhorro,
    totalItems,
  };

  return <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}
