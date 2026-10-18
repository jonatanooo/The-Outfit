"use client";

import { useState, useEffect } from 'react';
import SidebarAdmin from '@/components/SidebarAdmin.jsx';
import { db, auth, storage } from '@/lib/firebaseClient';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { obtenerIdUsuario } from '@/lib/usuario';
import { esOfertaActiva, calcularPrecioConDescuento } from '@/lib/descuentos';
import { subirImagenStorage } from '@/lib/storage';
import './AdminInventario.css';

// Helpers para indexar y buscar documentos en Firestore por ID flexible (número, string o doc.id)
function indexarColeccion(snap, campoId) {
    const map = {};
    snap.docs.forEach((d) => {
        const data = d.data();
        const rawId = data[campoId] ?? d.id;
        const item = { ...data, [campoId]: rawId, _docId: d.id };
        map[rawId] = item;
        map[String(rawId)] = item;
        if (!isNaN(Number(rawId))) map[Number(rawId)] = item;
        map[d.id] = item;
    });
    return map;
}

async function actualizarDocPorId(nombreColeccion, campoId, idValor, camposActualizar) {
    if (idValor == null) return;
    try {
        const refDirecta = doc(db, nombreColeccion, String(idValor));
        const snapDirecto = await getDoc(refDirecta);
        if (snapDirecto.exists()) {
            await updateDoc(refDirecta, camposActualizar);
            return;
        }

        const opcionesId = [idValor, String(idValor)];
        if (!isNaN(Number(idValor))) opcionesId.push(Number(idValor));
        const q = query(collection(db, nombreColeccion), where(campoId, 'in', Array.from(new Set(opcionesId))));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await updateDoc(snap.docs[0].ref, camposActualizar);
        }
    } catch (err) {
        console.error(`Error actualizando ${nombreColeccion} (${campoId}=${idValor}):`, err);
    }
}

async function eliminarDocPorId(nombreColeccion, campoId, idValor) {
    if (idValor == null) return;
    try {
        const refDirecta = doc(db, nombreColeccion, String(idValor));
        const snapDirecto = await getDoc(refDirecta);
        if (snapDirecto.exists()) {
            await deleteDoc(refDirecta);
            return;
        }

        const opcionesId = [idValor, String(idValor)];
        if (!isNaN(Number(idValor))) opcionesId.push(Number(idValor));
        const q = query(collection(db, nombreColeccion), where(campoId, 'in', Array.from(new Set(opcionesId))));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            await deleteDoc(d.ref);
        }
    } catch (err) {
        console.error(`Error eliminando en ${nombreColeccion} (${campoId}=${idValor}):`, err);
    }
}

function IconoCamisa() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8 3l-5 3 2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z" />
    </svg>
  );
}

