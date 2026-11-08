"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { esOfertaActiva, calcularPrecioConDescuento } from '@/lib/descuentos';
import { obtenerIdUsuario } from '@/lib/usuario';

const CarritoContext = createContext(null);
const CLAVE_STORAGE_LEGACY = 'the-outfit-carrito';
const PREFIJO_STORAGE_USUARIO = 'the-outfit-carrito-user:';

function limpiarStorageCarrito() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CLAVE_STORAGE_LEGACY);
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k === CLAVE_STORAGE_LEGACY || k.startsWith(PREFIJO_STORAGE_USUARIO))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignorar errores de acceso a localStorage
  }
}

function esDocPlantilla(docSnapOrData) {
  if (!docSnapOrData) return true;
  const id = docSnapOrData.id;
  const data = typeof docSnapOrData.data === 'function' ? docSnapOrData.data() : docSnapOrData;
  if (!data) return true;
  if (id === '_schema_init' || id === '_placeholder') return true;
  if (data._is_schema_template === true || data._info) return true;
  return false;
}

function esEntidadActiva(entidad) {
  if (!entidad || esDocPlantilla(entidad)) return false;
  const estado = entidad.ID_EstadoProducto != null ? Number(entidad.ID_EstadoProducto) : 1;
  if (estado !== 1) return false;
  if (entidad.Activo !== undefined && entidad.Activo !== null) {
    if (entidad.Activo === false || Number(entidad.Activo) === 0) return false;
  }
  return true;
}

