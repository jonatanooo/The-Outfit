"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CldUploadWidget } from 'next-cloudinary';
import SidebarAdmin from '@/components/SidebarAdmin.jsx';
import { db, auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    arrayUnion,
    serverTimestamp,
    query,
    where,
    limit
} from 'firebase/firestore';
import { obtenerIdUsuario, verificarAccesoServidor } from '@/lib/usuario';
import { esOfertaActiva, calcularPrecioConDescuento } from '@/lib/descuentos';
import './AdminInventario.css';

// Helpers para indexar y buscar documentos en Firestore por ID flexible (número, string o doc.id)
function esDocPlantilla(d) {
    if (!d) return true;
    if (d.id === '_schema_init' || d.id === '_placeholder') return true;
    const data = typeof d.data === 'function' ? d.data() : d;
    return Boolean(data?._is_schema_template);
}

function indexarColeccion(snap, campoId) {
    const map = {};
    snap.docs.forEach((d) => {
        if (esDocPlantilla(d)) return;
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

// Generador universal de IDs 100% numéricos enteros para colecciones de Firestore
async function generarSiguienteIdNumerico(nombreColeccion, campoId, baseMinima = 1) {
    try {
        const snap = await getDocs(collection(db, nombreColeccion));
        let maxId = baseMinima - 1;
        snap.docs.forEach((d) => {
            if (esDocPlantilla(d)) return;
            const data = d.data();
            const raw = data[campoId] ?? d.id;
            const val = Number(raw);
            if (!isNaN(val) && Number.isInteger(val) && val > maxId && val < 2000000000) {
                maxId = val;
            }
        });
        return maxId + 1;
    } catch (err) {
        console.error(`Error generando ID numérico para ${nombreColeccion}:`, err);
        return Math.max(baseMinima, (Date.now() % 100000000));
    }
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

function ordenarFotosProducto(listaFotos = []) {
    return [...listaFotos].sort((a, b) => {
        if (a.Es_Principal && !b.Es_Principal) return -1;
        if (!a.Es_Principal && b.Es_Principal) return 1;
        const ordenA = a.Orden != null && !isNaN(Number(a.Orden)) ? Number(a.Orden) : 999999;
        const ordenB = b.Orden != null && !isNaN(Number(b.Orden)) ? Number(b.Orden) : 999999;
        return ordenA - ordenB;
    });
}

function IconoCamisa() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8 3l-5 3 2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z" />
    </svg>
  );
}

function extraerCodigoNumericoProducto(p) {
    if (!p) return 10001;
    if (p.Codigo_Producto && !isNaN(Number(p.Codigo_Producto))) {
        return Number(p.Codigo_Producto);
    }
    const pid = p.ID_Producto ?? p.id;
    if (!isNaN(Number(pid)) && /^\d+$/.test(String(pid))) {
        return Number(pid);
    }
    const digits = String(pid).replace(/\D/g, '');
    if (digits.length >= 4) {
        return parseInt(digits.slice(0, 8), 10);
    }
    let hash = 0;
    const str = String(pid);
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash = Math.abs(hash);
    }
    return 10000 + (hash % 89999);
}

function AdminInventario() {
    const router = useRouter();
    const [verificandoAcceso, setVerificandoAcceso] = useState(true);
    // ---------- ESTADOS DE LA TABLA PRINCIPAL ----------
    const [filtroActivo, setFiltroActivo] = useState('todos'); // 'activos' | 'inactivos' | 'bajo' | 'sinstock'
    const [idEstadoInactivo, setIdEstadoInactivo] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [variantes, setVariantes] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [pestana, setPestana] = useState('inventario'); // 'inventario' | 'inactivos' | 'historial'
    const [busquedaInactivos, setBusquedaInactivos] = useState('');
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
    const [categoriaEditar, setCategoriaEditar] = useState('');
    const [subcategoriaEditar, setSubcategoriaEditar] = useState('');
    const [creandoSubcategoriaEditar, setCreandoSubcategoriaEditar] = useState(false);
    const [nombreNuevaSubcategoriaEditar, setNombreNuevaSubcategoriaEditar] = useState('');
    const [fotosExistentes, setFotosExistentes] = useState([]); // Fotos ya en Firestore
    const [fotosNuevasEditar, setFotosNuevasEditar] = useState([]); // Archivos nuevos File
    const [previewsNuevasEditar, setPreviewsNuevasEditar] = useState([]); // Previews locales
    const [fotosAEliminar, setFotosAEliminar] = useState([]); // IDs de fotos marcadas para borrar
    const [principalEsNueva, setPrincipalEsNueva] = useState(false); // Indica si la foto principal elegida en edición es una foto nueva
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    //------ ESTADOS DE MODAL DE INGRESO DE STOCK ----------//
    const [varianteStock, setVarianteStock] = useState(null);
    const tieneTallaAsignadaStock = Boolean(
        !varianteStock?.esProductoBase && (
            varianteStock?.Talla?.Tipos_Talla?.Nombre_TipoTalla ||
            varianteStock?.Talla?.Nombre_TipoTalla ||
            (varianteStock?.ID_Talla != null && varianteStock?.ID_Talla !== '' && varianteStock?.ID_Talla !== 0)
        )
    );
    const [cantidadIngresar, setCantidadIngresar] = useState('');
    const [motivoStock, setMotivoStock] = useState('Compra a proveedor');
    const [motivoPersonalizado, setMotivoPersonalizado] = useState('');
    const [guardandoStock, setGuardandoStock] = useState(false);
    const [tallaStock, setTallaStock] = useState('');
    const [tallasDisponibles, setTallasDisponibles] = useState([]);
    const [tipoTallaSeleccionada, setTipoTallaSeleccionada] = useState('');
    const [coloresDisponibles, setColoresDisponibles] = useState([]);
    const [colorSeleccionado, setColorSeleccionado] = useState('');
    const [dropdownColorAbierto, setDropdownColorAbierto] = useState(false);
    const [creandoColor, setCreandoColor] = useState(false);
    const [nombreNuevoColor, setNombreNuevoColor] = useState('');
    const [hexNuevoColor, setHexNuevoColor] = useState('#000000');
    const [guardandoColor, setGuardandoColor] = useState(false);
    const [colorEditar, setColorEditar] = useState('');
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
            cargarColoresDisponibles();
        }
    }, [modalAbierto]);

    async function cargarMarcas() {
        try {
            const snap = await getDocs(collection(db, 'Marca'));
            const data = snap.docs
                .filter((d) => !esDocPlantilla(d))
                .map((d) => ({
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
            const nuevoId = await generarSiguienteIdNumerico('Marca', 'ID_Marca', 1);
            const nuevaMarca = {
                ID_Marca: nuevoId,
                ID_User: idUser,
                Nombre_Marca: nombreNuevaMarca.trim(),
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
        }
    }, [modalAbierto]);

    async function cargarTallasDisponibles() {
        try {
            const [tallaSnap, tiposSnap] = await Promise.all([
                getDocs(collection(db, 'Talla')),
                getDocs(collection(db, 'Tipos_Talla'))
            ]);

            const tiposMap = {};
            tiposSnap.docs.forEach((d) => {
                if (esDocPlantilla(d)) return;
                const td = d.data();
                const idTipo = td.ID_TipoTalla ?? d.id;
                tiposMap[String(idTipo)] = td.Nombre_TipoTalla;
                tiposMap[String(d.id)] = td.Nombre_TipoTalla;
            });

            const tallasMap = new Map();
            tallaSnap.docs.forEach((d) => {
                if (esDocPlantilla(d)) return;
                const tdata = d.data();
                const rawIdTalla = tdata.ID_Talla ?? d.id;
                const numIdTalla = Number(rawIdTalla);
                if (isNaN(numIdTalla)) return;

                const idTipo = tdata.ID_TipoTalla;
                const nombreTipo = (tiposMap[String(idTipo)] || '').trim().toUpperCase();
                if (nombreTipo && !tallasMap.has(nombreTipo)) {
                    tallasMap.set(nombreTipo, {
                        _docId: d.id,
                        ID_Talla: numIdTalla,
                        ID_TipoTalla: Number(idTipo) || numIdTalla,
                        Nombre_TipoTalla: nombreTipo
                    });
                }
            });

            const listaOrden = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            for (const nom of listaOrden) {
                if (!tallasMap.has(nom)) {
                    const tipoEntry = tiposSnap.docs.find((td) => {
                        if (esDocPlantilla(td)) return false;
                        return (td.data().Nombre_TipoTalla || '').trim().toUpperCase() === nom;
                    });
                    let idTipoNum = tipoEntry ? Number(tipoEntry.data().ID_TipoTalla ?? tipoEntry.id) : null;
                    if (!idTipoNum || isNaN(idTipoNum)) {
                        idTipoNum = await generarSiguienteIdNumerico('Tipos_Talla', 'ID_TipoTalla', 1);
                        await setDoc(doc(db, 'Tipos_Talla', String(idTipoNum)), {
                            ID_TipoTalla: idTipoNum,
                            Nombre_TipoTalla: nom
                        });
                    }
                    const nuevoIdTalla = await generarSiguienteIdNumerico('Talla', 'ID_Talla', 1);
                    const nuevoDocTalla = {
                        ID_Talla: nuevoIdTalla,
                        ID_TipoTalla: idTipoNum
                    };
                    await setDoc(doc(db, 'Talla', String(nuevoIdTalla)), nuevoDocTalla);
                    tallasMap.set(nom, {
                        _docId: String(nuevoIdTalla),
                        ID_Talla: nuevoIdTalla,
                        ID_TipoTalla: idTipoNum,
                        Nombre_TipoTalla: nom
                    });
                }
            }

            const tallasOrdenadas = [];
            listaOrden.forEach((nom) => {
                if (tallasMap.has(nom)) {
                    tallasOrdenadas.push(tallasMap.get(nom));
                }
            });
            tallasMap.forEach((val, key) => {
                if (!listaOrden.includes(key)) {
                    tallasOrdenadas.push(val);
                }
            });

            setTallasDisponibles(tallasOrdenadas);
        } catch (err) {
            console.error('Error al cargar tallas disponibles:', err);
        }
    }

    async function cargarColoresDisponibles() {
        try {
            const snap = await getDocs(collection(db, 'Colores'));
            const data = snap.docs
                .filter((d) => !esDocPlantilla(d))
                .map((d) => {
                    const docData = d.data();
                    const rawId = docData.ID_Color ?? d.id;
                    const numId = Number(rawId);
                    return {
                        _docId: d.id,
                        ID_Color: !isNaN(numId) ? numId : rawId,
                        Nombre_Color: docData.Nombre_Color || 'Sin nombre',
                        Codigo_Hex: docData.Codigo_Hex || '#4b5563',
                        ...docData
                    };
                })
                .filter((c) => c.Nombre_Color && c.Nombre_Color.trim() !== '');

            data.sort((a, b) => (a.Nombre_Color || '').localeCompare(b.Nombre_Color || ''));
            setColoresDisponibles(data);
        } catch (err) {
            console.error('Error al cargar colores disponibles:', err);
        }
    }

    async function crearNuevoColor() {
        if (!nombreNuevoColor.trim()) {
            alert('Por favor ingresa el nombre del nuevo color.');
            return;
        }
        setGuardandoColor(true);
        try {
            const nuevoIdColor = await generarSiguienteIdNumerico('Colores', 'ID_Color', 1);
            const nuevoColor = {
                ID_Color: nuevoIdColor,
                Nombre_Color: nombreNuevoColor.trim(),
                Codigo_Hex: hexNuevoColor.trim() || '#000000',
                Fecha_Creacion: new Date().toISOString()
            };
            await setDoc(doc(db, 'Colores', String(nuevoIdColor)), nuevoColor);
            setColoresDisponibles((prev) => [...prev, nuevoColor]);
            setColorSeleccionado(nuevoIdColor);
            setNombreNuevoColor('');
            setHexNuevoColor('#000000');
            setCreandoColor(false);
        } catch (err) {
            console.error('Error al registrar nuevo color:', err);
            alert('Error al registrar nuevo color: ' + (err?.message || 'Error desconocido'));
        } finally {
            setGuardandoColor(false);
        }
    }

    // ---------- VERIFICACIÓN DE SESIÓN/ROL EN SERVIDOR Y CARGA INICIAL ----------
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.replace('/login');
                return;
            }

            const acceso = await verificarAccesoServidor('admin');
            if (!acceso.autorizado) {
                router.replace('/');
                return;
            }

            setVerificandoAcceso(false);
            cargarVariantes();
        });

        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (verificandoAcceso) return;
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
    }, [verificandoAcceso]);

    const estadoInactivoValor = idEstadoInactivo ?? 2;
    const esVarianteInactiva = (v) =>
        Number(v.ID_EstadoProducto) === Number(estadoInactivoValor) ||
        Number(v.ID_EstadoProducto) === 2;

    const totalProductos = variantes.length;

    const stockBajo = variantes.filter((v) => {
        if (esVarianteInactiva(v)) return false;
        const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
        return stock > 0 && stock < 5;
    }).length;

    const sinStock = variantes.filter((v) => {
        if (esVarianteInactiva(v)) return false;
        const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
        return stock === 0;
    }).length;

    const productosInactivos = variantes.filter((v) => esVarianteInactiva(v)).length;
    const productosActivos = totalProductos - productosInactivos;

    // ---------- Filtro combinado para pestaña de Productos activos ----------
    const filtrados = variantes.filter((v) => {
        if (esVarianteInactiva(v)) return false;

        const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
        const q = busqueda.toLowerCase();
        const nombreProd = (v.Productos?.Nombre_Producto || '').toLowerCase();
        const nombreTalla = (v.Talla?.Tipos_Talla?.Nombre_TipoTalla || '').toLowerCase();
        const nombreMarca = (v.Productos?.Marca?.Nombre_Marca || '').toLowerCase();
        const coincideBusqueda =
            !q ||
            nombreProd.includes(q) ||
            nombreTalla.includes(q) ||
            nombreMarca.includes(q) ||
            String(v.ID_Variante).toLowerCase().includes(q);

        let coincideFiltro = true;
        if (filtroActivo === 'bajo') coincideFiltro = stock > 0 && stock < 5;
        if (filtroActivo === 'sinstock') coincideFiltro = stock === 0;
        if (filtroActivo === 'activos') coincideFiltro = true;

        return coincideBusqueda && coincideFiltro;
    });

    // ---------- Filtro para pestaña de Prendas Desactivadas ----------
    const inactivosFiltrados = variantes.filter((v) => {
        if (!esVarianteInactiva(v)) return false;
        if (!busquedaInactivos.trim()) return true;
        const q = busquedaInactivos.toLowerCase();
        const nombre = (v.Productos?.Nombre_Producto || '').toLowerCase();
        const marca = (v.Productos?.Marca?.Nombre_Marca || '').toLowerCase();
        const talla = (v.Talla?.Tipos_Talla?.Nombre_TipoTalla || '').toLowerCase();
        return nombre.includes(q) || marca.includes(q) || talla.includes(q) || String(v.ID_Variante).includes(q);
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

            const items = auditSnap.docs
                .filter((d) => !esDocPlantilla(d))
                .map((d) => {
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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            cargarAuditoria();
        }
    }, [pestana]);

    // ---------------- ABRIR MODALES ----------------//
    function abrirModalEditar(v) {
        setVarianteEditando(v);
        setNombreEditar(v.Productos?.Nombre_Producto || '');
        setPrecioEditar(v.Precio_Actual ?? v.Productos?.Precio ?? '');
        setMarcaEditar(v.Marca?.ID_Marca ?? v.Productos?.ID_Marca ?? '');
        setColorEditar(v.Productos?.ID_Color ?? v.Colores?.ID_Color ?? '');
        cargarMarcas();
        cargarCategorias();
        cargarColoresDisponibles();
        
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
        const fotos = ordenarFotosProducto(v.Productos?.Fotos_Productos || []);
        setFotosExistentes(fotos);
        setFotosNuevasEditar([]);
        setPreviewsNuevasEditar([]);
        setFotosAEliminar([]);
        setPrincipalEsNueva(false);
        setModalAbierto('editar');
    }

    // Abre el modal para registrar entrada rápida de stock
    function abrirModalStock(v) {
        setVarianteStock(v);
        setCantidadIngresar('');
        const esBase = v.esProductoBase || !v.ID_Talla;
        if (esBase) {
            setTipoTallaSeleccionada('');
        } else {
            const idTallaDir = v.Talla?.ID_Talla || v.ID_Talla || '';
            setTipoTallaSeleccionada(String(idTallaDir));
        }
        setModalAbierto('stock');
        setMotivoStock('Compra a proveedor');
        setMotivoPersonalizado('');
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
            const idAuditoria = doc(collection(db, 'Auditoria_Descuentos')).id;
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
            cargarAuditoria();
            alert(quitar ? 'Descuento eliminado con éxito.' : `¡Oferta del ${numPorcentaje}% aplicada correctamente!`);
        } catch (error) {
            console.error('Error al guardar descuento:', error);
            alert('Hubo un error al guardar la oferta.');
        } finally {
            setGuardandoDescuento(false);
        }
    }

    // Activa o desactiva un producto (variante) y registra en Auditoria_CambioEstado_Producto
    async function alternarEstadoProducto(v) {
        const inactivoAhora = esVarianteInactiva(v);
        const estadoAnterior = Number(v.ID_EstadoProducto ?? (inactivoAhora ? 2 : 1));
        const nuevoEstado = inactivoAhora ? 1 : (idEstadoInactivo ?? 2);

        try {
            // 1. Actualizar el estado de la variante
            await actualizarDocPorId('Variante_Producto', 'ID_Variante', v.ID_Variante, {
                ID_EstadoProducto: nuevoEstado
            });

            // 2. Actualizar el estado del producto padre solo si todas las variantes quedan inactivas, o si se está activando
            if (v.ID_Producto) {
                const hermanas = variantes.filter(
                    (item) =>
                        String(item.ID_Producto) === String(v.ID_Producto) &&
                        String(item.ID_Variante) !== String(v.ID_Variante)
                );
                const algunaHermanaActiva = hermanas.some((h) => !esVarianteInactiva(h));
                const estadoProductoPadre = nuevoEstado === 1 ? 1 : (algunaHermanaActiva ? 1 : nuevoEstado);

                await actualizarDocPorId('Productos', 'ID_Producto', v.ID_Producto, {
                    ID_EstadoProducto: estadoProductoPadre
                });
            }

            // 3. Registrar en Auditoria_CambioEstado_Producto
            try {
                const idUserAccion = await obtenerIdUsuario();
                const idAuditEstado = doc(collection(db, 'Auditoria_CambioEstado_Producto')).id;
                await setDoc(doc(db, 'Auditoria_CambioEstado_Producto', idAuditEstado), {
                    ID_Auditoria: idAuditEstado,
                    ID_Producto: v.ID_Producto ?? null,
                    ID_Variante: v.ID_Variante,
                    ID_UserAccion: idUserAccion,
                    ID_EstadoAnterior: estadoAnterior,
                    ID_EstadoNuevo: nuevoEstado,
                    Fecha: new Date().toISOString()
                });
            } catch (errAudit) {
                console.error('Error guardando Auditoria_CambioEstado_Producto:', errAudit);
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

    // Subida de nuevas fotos con Cloudinary (<CldUploadWidget>) dentro del modal de edición
    async function manejarSubidaCloudinaryEditar(result) {
        const secureUrl = result?.info?.secure_url;
        if (!secureUrl) return;

        setFotosNuevasEditar((prev) => [...prev, secureUrl]);
        setPreviewsNuevasEditar((prev) => [...prev, secureUrl]);

        const idProducto = varianteEditando?.Productos?.ID_Producto ?? varianteEditando?.ID_Producto;
        try {
            if (idProducto) {
                await setDoc(
                    doc(db, 'products', String(idProducto)),
                    {
                        ID_Producto: idProducto,
                        name: nombreEditar || varianteEditando?.Productos?.Nombre_Producto || '',
                        imageUrl: secureUrl,
                        images: arrayUnion(secureUrl),
                        updatedAt: serverTimestamp()
                    },
                    { merge: true }
                );
            } else {
                await addDoc(collection(db, 'products'), {
                    imageUrl: secureUrl,
                    images: [secureUrl],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
        } catch (err) {
            console.error('Error guardando URL de Cloudinary en colección products:', err);
        }
    }

    // Marca una foto existente para borrarla al guardar cambios
    function quitarFotoExistente(idFoto) {
        setFotosAEliminar((prev) => [...prev, idFoto]);
        setFotosExistentes((prev) => prev.filter((f) => f.ID_Foto !== idFoto));
    }

    // Descarta una foto recién seleccionada en el modal de edición
    function quitarFotoNuevaEditar(index) {
        setFotosNuevasEditar((prev) => {
            const nuevas = prev.filter((_, i) => i !== index);
            if (nuevas.length === 0) setPrincipalEsNueva(false);
            return nuevas;
        });
        setPreviewsNuevasEditar((prev) => prev.filter((_, i) => i !== index));
    }

    // Marca una foto ya existente como principal en el modal de edición y la aplica en Firestore de inmediato
    async function marcarExistenteComoPrincipal(indice) {
        setPrincipalEsNueva(false);
        const copia = [...fotosExistentes];
        if (indice > 0 && indice < copia.length) {
            const [fotoElegida] = copia.splice(indice, 1);
            copia.unshift(fotoElegida);
        }
        const actualizadas = copia.map((f, i) => ({
            ...f,
            Orden: i,
            Es_Principal: i === 0
        }));
        setFotosExistentes(actualizadas);

        const idProducto = varianteEditando?.Productos?.ID_Producto ?? varianteEditando?.ID_Producto;
        const urlPrincipal = actualizadas[0]?.URL_Foto || null;

        // Actualizar estado local de variantes inmediatamente
        if (idProducto != null) {
            setVariantes((prev) =>
                prev.map((v) =>
                    String(v.ID_Producto) === String(idProducto) && v.Productos
                        ? {
                              ...v,
                              Productos: {
                                  ...v.Productos,
                                  Imagen_Principal: urlPrincipal,
                                  Fotos_Productos: actualizadas
                              }
                          }
                        : v
                )
            );
        }

        // Persistir de inmediato en Firestore para que se aplique al instante en carruseles y listados
        try {
            await Promise.all([
                ...actualizadas.map((foto, i) => {
                    const campos = { Orden: i, Es_Principal: i === 0 };
                    if (foto._docId) {
                        return updateDoc(doc(db, 'Fotos_Productos', String(foto._docId)), campos);
                    }
                    return actualizarDocPorId('Fotos_Productos', 'ID_Foto', foto.ID_Foto, campos);
                }),
                ...(idProducto && urlPrincipal
                    ? [actualizarDocPorId('Productos', 'ID_Producto', idProducto, { Imagen_Principal: urlPrincipal })]
                    : [])
            ]);
        } catch (err) {
            console.error('Error aplicando foto principal en Firestore:', err);
        }
    }

    // Marca una foto recién agregada como principal en el modal de edición
    function marcarNuevaEditarComoPrincipal(indice) {
        setPrincipalEsNueva(true);
        if (indice === 0) return;
        setFotosNuevasEditar((prev) => {
            const copia = [...prev];
            const [archivoElegido] = copia.splice(indice, 1);
            return [archivoElegido, ...copia];
        });
        setPreviewsNuevasEditar((prev) => {
            const copia = [...prev];
            const [previewElegida] = copia.splice(indice, 1);
            return [previewElegida, ...copia];
        });
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
        setGuardandoEdicion(true);

        const idProducto = varianteEditando.Productos?.ID_Producto ?? varianteEditando.ID_Producto;
        const idVariante = varianteEditando.ID_Variante;
        const idTipoTalla = varianteEditando.Talla?.Tipos_Talla?.ID_TipoTalla;
        const categoriaAnterior = varianteEditando.Productos?.ID_Categoria ?? varianteEditando.Productos?.ID_categoria ?? null;
        const precioAnterior = Number(varianteEditando.Precio_Actual ?? 0);

        try {
            const idUserAudit = (await obtenerIdUsuario()) || auth.currentUser?.uid || 'Admin';

            // 1. Actualiza el nombre, marca, categoría, precio y color del producto
            if (idProducto) {
                const idCatUpdate = subcategoriaEditar ? subcategoriaEditar : (categoriaEditar || null);
                const idCatFinal = idCatUpdate ? (Number(idCatUpdate) || idCatUpdate) : null;
                const nuevoPrecioNum = parseFloat(precioEditar);
                const datosUpdateProd = {
                    Nombre_Producto: nombreEditar,
                    ID_Marca: marcaEditar ? (Number(marcaEditar) || marcaEditar) : null,
                    ID_Categoria: idCatFinal
                };
                if (!isNaN(nuevoPrecioNum)) {
                    datosUpdateProd.Precio = nuevoPrecioNum;
                }
                if (colorEditar) {
                    datosUpdateProd.ID_Color = Number(colorEditar) || colorEditar;
                }
                await actualizarDocPorId('Productos', 'ID_Producto', idProducto, datosUpdateProd);

                // Si se cambió el color, heredar a todas las variantes del producto
                if (colorEditar) {
                    try {
                        const qVarsProd = query(
                            collection(db, 'Variante_Producto'),
                            where('ID_Producto', 'in', [idProducto, Number(idProducto), String(idProducto)])
                        );
                        const snapVarsProd = await getDocs(qVarsProd);
                        for (const vd of snapVarsProd.docs) {
                            if (!esDocPlantilla(vd)) {
                                await updateDoc(vd.ref, { ID_Color: Number(colorEditar) || colorEditar });
                            }
                        }
                    } catch (errColorHer) {
                        console.error('Error heredando color a variantes:', errColorHer);
                    }
                }

                // Registrar en Auditoria_CambioCategoria si cambió la categoría
                if (idCatFinal != null && String(idCatFinal) !== String(categoriaAnterior ?? '')) {
                    try {
                        const idAuditCat = await generarSiguienteIdNumerico('Auditoria_CambioCategoria', 'ID_Auditoria', 1);
                        await setDoc(doc(db, 'Auditoria_CambioCategoria', String(idAuditCat)), {
                            ID_Auditoria: idAuditCat,
                            ID_Producto: idProducto,
                            ID_UserAccion: idUserAudit,
                            ID_CategoriaAntigua: categoriaAnterior,
                            ID_CategoriaNueva: idCatFinal,
                            Fecha_Registro: new Date().toISOString()
                        });
                    } catch (errCatAudit) {
                        console.error('Error guardando Auditoria_CambioCategoria:', errCatAudit);
                    }
                }
            }

            // 2. Actualiza el precio actual (Variante_Producto) y registra en Auditoria_Precio_Variante si cambió
            if (idVariante) {
                const nuevoPrecioNum = parseFloat(precioEditar);
                await actualizarDocPorId('Variante_Producto', 'ID_Variante', idVariante, {
                    Precio_Actual: nuevoPrecioNum
                });

                if (!isNaN(nuevoPrecioNum) && Number(nuevoPrecioNum) !== Number(precioAnterior)) {
                    try {
                        const idAuditPrecio = await generarSiguienteIdNumerico('Auditoria_Precio_Variante', 'ID_Auditoria', 1);
                        await setDoc(doc(db, 'Auditoria_Precio_Variante', String(idAuditPrecio)), {
                            ID_Auditoria: idAuditPrecio,
                            ID_Variante: idVariante,
                            ID_UserAccion: idUserAudit,
                            Precio_Anterior: precioAnterior,
                            Precio_Nuevo: nuevoPrecioNum,
                            Fecha: new Date().toISOString()
                        });
                    } catch (errPrecioAudit) {
                        console.error('Error guardando Auditoria_Precio_Variante:', errPrecioAudit);
                    }
                }
            }

            // 3. Elimina de la BD las fotos que el usuario quitó
            if (fotosAEliminar.length > 0) {
                for (const idFoto of fotosAEliminar) {
                    await eliminarDocPorId('Fotos_Productos', 'ID_Foto', idFoto);
                }
            }

            const usarNuevaComoPrincipal = principalEsNueva && fotosNuevasEditar.length > 0;

            // 6. Actualiza el Orden y Es_Principal de las fotos existentes en Firestore
            if (fotosExistentes.length > 0) {
                await Promise.all(
                    fotosExistentes.map(async (foto, i) => {
                        const nuevoOrden = usarNuevaComoPrincipal ? fotosNuevasEditar.length + i : i;
                        const esPrincipal = !usarNuevaComoPrincipal && i === 0;
                        const camposFoto = {
                            Orden: nuevoOrden,
                            Es_Principal: esPrincipal
                        };
                        try {
                            if (foto._docId) {
                                await updateDoc(doc(db, 'Fotos_Productos', String(foto._docId)), camposFoto);
                            } else {
                                await actualizarDocPorId('Fotos_Productos', 'ID_Foto', foto.ID_Foto, camposFoto);
                            }
                        } catch (errOrden) {
                            console.error('Error actualizando orden de foto:', errOrden);
                        }
                    })
                );
            }

            // 7. Registra las nuevas fotos subidas con Cloudinary en Firestore con IDs numéricos
            let urlNuevaPrincipal = null;
            if (fotosNuevasEditar.length > 0) {
                if (!idProducto) {
                    alert("Error: No se encontró el ID_Producto para asociar la foto.");
                    return;
                }

                const idUser = await obtenerIdUsuario();
                const ordenBase = usarNuevaComoPrincipal ? 0 : fotosExistentes.length;
                const baseFotoId = await generarSiguienteIdNumerico('Fotos_Productos', 'ID_Foto', 1);

                await Promise.all(
                    fotosNuevasEditar.map(async (secureUrl, i) => {
                        try {
                            const idFoto = baseFotoId + i;
                            const ordenFoto = ordenBase + i;
                            const esPrincipal = (usarNuevaComoPrincipal && i === 0) || (fotosExistentes.length === 0 && i === 0);
                            if (esPrincipal) urlNuevaPrincipal = secureUrl;

                            await setDoc(doc(db, 'Fotos_Productos', String(idFoto)), {
                                ID_Foto: idFoto,
                                ID_Producto: Number(idProducto),
                                ID_User: idUser,
                                URL_Foto: secureUrl,
                                Orden: ordenFoto,
                                Es_Principal: esPrincipal,
                                Fecha_Carga: new Date().toISOString()
                            });
                        } catch (errorFirestore) {
                            console.error('Error guardando foto en edición:', errorFirestore);
                        }
                    })
                );
            }

            // 8. Sincronizar Imagen_Principal en Productos y en la colección products de Firestore
            const urlPrincipalFinal = usarNuevaComoPrincipal
                ? urlNuevaPrincipal
                : (fotosExistentes[0]?.URL_Foto || urlNuevaPrincipal || null);
            if (idProducto && urlPrincipalFinal) {
                await actualizarDocPorId('Productos', 'ID_Producto', idProducto, {
                    Imagen_Principal: urlPrincipalFinal
                });
                await setDoc(
                    doc(db, 'products', String(idProducto)),
                    {
                        ID_Producto: idProducto,
                        name: nombreEditar,
                        price: parseFloat(precioEditar) || 0,
                        imageUrl: urlPrincipalFinal,
                        images: [
                            ...fotosExistentes.map((f) => f.URL_Foto),
                            ...fotosNuevasEditar
                        ].filter(Boolean),
                        updatedAt: serverTimestamp()
                    },
                    { merge: true }
                );
            }

            setModalAbierto(null);
            cargarVariantes();
            cargarAuditoria();
        } catch (err) {
            console.error('Error general en guardarEdicion:', err);
            alert('Error al procesar la edición');
        } finally {
            setGuardandoEdicion(false);
        }
    }

    // -------------- GUARDAR ENTRADA DE STOCK (POR TALLA) --------------//
    async function guardarEntradaStock() {
        const cant = parseInt(cantidadIngresar, 10) || 0;
        if (cant <= 0) {
            alert('Por favor ingresa una cantidad válida mayor a 0.');
            return;
        }
        if (!tipoTallaSeleccionada) {
            alert('Por favor selecciona la talla a la que deseas ingresar o retirar stock.');
            return;
        }
        if (motivoStock === 'Otro' && !motivoPersonalizado.trim()) {
            alert('Por favor escribe la razón o motivo del movimiento.');
            return;
        }

        setGuardandoStock(true);
        try {
            // REGLA 1: Independencia absoluta del Producto Base (CERO eliminaciones)
            // El Producto Base padre (Productos) queda intacto como entidad independiente.
            const idProductoPadre = Number(varianteStock.ID_Producto ?? varianteStock.Productos?.ID_Producto);
            if (!idProductoPadre || isNaN(idProductoPadre)) {
                alert('Error: No se encontró el ID numérico del Producto Base padre.');
                return;
            }

            // REGLA 2: Códigos 100% Numéricos
            const idProdNumerico = idProductoPadre;

            // Leer el ID numérico de la talla directamente de la tabla Talla
            const tallaDoc = tallasDisponibles.find(
                (t) => String(t.ID_Talla) === String(tipoTallaSeleccionada) || String(t.ID_TipoTalla) === String(tipoTallaSeleccionada)
            );
            const idTallaNumerico = Number(tallaDoc?.ID_Talla ?? tipoTallaSeleccionada);
            if (isNaN(idTallaNumerico) || idTallaNumerico <= 0) {
                alert('Error: Por favor selecciona una talla válida.');
                return;
            }

            // Concatenar código numérico del Producto Base + ID numérico de la tabla Talla como número entero puro
            const skuNumerico = parseInt(`${idProdNumerico}${idTallaNumerico}`, 10);
            if (isNaN(skuNumerico)) {
                alert('Error: No se pudo generar el SKU numérico.');
                return;
            }

            // El color se hereda exclusivamente del Producto Base padre (sin selector en este modal)
            const idColorPadre = varianteStock.Productos?.ID_Color ?? varianteStock.ID_Color ?? null;
            const idColorFinal = idColorPadre != null && !isNaN(Number(idColorPadre)) ? Number(idColorPadre) : null;

            // REGLAS 3 & 4: Integridad Estricta y Verificación de Flujo de Entrada de Stock
            // Consultar si ya existe este código numérico de variante para este producto
            const qVar = query(
                collection(db, 'Variante_Producto'),
                where('ID_Producto', 'in', [
                    idProductoPadre,
                    Number(idProductoPadre),
                    String(idProductoPadre)
                ])
            );
            const snapVar = await getDocs(qVar);
            let varExistente = null;

            for (const d of snapVar.docs) {
                if (esDocPlantilla(d)) continue;
                const vd = d.data();
                const vid = vd.ID_Variante ?? d.id;

                const coincideSku = Number(vid) === skuNumerico || String(vid) === String(skuNumerico);
                const coincideTalla = vd.ID_Talla != null && Number(vd.ID_Talla) === idTallaNumerico;

                if (coincideSku || coincideTalla) {
                    varExistente = { ...vd, ID_Variante: Number(vid) || vid, _docId: d.id };
                    break;
                }
            }

            let idVarianteFinal = skuNumerico;
            let idInventarioObjetivo = null;
            let stockAnteriorAudit = 0;
            let nuevoStock = 0;

            if (varExistente) {
                // Caso A: Ya existe la variante -> La talla es inmutable.
                // Sumar (o restar) la cantidad al stock existente en Inventario.
                idVarianteFinal = Number(varExistente.ID_Variante) || skuNumerico;

                const qInv = query(
                    collection(db, 'Inventario'),
                    where('ID_Variante', 'in', [
                        idVarianteFinal,
                        Number(idVarianteFinal),
                        String(idVarianteFinal),
                        skuNumerico
                    ])
                );
                const snapInv = await getDocs(qInv);
                const docsInv = snapInv.docs.filter((idDoc) => !esDocPlantilla(idDoc));

                if (docsInv.length > 0) {
                    const invDoc = docsInv[0];
                    idInventarioObjetivo = invDoc.data().ID_Inventario ?? invDoc.id;
                    stockAnteriorAudit = Number(invDoc.data().Cantidad_Disponible ?? 0);
                    nuevoStock = tipoMovimiento === 'entrada'
                        ? stockAnteriorAudit + cant
                        : Math.max(0, stockAnteriorAudit - cant);

                    await actualizarDocPorId('Inventario', 'ID_Inventario', idInventarioObjetivo, {
                        Cantidad_Disponible: nuevoStock,
                        Fecha_Actualizacion: new Date().toISOString()
                    });
                } else {
                    const nuevoInvId = await generarSiguienteIdNumerico('Inventario', 'ID_Inventario', 1);
                    stockAnteriorAudit = 0;
                    nuevoStock = tipoMovimiento === 'entrada' ? cant : 0;
                    await setDoc(doc(db, 'Inventario', String(nuevoInvId)), {
                        ID_Inventario: nuevoInvId,
                        ID_Variante: idVarianteFinal,
                        Cantidad_Disponible: nuevoStock,
                        Cantidad_Reservada: 0,
                        Fecha_Actualizacion: new Date().toISOString()
                    });
                    idInventarioObjetivo = nuevoInvId;
                }
            } else {
                // Caso B: NO existe la variante -> INSERT estricto del nuevo registro hijo vinculado al padre y a la talla
                // CERO eliminaciones: El registro del Producto Base jamás se elimina ni se sobreescribe.
                const idDocVariante = String(skuNumerico);

                const nuevaVariante = {
                    ID_Variante: skuNumerico,
                    ID_Producto: idProductoPadre, // Llave foránea hacia el producto base
                    ID_Talla: idTallaNumerico,
                    ID_TipoTalla: tallaDoc?.ID_TipoTalla ? Number(tallaDoc.ID_TipoTalla) : idTallaNumerico,
                    ID_Color: idColorFinal,
                    Precio_Actual: Number(varianteStock.Precio_Actual) || Number(varianteStock.Productos?.Precio) || 0,
                    ID_EstadoProducto: 1,
                    Fecha_Creacion: new Date().toISOString(),
                    ...(varianteStock.Tiene_Descuento ? {
                        Porcentaje_Descuento: varianteStock.Porcentaje_Descuento,
                        Precio_Oferta: varianteStock.Precio_Oferta,
                        Fecha_Inicio_Oferta: varianteStock.Fecha_Inicio_Oferta ?? null,
                        Fecha_Fin_Oferta: varianteStock.Fecha_Fin_Oferta ?? null,
                        Tiene_Descuento: true
                    } : {})
                };

                // INSERT estricto en Variante_Producto con el SKU numérico entero
                await setDoc(doc(db, 'Variante_Producto', idDocVariante), nuevaVariante);
                idVarianteFinal = skuNumerico;

                // INSERT estricto en Inventario con ID_Inventario entero puro
                const nuevoInvId = await generarSiguienteIdNumerico('Inventario', 'ID_Inventario', 1);
                stockAnteriorAudit = 0;
                nuevoStock = tipoMovimiento === 'entrada' ? cant : 0;
                await setDoc(doc(db, 'Inventario', String(nuevoInvId)), {
                    ID_Inventario: nuevoInvId,
                    ID_Variante: skuNumerico,
                    Cantidad_Disponible: nuevoStock,
                    Cantidad_Reservada: 0,
                    Fecha_Actualizacion: new Date().toISOString()
                });
                idInventarioObjetivo = nuevoInvId;
            }

            // Registrar en Auditoria_Inventario con ID_Auditoria numérico entero
            try {
                const idUserAccion = (await obtenerIdUsuario()) || auth.currentUser?.uid || 'Admin';
                const nuevoAuditId = await generarSiguienteIdNumerico('Auditoria_Inventario', 'ID_Auditoria', 1);
                const motivoFinal = motivoStock === 'Otro'
                    ? (motivoPersonalizado.trim() || 'Otro (sin especificar)')
                    : (motivoStock || (tipoMovimiento === 'entrada' ? 'Compra a proveedor' : 'Ajuste de inventario'));

                await setDoc(doc(db, 'Auditoria_Inventario', String(nuevoAuditId)), {
                    ID_Auditoria: nuevoAuditId,
                    ID_Variante: idVarianteFinal,
                    ID_UserAccion: idUserAccion,
                    Cantidad_Anterior: stockAnteriorAudit,
                    Cantidad_Nueva: nuevoStock,
                    Tipo_Movimiento: tipoMovimiento === 'entrada' ? 'Ingreso' : 'Salida',
                    Motivo: motivoFinal,
                    Fecha_Accion: new Date().toISOString()
                });
            } catch (err) {
                console.error('No se pudo guardar la auditoría:', err);
            }

            setModalAbierto(null);
            setMotivoPersonalizado('');
            await cargarVariantes();
            cargarAuditoria();
        } catch (err) {
            console.error('Error en guardarEntradaStock:', err);
            alert('Error al registrar movimiento de stock: ' + (err?.message || 'Error desconocido'));
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
                coloresSnap,
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
                if (esDocPlantilla(d)) return;
                const t = d.data();
                const tid = t.ID_Talla ?? d.id;
                const item = {
                    ...t,
                    ID_Talla: tid,
                    _docId: d.id,
                    Tipos_Talla: tiposTallaMap[t.ID_TipoTalla] || tiposTallaMap[String(t.ID_TipoTalla)] || null
                };
                tallaMap[tid] = item;
                tallaMap[String(tid)] = item;
                if (!isNaN(Number(tid))) tallaMap[Number(tid)] = item;
                tallaMap[d.id] = item;
            });

            const fotosPorProducto = {};
            fotosSnap.docs.forEach((d) => {
                if (esDocPlantilla(d)) return;
                const f = d.data();
                const pid = f.ID_Producto;
                if (pid != null) {
                    const k = String(pid);
                    if (!fotosPorProducto[k]) fotosPorProducto[k] = [];
                    fotosPorProducto[k].push({
                        ...f,
                        ID_Foto: f.ID_Foto ?? d.id,
                        _docId: d.id
                    });
                }
            });

            const invPorVariante = {};
            invSnap.docs.forEach((d) => {
                if (esDocPlantilla(d)) return;
                const inv = d.data();
                const vid = inv.ID_Variante ?? d.id;
                if (vid != null) {
                    const cantDisp = Number(inv.Cantidad_Disponible ?? 0);
                    const itemInv = {
                        ...inv,
                        ID_Inventario: inv.ID_Inventario ?? d.id,
                        ID_Variante: vid,
                        Cantidad_Disponible: isNaN(cantDisp) ? 0 : cantDisp,
                        _docId: d.id,
                    };
                    const k = String(vid);
                    if (!invPorVariante[k]) invPorVariante[k] = [];
                    invPorVariante[k].push(itemInv);
                    if (!isNaN(Number(vid)) && !invPorVariante[Number(vid)]) {
                        invPorVariante[Number(vid)] = invPorVariante[k];
                    }
                }
            });

            const prodMap = {};
            const productosValidos = [];
            prodSnap.docs.forEach((d) => {
                if (esDocPlantilla(d)) return;
                const p = d.data();
                const pid = p.ID_Producto ?? d.id;
                const fotos = ordenarFotosProducto(
                    fotosPorProducto[String(pid)] || fotosPorProducto[String(d.id)] || []
                );
                const colorObj = coloresMap[p.ID_Color] || coloresMap[String(p.ID_Color)] || null;
                const item = {
                    ...p,
                    ID_Producto: pid,
                    _docId: d.id,
                    Nombre_Producto: p.Nombre_Producto || '',
                    Descripcion: p.Descripcion || '',
                    ID_Categoria: p.ID_Categoria ?? p.ID_categoria ?? null,
                    Marca: marcasMap[p.ID_Marca] || marcasMap[String(p.ID_Marca)] || null,
                    Categorias_Producto: catMap[p.ID_Categoria ?? p.ID_categoria] || null,
                    Fotos_Productos: fotos,
                    Colores: colorObj
                };
                prodMap[pid] = item;
                prodMap[String(pid)] = item;
                if (!isNaN(Number(pid))) prodMap[Number(pid)] = item;
                prodMap[d.id] = item;
                productosValidos.push(item);
            });

            // Agrupar variantes por producto
            const variantesPorProducto = {};
            varSnap.docs.forEach((d) => {
                if (esDocPlantilla(d)) return;
                const v = d.data();
                const vid = v.ID_Variante ?? d.id;
                const pid = v.ID_Producto;
                if (pid == null) return;
                const k = String(pid);
                if (!variantesPorProducto[k]) variantesPorProducto[k] = [];

                let tallaObj = tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || null;
                if (!tallaObj && v.ID_TipoTalla != null && tiposTallaMap[v.ID_TipoTalla]) {
                    tallaObj = {
                        ID_Talla: v.ID_Talla,
                        ID_TipoTalla: v.ID_TipoTalla,
                        Tipos_Talla: tiposTallaMap[v.ID_TipoTalla]
                    };
                }

                const rawInvList = invPorVariante[String(vid)] || invPorVariante[vid] || [];
                const totalStock = rawInvList.reduce(
                    (sum, item) => sum + Number(item.Cantidad_Disponible ?? 0),
                    0
                );
                const invList = rawInvList.length > 0
                    ? [{ ...rawInvList[0], Cantidad_Disponible: totalStock }]
                    : [{ ID_Inventario: null, Cantidad_Disponible: 0 }];

                const parentProd = prodMap[String(pid)];
                const colorObj = coloresMap[v.ID_Color ?? parentProd?.ID_Color] ||
                    coloresMap[String(v.ID_Color ?? parentProd?.ID_Color)] || null;

                variantesPorProducto[k].push({
                    ...v,
                    _docId: d.id,
                    esProductoBase: false,
                    ID_Variante: vid,
                    ID_Producto: pid,
                    Precio_Actual: v.Precio_Actual ?? parentProd?.Precio ?? 0,
                    ID_EstadoProducto: v.ID_EstadoProducto ?? parentProd?.ID_EstadoProducto ?? 1,
                    Productos: parentProd,
                    Talla: tallaObj,
                    ID_Talla: v.ID_Talla,
                    ID_TipoTalla: v.ID_TipoTalla ?? tallaObj?.ID_TipoTalla ?? null,
                    Inventario: invList,
                    Colores: colorObj
                });
            });

            // Ensamblar la lista con Producto Base (Modelo Base) + Variantes hijas con talla
            const ordenTallas = { XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6 };
            const listaCompleta = [];

            // Ordenar alfabéticamente por nombre de producto
            productosValidos.sort((a, b) => {
                const na = (a.Nombre_Producto || '').toLowerCase();
                const nb = (b.Nombre_Producto || '').toLowerCase();
                return na.localeCompare(nb);
            });

            productosValidos.forEach((p) => {
                const k = String(p.ID_Producto);

                // 1. Fila de Producto Base (Modelo Base) - SIEMPRE presente, no se borra ni se oculta
                const filaBase = {
                    esProductoBase: true,
                    _docId: p._docId,
                    ID_Variante: p.ID_Producto,
                    ID_Producto: p.ID_Producto,
                    Precio_Actual: p.Precio || 0,
                    ID_EstadoProducto: p.ID_EstadoProducto ?? 1,
                    Productos: p,
                    Talla: null,
                    ID_Talla: null,
                    Inventario: [{ ID_Inventario: null, Cantidad_Disponible: null }],
                    Colores: p.Colores
                };
                listaCompleta.push(filaBase);

                // 2. Variantes con talla del producto
                const hijas = (variantesPorProducto[k] || []).filter(
                    (v) => v.ID_Talla != null && v.ID_Talla !== '' && v.ID_Talla !== 0
                );

                hijas.sort((a, b) => {
                    const ta = (a.Talla?.Tipos_Talla?.Nombre_TipoTalla || a.Talla?.Nombre_TipoTalla || '').toUpperCase();
                    const tb = (b.Talla?.Tipos_Talla?.Nombre_TipoTalla || b.Talla?.Nombre_TipoTalla || '').toUpperCase();
                    const pa = ordenTallas[ta] || 99;
                    const pb = ordenTallas[tb] || 99;
                    if (pa !== pb) return pa - pb;
                    return Number(a.ID_Variante) - Number(b.ID_Variante);
                });

                hijas.forEach((vh) => {
                    listaCompleta.push({
                        ...vh,
                        Productos: p
                    });
                });
            });

            setVariantes(listaCompleta);
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
            const nuevoId = await generarSiguienteIdNumerico('Categorias_Producto', 'ID_categoria', 100);
            const nuevaCat = {
                ID_categoria: nuevoId,
                ID_User: idUser,
                Nombre_Categoria: nombreNuevaCategoria.trim(),
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
            const nuevoId = await generarSiguienteIdNumerico('Categorias_Producto', 'ID_categoria', 100);
            const nuevaSub = {
                ID_categoria: nuevoId,
                ID_User: idUser,
                Nombre_Categoria: nombreNuevaSubcategoria.trim(),
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

    // ---------- MANEJO DE FOTOS CON CLOUDINARY + FIREBASE FIRESTORE ----------
    async function manejarSubidaCloudinaryAgregar(result) {
        const secureUrl = result?.info?.secure_url;
        if (!secureUrl) return;

        setFotosSeleccionadas((prev) => [...prev, secureUrl]);
        setPreviews((prev) => [...prev, secureUrl]);

        try {
            await addDoc(collection(db, 'products'), {
                name: nombreProducto || 'Producto en creación',
                imageUrl: secureUrl,
                images: [secureUrl],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } catch (err) {
            console.error('Error guardando URL de Cloudinary en colección products:', err);
        }
    }

    function quitarFoto(index) {
        setFotosSeleccionadas((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    }

    // ---------------- GUARDAR FOTOS DE CLOUDINARY EN FIRESTORE -----------------//
    async function subirFotos(idProducto, urlsCloudinary = fotosSeleccionadas) {
        if (!urlsCloudinary || urlsCloudinary.length === 0) return;

        const idUser = await obtenerIdUsuario();
        const urlPrincipal = urlsCloudinary[0] || null;
        const baseFotoId = await generarSiguienteIdNumerico('Fotos_Productos', 'ID_Foto', 1);

        await Promise.all(
            urlsCloudinary.map(async (secureUrl, i) => {
                try {
                    const idFoto = baseFotoId + i;
                    await setDoc(doc(db, 'Fotos_Productos', String(idFoto)), {
                        ID_Foto: idFoto,
                        ID_Producto: Number(idProducto),
                        ID_User: idUser,
                        URL_Foto: secureUrl,
                        Orden: i,
                        Es_Principal: i === 0,
                        Fecha_Carga: new Date().toISOString()
                    });

                    console.log(`✅ Foto ${i} registrada en Firestore:`, secureUrl);
                } catch (errorSubida) {
                    console.error('❌ Error guardando foto en Firestore:', errorSubida);
                }
            })
        );

        if (idProducto && urlPrincipal) {
            await actualizarDocPorId('Productos', 'ID_Producto', idProducto, {
                Imagen_Principal: urlPrincipal
            });

            await setDoc(
                doc(db, 'products', String(idProducto)),
                {
                    ID_Producto: Number(idProducto),
                    name: nombreProducto,
                    description: descripcionProducto,
                    price: parseFloat(precioProducto) || 0,
                    imageUrl: urlPrincipal,
                    images: urlsCloudinary,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );
        }
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
        setMarcaSeleccionada('');
        setColorSeleccionado('');
        setNombreNuevoColor('');
        setHexNuevoColor('#000000');
        setCreandoColor(false);
        setDropdownColorAbierto(false);
        setFotosSeleccionadas([]);
        setPreviews([]);
    }

    // ---------- GUARDAR EL PRODUCTO COMPLETO (PRODUCTO BASE 100% NUMÉRICO) ----------
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

        if (!colorSeleccionado) {
            alert('Por favor selecciona un color para el Producto Base.');
            return;
        }

        setGuardandoProducto(true);

        try {
            // 1. Obtener siguiente código numérico secuencial garantizando ID_Producto 100% entero
            const idProducto = await generarSiguienteIdNumerico('Productos', 'ID_Producto', 10001);
            const nuevoCodigoNumerico = idProducto;

            // 2. Crear registro del Producto Base en la colección Productos (con su ID_Color)
            const nuevoProducto = {
                ID_Producto: idProducto,
                Codigo_Producto: nuevoCodigoNumerico,
                Nombre_Producto: nombreProducto.trim(),
                Descripcion: descripcionProducto.trim(),
                Precio: parseFloat(precioProducto) || 0,
                ID_Categoria: Number(idCategoriaFinal) || idCategoriaFinal,
                ID_Marca: marcaSeleccionada ? (Number(marcaSeleccionada) || marcaSeleccionada) : null,
                ID_Color: Number(colorSeleccionado) || colorSeleccionado,
                ID_EstadoProducto: 1,
                Fecha_Creacion: new Date().toISOString()
            };

            await setDoc(doc(db, 'Productos', String(idProducto)), nuevoProducto);

            // 3. Subir fotos en paralelo con IDs numéricos
            if (fotosSeleccionadas.length > 0) {
                await subirFotos(idProducto, fotosSeleccionadas);
            }

            // 4. Cerrar modal y limpiar formulario
            setModalAbierto(null);
            limpiarFormulario();

            // 5. Actualizar catálogo e inventario
            await cargarVariantes();
        } catch (err) {
            console.error('Error general en guardarProductoNuevo:', err);
            alert('Error al guardar el producto: ' + (err?.message || 'Error desconocido'));
        } finally {
            setGuardandoProducto(false);
        }
    }

    if (verificandoAcceso) {
        return null;
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
                        Productos ({productosActivos})
                    </button>
                    <button 
                        className={`admin-tab-btn ${pestana === 'inactivos' ? 'activo' : ''}`}
                        onClick={() => setPestana('inactivos')}
                    >
                        Prendas desactivadas ({productosInactivos})
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
                                className="stat-card"
                                onClick={() => setPestana('inactivos')}
                                title="Ir a la pestaña de prendas desactivadas"
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
                                const estaInactivo = esVarianteInactiva(v);
                                const esBase = v.esProductoBase || !v.ID_Talla;
    
                                return (
                                    <tr 
                                        key={`${v.ID_Producto}_${v.ID_Variante}_${esBase ? 'base' : 'var'}`} 
                                        className={`fila-tabla-inventario ${esBase ? 'fila-modelo-base' : 'fila-variante-talla'} ${estaInactivo ? 'fila-inactiva' : ''}`}
                                        style={{ opacity: estaInactivo ? 0.45 : 1 }}
                                    >
                                        <td><strong>{v.ID_Variante}</strong></td>
                                        <td>
                                            <span>{v.Productos?.Nombre_Producto || '—'}</span>
                                            {estaInactivo && (
                                                <span style={{ fontSize: '0.75rem', color: '#777', marginLeft: '6px' }}>
                                                    (Inactivo)
                                                </span>
                                            )}
                                        </td>

                                        <td>
                                            {(esOfertaActiva(v) || esOfertaActiva(v.Productos)) ? (
                                                <div>
                                                    <span style={{ textDecoration: 'line-through', color: '#888', fontSize: '0.85em' }}>
                                                        ${Number(v.Precio_Actual).toFixed(2)}
                                                    </span>{' '}
                                                    <strong style={{ color: '#d32f2f' }}>
                                                        ${calcularPrecioConDescuento(Number(v.Precio_Actual), Number(v.Porcentaje_Descuento || v.Productos?.Porcentaje_Descuento || 0)).toFixed(2)}
                                                    </strong>
                                                    <span className="badge-descuento-admin" title="Oferta activa" style={{ marginLeft: '4px' }}>
                                                        -{v.Porcentaje_Descuento || v.Productos?.Porcentaje_Descuento}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span>${Number(v.Precio_Actual || 0).toFixed(2)}</span>
                                            )}
                                        </td>
                                        
                                        <td>
                                            {esBase ? (
                                                <span className="stock-modelo-base" title="Plantilla de catálogo maestro. El stock físico vive en sus variantes por talla.">
                                                    N/A (Catálogo)
                                                </span>
                                            ) : (
                                                <span className={stock === 0 ? 'sin-stock' : stock < 5 ? 'stock-bajo' : ''}>
                                                    <strong>{stock}</strong> <span style={{ fontSize: '0.78rem', color: '#666' }}>uds.</span>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {esBase ? (
                                                <span className="badge-modelo-base">
                                                    Modelo Base
                                                </span>
                                            ) : (
                                                <span className="badge-talla-normal">
                                                    {v.Talla?.Tipos_Talla?.Nombre_TipoTalla || v.Talla?.Nombre_TipoTalla || `Talla #${v.ID_Talla}`}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {v.Colores ? (
                                                <div className="color-celda-tabla">
                                                    <span 
                                                        className="color-dot-tabla" 
                                                        style={{ backgroundColor: v.Colores.Codigo_Hex || '#666' }} 
                                                        title={v.Colores.Nombre_Color}
                                                    />
                                                    <span>{v.Colores.Nombre_Color}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#999' }}>—</span>
                                            )}
                                        </td>
                                        <td>{v.Productos?.Marca?.Nombre_Marca || '—'}</td>
                                        
                                        <td>
                                            <div className="acciones-tabla-wrap">
                                                <button 
                                                    type="button" 
                                                    title={esBase ? "Registrar entrada de stock para este modelo base" : "Ajustar stock de esta variante"} 
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
                                                    title="Desactivar producto (mover a Prendas desactivadas)" 
                                                    onClick={() => alternarEstadoProducto(v)}
                                                    className="btn-accion-tabla"
                                                >
                                                    <span className="icono-estado-tabla">❌</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        
                            {filtrados.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', color: '#777', padding: '36px' }}>
                                        No hay productos activos que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
                </>
                ) : pestana === 'inactivos' ? (
                    <>
                        {/* Tarjetas resumen en la pestaña de Prendas desactivadas */}
                        <div className="stats-row">
                            <div className="stat-card stat-card-activa">
                                <p className="stat-titulo">Prendas desactivadas</p>
                                <p className="stat-valor" style={{ color: 'orange' }}>{productosInactivos}</p>
                            </div>
                            <div
                                className="stat-card"
                                onClick={() => setPestana('inventario')}
                                title="Volver a productos activos"
                            >
                                <p className="stat-titulo">Productos activos</p>
                                <p className="stat-valor" style={{ color: 'green' }}>{productosActivos}</p>
                            </div>
                        </div>

                        <input
                            className="buscador"
                            placeholder="Buscar prenda desactivada por nombre, marca, talla o ID..."
                            value={busquedaInactivos}
                            onChange={(e) => setBusquedaInactivos(e.target.value)}
                        />

                        {cargando ? (
                            <p>Cargando prendas desactivadas...</p>
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
                                    {inactivosFiltrados.map((v) => {
                                        const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
                                        const esBase = v.esProductoBase || !v.ID_Talla;

                                        return (
                                            <tr 
                                                key={`${v.ID_Producto}_${v.ID_Variante}_inactivo_${esBase ? 'base' : 'var'}`}
                                                className={`fila-tabla-inventario ${esBase ? 'fila-modelo-base' : 'fila-variante-talla'} fila-inactiva`}
                                            >
                                                <td><strong>{v.ID_Variante}</strong></td>
                                                <td>
                                                    <span>{v.Productos?.Nombre_Producto || '—'}</span>
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        backgroundColor: '#fff3e0',
                                                        color: '#e65100',
                                                        border: '1px solid #ffcc80',
                                                        borderRadius: '4px',
                                                        padding: '2px 6px',
                                                        marginLeft: '8px',
                                                        fontWeight: 600
                                                    }}>
                                                        Desactivada
                                                    </span>
                                                </td>
                                                <td>
                                                    {(esOfertaActiva(v) || esOfertaActiva(v.Productos)) ? (
                                                        <div>
                                                            <span style={{ textDecoration: 'line-through', color: '#888', fontSize: '0.85em' }}>
                                                                ${Number(v.Precio_Actual).toFixed(2)}
                                                            </span>{' '}
                                                            <strong style={{ color: '#d32f2f' }}>
                                                                ${calcularPrecioConDescuento(Number(v.Precio_Actual), Number(v.Porcentaje_Descuento || v.Productos?.Porcentaje_Descuento || 0)).toFixed(2)}
                                                            </strong>
                                                        </div>
                                                    ) : (
                                                        <span>${Number(v.Precio_Actual || 0).toFixed(2)}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {esBase ? (
                                                        <span className="stock-modelo-base" title="Plantilla de catálogo maestro. El stock físico vive en sus variantes por talla.">
                                                            N/A (Catálogo)
                                                        </span>
                                                    ) : (
                                                        <span className={stock === 0 ? 'sin-stock' : stock < 5 ? 'stock-bajo' : ''}>
                                                            <strong>{stock}</strong> <span style={{ fontSize: '0.78rem', color: '#666' }}>uds.</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {esBase ? (
                                                        <span className="badge-modelo-base">
                                                            Modelo Base
                                                        </span>
                                                    ) : (
                                                        <span className="badge-talla-normal">
                                                            {v.Talla?.Tipos_Talla?.Nombre_TipoTalla || v.Talla?.Nombre_TipoTalla || `Talla #${v.ID_Talla}`}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {v.Colores ? (
                                                        <div className="color-celda-tabla">
                                                            <span 
                                                                className="color-dot-tabla" 
                                                                style={{ backgroundColor: v.Colores.Codigo_Hex || '#666' }} 
                                                                title={v.Colores.Nombre_Color}
                                                            />
                                                            <span>{v.Colores.Nombre_Color}</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#999' }}>—</span>
                                                    )}
                                                </td>
                                                <td>{v.Productos?.Marca?.Nombre_Marca || '—'}</td>
                                                <td>
                                                    <div className="acciones-tabla-wrap">
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
                                                            title="Volver a activar prenda"
                                                            onClick={() => alternarEstadoProducto(v)}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                backgroundColor: '#2e7d32',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                padding: '6px 12px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            <span>👁️</span> Activar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {inactivosFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', color: '#777', padding: '36px' }}>
                                                No hay prendas desactivadas en este momento.
                                            </td>
                                        </tr>
                                    )}
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

                        {/* Selector de Color del Producto Base con bolita visual y modal rápido para agregar colores */}
                        <label>Color del Producto Base</label>
                        {creandoColor && (
                            <div className="box-nuevo-color">
                                <div className="box-nuevo-color-header">
                                    <span>+ Registrar Nuevo Color</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setCreandoColor(false)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#666' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="box-nuevo-color-body">
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <input
                                            type="text"
                                            placeholder="Nombre del color (Ej: Azul Marino)"
                                            value={nombreNuevoColor}
                                            onChange={(e) => setNombreNuevoColor(e.target.value)}
                                            style={{ width: '100%', padding: '7px 10px', fontSize: '0.88rem', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="color"
                                            value={hexNuevoColor}
                                            onChange={(e) => setHexNuevoColor(e.target.value)}
                                            className="input-color-picker"
                                            title="Seleccionar tonalidad exacta"
                                        />
                                        <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#475569' }}>{hexNuevoColor}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '6px' }}>
                                        <button
                                            type="button"
                                            onClick={crearNuevoColor}
                                            disabled={guardandoColor}
                                            style={{
                                                padding: '6px 14px',
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontWeight: 600,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {guardandoColor ? 'Guardando...' : 'Guardar Color'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreandoColor(false);
                                                setNombreNuevoColor('');
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#e2e8f0',
                                                color: '#334155',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontWeight: 600,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="selector-color-con-boton">
                            <div className="selector-color-custom-wrap">
                                <div 
                                    className="selector-color-trigger"
                                    onClick={() => setDropdownColorAbierto(!dropdownColorAbierto)}
                                    type="button"
                                >
                                    {(() => {
                                        const colorObj = coloresDisponibles.find((c) => String(c.ID_Color) === String(colorSeleccionado));
                                        if (colorObj) {
                                            return (
                                                <div className="selector-color-opcion-item">
                                                    <span 
                                                        className="color-dot-preview" 
                                                        style={{ backgroundColor: colorObj.Codigo_Hex || '#666' }} 
                                                    />
                                                    <span style={{ fontWeight: 600 }}>{colorObj.Nombre_Color}</span>
                                                </div>
                                            );
                                        }
                                        return <span style={{ color: '#888' }}>Selecciona un color...</span>;
                                    })()}
                                    <span style={{ fontSize: '0.75rem', color: '#666' }}>▼</span>
                                </div>

                                {dropdownColorAbierto && (
                                    <div className="selector-color-menu">
                                        {coloresDisponibles.map((c) => (
                                            <div
                                                key={c.ID_Color}
                                                className={`selector-color-option ${String(colorSeleccionado) === String(c.ID_Color) ? 'seleccionado' : ''}`}
                                                onClick={() => {
                                                    setColorSeleccionado(c.ID_Color);
                                                    setDropdownColorAbierto(false);
                                                }}
                                            >
                                                <span 
                                                    className="color-dot-preview" 
                                                    style={{ backgroundColor: c.Codigo_Hex || '#666' }} 
                                                />
                                                <span>{c.Nombre_Color}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button 
                                type="button" 
                                className="btn-nuevo-color"
                                onClick={() => {
                                    setCreandoColor(true);
                                    setDropdownColorAbierto(false);
                                }}
                            >
                                + Nuevo Color
                            </button>
                        </div>

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
                           
                            <CldUploadWidget
                                uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                                onSuccess={manejarSubidaCloudinaryAgregar}
                            >
                                {({ open }) => (
                                    <button
                                        type="button"
                                        className="foto-box agregar"
                                        onClick={() => open()}
                                    >
                                        + Agregar
                                    </button>
                                )}
                            </CldUploadWidget>
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
                                    const nuevoId = await generarSiguienteIdNumerico('Categorias_Producto', 'ID_categoria', 100);
                                    const data = {
                                        ID_categoria: nuevoId,
                                        ID_User: idUser,
                                        Nombre_Categoria: nombreNuevaSubcategoriaEditar.trim(),
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


            <label>Precio</label>
            <input
                type="number"
                step="0.01"
                min="0"
                value={precioEditar}
                onChange={(e) => setPrecioEditar(e.target.value)}
            />

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
                            const nuevoId = await generarSiguienteIdNumerico('Marca', 'ID_Marca', 1);
                            const nuevaMarca = {
                                ID_Marca: nuevoId,
                                ID_User: idUser,
                                Nombre_Marca: nombreNuevaMarcaEditar.trim(),
                                Fecha_Creacion: new Date().toISOString()
                            };
                            await setDoc(doc(db, 'Marca', String(nuevoId)), nuevaMarca);
                            setMarcas((prev) => [...prev, nuevaMarca]);
                            setMarcaEditar(nuevoId);
                            setNombreNuevaMarcaEditar('');
                            setCreandoMarcaEditar(false);
                        } catch (error) {
                            console.log('Error creando marca:', error.message);
                        }
                    }}>Crear</button>
                    <button type="button" onClick={() => setCreandoMarcaEditar(false)}>Cancelar</button>
                </div>
            )}

            <label>Color del Producto</label>
            <div className="select-con-boton">
                <select
                    value={colorEditar}
                    onChange={(e) => setColorEditar(e.target.value)}
                >
                    <option value="">Sin color asignado</option>
                    {coloresDisponibles.map((c) => (
                        <option key={c.ID_Color} value={c.ID_Color}>
                            {c.Nombre_Color}
                        </option>
                    ))}
                </select>
            </div>

            <label>Fotos del producto</label>
            <div className="fotos-row">
                {/* Fotos ya guardadas en Firestore */}
                {fotosExistentes.map((foto, index) => {
                    const esPrincipal = (!principalEsNueva || previewsNuevasEditar.length === 0) && index === 0;
                    return (
                        <div
                            key={`existente-${foto._docId ?? foto.ID_Foto ?? index}`}
                            className="foto-box"
                            onClick={() => marcarExistenteComoPrincipal(index)}
                            title={esPrincipal ? "Foto principal" : "Haz clic para hacerla principal"}
                        >
                            <img src={foto.URL_Foto} alt="producto" className="foto-preview" />
                            <button 
                                type="button" 
                                className="foto-quitar" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    quitarFotoExistente(foto.ID_Foto);
                                }}
                            >
                                ✕
                            </button>
                            {esPrincipal && <span className="foto-principal-label">Principal</span>}
                        </div>
                    );
                })}

                {/* Nuevas fotos pendientes de subir */}
                {previewsNuevasEditar.map((url, index) => {
                    const esPrincipal = (principalEsNueva || fotosExistentes.length === 0) && index === 0;
                    return (
                        <div
                            key={`nueva-${index}`}
                            className="foto-box"
                            onClick={() => marcarNuevaEditarComoPrincipal(index)}
                            title={esPrincipal ? "Foto principal" : "Haz clic para hacerla principal"}
                        >
                            <img src={url} alt="preview" className="foto-preview" />
                            <button 
                                type="button" 
                                className="foto-quitar" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    quitarFotoNuevaEditar(index);
                                }}
                            >
                                ✕
                            </button>
                            {esPrincipal && <span className="foto-principal-label">Principal</span>}
                        </div>
                    );
                })}

                {/* Botón agregar foto con Cloudinary */}
                <CldUploadWidget
                    uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                    onSuccess={manejarSubidaCloudinaryEditar}
                >
                    {({ open }) => (
                        <button
                            type="button"
                            className="foto-box agregar"
                            onClick={() => open()}
                        >
                            + Agregar
                        </button>
                    )}
                </CldUploadWidget>
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
        <div className="modal-box" style={{ maxWidth: '440px' }} >
            <div className="modal-header">
                <h2>Ajustar stock (Entradas y Salidas)</h2>
                <button onClick={() => setModalAbierto(null)}>✕</button>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '8px' }}>
                <strong>{varianteStock?.Productos?.Nombre_Producto || 'Producto'}</strong> | {tieneTallaAsignadaStock ? (
                    <span>Talla asignada: <strong>{varianteStock?.Talla?.Tipos_Talla?.Nombre_TipoTalla || `Talla #${varianteStock?.ID_Talla}`}</strong></span>
                ) : (
                    <span style={{ color: '#4f46e5', fontWeight: 600 }}>Modelo Base (Selecciona la talla abajo)</span>
                )}
            </p>

            {varianteStock?.Colores && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Color del Modelo Base:</span>
                    <span className="color-dot-tabla" style={{ backgroundColor: varianteStock.Colores.Codigo_Hex || '#666' }} />
                    <strong style={{ color: '#1e293b' }}>{varianteStock.Colores.Nombre_Color}</strong>
                </div>
            )}

            {/* Resumen de todas las tallas registradas de esta prenda y su stock actual */}
            {(() => {
                const variantesMismaPrenda = variantes.filter(
                    (item) =>
                        String(item.ID_Producto) === String(varianteStock?.ID_Producto) &&
                        item.Talla?.Tipos_Talla?.Nombre_TipoTalla
                );
                return (
                    <div style={{
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        marginBottom: '12px',
                        fontSize: '0.82rem'
                    }}>
                        <strong style={{ display: 'block', marginBottom: '6px', color: '#222' }}>
                            Stock actual por talla de esta prenda:
                        </strong>
                        {variantesMismaPrenda.length > 0 ? (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {variantesMismaPrenda.map((vp) => {
                                    const nomTalla = vp.Talla?.Tipos_Talla?.Nombre_TipoTalla;
                                    const cantTalla = vp.Inventario?.[0]?.Cantidad_Disponible ?? 0;
                                    const idTallaItem = vp.ID_Talla ?? vp.Talla?.ID_Talla;
                                    const seleccionada = String(idTallaItem) === String(tipoTallaSeleccionada);
                                    return (
                                        <span
                                            key={vp.ID_Variante}
                                            onClick={() => {
                                                if (!tieneTallaAsignadaStock && idTallaItem) {
                                                    setTipoTallaSeleccionada(idTallaItem);
                                                }
                                            }}
                                            style={{
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                cursor: tieneTallaAsignadaStock ? 'not-allowed' : 'pointer',
                                                backgroundColor: seleccionada ? '#111' : '#fff',
                                                color: seleccionada ? '#fff' : '#111',
                                                border: '1px solid #bbb',
                                                fontWeight: 600,
                                                opacity: tieneTallaAsignadaStock && !seleccionada ? 0.6 : 1
                                            }}
                                            title={tieneTallaAsignadaStock ? `Talla fija de esta variante (${nomTalla})` : `ID Variante: ${vp.ID_Variante} | ID Talla: ${idTallaItem}`}
                                        >
                                            {nomTalla} (ID: {vp.ID_Variante}): {cantTalla} uds.
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <span style={{ color: '#777' }}>
                                Sin tallas ingresadas aún. Selecciona una talla abajo para hacer el primer ingreso.
                            </span>
                        )}
                    </div>
                );
            })()}

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
             <label>
                 Talla {tieneTallaAsignadaStock && (
                     <span style={{ color: '#666', fontWeight: 'normal', fontSize: '0.85rem' }}>
                         (Asignada a esta variante - Bloqueada)
                     </span>
                 )}
             </label>
             <select
                 value={tipoTallaSeleccionada}
                 onChange={(e) => setTipoTallaSeleccionada(e.target.value)}
                 disabled={tieneTallaAsignadaStock}
                 style={{
                     backgroundColor: tieneTallaAsignadaStock ? '#f3f4f6' : '#ffffff',
                     cursor: tieneTallaAsignadaStock ? 'not-allowed' : 'pointer',
                     color: tieneTallaAsignadaStock ? '#555555' : 'inherit',
                     borderColor: tieneTallaAsignadaStock ? '#d1d5db' : undefined
                 }}
             >
                 <option value="" disabled hidden>Selecciona una talla</option>
                 {tallasDisponibles.map((t) => (
                     <option key={t.ID_Talla} value={t.ID_Talla}>
                         {t.Nombre_TipoTalla}
                     </option>
                 ))}
             </select>

            {/* Opciones según el tipo de movimiento */}
            <label>Motivo</label>
            <select
                value={motivoStock}
                onChange={(e) => {
                    setMotivoStock(e.target.value);
                    if (e.target.value !== 'Otro') {
                        setMotivoPersonalizado('');
                    }
                }}
            >
                {tipoMovimiento === 'entrada' ? (
                    <>
                        <option value="Compra a proveedor">Compra a proveedor</option>
                        <option value="Devolución de cliente">Devolución de cliente</option>
                        <option value="Ajuste positivo de inventario">Ajuste de inventario</option>
                        <option value="Otro">Otro</option>
                    </>
                ) : (
                    <>
                        <option value="Venta en tienda física">Venta en tienda física</option>
                        <option value="Producto dañado / defectuoso">Producto dañado o defectuoso</option>
                        <option value="Pérdida o merma">Pérdida o merma</option>
                        <option value="Ajuste negativo de inventario">Ajuste de inventario</option>
                        <option value="Otro">Otro</option>
                    </>
                )}
            </select>

            {motivoStock === 'Otro' && (
                <div style={{ marginTop: '10px' }}>
                    <label>Escribe la razón / motivo</label>
                    <input
                        type="text"
                        placeholder="Escribe la razón aquí..."
                        value={motivoPersonalizado}
                        onChange={(e) => setMotivoPersonalizado(e.target.value)}
                        autoFocus
                    />
                </div>
            )}

            {/* Tarjeta de cálculo en vivo según la talla seleccionada */}
            {(() => {
                const varianteTallaElegida = variantes.find(
                    (item) =>
                        String(item.ID_Producto) === String(varianteStock?.ID_Producto) &&
                        (String(item.ID_Talla ?? item.Talla?.ID_Talla ?? '') === String(tipoTallaSeleccionada ?? '') ||
                         String(item.Talla?.Tipos_Talla?.ID_TipoTalla ?? '') === String(tipoTallaSeleccionada ?? ''))
                );
                const stockBaseTalla = tipoTallaSeleccionada
                    ? Number(varianteTallaElegida?.Inventario?.[0]?.Cantidad_Disponible ?? 0)
                    : Number(varianteStock?.Inventario?.[0]?.Cantidad_Disponible ?? 0);
                const nombreTallaElegida =
                    tallasDisponibles.find((t) => String(t.ID_Talla) === String(tipoTallaSeleccionada) || String(t.ID_TipoTalla) === String(tipoTallaSeleccionada))?.Nombre_TipoTalla ||
                    varianteStock?.Talla?.Tipos_Talla?.Nombre_TipoTalla ||
                    'Sin seleccionar';
                const cant = parseInt(cantidadIngresar, 10) || 0;
                const resultante = tipoMovimiento === 'entrada' ? stockBaseTalla + cant : stockBaseTalla - cant;
                const stockNegativo = resultante < 0;
                const faltaMotivoOtro = motivoStock === 'Otro' && !motivoPersonalizado.trim();
                const botonDeshabilitado = guardandoStock || stockNegativo || cant <= 0 || !tipoTallaSeleccionada || faltaMotivoOtro;

                return (
                    <>
                        <div style={{
                            marginTop: '16px',
                            backgroundColor: stockNegativo ? '#f8d7da' : '#e8f5e9',
                            border: `1px solid ${stockNegativo ? '#f5c6cb' : '#c8e6c9'}`,
                            color: stockNegativo ? '#721c24' : '#1b5e20',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.9rem'
                        }}>
                            <span>
                                Stock resultante ({nombreTallaElegida}, actual: {stockBaseTalla}):
                            </span>
                            <strong>{resultante} Unidades</strong>
                        </div>

                        <button 
                            className="btn-guardar" 
                            onClick={guardarEntradaStock}
                            disabled={botonDeshabilitado}
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