function AdminInventario() {
    // ---------- ESTADOS DE LA TABLA PRINCIPAL ----------
    const [filtroActivo, setFiltroActivo] = useState('todos'); // 'activos' | 'inactivos' | 'bajo' | 'sinstock'
    const [idEstadoInactivo, setIdEstadoInactivo] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [variantes, setVariantes] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [pestana, setPestana] = useState('inventario'); // 'inventario' | 'historial'
    const [historialAuditoria, setHistorialAuditoria] = useState([]);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [busquedaHistorial, setBusquedaHistorial] = useState('');
    const [filtroTipoMovimiento, setFiltroTipoMovimiento] = useState('todos'); // 'todos' | 'ingreso' | 'salida'

    // ---------- ESTADOS DEL MODAL -- null | 'agregar' | 'editar' | 'stock' ----------
    const [modalAbierto, setModalAbierto] = useState(null); 

    // ---------- ESTADOS DEL FORMULARIO "AGREGAR PRODUCTO" ----------
    const [nombreProducto, setNombreProducto] = useState('');
    const [descripcionProducto, setDescripcionProducto] = useState('');
    const [precioProducto, setPrecioProducto] = useState('');
    const [guardandoProducto, setGuardandoProducto] = useState(false);

    // ---------- ESTADOS DE CATEGORIA / SUBCATEGORIA ----------
    const [categorias, setCategorias] = useState([]);
    const [subcategorias, setSubcategorias] = useState([]);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
    const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState('');
    const [creandoCategoria, setCreandoCategoria] = useState(false);
    const [creandoSubcategoria, setCreandoSubcategoria] = useState(false);
    const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState('');
    const [nombreNuevaSubcategoria, setNombreNuevaSubcategoria] = useState('');

    // ---------- ESTADOS DE FOTOS ----------
    const [fotosSeleccionadas, setFotosSeleccionadas] = useState([]);
    const [previews, setPreviews] = useState([]);

    //---------- ESTADOS DE MODAL DE EDICION ----------//
    const [varianteEditando, setVarianteEditando] = useState(null);
    const [nombreEditar, setNombreEditar] = useState('');
    const [marcaEditar, setMarcaEditar] = useState('');
    const [creandoMarcaEditar, setCreandoMarcaEditar] = useState(false);
    const [nombreNuevaMarcaEditar, setNombreNuevaMarcaEditar] = useState('');
    const [precioEditar, setPrecioEditar] = useState('');
    const [tallaEditar, setTallaEditar] = useState('');
    const [stockEditar, setStockEditar] = useState('');
    const [categoriaEditar, setCategoriaEditar] = useState('');
    const [subcategoriaEditar, setSubcategoriaEditar] = useState('');
    const [creandoSubcategoriaEditar, setCreandoSubcategoriaEditar] = useState(false);
    const [nombreNuevaSubcategoriaEditar, setNombreNuevaSubcategoriaEditar] = useState('');
    const [fotosExistentes, setFotosExistentes] = useState([]); // Fotos ya en Firestore
    const [fotosNuevasEditar, setFotosNuevasEditar] = useState([]); // Archivos nuevos File
    const [previewsNuevasEditar, setPreviewsNuevasEditar] = useState([]); // Previews locales
    const [fotosAEliminar, setFotosAEliminar] = useState([]); // IDs de fotos marcadas para borrar
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    //------ ESTADOS DE MODAL DE INGRESO DE STOCK ----------//
    const [varianteStock, setVarianteStock] = useState(null);
    const [cantidadIngresar, setCantidadIngresar] = useState('');
    const [motivoStock, setMotivoStock] = useState('Compra a proveedor');
    const [guardandoStock, setGuardandoStock] = useState(false);
    const [tallaStock, setTallaStock] = useState('');
    const [tallasDisponibles, setTallasDisponibles] = useState([]);
    const [tipoTallaSeleccionada, setTipoTallaSeleccionada] = useState('');
    const [coloresDisponibles, setColoresDisponibles] = useState([]);
    const [colorSeleccionado, setColorSeleccionado] = useState('');
    const [tipoMovimiento, setTipoMovimiento] = useState('entrada'); // 'entrada' | 'salida'
    const [marcas, setMarcas] = useState([]);
    const [marcaSeleccionada, setMarcaSeleccionada] = useState('');
    const [creandoMarca, setCreandoMarca] = useState(false);
    const [nombreNuevaMarca, setNombreNuevaMarca] = useState('');

    //------ ESTADOS DE MODAL DE DESCUENTO / OFERTA ----------//
    const [varianteDescuento, setVarianteDescuento] = useState(null);
    const [porcentajeDescuento, setPorcentajeDescuento] = useState('');
    const [fechaInicioOferta, setFechaInicioOferta] = useState('');
    const [fechaFinOferta, setFechaFinOferta] = useState('');
    const [guardandoDescuento, setGuardandoDescuento] = useState(false);

    useEffect(() => {
        if (modalAbierto === 'agregar') {
            cargarCategorias();
            cargarMarcas();
        }
    }, [modalAbierto]);

    async function cargarMarcas() {
        try {
            const snap = await getDocs(collection(db, 'Marca'));
            const data = snap.docs.map((d) => ({
                _docId: d.id,
                ID_Marca: d.data().ID_Marca ?? d.id,
                Nombre_Marca: d.data().Nombre_Marca,
                ...d.data()
            }));
            setMarcas(data);
        } catch (err) {
            console.error('Error al cargar marcas desde Firestore:', err);
        }
    }

    async function crearMarca() {
        try {
            const idUser = await obtenerIdUsuario();
            const nuevoId = Date.now();
            const nuevaMarca = {
                ID_Marca: nuevoId,
                ID_User: idUser,
                Nombre_Marca: nombreNuevaMarca,
                Fecha_Creacion: new Date().toISOString()
            };

            await setDoc(doc(db, 'Marca', String(nuevoId)), nuevaMarca);
            setMarcas((prev) => [...prev, nuevaMarca]);
            setMarcaSeleccionada(nuevoId);
            setNombreNuevaMarca('');
            setCreandoMarca(false);
        } catch (error) {
            console.log('❌ Error creando marca en Firestore:', error.message);
        }
    }

    //------------------- CARGA DE TALLAS DISPONIBLES AL ABRIR EL MODAL DE STOCK ----------------//
    useEffect(() => {
        if (modalAbierto === 'stock') {
            cargarTallasDisponibles();
            cargarColoresDisponibles();
        }
    }, [modalAbierto]);

    async function cargarTallasDisponibles() {
        try {
            const snap = await getDocs(collection(db, 'Tipos_Talla'));
            const data = snap.docs.map((d) => ({
                _docId: d.id,
                ID_TipoTalla: d.data().ID_TipoTalla ?? d.id,
                Nombre_TipoTalla: d.data().Nombre_TipoTalla,
                ...d.data()
            }));
            setTallasDisponibles(data);
        } catch (err) {
            console.error('Error al cargar tallas disponibles:', err);
        }
    }

    async function cargarColoresDisponibles() {
        try {
            const snap = await getDocs(collection(db, 'Colores'));
            const data = snap.docs.map((d) => ({
                _docId: d.id,
                ID_Color: d.data().ID_Color ?? d.id,
                Nombre_Color: d.data().Nombre_Color,
                ...d.data()
            }));
            setColoresDisponibles(data);
        } catch (err) {
            console.error('Error al cargar colores disponibles:', err);
        }
    }

    // ---------- CARGA INICIAL DE PRODUCTOS ----------
    useEffect(() => {
        cargarVariantes();
    }, []);

    useEffect(() => {
        async function cargarEstadoInactivo() {
            try {
                const q = query(collection(db, 'Estado_Producto'), where('Estado', '==', 'Inactivo'), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setIdEstadoInactivo(snap.docs[0].data().ID_Estado_Producto ?? 2);
                } else {
                    setIdEstadoInactivo(2);
                }
            } catch (err) {
                console.log('⚠️ Error al consultar Estado_Producto:', err);
                setIdEstadoInactivo(2);
            }
        }
        cargarEstadoInactivo();
    }, []);

    const totalProductos = variantes.length;

    const stockBajo = variantes.filter((v) => {
        const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
        return stock > 0 && stock < 5;
    }).length;

    const sinStock = variantes.filter((v) => {
        const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
        return stock === 0;
    }).length;

    const productosInactivos = variantes.filter((v) => v.ID_EstadoProducto === idEstadoInactivo).length;
    const productosActivos = totalProductos - productosInactivos;

    // ---------- Filtro combinado (busqueda + tarjeta activa) ----------
    const filtrados = variantes.filter((v) => {
        const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
        const coincideBusqueda = (v.Productos?.Nombre_Producto || '').toLowerCase().includes(busqueda.toLowerCase());

        let coincideFiltro = true;
        if (filtroActivo === 'bajo') coincideFiltro = stock > 0 && stock < 5;
        if (filtroActivo === 'sinstock') coincideFiltro = stock === 0;
        if (filtroActivo === 'activos') coincideFiltro = v.ID_EstadoProducto !== idEstadoInactivo;
        if (filtroActivo === 'inactivos') coincideFiltro = v.ID_EstadoProducto === idEstadoInactivo;

        return coincideBusqueda && coincideFiltro;
    });

    // ---------- Contadores y filtro para Ingresos y Salidas ----------
    const totalIngresos = historialAuditoria.filter((f) => {
        const dif = (f.Cantidad_Nueva ?? 0) - (f.Cantidad_Anterior ?? 0);
        return f.Tipo_Movimiento?.toLowerCase().includes('ingreso') || f.Tipo_Movimiento?.toLowerCase().includes('entrada') || dif > 0;
    }).length;

    const totalSalidas = historialAuditoria.filter((f) => {
        const dif = (f.Cantidad_Nueva ?? 0) - (f.Cantidad_Anterior ?? 0);
        return f.Tipo_Movimiento?.toLowerCase().includes('salida') || f.Tipo_Movimiento?.toLowerCase().includes('baja') || dif < 0;
    }).length;

    const historialFiltrado = historialAuditoria.filter((fila) => {
        const prod = fila.Variante_Producto?.Productos?.Nombre_Producto || `Variante #${fila.ID_Variante}`;
        const responsable = `${fila.User?.Nombres || ''} ${fila.User?.Apellidos || ''}`.trim() || fila.User?.Usuario || fila.User?.Correo || 'Sistema';
        const tipo = fila.Tipo_Movimiento || '';
        const dif = (fila.Cantidad_Nueva ?? 0) - (fila.Cantidad_Anterior ?? 0);
        const esIngreso = tipo.toLowerCase().includes('ingreso') || tipo.toLowerCase().includes('entrada') || dif > 0;
        const esSalida = tipo.toLowerCase().includes('salida') || tipo.toLowerCase().includes('baja') || dif < 0;

        if (filtroTipoMovimiento === 'ingreso' && !esIngreso) return false;
        if (filtroTipoMovimiento === 'salida' && !esSalida) return false;

        if (busquedaHistorial.trim()) {
            const q = busquedaHistorial.toLowerCase();
            const coincide = prod.toLowerCase().includes(q) || responsable.toLowerCase().includes(q) || tipo.toLowerCase().includes(q);
            if (!coincide) return false;
        }

        return true;
    });

    //------------------- CARGAR AUDITORIA DE INVENTARIO ----------------//
    async function cargarAuditoria() {
        setCargandoHistorial(true);
        try {
            const [
                auditSnap,
                varSnap,
                prodSnap,
                tallaSnap,
                tiposTallaSnap,
                coloresSnap,
                userSnap
            ] = await Promise.all([
                getDocs(collection(db, 'Auditoria_Inventario')),
                getDocs(collection(db, 'Variante_Producto')),
                getDocs(collection(db, 'Productos')),
                getDocs(collection(db, 'Talla')),
                getDocs(collection(db, 'Tipos_Talla')),
                getDocs(collection(db, 'Colores')),
                getDocs(collection(db, 'User'))
            ]);

            const tiposTallaMap = indexarColeccion(tiposTallaSnap, 'ID_TipoTalla');
            const coloresMap = indexarColeccion(coloresSnap, 'ID_Color');
            const prodMap = indexarColeccion(prodSnap, 'ID_Producto');
            const userMap = indexarColeccion(userSnap, 'ID_User');

            const tallaMap = {};
            tallaSnap.docs.forEach((d) => {
                const t = d.data();
                const tid = t.ID_Talla ?? d.id;
                const item = {
                    ...t,
                    ID_Talla: tid,
                    Tipos_Talla: tiposTallaMap[t.ID_TipoTalla] || null
                };
                tallaMap[tid] = item;
                tallaMap[String(tid)] = item;
            });

            const varMap = {};
            varSnap.docs.forEach((d) => {
                const v = d.data();
                const vid = v.ID_Variante ?? d.id;
                const pid = v.ID_Producto;
                varMap[vid] = {
                    ...v,
                    ID_Variante: vid,
                    Productos: prodMap[pid] || prodMap[String(pid)] || null,
                    Talla: tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || null,
                    Colores: coloresMap[v.ID_Color] || coloresMap[String(v.ID_Color)] || null
                };
                varMap[String(vid)] = varMap[vid];
            });

            const items = auditSnap.docs.map((d) => {
                const a = d.data();
                const aid = a.ID_Auditoria ?? d.id;
                const vid = a.ID_Variante;
                const uid = a.ID_UserAccion ?? a.ID_User;

                return {
                    ...a,
                    _docId: d.id,
                    ID_Auditoria: aid,
                    ID_Variante: vid,
                    Cantidad_Anterior: a.Cantidad_Anterior,
                    Cantidad_Nueva: a.Cantidad_Nueva,
                    Tipo_Movimiento: a.Tipo_Movimiento,
                    Fecha_Accion: a.Fecha_Accion,
                    Variante_Producto: varMap[vid] || varMap[String(vid)] || null,
                    User: userMap[uid] || userMap[String(uid)] || null
                };
            });

            items.sort((x, y) => {
                const fx = x.Fecha_Accion ? new Date(x.Fecha_Accion).getTime() : (Number(x.ID_Auditoria) || 0);
                const fy = y.Fecha_Accion ? new Date(y.Fecha_Accion).getTime() : (Number(y.ID_Auditoria) || 0);
                return fy - fx;
            });

            setHistorialAuditoria(items.slice(0, 100));
        } catch (error) {
            console.error("Error al cargar la auditoría desde Firestore:", error);
        } finally {
            setCargandoHistorial(false);
        }
    }

    useEffect(() => {
        if (pestana === 'historial') {
            cargarAuditoria();
        }
    }, [pestana]);

    // ---------------- ABRIR MODALES ----------------//
    function abrirModalEditar(v) {
        setVarianteEditando(v);
        setNombreEditar(v.Productos?.Nombre_Producto || '');
        setPrecioEditar(v.Precio_Actual || '');
        setTallaEditar(v.Talla?.Tipos_Talla?.Nombre_TipoTalla || '');
        setMarcaEditar(v.Marca?.ID_Marca || '');
        cargarMarcas();
        cargarCategorias();
        setStockEditar(v.Inventario?.[0]?.Cantidad_Disponible ?? 0);
        
        let idPadre = v.Productos?.Categorias_Producto?.ID_CategoriaPadre;
        let idSub = v.Productos?.ID_Categoria;
        
        if (idPadre == null && (idSub === 56 || idSub === 57 || idSub === '56' || idSub === '57')) {
            idPadre = idSub;
            idSub = '';
        } else if (idPadre == null && idSub == null) {
            idPadre = '';
            idSub = '';
        }

        setCategoriaEditar(idPadre || '');
        setSubcategoriaEditar(idSub || '');
        setCreandoSubcategoriaEditar(false);
        setNombreNuevaSubcategoriaEditar('');
        
        if (idPadre) {
            cargarSubcategorias(idPadre);
        }

        // Carga las fotos que ya existen en la base de datos
        const fotos = (v.Productos?.Fotos_Productos || []).sort((a, b) => (Number(a.Orden) ?? 0) - (Number(b.Orden) ?? 0));
        setFotosExistentes(fotos);
        setFotosNuevasEditar([]);
        setPreviewsNuevasEditar([]);
        setFotosAEliminar([]);
        setModalAbierto('editar');
    }

    // Abre el modal para registrar entrada rápida de stock
    function abrirModalStock(v) {
        setVarianteStock(v);
        setCantidadIngresar('');
        setTipoTallaSeleccionada(v.Talla?.Tipos_Talla?.ID_TipoTalla || '');
        setColorSeleccionado(v.Colores?.ID_Color || '');
        setModalAbierto('stock');
        setMotivoStock('Compra a proveedor');
    }

    // Abre el modal para gestionar descuentos y ofertas
    function abrirModalDescuento(v) {
        setVarianteDescuento(v);
        const porc = v.Porcentaje_Descuento ?? v.Productos?.Porcentaje_Descuento ?? '';
        setPorcentajeDescuento(porc !== '' && porc != null ? String(porc) : '');
        
        const fInicio = v.Fecha_Inicio_Oferta ?? v.Productos?.Fecha_Inicio_Oferta;
        const fFin = v.Fecha_Fin_Oferta ?? v.Productos?.Fecha_Fin_Oferta;
        
        setFechaInicioOferta(fInicio ? new Date(fInicio).toISOString().slice(0, 16) : '');
        setFechaFinOferta(fFin ? new Date(fFin).toISOString().slice(0, 16) : '');
        setModalAbierto('descuento');
    }

    // Guarda o elimina el descuento/oferta y lo registra en Auditoria_Descuentos
    async function guardarDescuento(quitar = false) {
        if (!varianteDescuento) return;
        const numPorcentaje = quitar ? 0 : parseFloat(porcentajeDescuento);
        
        if (!quitar) {
            if (isNaN(numPorcentaje) || numPorcentaje <= 0 || numPorcentaje > 100) {
                alert('Por favor ingresa un porcentaje de descuento válido (entre 1 y 100).');
                return;
            }
            if (fechaInicioOferta && fechaFinOferta) {
                if (new Date(fechaFinOferta) <= new Date(fechaInicioOferta)) {
                    alert('La fecha y hora de finalización debe ser posterior a la de inicio.');
                    return;
                }
            }
        }

        setGuardandoDescuento(true);
        try {
            const idUser = await obtenerIdUsuario();
            let usuarioNombre = 'Administrador';
            let usuarioEmail = '';
            try {
                const uSnap = await getDocs(query(collection(db, 'User'), where('ID_User', 'in', [idUser, String(idUser)])));
                if (!uSnap.empty) {
                    const uData = uSnap.docs[0].data();
                    usuarioNombre = `${uData.Nombres || ''} ${uData.Apellidos || ''}`.trim() || uData.Usuario || uData.Correo || 'Administrador';
                    usuarioEmail = uData.Correo || '';
                }
            } catch {
                if (auth.currentUser) {
                    usuarioEmail = auth.currentUser.email || '';
                    usuarioNombre = auth.currentUser.displayName || auth.currentUser.email || 'Administrador';
                }
            }

            const idProd = varianteDescuento.ID_Producto;
            const idVar = varianteDescuento.ID_Variante;
            const prodNombre = varianteDescuento.Productos?.Nombre_Producto || `Producto #${idProd}`;
            const precioOriginal = Number(varianteDescuento.Precio_Actual ?? 0);
            const precioConDescuento = calcularPrecioConDescuento(precioOriginal, numPorcentaje);

            const datosOferta = {
                Porcentaje_Descuento: numPorcentaje,
                Fecha_Inicio_Oferta: (!quitar && fechaInicioOferta) ? new Date(fechaInicioOferta).toISOString() : null,
                Fecha_Fin_Oferta: (!quitar && fechaFinOferta) ? new Date(fechaFinOferta).toISOString() : null,
                Tiene_Descuento: numPorcentaje > 0,
                Precio_Oferta: numPorcentaje > 0 ? precioConDescuento : precioOriginal
            };

            // 1. Actualizar Variante_Producto objetivo
            await actualizarDocPorId('Variante_Producto', 'ID_Variante', idVar, datosOferta);

            // 2. Actualizar Producto padre
            await actualizarDocPorId('Productos', 'ID_Producto', idProd, {
                Porcentaje_Descuento: datosOferta.Porcentaje_Descuento,
                Fecha_Inicio_Oferta: datosOferta.Fecha_Inicio_Oferta,
                Fecha_Fin_Oferta: datosOferta.Fecha_Fin_Oferta,
                Tiene_Descuento: datosOferta.Tiene_Descuento
            });

            // 3. Actualizar todas las variantes de este producto para consistencia (aplica a todas las tallas)
            try {
                const searchPids = Array.from(new Set([
                    idProd,
                    String(idProd),
                    !isNaN(Number(idProd)) ? Number(idProd) : null
                ].filter(v => v !== null && v !== undefined && v !== '')));
                const varSnap = await getDocs(query(collection(db, 'Variante_Producto'), where('ID_Producto', 'in', searchPids)));
                for (const d of varSnap.docs) {
                    const vData = d.data();
                    const vPrecio = Number(vData.Precio_Actual ?? 0);
                    const vPrecioOferta = numPorcentaje > 0 ? calcularPrecioConDescuento(vPrecio, numPorcentaje) : vPrecio;
                    await updateDoc(d.ref, {
                        ...datosOferta,
                        Precio_Oferta: vPrecioOferta
                    });
                }
            } catch (errVar) {
                console.error('Error actualizando variantes hermanas:', errVar);
            }

            // 4. Registrar OBLIGATORIAMENTE en Auditoria_Descuentos
            const idAuditoria = Date.now().toString();
            await setDoc(doc(db, 'Auditoria_Descuentos', idAuditoria), {
                ID_AuditoriaDescuento: idAuditoria,
                ID_Producto: String(idProd),
                ID_Variante: String(idVar),
                Nombre_Producto: prodNombre,
                ID_User: String(idUser),
                Usuario: usuarioNombre,
                Correo: usuarioEmail,
                Fecha_Cambio: new Date().toISOString(),
                Estado_Anterior: {
                    Precio_Original: precioOriginal,
                    Porcentaje_Descuento: Number(varianteDescuento.Porcentaje_Descuento ?? varianteDescuento.Productos?.Porcentaje_Descuento ?? 0),
                    Fecha_Inicio_Oferta: varianteDescuento.Fecha_Inicio_Oferta ?? varianteDescuento.Productos?.Fecha_Inicio_Oferta ?? null,
                    Fecha_Fin_Oferta: varianteDescuento.Fecha_Fin_Oferta ?? varianteDescuento.Productos?.Fecha_Fin_Oferta ?? null
                },
                Estado_Nuevo: {
                    Porcentaje_Descuento: numPorcentaje,
                    Precio_Con_Descuento: precioConDescuento,
                    Fecha_Inicio_Oferta: datosOferta.Fecha_Inicio_Oferta,
                    Fecha_Fin_Oferta: datosOferta.Fecha_Fin_Oferta,
                    Vigente: numPorcentaje > 0
                },
                Accion: quitar ? 'ELIMINAR_DESCUENTO' : 'APLICAR_DESCUENTO'
            });

            setModalAbierto(null);
            cargarVariantes();
            alert(quitar ? 'Descuento eliminado con éxito.' : `¡Oferta del ${numPorcentaje}% aplicada correctamente!`);
        } catch (error) {
            console.error('Error al guardar descuento:', error);
            alert('Hubo un error al guardar la oferta.');
        } finally {
            setGuardandoDescuento(false);
        }
    }

    // Activa o desactiva un producto (variante)
    async function alternarEstadoProducto(v) {
        const nuevoEstado = v.ID_EstadoProducto === 2 ? 1 : 2;

        try {
            // 1. Actualizar el estado de la variante
            await actualizarDocPorId('Variante_Producto', 'ID_Variante', v.ID_Variante, {
                ID_EstadoProducto: nuevoEstado
            });

            // 2. Actualizar el estado del producto padre para que se oculte del feed general
            if (v.ID_Producto) {
                await actualizarDocPorId('Productos', 'ID_Producto', v.ID_Producto, {
                    ID_EstadoProducto: nuevoEstado
                });
            }

            setVariantes((prev) => 
                prev.map((item) => 
                    item.ID_Variante === v.ID_Variante 
                        ? { ...item, ID_EstadoProducto: nuevoEstado } 
                        : item
                )
            );
        } catch (err) {
            console.error('Error al cambiar el estado del producto:', err);
            alert('Hubo un error al intentar cambiar el estado del producto.');
        }
    }

    // Manejo de nuevas fotos dentro del modal de edición
    function manejarSeleccionFotosEditar(event) {
        const archivos = Array.from(event.target.files);
        if (archivos.length === 0) return;
        
        setFotosNuevasEditar((prev) => [...prev, ...archivos]);
        const urls = archivos.map((file) => URL.createObjectURL(file));
        setPreviewsNuevasEditar((prev) => [...prev, ...urls]);
    }

    // Marca una foto existente para borrarla al guardar cambios
    function quitarFotoExistente(idFoto) {
        setFotosAEliminar((prev) => [...prev, idFoto]);
        setFotosExistentes((prev) => prev.filter((f) => f.ID_Foto !== idFoto));
    }

    // Descarta una foto recién seleccionada en el modal de edición
    function quitarFotoNuevaEditar(index) {
        setFotosNuevasEditar((prev) => prev.filter((_, i) => i !== index));
        setPreviewsNuevasEditar((prev) => prev.filter((_, i) => i !== index));
    }

    /*---------- TEXTOS Y COLORES PARA LOS FILTROS ----------*/
    const textosFiltro = {
        bajo: 'Stock bajo',
        sinstock: 'Sin stock',
        activos: 'Productos activos',
        inactivos: 'Productos inactivos',
    };

    const coloresFiltro = {
        activos: 'green',
        inactivos: 'orange',
        bajo: 'purple',
        sinstock: 'red',
    };

    //-----------OPERACIONES EN LA BASE DE DATOS (CRUD)----------//

    // ---------- GUARDAR EDICION DE VARIANTE ----------//
    async function guardarEdicion() {
        if (!varianteEditando) return;

        if (Number(precioEditar) < 0) {
            alert('El precio no puede ser negativo');
            return;
        }

        if (Number(stockEditar) < 0) {
            alert('El stock no puede ser negativo');
            return;
        }
        setGuardandoEdicion(true);

        const idProducto = varianteEditando.Productos?.ID_Producto;
        const idVariante = varianteEditando.ID_Variante;
        const idInventario = varianteEditando.Inventario?.[0]?.ID_Inventario;
        const idTipoTalla = varianteEditando.Talla?.Tipos_Talla?.ID_TipoTalla;

        try {
            // 1. Actualiza el nombre, marca y categoría del producto
            if (idProducto) {
                const idCatUpdate = subcategoriaEditar ? subcategoriaEditar : (categoriaEditar || null);
                await actualizarDocPorId('Productos', 'ID_Producto', idProducto, {
                    Nombre_Producto: nombreEditar,
                    ID_Marca: marcaEditar || null,
                    ID_Categoria: idCatUpdate ? (Number(idCatUpdate) || idCatUpdate) : null
                });
            }

            // 2. Actualiza el precio actual (Variante_Producto)
            if (idVariante) {
                await actualizarDocPorId('Variante_Producto', 'ID_Variante', idVariante, {
                    Precio_Actual: parseFloat(precioEditar)
                });
            }

            // 3. Actualiza el nombre de la talla
            if (idTipoTalla) {
                await actualizarDocPorId('Tipos_Talla', 'ID_TipoTalla', idTipoTalla, {
                    Nombre_TipoTalla: tallaEditar
                });
            }

            // 4. Actualiza la cantidad de stock disponible
            if (idInventario) {
                await actualizarDocPorId('Inventario', 'ID_Inventario', idInventario, {
                    Cantidad_Disponible: parseInt(stockEditar, 10),
                    Fecha_Actualizacion: new Date().toISOString()
                });
            }

            // 5. Elimina de la BD las fotos que el usuario quitó
            if (fotosAEliminar.length > 0) {
                for (const idFoto of fotosAEliminar) {
                    await eliminarDocPorId('Fotos_Productos', 'ID_Foto', idFoto);
                }
            }

            // 6. Sube y registra nuevas fotos añadidas durante la edición en paralelo
            if (fotosNuevasEditar.length > 0) {
                if (!idProducto) {
                    alert("Error: No se encontró el ID_Producto para asociar la foto.");
                    return;
                }

                const idUser = await obtenerIdUsuario();
                const ordenBase = fotosExistentes.length;

                await Promise.all(
                    fotosNuevasEditar.map(async (archivo, i) => {
                        const extension = archivo.name.split('.').pop() || 'jpg';
                        const nombreArchivo = `${idProducto}_${Date.now()}_${i}.${extension}`;

                        try {
                            const publicUrl = await subirImagenStorage(archivo, nombreArchivo);

                            const idFoto = Date.now() + i;
                            await setDoc(doc(db, 'Fotos_Productos', String(idFoto)), {
                                ID_Foto: idFoto,
                                ID_Producto: idProducto,
                                ID_User: idUser,
                                URL_Foto: publicUrl,
                                Orden: ordenBase + i,
                                Fecha_Carga: new Date().toISOString()
                            });
                        } catch (errorStorage) {
                            console.error('Error guardando foto en edición:', errorStorage);
                        }
                    })
                );
            }

            setModalAbierto(null);
            cargarVariantes();
        } catch (err) {
            console.error('Error general en guardarEdicion:', err);
            alert('Error al procesar la edición');
        } finally {
            setGuardandoEdicion(false);
        }
    }

    // -------------- GUARDAR ENTRADA DE STOCK --------------//
    async function guardarEntradaStock() {
        setGuardandoStock(true);
        try {
            const idInventario = varianteStock.Inventario?.[0]?.ID_Inventario;
            const stockActual = Number(varianteStock.Inventario?.[0]?.Cantidad_Disponible ?? 0);
            const cant = parseInt(cantidadIngresar, 10) || 0;
            let nuevoStock = tipoMovimiento === 'entrada' ? stockActual + cant : stockActual - cant;

            if (!idInventario) {
                console.log('❌ No se encontró el registro de inventario');
                setGuardandoStock(false);
                return;
            }

            // 1. Resolver la talla final
            let idTallaFinal = varianteStock.Talla?.ID_Talla;
            const idTipoTallaActual = varianteStock.Talla?.Tipos_Talla?.ID_TipoTalla;
            
            const tallaCambio = tipoTallaSeleccionada && Number(tipoTallaSeleccionada) !== Number(idTipoTallaActual);
            const colorCambio = colorSeleccionado && Number(colorSeleccionado) !== Number(varianteStock.Colores?.ID_Color || null);

            let idVarianteObjetivo = varianteStock.ID_Variante;
            let idInventarioObjetivo = idInventario;

            if (tallaCambio || colorCambio) {
                let idNuevaTalla = null;

                if (tipoTallaSeleccionada) {
                    const qTalla = query(
                        collection(db, 'Talla'),
                        where('ID_TipoTalla', 'in', [
                            tipoTallaSeleccionada,
                            Number(tipoTallaSeleccionada),
                            String(tipoTallaSeleccionada)
                        ])
                    );
                    const snapTalla = await getDocs(qTalla);
                    if (!snapTalla.empty) {
                        idNuevaTalla = snapTalla.docs[0].data().ID_Talla ?? snapTalla.docs[0].id;
                    } else {
                        const nuevaTallaId = Date.now();
                        await setDoc(doc(db, 'Talla', String(nuevaTallaId)), {
                            ID_Talla: nuevaTallaId,
                            ID_TipoTalla: Number(tipoTallaSeleccionada) || tipoTallaSeleccionada
                        });
                        idNuevaTalla = nuevaTallaId;
                    }
                }

                const idColorFinal = colorSeleccionado ? (Number(colorSeleccionado) || colorSeleccionado) : null;

                // Buscar variante existente con misma talla y color
                const qVar = query(
                    collection(db, 'Variante_Producto'),
                    where('ID_Producto', 'in', [
                        varianteStock.ID_Producto,
                        Number(varianteStock.ID_Producto),
                        String(varianteStock.ID_Producto)
                    ])
                );
                const snapVar = await getDocs(qVar);
                let varExistente = null;

                for (const d of snapVar.docs) {
                    const vd = d.data();
                    const matchTalla = String(vd.ID_Talla ?? '') === String(idNuevaTalla ?? '');
                    const matchColor = String(vd.ID_Color ?? '') === String(idColorFinal ?? '');
                    if (matchTalla && matchColor) {
                        varExistente = { ...vd, ID_Variante: vd.ID_Variante ?? d.id, _docId: d.id };
                        break;
                    }
                }

                if (varExistente && String(varExistente.ID_Variante) !== String(varianteStock.ID_Variante)) {
                    idVarianteObjetivo = varExistente.ID_Variante;
                    const qInv = query(
                        collection(db, 'Inventario'),
                        where('ID_Variante', 'in', [
                            idVarianteObjetivo,
                            Number(idVarianteObjetivo),
                            String(idVarianteObjetivo)
                        ])
                    );
                    const snapInv = await getDocs(qInv);
                    if (!snapInv.empty) {
                        const invDoc = snapInv.docs[0];
                        idInventarioObjetivo = invDoc.data().ID_Inventario ?? invDoc.id;
                        const stockBase = Number(invDoc.data().Cantidad_Disponible ?? 0);
                        nuevoStock = tipoMovimiento === 'entrada' ? stockBase + cant : stockBase - cant;
                    }
                } else if (!varExistente) {
                    // Crear nueva variante
                    const nuevoVarId = Date.now();
                    const nuevaVar = {
                        ID_Variante: nuevoVarId,
                        ID_Producto: varianteStock.ID_Producto,
                        ID_Talla: idNuevaTalla,
                        ID_Color: idColorFinal,
                        Precio_Actual: varianteStock.Precio_Actual,
                        ID_EstadoProducto: 1
                    };
                    await setDoc(doc(db, 'Variante_Producto', String(nuevoVarId)), nuevaVar);
                    idVarianteObjetivo = nuevoVarId;

                    // Crear inventario para la nueva variante
                    const nuevoInvId = Date.now() + 1;
                    await setDoc(doc(db, 'Inventario', String(nuevoInvId)), {
                        ID_Inventario: nuevoInvId,
                        ID_Variante: idVarianteObjetivo,
                        Cantidad_Disponible: cant,
                        Cantidad_Reservada: 0,
                        Fecha_Actualizacion: new Date().toISOString()
                    });
                    idInventarioObjetivo = nuevoInvId;
                    nuevoStock = cant;
                }
            }

            // 3. Actualizar el stock
            if (idInventarioObjetivo) {
                await actualizarDocPorId('Inventario', 'ID_Inventario', idInventarioObjetivo, {
                    Cantidad_Disponible: nuevoStock,
                    Fecha_Actualizacion: new Date().toISOString()
                });

                // --- INSERTAR EN TABLA DE AUDITORIA ---
                try {
                    const idUserAccion = await obtenerIdUsuario();
                    const nuevoAuditId = Date.now();
                    await setDoc(doc(db, 'Auditoria_Inventario', String(nuevoAuditId)), {
                        ID_Auditoria: nuevoAuditId,
                        ID_Variante: idVarianteObjetivo,
                        ID_UserAccion: idUserAccion,
                        Cantidad_Anterior: stockActual,
                        Cantidad_Nueva: nuevoStock,
                        Tipo_Movimiento: tipoMovimiento === 'entrada' ? 'Ingreso' : 'Salida',
                        Fecha_Accion: new Date().toISOString()
                    });
                } catch (err) {
                    console.error('No se pudo guardar la auditoría en Firestore:', err);
                }
            }

            setModalAbierto(null);
            cargarVariantes();
            cargarAuditoria();
        } catch (err) {
            console.error('Error en guardarEntradaStock:', err);
        } finally {
            setGuardandoStock(false);
        }
    }

    // Consulta la lista principal de variantes y sus relaciones
    async function cargarVariantes() {
        setCargando(true);
        try {
            const [
                varSnap,
                prodSnap,
                marcasSnap,
                catSnap,
                fotosSnap,
                tallaSnap,
                tiposTallaSnap,
                invSnap,
                coloresSnap
            ] = await Promise.all([
                getDocs(collection(db, 'Variante_Producto')),
                getDocs(collection(db, 'Productos')),
                getDocs(collection(db, 'Marca')),
                getDocs(collection(db, 'Categorias_Producto')),
                getDocs(collection(db, 'Fotos_Productos')),
                getDocs(collection(db, 'Talla')),
                getDocs(collection(db, 'Tipos_Talla')),
                getDocs(collection(db, 'Inventario')),
                getDocs(collection(db, 'Colores')),
            ]);

            const marcasMap = indexarColeccion(marcasSnap, 'ID_Marca');
            const catMap = indexarColeccion(catSnap, 'ID_categoria');
            catSnap.docs.forEach((d) => {
                const data = d.data();
                const idC = data.ID_Categoria ?? data.ID_categoria;
                if (idC != null) {
                    catMap[idC] = { ...data, ID_categoria: idC, _docId: d.id };
                    catMap[String(idC)] = catMap[idC];
                }
            });

            const tiposTallaMap = indexarColeccion(tiposTallaSnap, 'ID_TipoTalla');
            const coloresMap = indexarColeccion(coloresSnap, 'ID_Color');

            const tallaMap = {};
            tallaSnap.docs.forEach((d) => {
                const t = d.data();
                const tid = t.ID_Talla ?? d.id;
                const item = {
                    ...t,
                    ID_Talla: tid,
                    _docId: d.id,
                    Tipos_Talla: tiposTallaMap[t.ID_TipoTalla] || null
                };
                tallaMap[tid] = item;
                tallaMap[String(tid)] = item;
                if (!isNaN(Number(tid))) tallaMap[Number(tid)] = item;
                tallaMap[d.id] = item;
            });

            const fotosPorProducto = {};
            fotosSnap.docs.forEach((d) => {
                const f = d.data();
                const pid = f.ID_Producto;
                if (pid != null) {
                    if (!fotosPorProducto[pid]) fotosPorProducto[pid] = [];
                    fotosPorProducto[pid].push({
                        ID_Foto: f.ID_Foto ?? d.id,
                        _docId: d.id,
                        ...f
                    });
                    if (!fotosPorProducto[String(pid)]) fotosPorProducto[String(pid)] = fotosPorProducto[pid];
                }
            });

            const invPorVariante = {};
            invSnap.docs.forEach((d) => {
                const inv = d.data();
                const vid = inv.ID_Variante;
                if (vid != null) {
                    if (!invPorVariante[vid]) invPorVariante[vid] = [];
                    invPorVariante[vid].push({
                        ID_Inventario: inv.ID_Inventario ?? d.id,
                        _docId: d.id,
                        ...inv
                    });
                    if (!invPorVariante[String(vid)]) invPorVariante[String(vid)] = invPorVariante[vid];
                }
            });

            const prodMap = {};
            prodSnap.docs.forEach((d) => {
                const p = d.data();
                const pid = p.ID_Producto ?? d.id;
                const fotos = (fotosPorProducto[pid] || fotosPorProducto[String(pid)] || []).sort(
                    (a, b) => (Number(a.Orden) ?? 0) - (Number(b.Orden) ?? 0)
                );
                const item = {
                    ...p,
                    ID_Producto: pid,
                    _docId: d.id,
                    Nombre_Producto: p.Nombre_Producto || '',
                    Descripcion: p.Descripcion || '',
                    ID_Categoria: p.ID_Categoria ?? p.ID_categoria ?? null,
                    Marca: marcasMap[p.ID_Marca] || null,
                    Categorias_Producto: catMap[p.ID_Categoria ?? p.ID_categoria] || null,
                    Fotos_Productos: fotos
                };
                prodMap[pid] = item;
                prodMap[String(pid)] = item;
                if (!isNaN(Number(pid))) prodMap[Number(pid)] = item;
                prodMap[d.id] = item;
            });

            const listaVariantes = varSnap.docs.map((d) => {
                const v = d.data();
                const vid = v.ID_Variante ?? d.id;
                const pid = v.ID_Producto;
                const productoObj = prodMap[pid] || prodMap[String(pid)] || null;
                const tallaObj = tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || null;
                const colorObj = coloresMap[v.ID_Color] || coloresMap[String(v.ID_Color)] || null;
                const invList = invPorVariante[vid] || invPorVariante[String(vid)] || [{ ID_Inventario: null, Cantidad_Disponible: 0 }];

                return {
                    ...v,
                    _docId: d.id,
                    ID_Variante: vid,
                    ID_Producto: pid,
                    Precio_Actual: v.Precio_Actual,
                    ID_EstadoProducto: v.ID_EstadoProducto,
                    Productos: productoObj,
                    Talla: tallaObj,
                    Inventario: invList,
                    Colores: colorObj
                };
            });

            listaVariantes.sort((a, b) => (Number(b.ID_Variante) || 0) - (Number(a.ID_Variante) || 0));
            setVariantes(listaVariantes);
        } catch (error) {
            console.log('❌ Error al cargar variantes desde Firestore:', error.message);
        } finally {
            setCargando(false);
        }
    }

    // Carga las categorías principales (sin categoría padre)
    async function cargarCategorias() {
        try {
            const snap = await getDocs(collection(db, 'Categorias_Producto'));
            const principales = snap.docs
                .map((d) => ({
                    _docId: d.id,
                    ID_categoria: d.data().ID_categoria ?? d.data().ID_Categoria ?? d.id,
                    Nombre_Categoria: d.data().Nombre_Categoria,
                    ID_CategoriaPadre: d.data().ID_CategoriaPadre ?? null
                }))
                .filter((c) => !c.ID_CategoriaPadre);

            setCategorias(principales);
        } catch (error) {
            console.error('Error al cargar categorías desde Firestore:', error);
        }
    }

    // Carga las subcategorías vinculadas a una categoría padre
    async function cargarSubcategorias(idCategoriaPadre) {
        try {
            const snap = await getDocs(collection(db, 'Categorias_Producto'));
            const subs = snap.docs
                .map((d) => ({
                    _docId: d.id,
                    ID_categoria: d.data().ID_categoria ?? d.data().ID_Categoria ?? d.id,
                    Nombre_Categoria: d.data().Nombre_Categoria,
                    ID_CategoriaPadre: d.data().ID_CategoriaPadre ?? null
                }))
                .filter((c) => String(c.ID_CategoriaPadre) === String(idCategoriaPadre));

            setSubcategorias(subs);
        } catch (error) {
            console.error('Error al cargar subcategorías desde Firestore:', error);
        }
    }

    // ---------- CREAR CATEGORIA / SUBCATEGORIA AL VUELO ----------
    async function crearCategoria() {
        try {
            const idUser = await obtenerIdUsuario();
            const nuevoId = Date.now();
            const nuevaCat = {
                ID_categoria: nuevoId,
                ID_User: idUser,
                Nombre_Categoria: nombreNuevaCategoria,
                ID_CategoriaPadre: null,
                Fecha_Creacion: new Date().toISOString()
            };

            await setDoc(doc(db, 'Categorias_Producto', String(nuevoId)), nuevaCat);
            setCategorias((prev) => [...prev, nuevaCat]);
            setCategoriaSeleccionada(nuevoId);
            setNombreNuevaCategoria('');
            setCreandoCategoria(false);
        } catch (error) {
            console.log('❌ Error creando categoría en Firestore:', error.message);
        }
    }

    async function crearSubcategoria() {
        try {
            const idUser = await obtenerIdUsuario();
            const nuevoId = Date.now();
            const nuevaSub = {
                ID_categoria: nuevoId,
                ID_User: idUser,
                Nombre_Categoria: nombreNuevaSubcategoria,
                ID_CategoriaPadre: categoriaSeleccionada,
                Fecha_Creacion: new Date().toISOString()
            };

            await setDoc(doc(db, 'Categorias_Producto', String(nuevoId)), nuevaSub);
            setSubcategorias((prev) => [...prev, nuevaSub]);
            setSubcategoriaSeleccionada(nuevoId);
            setNombreNuevaSubcategoria('');
            setCreandoSubcategoria(false);
        } catch (error) {
            console.log('❌ Error creando subcategoría en Firestore:', error.message);
        }
    }

    // ---------- MANEJO DE FOTOS ----------
    function manejarSeleccionFotos(event) {
        const archivos = Array.from(event.target.files);
        setFotosSeleccionadas((prev) => [...prev, ...archivos]);

        const nuevasPreviews = archivos.map((archivo) => URL.createObjectURL(archivo));
        setPreviews((prev) => [...prev, ...nuevasPreviews]);
    }

    function quitarFoto(index) {
        setFotosSeleccionadas((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    }

    // ---------------- SUBIR FOTOS A STORAGE & FIRESTORE -----------------//
    async function subirFotos(idProducto, archivos = fotosSeleccionadas) {
        if (!archivos || archivos.length === 0) return;

        const idUser = await obtenerIdUsuario();

        // Optimizar y subir todas las fotos en paralelo para máxima velocidad
        await Promise.all(
            archivos.map(async (archivo, i) => {
                const extension = archivo.name.split('.').pop() || 'jpg';
                const nombreArchivo = `${idProducto}_${Date.now()}_${i}.${extension}`;

                try {
                    // Subida rápida (Supabase Storage / Firebase fallback)
                    const publicUrl = await subirImagenStorage(archivo, nombreArchivo);

                    // Registrar en Fotos_Productos de Firestore
                    const idFoto = Date.now() + i;
                    await setDoc(doc(db, 'Fotos_Productos', String(idFoto)), {
                        ID_Foto: idFoto,
                        ID_Producto: idProducto,
                        ID_User: idUser,
                        URL_Foto: publicUrl,
                        Orden: i,
                        Fecha_Carga: new Date().toISOString()
                    });

                    console.log(`✅ Foto ${i} guardada correctamente:`, publicUrl);
                } catch (errorSubida) {
                    console.error('❌ Error guardando foto:', errorSubida);
                }
            })
        );
    }

    function marcarComoPrincipal(indice) {
        if (indice === 0) return;

        setFotosSeleccionadas((prev) => {
            const copia = [...prev];
            const [fotoElegida] = copia.splice(indice, 1);
            return [fotoElegida, ...copia];
        });

        setPreviews((prev) => {
            const copia = [...prev];
            const [previewElegida] = copia.splice(indice, 1);
            return [previewElegida, ...copia];
        });
    }

    function limpiarFormulario() {
        setNombreProducto('');
        setDescripcionProducto('');
        setPrecioProducto('');
        setCategoriaSeleccionada('');
        setSubcategoriaSeleccionada('');
        setFotosSeleccionadas([]);
        setPreviews([]);
        setMarcaSeleccionada('');
    }

    // ---------- GUARDAR EL PRODUCTO COMPLETO ----------
    async function guardarProductoNuevo() {
        const idCategoriaFinal = subcategoriaSeleccionada || categoriaSeleccionada;

        if (!nombreProducto || !idCategoriaFinal) {
            alert('Nombre y categoría son obligatorios');
            return;
        }

        if (Number(precioProducto) < 0) {
            alert('El precio no puede ser negativo');
            return;
        }

        setGuardandoProducto(true);

        try {
            const idProducto = Date.now();
            const idVariante = idProducto + 1;
            const idInventario = idProducto + 2;

            // 1. Crear producto, variante e inventario en Firestore en una sola operación atómica (writeBatch)
            const nuevoProducto = {
                ID_Producto: idProducto,
                Nombre_Producto: nombreProducto,
                Descripcion: descripcionProducto,
                ID_Categoria: Number(idCategoriaFinal) || idCategoriaFinal,
                ID_Marca: marcaSeleccionada ? (Number(marcaSeleccionada) || marcaSeleccionada) : null,
                ID_EstadoProducto: 1,
                Fecha_Creacion: new Date().toISOString()
            };

            const nuevaVariante = {
                ID_Variante: idVariante,
                ID_Producto: idProducto,
                ID_Talla: null,
                Precio_Actual: parseFloat(precioProducto) || 0,
                ID_EstadoProducto: 1
            };

            const nuevoInventario = {
                ID_Inventario: idInventario,
                ID_Variante: idVariante,
                Cantidad_Disponible: 0,
                Cantidad_Reservada: 0,
                Fecha_Actualizacion: new Date().toISOString()
            };

            const batch = writeBatch(db);
            batch.set(doc(db, 'Productos', String(idProducto)), nuevoProducto);
            batch.set(doc(db, 'Variante_Producto', String(idVariante)), nuevaVariante);
            batch.set(doc(db, 'Inventario', String(idInventario)), nuevoInventario);
            await batch.commit();

            // 2. Subir fotos en paralelo con optimización de imagen
            if (fotosSeleccionadas.length > 0) {
                await subirFotos(idProducto, fotosSeleccionadas);
            }

            // 3. Cerrar modal y limpiar formulario inmediatamente
            setModalAbierto(null);
            limpiarFormulario();

            // 4. Actualizar inventario en segundo plano
            await cargarVariantes();
        } catch (err) {
            console.error('Error general en guardarProductoNuevo:', err);
            alert('Error al guardar el producto');
        } finally {
            setGuardandoProducto(false);
        }
    }

    return (
        <div className="admin-layout">
            <SidebarAdmin />
            {/* Barra lateral de opciones */}

            <main className="admin-content">
                {/* Encabezado con título y botón para abrir el modal de agregar */}
                <div className="admin-top">
                    <h1>Inventario</h1>
                    <button className="btn-agregar" onClick={() => setModalAbierto('agregar')}>
                        + Agregar producto
                    </button>
                </div>

                <div className="admin-tabs">
                    <button 
                        className={`admin-tab-btn ${pestana === 'inventario' ? 'activo' : ''}`}
                        onClick={() => setPestana('inventario')}
                    >
                        Productos
                    </button>
                    <button 
                        className={`admin-tab-btn ${pestana === 'historial' ? 'activo' : ''}`}
                        onClick={() => setPestana('historial')}
                    >
                        Ingresos y Salidas
                    </button>
                </div>

                {pestana === 'inventario' ? (
                    <>
                        {/* tarjetas de estadisticas de productos activos, inactivos, stock bajo y sin stock */}
                        <div className="stats-row">
                            <div
                                className={`stat-card ${filtroActivo === 'activos' ? 'stat-card-activa' : ''}`}
                                onClick={() => setFiltroActivo(filtroActivo === 'activos' ? 'todos' : 'activos')}
                            >
                                <p className="stat-titulo">Productos activos</p>
                                <p className="stat-valor" style={{ color: 'green' }}>{productosActivos}</p>
                            </div>

                            <div
                                className={`stat-card ${filtroActivo === 'inactivos' ? 'stat-card-activa' : ''}`}
                                onClick={() => setFiltroActivo(filtroActivo === 'inactivos' ? 'todos' : 'inactivos')}
                            >
                                <p className="stat-titulo">Productos inactivos</p>
                                <p className="stat-valor" style={{ color: 'orange' }}>{productosInactivos}</p>
                            </div>

                            <div
                                className={`stat-card ${filtroActivo === 'bajo' ? 'stat-card-activa' : ''}`}
                                onClick={() => setFiltroActivo(filtroActivo === 'bajo' ? 'todos' : 'bajo')}
                            >
                                <p className="stat-titulo">Stock bajo</p>
                                <p className="stat-valor" style={{ color: 'purple' }}>{stockBajo}</p>
                            </div>
                            
                          

                            <div
                                className={`stat-card ${filtroActivo === 'sinstock' ? 'stat-card-activa' : ''}`}
                                onClick={() => setFiltroActivo(filtroActivo === 'sinstock' ? 'todos' : 'sinstock')}
                            >
                                <p className="stat-titulo">Sin stock</p>
                                <p className="stat-valor" style={{ color: 'red' }}>{sinStock}</p>
                            </div>
                        </div>

                        

                    {filtroActivo !== 'todos' && (
                         <div
                                className="filtro-indicador"
                                style={{ borderColor: coloresFiltro[filtroActivo], color: coloresFiltro[filtroActivo] }}
                            >
                                <p className="Filtro-titulo">Mostrando:</p>
                                {textosFiltro[filtroActivo]}
                                <button onClick={() => setFiltroActivo('todos')}>Quitar filtro ❌</button>
                            </div>
                        )}

                    {/* Barra de búsqueda para filtrar productos por nombre */}
                <input
                    className="buscador"
                    placeholder="Buscar producto"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
                    {/* solo un mensajito para que se vea que esta cargando los productos */}
                {cargando ? (
                    <p>Cargando productos...</p>
                ) : (
                    <table className="tabla-productos">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Producto</th>
                                <th>Precio</th>
                                <th>Stock</th>
                                <th>Talla</th>
                                <th>Color</th>
                                <th>Marca</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map((v) => {
                                const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
                                const estaInactivo = v.ID_EstadoProducto === 2;
    
    return (
        // Determina si el producto está inactivo para aplicar estilo de opacidad
        /*Muestra "(Inactivo)" si el producto está desactivado*/
        <tr key={v.ID_Variante} style={{ opacity: estaInactivo ? 0.45 : 1 }}>
            <td>{v.ID_Variante}</td>
            <td>
                
                {v.Productos?.Nombre_Producto} 
                
                {estaInactivo && (
                    <span style={{ fontSize: '0.75rem', color: '#777', marginLeft: '6px' }}>
                        (Inactivo)
                    </span>
                )}
            </td>

            
            <td>
                {(esOfertaActiva(v) || esOfertaActiva(v.Productos)) ? (
                    <div>
                        <span style={{ textDecoration: 'line-through', color: '#888', fontSize: '0.85em' }}>${v.Precio_Actual}</span>{' '}
                        <strong style={{ color: '#d32f2f' }}>
                            ${calcularPrecioConDescuento(Number(v.Precio_Actual), Number(v.Porcentaje_Descuento || v.Productos?.Porcentaje_Descuento || 0)).toFixed(2)}
                        </strong>
                        <span className="badge-descuento-admin" title="Oferta activa" style={{ marginLeft: '4px' }}>
                            -{v.Porcentaje_Descuento || v.Productos?.Porcentaje_Descuento}%
                        </span>
                    </div>
                ) : (
                    <span>${v.Precio_Actual}</span>
                )}
            </td>
            
            <td className={stock === 0 ? 'sin-stock' : stock < 5 ? 'stock-bajo' : ''}>
                {stock}
            </td>
            <td>{v.Talla?.Tipos_Talla?.Nombre_TipoTalla}</td>
            <td>{v.Colores?.Nombre_Color || '-'}</td>
            <td>{v.Productos?.Marca?.Nombre_Marca || '-'}</td>
            
{/*---------------- Botones para alterar stock, editar, aplicar descuento y activar/desactivar producto ----------------*/}
            <td>
                <div className="acciones-tabla-wrap">
                    <button 
                        type="button" 
                        title="Entrada de stock" 
                        onClick={() => abrirModalStock(v)}
                        className="btn-accion-tabla"
                    >
                        <img src="/ICONOS/Box.png" alt="Agregar stock" width={20} height={20} />
                    </button>
                    <button 
                        type="button" 
                        title="Editar producto" 
                        onClick={() => abrirModalEditar(v)}
                        className="btn-accion-tabla"
                    >
                        <img src="/ICONOS/PENCIL.png" alt="Editar producto" width={20} height={20} />
                    </button>
                    <button 
                        type="button" 
                        title="Aplicar descuento / oferta" 
                        onClick={() => abrirModalDescuento(v)}
                        className="btn-accion-tabla"
                    >
                        <img src="/ICONOS/SALES.png" alt="Descuento" width={20} height={20} />
                    </button>
                    <button 
                        type="button" 
                        title={estaInactivo ? "Activar producto" : "Desactivar producto"} 
                        onClick={() => alternarEstadoProducto(v)}
                        className="btn-accion-tabla"
                    >
                        <span className="icono-estado-tabla">{estaInactivo ? '👁️' : '❌'}</span>
                    </button>
                </div>
            </td>
                                    </tr>
                                );
                            })}
                        
                            
                        </tbody>
                    </table>
                )}
                </>
                ) : (
                    <>
                        {/* Tarjetas de estadísticas de movimientos */}
                        <div className="stats-row">
                            <div
                                className={`stat-card ${filtroTipoMovimiento === 'todos' ? 'stat-card-activa' : ''}`}
                                onClick={() => setFiltroTipoMovimiento('todos')}
                                style={{ cursor: 'pointer' }}
                            >
                                <p className="stat-titulo">Total movimientos</p>
                                <p className="stat-valor" style={{ color: '#1a1a1a' }}>{historialAuditoria.length}</p>
                            </div>

                            <div
                                className={`stat-card ${filtroTipoMovimiento === 'ingreso' ? 'stat-card-activa' : ''}`}
                                onClick={() => setFiltroTipoMovimiento(filtroTipoMovimiento === 'ingreso' ? 'todos' : 'ingreso')}
                                style={{ cursor: 'pointer' }}
                            >
                                <p className="stat-titulo">Ingresos / Entradas</p>
                                <p className="stat-valor" style={{ color: '#2e7d32' }}>{totalIngresos}</p>
                            </div>

                            <div
                                className={`stat-card ${filtroTipoMovimiento === 'salida' ? 'stat-card-activa' : ''}`}
                                onClick={() => setFiltroTipoMovimiento(filtroTipoMovimiento === 'salida' ? 'todos' : 'salida')}
                                style={{ cursor: 'pointer' }}
                            >
                                <p className="stat-titulo">Salidas / Bajas</p>
                                <p className="stat-valor" style={{ color: '#c62828' }}>{totalSalidas}</p>
                            </div>
                        </div>

                        {filtroTipoMovimiento !== 'todos' && (
                            <div
                                className="filtro-indicador"
                                style={{
                                    borderColor: filtroTipoMovimiento === 'ingreso' ? '#2e7d32' : '#c62828',
                                    color: '#ffffff',
                                    backgroundColor: '#000000'
                                }}
                            >
                                <p className="Filtro-titulo">Mostrando:</p>
                                {filtroTipoMovimiento === 'ingreso' ? 'Solo Ingresos y Entradas' : 'Solo Salidas y Bajas'}
                                <button onClick={() => setFiltroTipoMovimiento('todos')}>Quitar filtro ❌</button>
                            </div>
                        )}

                        {/* Barra de búsqueda para filtrar el historial */}
                        <input
                            className="buscador"
                            placeholder="Buscar por producto, responsable o tipo de movimiento..."
                            value={busquedaHistorial}
                            onChange={(e) => setBusquedaHistorial(e.target.value)}
                        />

                        {cargandoHistorial ? (
                            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Cargando movimientos de inventario...</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="tabla-productos tabla-historial">
                                    <thead>
                                        <tr>
                                            <th>Fecha y Hora</th>
                                            <th>Producto</th>
                                            <th>Talla / Color</th>
                                            <th>Tipo Movimiento</th>
                                            <th>Stock Anterior</th>
                                            <th>Stock Nuevo</th>
                                            <th>Cambio</th>
                                            <th>Responsable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historialFiltrado.map((fila) => {
                                            const prod = fila.Variante_Producto?.Productos?.Nombre_Producto || `Variante #${fila.ID_Variante}`;
                                            const talla = fila.Variante_Producto?.Talla?.Tipos_Talla?.Nombre_TipoTalla || '-';
                                            const color = fila.Variante_Producto?.Colores?.Nombre_Color || '-';
                                            const fecha = fila.Fecha_Accion ? new Date(fila.Fecha_Accion).toLocaleString('es-SV') : '-';
                                            const responsable = `${fila.User?.Nombres || ''} ${fila.User?.Apellidos || ''}`.trim() || fila.User?.Usuario || fila.User?.Correo || 'Sistema';
                                            const dif = (fila.Cantidad_Nueva ?? 0) - (fila.Cantidad_Anterior ?? 0);
                                            const esIngreso = fila.Tipo_Movimiento?.toLowerCase().includes('ingreso') || fila.Tipo_Movimiento?.toLowerCase().includes('entrada') || dif > 0;

                                            return (
                                                <tr key={fila.ID_Auditoria}>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{fecha}</td>
                                                    <td style={{ fontWeight: 600 }}>{prod}</td>
                                                    <td>{talla} / {color}</td>
                                                    <td>
                                                        <span className={esIngreso ? 'badge-ingreso' : 'badge-salida'}>
                                                            {fila.Tipo_Movimiento || (esIngreso ? 'Ingreso' : 'Salida')}
                                                        </span>
                                                    </td>
                                                    <td>{fila.Cantidad_Anterior ?? '-'}</td>
                                                    <td>{fila.Cantidad_Nueva ?? '-'}</td>
                                                    <td style={{ fontWeight: 'bold', color: dif > 0 ? '#2e7d32' : dif < 0 ? '#c62828' : '#666' }}>
                                                        {dif > 0 ? `+${dif}` : dif}
                                                    </td>
                                                    <td>{responsable}</td>
                                                </tr>
                                            );
                                        })}

                                        {historialFiltrado.length === 0 && (
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: 'center', color: '#777', padding: '36px' }}>
                                                    No hay movimientos registrados que coincidan con la búsqueda.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* ---------- MODAL: AGREGAR PRODUCTO ---------- */}
            {modalAbierto === 'agregar' && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <div className="modal-header">
                            <h2>Agregar producto</h2>
                            <button onClick={() => setModalAbierto(null)}>✕</button>
                        </div>

                        <label>Nombre producto</label>
                        <input
                            type="text"
                            placeholder="Ej: Blusa Floreada"
                            value={nombreProducto}
                            onChange={(e) => setNombreProducto(e.target.value)}
                        />

                        <label>Descripción</label>
                        <input
                            type="text"
                            placeholder="Descripción breve"
                            value={descripcionProducto}
                            onChange={(e) => setDescripcionProducto(e.target.value)}
                        />
                            {/*----------------- seleccion de categorias o creacion de estas-----------------*/}
                        <label>Categoría</label>
                        {!creandoCategoria ? (
                            <div className="select-con-boton">
                                <select
                                    value={categoriaSeleccionada}
                                    onChange={(e) => {
                                        setCategoriaSeleccionada(e.target.value);
                                        setSubcategoriaSeleccionada('');
                                        if (e.target.value) cargarSubcategorias(e.target.value);
                                    }}
                                >
                                    <option value="">Selecciona una categoría</option>
                                    {categorias.map((c) => (
                                        <option key={c.ID_categoria} value={c.ID_categoria}>
                                            {c.Nombre_Categoria}
                                        </option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setCreandoCategoria(true)}>+ Nueva</button>
                            </div>
                        ) : (
                            <div className="select-con-boton">
                                <input
                                    type="text"
                                    placeholder="Nombre de la categoría"
                                    value={nombreNuevaCategoria}
                                    onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                                />
                                <button type="button" onClick={crearCategoria}>Crear</button>
                                <button type="button" onClick={() => setCreandoCategoria(false)}>Cancelar</button>
                            </div>
                        )}

                        {categoriaSeleccionada && (
                            <>
                                <label>Subcategoría</label>
                                {!creandoSubcategoria ? (
                                    <div className="select-con-boton">
                                        <select
                                            value={subcategoriaSeleccionada}
                                            onChange={(e) => setSubcategoriaSeleccionada(e.target.value)}
                                        >
                                            <option value="">Sin subcategoría</option>
                                            {subcategorias.map((s) => (
                                                <option key={s.ID_categoria} value={s.ID_categoria}>
                                                    {s.Nombre_Categoria}
                                                </option>
                                            ))}
                                        </select>
                                        <button type="button" onClick={() => setCreandoSubcategoria(true)}>+ Nueva</button>
                                    </div>
                                ) : (
                                    <div className="select-con-boton">
                                        <input
                                            type="text"
                                            placeholder="Nombre de la subcategoría"
                                            value={nombreNuevaSubcategoria}
                                            onChange={(e) => setNombreNuevaSubcategoria(e.target.value)}
                                        />
                                        <button type="button" onClick={crearSubcategoria}>Crear</button>
                                        <button type="button" onClick={() => setCreandoSubcategoria(false)}>Cancelar</button>
                                    </div>

                                    
                                )}
                                <label>Marca</label>
                                    {!creandoMarca ? (
                                        <div className="select-con-boton">
                                            <select
                                                value={marcaSeleccionada}
                                                onChange={(e) => setMarcaSeleccionada(e.target.value)}
                                            >
                                                <option value="">Sin marca</option>
                                                {marcas.map((m) => (
                                                    <option key={m.ID_Marca} value={m.ID_Marca}>
                                                        {m.Nombre_Marca}
                                                    </option>
                                                ))}
                                            </select>
                                            <button type="button" onClick={() => setCreandoMarca(true)}>+ Nueva</button>
                                        </div>
                                    ) : (
                                        <div className="select-con-boton">
                                            <input
                                                type="text"
                                                placeholder="Nombre de la marca"
                                                value={nombreNuevaMarca}
                                                onChange={(e) => setNombreNuevaMarca(e.target.value)}
                                            />
                                            <button type="button" onClick={crearMarca}>Crear</button>
                                            <button type="button" onClick={() => setCreandoMarca(false)}>Cancelar</button>
                                        </div>
                                    )}
                            </>
                            
                            
                        )}

                        <div className="modal-row">
                            <div>
                                <label>Precio</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={precioProducto}
                                    onChange={(e) => setPrecioProducto(e.target.value)}
                                />
                            </div>
                            
                        </div>

                        <label>Fotos del producto</label>
                        <div className="fotos-row">
                            {previews.map((url, index) => (
                                <div 
                                    key={index} 
                                    className="foto-box"
                                    onClick={() => marcarComoPrincipal(index)}
                                    title={index === 0 ? "Foto principal" : "Haz clic para hacerla principal"}
                                >
                                    <img src={url} alt="preview" className="foto-preview" />
                                    <button 
                                        type="button" 
                                        className="foto-quitar" 
                                        onClick={(e) => {
                                            e.stopPropagation(); // Evita que se dispare marcarComoPrincipal al borrar
                                            quitarFoto(index);
                                        }}
                                    >
                                        ✕
                                    </button>
                                    {index === 0 && <span className="foto-principal-label">Principal</span>}
                                </div>
                            ))}
                           
                            <label className="foto-box agregar">
                                + Agregar
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={manejarSeleccionFotos}
                                    style={{ display: 'none' }}
                                />
                            </label>
                                    {/* casillas vacias de guia visual, solo se muestran si aun no hay 3 fotos */}
                            {Array.from({ length: Math.max(0, 3 - previews.length) }).map((_, i) => (
                              <div key={`vacia-${i}`} className="foto-box foto-vacia">
                                 <IconoCamisa />
                                 </div>
                            ))}


                        </div>

                        <button 
                            className="btn-guardar" 
                            onClick={guardarProductoNuevo}
                            disabled={guardandoProducto}
                        >
                            {guardandoProducto ? 'Guardando producto y fotos...' : 'Guardar cambios'}
                        </button>
                    </div>
                </div>
            )}

            {/* ---------- MODAL: EDITAR PRODUCTO ---------- */}
        {modalAbierto === 'editar' && (
            <div className="modal-overlay">
        <div className="modal-box">
            <div className="modal-header">
                <h2>Editar producto</h2>
                <button onClick={() => setModalAbierto(null)}>✕</button>
            </div>

            <label>Nombre producto</label>
            <input
                type="text"
                value={nombreEditar}
                onChange={(e) => setNombreEditar(e.target.value)}
            />
            <label>Categoría</label>
            <div className="select-con-boton">
                <select
                    value={categoriaEditar}
                    onChange={(e) => {
                        setCategoriaEditar(e.target.value);
                        setSubcategoriaEditar('');
                        if (e.target.value) cargarSubcategorias(e.target.value);
                    }}
                >
                    <option value="">Selecciona una categoría</option>
                    {categorias.map((c) => (
                        <option key={c.ID_categoria} value={c.ID_categoria}>
                            {c.Nombre_Categoria}
                        </option>
                    ))}
                </select>
            </div>

            {categoriaEditar && (
                <>
                    <label>Subcategoría</label>
                    {!creandoSubcategoriaEditar ? (
                        <div className="select-con-boton">
                            <select
                                value={subcategoriaEditar}
                                onChange={(e) => setSubcategoriaEditar(e.target.value)}
                            >
                                <option value="">Sin subcategoría</option>
                                {subcategorias.map((s) => (
                                    <option key={s.ID_categoria} value={s.ID_categoria}>
                                        {s.Nombre_Categoria}
                                    </option>
                                ))}
                            </select>
                            <button type="button" onClick={() => setCreandoSubcategoriaEditar(true)}>+ Nueva</button>
                        </div>
                    ) : (
                        <div className="select-con-boton">
                            <input
                                type="text"
                                placeholder="Nombre de la subcategoría"
                                value={nombreNuevaSubcategoriaEditar}
                                onChange={(e) => setNombreNuevaSubcategoriaEditar(e.target.value)}
                            />
                            <button type="button" onClick={async () => {
                                try {
                                    const idUser = await obtenerIdUsuario();
                                    const nuevoId = Date.now();
                                    const data = {
                                        ID_categoria: nuevoId,
                                        ID_User: idUser,
                                        Nombre_Categoria: nombreNuevaSubcategoriaEditar,
                                        ID_CategoriaPadre: categoriaEditar,
                                        Fecha_Creacion: new Date().toISOString()
                                    };
                                    await setDoc(doc(db, 'Categorias_Producto', String(nuevoId)), data);
                                    setSubcategorias((prev) => [...prev, data]);
                                    setSubcategoriaEditar(data.ID_categoria);
                                    setNombreNuevaSubcategoriaEditar('');
                                    setCreandoSubcategoriaEditar(false);
                                } catch (error) {
                                    console.log('Error creando subcategoría:', error.message);
                                }
                            }}>Crear</button>
                            <button type="button" onClick={() => setCreandoSubcategoriaEditar(false)}>Cancelar</button>
                        </div>
                    )}
                </>
            )}


            <div className="modal-row">
                <div>
                    <label>Precio</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={precioEditar}
                        onChange={(e) => setPrecioEditar(e.target.value)}
                    />
                </div>
                <div>
                    <label>Talla</label>
                    <input
                        type="text"
                        value={tallaEditar}
                        onChange={(e) => setTallaEditar(e.target.value)}
                    />
                </div>
                <div>
                    <label>Stock</label>
                    <input
                        type="number"
                        value={stockEditar}
                        onChange={(e) => setStockEditar(e.target.value)}
                    />
                </div>
            </div>

                        <label>Marca</label>
            {!creandoMarcaEditar ? (
                <div className="select-con-boton">
                    <select
                        value={marcaEditar}
                        onChange={(e) => setMarcaEditar(e.target.value)}
                    >
                        <option value="">Sin marca</option>
                        {marcas.map((m) => (
                            <option key={m.ID_Marca} value={m.ID_Marca}>
                                {m.Nombre_Marca}
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => setCreandoMarcaEditar(true)}>+ Nueva</button>
                </div>
            ) : (
                <div className="select-con-boton">
                    <input
                        type="text"
                        placeholder="Nombre de la marca"
                        value={nombreNuevaMarcaEditar}
                        onChange={(e) => setNombreNuevaMarcaEditar(e.target.value)}
                    />
                    <button type="button" onClick={async () => {
                        try {
                            const idUser = await obtenerIdUsuario();
                            const nuevoId = Date.now();
                            const nuevaMarca = {
                                ID_Marca: nuevoId,
                                ID_User: idUser,
                                Nombre_Marca: nombreNuevaMarcaEditar,
                                Fecha_Creacion: new Date().toISOString()
                            };
                            await setDoc(doc(db, 'Marca', String(nuevoId)), nuevaMarca);
                            setMarcas((prev) => [...prev, nuevaMarca]);
                            setMarcaEditar(nuevaMarca.ID_Marca);
                            setNombreNuevaMarcaEditar('');
                            setCreandoMarcaEditar(false);
                        } catch (error) {
                            console.log('❌ Error creando marca en Firestore:', error.message);
                        }
                    }}>Crear</button>
                    <button type="button" onClick={() => setCreandoMarcaEditar(false)}>Cancelar</button>
                </div>
            )}

            <label>Fotos del producto</label>
            <div className="fotos-row">
                {/* Fotos ya guardadas en Firestore */}
                {fotosExistentes.map((foto, index) => (
                    <div key={`existente-${foto.ID_Foto}`} className="foto-box">
                        <img src={foto.URL_Foto} alt="producto" className="foto-preview" />
                        <button 
                            type="button" 
                            className="foto-quitar" 
                            onClick={() => quitarFotoExistente(foto.ID_Foto)}
                        >
                            ✕
                        </button>
                        {index === 0 && <span className="foto-principal-label">Principal</span>}
                    </div>
                ))}

                {/* Nuevas fotos pendientes de subir */}
                {previewsNuevasEditar.map((url, index) => (
                    <div key={`nueva-${index}`} className="foto-box">
                        <img src={url} alt="preview" className="foto-preview" />
                        <button 
                            type="button" 
                            className="foto-quitar" 
                            onClick={() => quitarFotoNuevaEditar(index)}
                        >
                            ✕
                        </button>
                    </div>
                ))}

                {/* Botón agregar foto */}
                <label className="foto-box agregar">
                    + Agregar
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={manejarSeleccionFotosEditar}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>

            <button 
                className="btn-guardar" 
                onClick={guardarEdicion}
                disabled={guardandoEdicion}
            >
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
            </button>
        </div>
    </div>
)}

              {/*------------ MODAL: ENTRADA DE STOCK -------------- */}
             {modalAbierto === 'stock' && varianteStock && (
    <div className="modal-overlay">
        <div className="modal-box" style={{ maxWidth: '420px' }} >
            <div className="modal-header">
                <h2>Ajustar stock</h2>
                <button onClick={() => setModalAbierto(null)}>✕</button>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#555', textDecoration: 'underline', marginBottom: '14px' }}>
                {varianteStock?.Productos?.Nombre_Producto || 'Producto'} | Talla {varianteStock?.Talla?.Tipos_Talla?.Nombre_TipoTalla || 'Única'}
            </p>

            <label>Stock Actual</label>
            <p style={{ fontWeight: '600', marginBottom: '10px',color: '#0f0808' }}>
                {varianteStock?.Inventario?.[0]?.Cantidad_Disponible ?? 0} Unidades
            </p>

           

            {/* Selector: Entrada o Salida */}
          <label>Tipo de movimiento</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                    type="button"
                    onClick={() => setTipoMovimiento('entrada')}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        outline: tipoMovimiento === 'entrada' ? '2px solid #0e0d0d' : 'none',
                        fontWeight: '600',
                        backgroundColor: tipoMovimiento === 'entrada' ? '#2e7d32' : '#eee',
                        color: tipoMovimiento === 'entrada' ? 'white' : '#333',
                    }}
                >
                    + Ingresar
                </button>
                <button
                    type="button"
                    onClick={() => setTipoMovimiento('salida')}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        outline: tipoMovimiento === 'salida' ? '2px solid #0e0d0d' : 'none',
                        backgroundColor: tipoMovimiento === 'salida' ? '#a32121' : '#eee',
                        color: tipoMovimiento === 'salida' ? 'white' : '#333',
                    }}
                >
                    - Quitar / Retirar
                </button>
            </div>

            <label>Cantidad a {tipoMovimiento === 'entrada' ? 'ingresar' : 'retirar'}</label>
            <input
                type="number"
                min="1"
                placeholder="0"
                value={cantidadIngresar}
                onChange={(e) => setCantidadIngresar(e.target.value)}
            />
             <label>Talla</label>
                <select
                    value={tipoTallaSeleccionada}
                    onChange={(e) => setTipoTallaSeleccionada(e.target.value)}
                >
                    <option value="" disabled hidden>Selecciona una talla</option>
                    {tallasDisponibles.map((t) => (
                        <option key={t.ID_TipoTalla} value={t.ID_TipoTalla}>
                            {t.Nombre_TipoTalla}
                        </option>
                    ))}
                </select>
                
                {/* Selector de color, si hay colores disponibles para la variante */}
                <label>Color</label>
                <select
                    value={colorSeleccionado}
                    onChange={(e) => setColorSeleccionado(e.target.value)}
                >
                    <option value="">Selecciona un color</option>
                    {coloresDisponibles.map((c) => (
                        <option key={c.ID_Color} value={c.ID_Color}>
                            {c.Nombre_Color}
                        </option>
                    ))}
                </select>

            {/* Opciones según el tipo de movimiento */}
            <label>Motivo</label>
            <select value={motivoStock} onChange={(e) => setMotivoStock(e.target.value)}>
                {tipoMovimiento === 'entrada' ? (
                    <>
                        <option value="Compra a proveedor">Compra a proveedor</option>
                        <option value="Devolución de cliente">Devolución de cliente</option>
                        <option value="Ajuste positivo de inventario">Ajuste de inventario</option>
                    </>
                ) : (
                    <>
                        <option value="Venta en tienda física">Venta en tienda física</option>
                        <option value="Producto dañado / defectuoso">Producto dañado o defectuoso</option>
                        <option value="Pérdida o merma">Pérdida o merma</option>
                        <option value="Ajuste negativo de inventario">Ajuste de inventario</option>
                    </>
                )}
            </select>

            {/* Tarjeta de cálculo en vivo */}
            {(() => {
                const stockActual = varianteStock?.Inventario?.[0]?.Cantidad_Disponible ?? 0;
                const cant = parseInt(cantidadIngresar, 10) || 0;
                const resultante = tipoMovimiento === 'entrada' ? stockActual + cant : stockActual - cant;
                const esInvalido = resultante < 0;

                return (
                    <>
                        <div style={{
                            marginTop: '16px',
                            backgroundColor: esInvalido ? '#f8d7da' : '#e8f5e9',
                            border: `1px solid ${esInvalido ? '#f5c6cb' : '#c8e6c9'}`,
                            color: esInvalido ? '#721c24' : '#1b5e20',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.9rem'
                        }}>
                            <span>Stock resultante:</span>
                            <strong>{resultante} Unidades</strong>
                        </div>

                        <button 
                            className="btn-guardar" 
                            onClick={guardarEntradaStock}
                            disabled={guardandoStock || esInvalido}
                            style={{ marginTop: '16px' }}
                        >
                            {guardandoStock ? 'Guardando...' : 'Confirmar movimiento'}
                        </button>
                    </>
                );
            })()}
        </div>
    </div>
)}

            {/* ---------- MODAL: GESTIÓN DE OFERTAS / DESCUENTOS ---------- */}
            {modalAbierto === 'descuento' && (
                <div className="modal-overlay">
                    <div className="modal-box" style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h2>Gestionar Oferta / Descuento</h2>
                            <button onClick={() => setModalAbierto(null)}>✕</button>
                        </div>

                        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#555' }}>
                            Producto: <strong>{varianteDescuento?.Productos?.Nombre_Producto || `Variante #${varianteDescuento?.ID_Variante}`}</strong>
                            <br />
                            Precio base actual: <strong>${varianteDescuento?.Precio_Actual ?? 0}</strong>
                        </p>

                        <label>Porcentaje de descuento (%)</label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            placeholder="Ej: 20 (para 20% de descuento)"
                            value={porcentajeDescuento}
                            onChange={(e) => setPorcentajeDescuento(e.target.value)}
                        />

                        <label>Fecha y hora de inicio de la oferta</label>
                        <input
                            type="datetime-local"
                            value={fechaInicioOferta}
                            onChange={(e) => setFechaInicioOferta(e.target.value)}
                        />

                        <label>Fecha y hora de finalización de la oferta</label>
                        <input
                            type="datetime-local"
                            value={fechaFinOferta}
                            onChange={(e) => setFechaFinOferta(e.target.value)}
                        />

                        {/* Tarjeta de cálculo en vivo */}
                        {(() => {
                            const precioBase = Number(varianteDescuento?.Precio_Actual ?? 0);
                            const porc = parseFloat(porcentajeDescuento) || 0;
                            const tienePorc = porc > 0 && porc <= 100;
                            const precioFinal = tienePorc ? calcularPrecioConDescuento(precioBase, porc) : precioBase;
                            const ahorro = tienePorc ? Math.round((precioBase - precioFinal) * 100) / 100 : 0;

                            return (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 14px',
                                    backgroundColor: tienePorc ? '#f1f8e9' : '#f5f5f5',
                                    border: `1px solid ${tienePorc ? '#c5e1a5' : '#ddd'}`,
                                    borderRadius: '8px',
                                    fontSize: '0.9rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span>Nuevo precio con oferta:</span>
                                        <strong style={{ color: tienePorc ? '#2e7d32' : '#333', fontSize: '1.05rem' }}>
                                            ${precioFinal.toFixed(2)}
                                        </strong>
                                    </div>
                                    {tienePorc && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#558b2f', fontSize: '0.85rem' }}>
                                            <span>Ahorro del cliente:</span>
                                            <span>${ahorro.toFixed(2)} ({porc}%)</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            {(varianteDescuento?.Porcentaje_Descuento > 0 || varianteDescuento?.Productos?.Porcentaje_Descuento > 0) && (
                                <button
                                    type="button"
                                    onClick={() => guardarDescuento(true)}
                                    disabled={guardandoDescuento}
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#ffebee',
                                        color: '#c62828',
                                        border: '1px solid #ffcdd2',
                                        borderRadius: '6px',
                                        padding: '10px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {guardandoDescuento ? 'Procesando...' : 'Quitar oferta'}
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn-guardar"
                                onClick={() => guardarDescuento(false)}
                                disabled={guardandoDescuento}
                                style={{ flex: 2, marginTop: 0 }}
                            >
                                {guardandoDescuento ? 'Guardando...' : 'Aplicar oferta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
        </div>
    );
}

export default AdminInventario;