export function CarritoProvider({ children }) {
  const { user: authUser, idUser: authIdUser, loading: authLoading } = useAuth();
  // Estado inicial estrictamente vacío [] (sin datos mock ni precargados)
  const [items, setItems] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [uidActual, setUidActual] = useState(null);

  const idUserRef = useRef(null);
  const idCarritoRef = useRef(null);
  const prevUidRef = useRef(undefined);

  /**
   * Busca el Carrito del usuario en Firestore por su ID_User numérico.
   * Si crearSiNoExiste = true y aún no tiene registro en Carrito, lo crea.
   */
  async function obtenerOCrearIdCarrito(idUserRaw, crearSiNoExiste = false) {
    if (!idUserRaw) return null;
    if (idCarritoRef.current) return idCarritoRef.current;

    const idUserNum = !isNaN(Number(idUserRaw)) ? Number(idUserRaw) : idUserRaw;
    const candidatos = Array.from(
      new Set([idUserRaw, String(idUserRaw), idUserNum].filter((v) => v != null && v !== ''))
    );

    const snap = await getDocs(
      query(collection(db, 'Carrito'), where('ID_User', 'in', candidatos))
    );

    const docsValidos = snap.docs.filter((d) => !esDocPlantilla(d) && Number(d.data().ID_Carrito) !== 0);
    if (docsValidos.length > 0) {
      const docExistente = docsValidos[0];
      const idCarrito = docExistente.data().ID_Carrito ?? docExistente.id;
      const idCarritoFinal = !isNaN(Number(idCarrito)) ? Number(idCarrito) : idCarrito;
      idCarritoRef.current = idCarritoFinal;
      return idCarritoFinal;
    }

    if (!crearSiNoExiste) return null;

    // Generar siguiente ID_Carrito numérico
    const todosSnap = await getDocs(collection(db, 'Carrito'));
    let maxId = 0;
    todosSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const num = Number(d.data().ID_Carrito ?? d.id);
      if (!isNaN(num) && num > maxId && num < 1000000000) {
        maxId = num;
      }
    });
    const nuevoIdCarrito = maxId + 1;

    await setDoc(doc(db, 'Carrito', String(nuevoIdCarrito)), {
      ID_Carrito: nuevoIdCarrito,
      ID_User: idUserNum,
      Fecha_Creacion: new Date().toISOString(),
    });

    idCarritoRef.current = nuevoIdCarrito;
    return nuevoIdCarrito;
  }

  /**
   * Sincroniza un ítem puntual en la colección Carrito_Detalle de Firebase.
   * - Si cantidad <= 0: elimina el registro de Carrito_Detalle.
   * - Si cantidad > 0: inserta o actualiza el registro en Carrito_Detalle.
   */
  async function sincronizarItemEnFirebase(idVarianteRaw, cantidad, fechaAgregado = null) {
    try {
      const idUser = idUserRef.current || (await obtenerIdUsuario());
      if (!idUser) return;
      idUserRef.current = idUser;

      const idVariante = !isNaN(Number(idVarianteRaw)) ? Number(idVarianteRaw) : idVarianteRaw;
      const cantNum = Math.floor(Number(cantidad ?? 0));

      const idCarrito = await obtenerOCrearIdCarrito(idUser, cantNum > 0);
      if (!idCarrito) return;

      const candidatosCarrito = Array.from(
        new Set([idCarrito, String(idCarrito), !isNaN(Number(idCarrito)) ? Number(idCarrito) : null].filter((v) => v != null))
      );

      const snapDet = await getDocs(
        query(collection(db, 'Carrito_Detalle'), where('ID_Carrito', 'in', candidatosCarrito))
      );

      const docsCoincidentes = snapDet.docs.filter((d) => {
        if (esDocPlantilla(d)) return false;
        const vid = d.data().ID_Variante;
        return String(vid) === String(idVariante) || Number(vid) === Number(idVariante);
      });

      if (cantNum <= 0) {
        await Promise.all(docsCoincidentes.map((d) => deleteDoc(d.ref)));
        return;
      }

      const ahoraIso = fechaAgregado || new Date().toISOString();
      if (docsCoincidentes.length > 0) {
        const docPrincipal = docsCoincidentes[0];
        await updateDoc(docPrincipal.ref, {
          ID_Carrito: !isNaN(Number(idCarrito)) ? Number(idCarrito) : idCarrito,
          ID_Variante: idVariante,
          Cantidad: cantNum,
          Fecha_agregado: docPrincipal.data().Fecha_agregado || ahoraIso,
        });
        // Eliminar duplicados si existieran
        if (docsCoincidentes.length > 1) {
          await Promise.all(docsCoincidentes.slice(1).map((d) => deleteDoc(d.ref)));
        }
      } else {
        const docIdDetalle = `${idCarrito}_${idVariante}`;
        const idDetalleNum = Number(`${idCarrito}${idVariante}`);
        await setDoc(doc(db, 'Carrito_Detalle', docIdDetalle), {
          ID_CarritoDetalle: !isNaN(idDetalleNum) ? idDetalleNum : docIdDetalle,
          ID_Carrito: !isNaN(Number(idCarrito)) ? Number(idCarrito) : idCarrito,
          ID_Variante: idVariante,
          Cantidad: cantNum,
          Fecha_agregado: ahoraIso,
        });
      }
    } catch (err) {
      console.error('Error sincronizando ítem con Carrito_Detalle en Firestore:', err);
    }
  }

  /**
   * Consulta el Carrito del usuario en Firebase por su ID_User, recupera todos sus ítems de Carrito_Detalle,
   * y aplica la validación estricta de stock (Cantidad_Disponible > 0) y estado activo (ID_EstadoProducto === 1).
   */
  async function cargarYValidarCarritoDesdeFirebase(idUser) {
    if (!idUser) return [];

    const idCarrito = await obtenerOCrearIdCarrito(idUser, false);
    if (!idCarrito) return [];

    const candidatosCarrito = Array.from(
      new Set([idCarrito, String(idCarrito), !isNaN(Number(idCarrito)) ? Number(idCarrito) : null].filter((v) => v != null))
    );

    const snapDetalle = await getDocs(
      query(collection(db, 'Carrito_Detalle'), where('ID_Carrito', 'in', candidatosCarrito))
    );

    const docsDetalle = snapDetalle.docs.filter((d) => !esDocPlantilla(d));
    if (docsDetalle.length === 0) return [];

    const [varSnap, prodSnap, invSnap, marcasSnap, fotosSnap, tallaSnap, tiposTallaSnap] = await Promise.all([
      getDocs(collection(db, 'Variante_Producto')),
      getDocs(collection(db, 'Productos')),
      getDocs(collection(db, 'Inventario')),
      getDocs(collection(db, 'Marca')),
      getDocs(collection(db, 'Fotos_Productos')),
      getDocs(collection(db, 'Talla')),
      getDocs(collection(db, 'Tipos_Talla')),
    ]);

    const varMap = {};
    varSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const v = { ...d.data(), ID_Variante: d.data().ID_Variante ?? d.id };
      varMap[v.ID_Variante] = v;
      varMap[String(v.ID_Variante)] = v;
    });

    const prodMap = {};
    prodSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const p = { ...d.data(), ID_Producto: d.data().ID_Producto ?? d.id };
      prodMap[p.ID_Producto] = p;
      prodMap[String(p.ID_Producto)] = p;
    });

    const invMap = {};
    invSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const inv = d.data();
      const vid = inv.ID_Variante;
      if (vid != null) {
        const disp = Number(inv.Cantidad_Disponible ?? 0);
        if (!isNaN(disp)) {
          invMap[vid] = (invMap[vid] || 0) + disp;
          invMap[String(vid)] = invMap[vid];
        }
      }
    });

    const marcasMap = {};
    marcasSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const m = d.data();
      const id = m.ID_Marca ?? d.id;
      marcasMap[id] = m;
      marcasMap[String(id)] = m;
    });

    const fotosPorProducto = {};
    fotosSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const f = d.data();
      const pid = f.ID_Producto;
      if (pid != null) {
        if (!fotosPorProducto[pid]) fotosPorProducto[pid] = [];
        fotosPorProducto[pid].push(f);
        if (!fotosPorProducto[String(pid)]) fotosPorProducto[String(pid)] = fotosPorProducto[pid];
      }
    });

    const tiposTallaMap = {};
    tiposTallaSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const tt = d.data();
      const id = tt.ID_TipoTalla ?? d.id;
      tiposTallaMap[id] = tt;
      tiposTallaMap[String(id)] = tt;
    });

    const tallaMap = {};
    tallaSnap.docs.forEach((d) => {
      if (esDocPlantilla(d)) return;
      const t = d.data();
      const id = t.ID_Talla ?? d.id;
      tallaMap[id] = t;
      tallaMap[String(id)] = t;
    });

    const itemsHidratados = [];
    const promesasLimpieza = [];

    for (const detDoc of docsDetalle) {
      const det = detDoc.data();
      const vid = det.ID_Variante;
      const cantGuardada = Math.floor(Number(det.Cantidad ?? 0));

      const v = varMap[vid] || varMap[String(vid)] || null;
      const p = v ? (prodMap[v.ID_Producto] || prodMap[String(v.ID_Producto)] || null) : null;

      // Condición 2: Producto Base o Variante oculto/inactivo o eliminado -> eliminar de Carrito_Detalle
      if (!esEntidadActiva(v) || !esEntidadActiva(p)) {
        promesasLimpieza.push(deleteDoc(detDoc.ref).catch(() => {}));
        continue;
      }

      // Condición 1: Verificar stock real disponible en Inventario
      const stockDisponible = Number(invMap[vid] ?? invMap[String(vid)] ?? 0);
      if (stockDisponible <= 0 || cantGuardada <= 0) {
        // Sin stock (Cantidad_Disponible <= 0) -> eliminar de Carrito_Detalle
        promesasLimpieza.push(deleteDoc(detDoc.ref).catch(() => {}));
        continue;
      }

      // Si tenía Cantidad mayor al stock actual disponible, ajustar a stockDisponible
      let cantidadFinal = cantGuardada;
      if (cantGuardada > stockDisponible) {
        cantidadFinal = stockDisponible;
        promesasLimpieza.push(
          updateDoc(detDoc.ref, { Cantidad: cantidadFinal }).catch(() => {})
        );
      }

      // Resolver nombre de talla
      const tallaDoc = tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || {};
      const idTipoTalla = tallaDoc.ID_TipoTalla ?? v.ID_TipoTalla;
      const tipoTallaDoc = tiposTallaMap[idTipoTalla] || tiposTallaMap[String(idTipoTalla)] || {};
      const nombreTalla = (tipoTallaDoc.Nombre_TipoTalla || tallaDoc.Nombre_Talla || '').trim();

      // Resolver imagen principal
      const fotos = [...(fotosPorProducto[p.ID_Producto] || fotosPorProducto[String(p.ID_Producto)] || [])].sort((a, b) => {
        if (a.Es_Principal && !b.Es_Principal) return -1;
        if (!a.Es_Principal && b.Es_Principal) return 1;
        return Number(a.Orden ?? 999) - Number(b.Orden ?? 999);
      });
      const imagen =
        p.Imagen_Principal ||
        fotos.find((f) => f.Es_Principal)?.URL_Foto ||
        fotos[0]?.URL_Foto ||
        null;

      // Resolver precios y oferta activa
      const precioOriginal = Number(v.Precio_Actual ?? p.Precio_Base ?? p.Precio ?? 0);
      let enOferta = false;
      let porcentajeDescuento = 0;
      if (esOfertaActiva(v)) {
        enOferta = true;
        porcentajeDescuento = Number(v.Porcentaje_Descuento ?? 0);
      } else if (esOfertaActiva(p)) {
        enOferta = true;
        porcentajeDescuento = Number(p.Porcentaje_Descuento ?? 0);
      }
      const precio = enOferta ? calcularPrecioConDescuento(precioOriginal, porcentajeDescuento) : precioOriginal;

      const marcaObj = marcasMap[p.ID_Marca] || marcasMap[String(p.ID_Marca)] || null;

      itemsHidratados.push({
        idProducto: p.ID_Producto,
        idVariante: v.ID_Variante,
        nombre: p.Nombre_Producto || '',
        marca: (marcaObj?.Nombre_Marca && String(marcaObj.Nombre_Marca).trim()) ? String(marcaObj.Nombre_Marca).trim() : 'The Outfit',
        talla: nombreTalla,
        precio,
        precioOriginal,
        enOferta,
        porcentajeDescuento: enOferta ? porcentajeDescuento : 0,
        imagen,
        stockDisponible,
        cantidad: cantidadFinal,
        fechaAgregado: det.Fecha_agregado || new Date().toISOString(),
      });
    }

    if (promesasLimpieza.length > 0) {
      await Promise.all(promesasLimpieza);
    }

    return itemsHidratados;
  }

  // Escuchar el estado de autenticación para cargar el carrito del usuario al iniciar sesión
  // y limpiar únicamente el estado local al cerrar sesión (conservando Carrito y Carrito_Detalle en Firebase)
  useEffect(() => {
    try {
      window.localStorage.removeItem(CLAVE_STORAGE_LEGACY);
    } catch {
      // ignorar
    }

    // Prohibido limpiar datos o asumir usuario sin sesión mientras authLoading sea true
    if (authLoading) return;

    let activo = true;

    async function sincronizarSegunSesion() {
      // Caso 1: Sin sesión iniciada (!authUser) o cierre de sesión (logout)
      if (!authUser) {
        const idUserCookie = await obtenerIdUsuario();
        if (!activo) return;

        if (idUserCookie) {
          idUserRef.current = idUserCookie;
          const itemsDesdeBD = await cargarYValidarCarritoDesdeFirebase(idUserCookie);
          if (!activo) return;
          setItems(itemsDesdeBD);
          setCargado(true);
          return;
        }

        limpiarStorageCarrito();
        prevUidRef.current = null;
        idUserRef.current = null;
        idCarritoRef.current = null;
        setUidActual(null);
        setItems([]);
        setCargado(true);
        return;
      }

      // Caso 2: Usuario con sesión activa -> consultar su Carrito y Carrito_Detalle en Firebase por su ID_User
      const uid = authUser.uid;
      prevUidRef.current = uid;
      setUidActual(uid);
      idCarritoRef.current = null;

      try {
        const idUser = authIdUser || (await obtenerIdUsuario());
        if (!activo) return;

        if (!idUser) {
          setItems([]);
          setCargado(true);
          return;
        }

        idUserRef.current = idUser;
        const itemsDesdeBD = await cargarYValidarCarritoDesdeFirebase(idUser);
        if (!activo) return;

        setItems(itemsDesdeBD);
      } catch (err) {
        console.error('Error cargando carrito del usuario desde Firebase:', err);
        if (activo) setItems([]);
      } finally {
        if (activo) setCargado(true);
      }
    }

    sincronizarSegunSesion();

    return () => {
      activo = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authIdUser, authLoading]);

  // Persiste copia rápida en localStorage únicamente bajo la clave del usuario autenticado
  useEffect(() => {
    if (!cargado) return;
    try {
      window.localStorage.removeItem(CLAVE_STORAGE_LEGACY);
      if (uidActual) {
        window.localStorage.setItem(`${PREFIJO_STORAGE_USUARIO}${uidActual}`, JSON.stringify(items));
      }
    } catch {
      // ignorar fallos de escritura en localStorage
    }
  }, [items, cargado, uidActual]);

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
        if (esDocPlantilla(d)) return;
        const inv = d.data();
        const vid = inv.ID_Variante;
        if (vid != null) {
          const disp = Number(inv.Cantidad_Disponible ?? 0);
          if (!isNaN(disp)) {
            invMap[vid] = (invMap[vid] || 0) + disp;
            invMap[String(vid)] = invMap[vid];
          }
        }
      });

      const sincronizacionesFirebase = [];

      setItems((prev) =>
        prev
          .map((item) => {
            const v = varMap[item.idVariante] || varMap[String(item.idVariante)];
            const p = v ? (prodMap[v.ID_Producto] || prodMap[String(v.ID_Producto)] || null) : null;

            // Limpieza automática si el producto o la variante están ocultos/inactivos o eliminados
            if (!esEntidadActiva(v) || !esEntidadActiva(p)) {
              sincronizacionesFirebase.push({ idVariante: item.idVariante, cantidad: 0 });
              return null;
            }

            const stockReal = Number(
              invMap[item.idVariante] ??
              invMap[String(item.idVariante)] ??
              0
            );

            // Limpieza automática si el stock disponible es <= 0
            if (stockReal <= 0) {
              sincronizacionesFirebase.push({ idVariante: item.idVariante, cantidad: 0 });
              return null;
            }

            const cantidadAnterior = Math.max(1, Number(item.cantidad) || 1);
            const cantidadAjustada = Math.min(cantidadAnterior, stockReal);

            // Si el stock disminuyó por debajo de la cantidad en el carrito, ajustar también en Carrito_Detalle
            if (cantidadAjustada !== Number(item.cantidad)) {
              sincronizacionesFirebase.push({
                idVariante: item.idVariante,
                cantidad: cantidadAjustada,
                fechaAgregado: item.fechaAgregado,
              });
            }

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

            return {
              ...item,
              precioOriginal: precioOriginalReal,
              precio: precioReal,
              enOferta,
              porcentajeDescuento: enOferta ? porcentajeDescuento : 0,
              stockDisponible: stockReal,
              cantidad: cantidadAjustada,
            };
          })
          .filter(Boolean)
      );

      if (sincronizacionesFirebase.length > 0) {
        await Promise.all(
          sincronizacionesFirebase.map((s) =>
            sincronizarItemEnFirebase(s.idVariante, s.cantidad, s.fechaAgregado)
          )
        );
      }
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
    const fechaAgregado = item.fechaAgregado || new Date().toISOString();
    let cantidadParaBD = 0;

    setItems((prev) => {
      const existente = prev.find((i) => String(i.idVariante) === String(item.idVariante));
      if (existente) {
        const tope = existente.stockDisponible ?? item.stockDisponible ?? Infinity;
        const nuevaCantidad = Math.min(existente.cantidad + cantidad, tope);
        cantidadParaBD = nuevaCantidad;
        return prev.map((i) =>
          String(i.idVariante) === String(item.idVariante) ? { ...i, cantidad: nuevaCantidad } : i
        );
      }
      const tope = item.stockDisponible ?? Infinity;
      const nuevaCantidad = Math.min(cantidad, tope);
      cantidadParaBD = nuevaCantidad;
      return [...prev, { ...item, cantidad: nuevaCantidad, fechaAgregado }];
    });

    if (cantidadParaBD > 0) {
      sincronizarItemEnFirebase(item.idVariante, cantidadParaBD, fechaAgregado);
    }
  }

  function cambiarCantidad(idVariante, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
      setItems((prev) => prev.filter((i) => String(i.idVariante) !== String(idVariante)));
      sincronizarItemEnFirebase(idVariante, 0);
      return;
    }

    let cantidadFinalBD = nuevaCantidad;
    let fechaItem = null;

    setItems((prev) =>
      prev.map((i) => {
        if (String(i.idVariante) !== String(idVariante)) return i;
        const tope = i.stockDisponible ?? Infinity;
        const ajustada = Math.min(nuevaCantidad, tope);
        cantidadFinalBD = ajustada;
        fechaItem = i.fechaAgregado || null;
        return { ...i, cantidad: ajustada };
      })
    );

    sincronizarItemEnFirebase(idVariante, cantidadFinalBD, fechaItem);
  }

  function quitarDelCarrito(idVariante) {
    setItems((prev) => prev.filter((i) => String(i.idVariante) !== String(idVariante)));
    sincronizarItemEnFirebase(idVariante, 0);
  }

  /**
   * Limpia EXCLUSIVAMENTE el estado local del carrito (memoria y localStorage).
   * Se usa al cerrar sesión (logout) para NO borrar los registros de Carrito ni Carrito_Detalle en Firebase.
   */
  function limpiarCarritoLocal() {
    setItems([]);
    limpiarStorageCarrito();
  }

  /**
   * Vacía el carrito por completo (memoria, localStorage y Carrito_Detalle en Firebase).
   * Si se pasa { soloLocal: true }, únicamente limpia el estado local sin borrar nada en Firebase.
   */
  async function vaciarCarrito(opciones = {}) {
    const soloLocal = opciones?.soloLocal === true;
    setItems([]);
    limpiarStorageCarrito();

    if (soloLocal) return;

    try {
      const idUser = idUserRef.current || (await obtenerIdUsuario());
      if (!idUser) return;
      const idCarrito = await obtenerOCrearIdCarrito(idUser, false);
      if (!idCarrito) return;

      const candidatosCarrito = Array.from(
        new Set([idCarrito, String(idCarrito), !isNaN(Number(idCarrito)) ? Number(idCarrito) : null].filter((v) => v != null))
      );

      const snapDet = await getDocs(
        query(collection(db, 'Carrito_Detalle'), where('ID_Carrito', 'in', candidatosCarrito))
      );
      const docsABorrar = snapDet.docs.filter((d) => !esDocPlantilla(d));
      if (docsABorrar.length > 0) {
        await Promise.all(docsABorrar.map((d) => deleteDoc(d.ref)));
      }
    } catch (err) {
      console.error('Error vaciando Carrito_Detalle en Firebase:', err);
    }
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
    limpiarCarritoLocal,
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
