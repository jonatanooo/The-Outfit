"use client";

import { useState, useEffect } from 'react';
import SidebarAdmin from '@/components/SidebarAdmin.jsx';
import { supabase } from '@/lib/supabaseClient';
import './AdminInventario.css';

function AdminInventario() {
    // ---------- ESTADOS DE LA TABLA PRINCIPAL ----------
    const [busqueda, setBusqueda] = useState('');
    const [variantes, setVariantes] = useState([]);
    const [cargando, setCargando] = useState(true);

    // ---------- ESTADOS DEL MODAL -- null | 'agregar' | 'editar' | 'stock' ----------
    const [modalAbierto, setModalAbierto] = useState(null); 
    const [tipoMovimiento, setTipoMovimiento] = useState('entrada');

    // ---------- ESTADOS DEL FORMULARIO "AGREGAR PRODUCTO" ----------
    const [nombreProducto, setNombreProducto] = useState('');
    const [descripcionProducto, setDescripcionProducto] = useState('');
    const [precioProducto, setPrecioProducto] = useState('');
    const [tallaProducto, setTallaProducto] = useState('');
    const [stockProducto, setStockProducto] = useState('');

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
    const [precioEditar, setPrecioEditar] = useState('');
    const [tallaEditar, setTallaEditar] = useState('');
    const [stockEditar, setStockEditar] = useState('');
    const [fotosExistentes, setFotosExistentes] = useState([]); // Fotos ya en Supabase
    const [fotosNuevasEditar, setFotosNuevasEditar] = useState([]); // Archivos nuevos File
    const [previewsNuevasEditar, setPreviewsNuevasEditar] = useState([]); // Previews locales
    const [fotosAEliminar, setFotosAEliminar] = useState([]); // IDs de fotos marcadas para borrar
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    //------ ESTADOS DE MODAL DE INGRESO DE STOCK ----------//
    const [varianteStock, setVarianteStock] = useState(null);
    const [cantidadIngresar, setCantidadIngresar] = useState('');
    const [motivoStock, setMotivoStock] = useState('Compra a proveedor');
    const [guardandoStock, setGuardandoStock] = useState(false);

    // ---------- CARGA INICIAL DE PRODUCTOS ----------
    useEffect(() => {
        cargarVariantes();
    }, []);


    // ---------------- ABRIR MODALES ----------------//
    function abrirModalEditar(v) {
    setVarianteEditando(v);
    setNombreEditar(v.Productos?.Nombre_Producto || '');
    setPrecioEditar(v.Precio_Actual || '');
    setTallaEditar(v.Talla?.Tipos_Talla?.Nombre_TipoTalla || '');
    setStockEditar(v.Inventario?.[0]?.Cantidad_Disponible ?? 0);
    
    // Carga las fotos que ya existen en la base de datos
    const fotos = (v.Productos?.Fotos_Productos || []).sort((a, b) => (a.Orden ?? 0) - (b.Orden ?? 0));
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
     setTipoMovimiento('entrada'); 
     setMotivoStock('Compra a proveedor');
     setModalAbierto('stock');
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


//-----------OPERACIONES EN LA BASE DE DATOS (CRUD)----------//

// ---------- GUARDAR EDICION DE VARIANTE ----------//
    async function guardarEdicion() {
    if (!varianteEditando) return;
    setGuardandoEdicion(true);

    const idProducto = varianteEditando.Productos?.ID_Producto;
    const idVariante = varianteEditando.ID_Variante;
    const idInventario = varianteEditando.Inventario?.[0]?.ID_Inventario;
    const idTipoTalla = varianteEditando.Talla?.Tipos_Talla?.ID_TipoTalla;

    console.log("Iniciando guardado de edición...", {
        idProducto,
        fotosNuevasCount: fotosNuevasEditar.length,
        fotosNuevasEditar
    });

    try {
        // 1. Actualiza el nombre del producto
        if (idProducto) {
            await supabase
                .from('Productos')
                .update({ Nombre_Producto: nombreEditar })
                .eq('ID_Producto', idProducto);
        }
        // 2. Actualiza el precio actual
        await supabase
            .from('Variante Producto')
            .update({ Precio_Actual: parseFloat(precioEditar) })
            .eq('ID_Variante', idVariante);
        
        // 3. Actualiza el nombre de la talla
        if (idTipoTalla) {
            await supabase
                .from('Tipos_Talla')
                .update({ Nombre_TipoTalla: tallaEditar })
                .eq('ID_TipoTalla', idTipoTalla);
        }
        // 4. Actualiza la cantidad de stock disponible
        if (idInventario) {
            await supabase
                .from('Inventario')
                .update({ 
                    Cantidad_Disponible: parseInt(stockEditar, 10),
                    Fecha_Actualizacion: new Date().toISOString()
                })
                .eq('ID_Inventario', idInventario);
        }

        // 5. Elimina de la BD las fotos que el usuario quitó
        if (fotosAEliminar.length > 0) {
            await supabase
                .from('Fotos_Productos')
                .delete()
                .in('ID_Foto', fotosAEliminar);
        }

        // 6. Sube y registra nuevas fotos añadidas durante la ediciónl
        if (fotosNuevasEditar.length > 0) {
            if (!idProducto) {
                alert("Error: No se encontró el ID_Producto para asociar la foto.");
                return;
            }

            const idUser = await obtenerIdUsuario();
            let ordenBase = fotosExistentes.length;

            for (let i = 0; i < fotosNuevasEditar.length; i++) {
                const archivo = fotosNuevasEditar[i];
                const extension = archivo.name.split('.').pop();
                const nombreArchivo = `${idProducto}_${Date.now()}_${i}.${extension}`;

                // Subir a Storage
                const { error: errorStorage } = await supabase.storage
                    .from('fotos-productos')
                    .upload(nombreArchivo, archivo);

                if (errorStorage) {
                    console.error('Error Storage:', errorStorage);
                    alert(`Error subiendo imagen al Storage: ${errorStorage.message}`);
                    continue;
                }

                // Obtener URL pública
                const { data: urlData } = supabase.storage
                    .from('fotos-productos')
                    .getPublicUrl(nombreArchivo);

                // Registro en la tabla de fotos
                const { error: errorTabla } = await supabase
                    .from('Fotos_Productos')
                    .insert({
                        ID_Producto: idProducto,
                        ID_User: idUser,
                        URL_Foto: urlData.publicUrl,
                        Orden: ordenBase + i,
                        Fecha_Carga: new Date().toISOString()
                    });

                if (errorTabla) {
                    console.error('Error Tabla Fotos_Productos:', errorTabla);
                    alert(`Error guardando en Fotos_Productos: ${errorTabla.message}`);
                }
            }
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

            // Registra una entrada de mercancía sumándola al stock actual
            async function guardarEntradaStock() {
                    const cantidad = parseInt(cantidadIngresar, 10);
            if (!cantidad || cantidad <= 0) {
                alert('Ingresa una cantidad válida mayor a 0');
                return;
            }

            const idInventario = varianteStock?.Inventario?.[0]?.ID_Inventario;
            if (!idInventario) {
                alert('No se encontró el registro de inventario.');
                return;
            }

            const stockActual = varianteStock.Inventario?.[0]?.Cantidad_Disponible ?? 0;

            // Calcular según si es entrada o salida
            const nuevoStock = tipoMovimiento === 'entrada' 
                ? stockActual + cantidad 
                : stockActual - cantidad;

            // Validación para no permitir inventario negativo
            if (nuevoStock < 0) {
                alert(`No puedes retirar más de ${stockActual} unidades disponibles.`);
                return;
            }

            setGuardandoStock(true);

            const { error } = await supabase
                .from('Inventario')
                .update({
                    Cantidad_Disponible: nuevoStock,
                    Fecha_Actualizacion: new Date().toISOString()
                })
                .eq('ID_Inventario', idInventario);

            setGuardandoStock(false);

            if (error) {
                alert('Error al actualizar inventario: ' + error.message);
            } else {
                setModalAbierto(null);
                cargarVariantes();
            }
}
     // ---------- GUARDAR ENTRADA DE ESTADO DEL PRODUCTO ------------//

        // Alterna el estado activo / inactivo de un producto
        async function alternarEstadoProducto(variante) {
            // Si el estado actual es 1 (activo), lo pasamos a 2 (inactivo), o viceversa
            const estadoActual = variante.ID_EstadoProducto ?? 1;
            const nuevoEstado = estadoActual === 1 ? 2 : 1;
            const accion = nuevoEstado === 2 ? 'desactivar' : 'activar';

            const confirmar = confirm(`¿Estás seguro de que deseas ${accion} este producto?`);
            if (!confirmar) return;

            // 1. Actualiza el estado de la variante
            const { error: errorVariante } = await supabase
                .from('Variante Producto')
                .update({ ID_EstadoProducto: nuevoEstado })
                .eq('ID_Variante', variante.ID_Variante);

            // Actualiza el estado en el producto principal
            if (variante.ID_Producto) {
                await supabase
                    .from('Productos')
                    .update({ ID_EstadoProducto: nuevoEstado })
                    .eq('ID_Producto', variante.ID_Producto);
            }

            if (errorVariante) {
                alert('Error al cambiar el estado: ' + errorVariante.message);
            } else {
                cargarVariantes(); // Refresca la tabla automáticamente
            }
        }

        // Consulta la lista principal de variantes y sus relaciones
         async function cargarVariantes() {
             setCargando(true);
              const { data, error } = await supabase
            .from('Variante Producto')
            .select(`
               ID_Variante,
            ID_Producto,
            Precio_Actual,
            ID_EstadoProducto,
            Productos ( 
                ID_Producto, 
                Nombre_Producto, 
                Descripcion,
                ID_EstadoProducto,
                Fotos_Productos ( ID_Foto, URL_Foto, Orden )
            ),
            Talla ( ID_Talla, Tipos_Talla ( ID_TipoTalla, Nombre_TipoTalla ) ),
            Inventario ( ID_Inventario, Cantidad_Disponible )
            `);

        if (error) {
            console.log('❌ Error al cargar variantes:', error.message);
        } else {
            console.log('✅ Variantes recibidas:', data);
            setVariantes(data);
        }
        setCargando(false);
    }

    // ---------- CARGA DE CATEGORIAS AL ABRIR EL MODAL ----------
    useEffect(() => {
        if (modalAbierto === 'agregar') {
            cargarCategorias();
        }
    }, [modalAbierto]);

    // Carga las categorías principales (sin categoría padre)
    async function cargarCategorias() {
        const { data, error } = await supabase
            .from('Categorias_Producto')
            .select('ID_categoria, Nombre_Categoria')
            .is('ID_CategoriaPadre', null);

        if (!error) setCategorias(data);
    }
    // Carga las subcategorías vinculadas a una categoría padre
    async function cargarSubcategorias(idCategoriaPadre) {
        const { data, error } = await supabase
            .from('Categorias_Producto')
            .select('ID_categoria, Nombre_Categoria')
            .eq('ID_CategoriaPadre', idCategoriaPadre);

        if (!error) setSubcategorias(data);
    }

// ---------- CREAR CATEGORIA / SUBCATEGORIA AL VUELO ----------

    // Obtiene un ID de usuario por defecto para auditoría
    async function obtenerIdUsuario() {
        const { data } = await supabase.from('User').select('ID_User').limit(1);
        return data?.[0]?.ID_User;
    }
    // Crea una nueva categoría al vuelo
    async function crearCategoria() {
        const idUser = await obtenerIdUsuario();
        const { data, error } = await supabase
            .from('Categorias_Producto')
            .insert({ ID_User: idUser, Nombre_Categoria: nombreNuevaCategoria })
            .select()
            .single();

        if (!error) {
            setCategorias((prev) => [...prev, data]);
            setCategoriaSeleccionada(data.ID_categoria);
            setNombreNuevaCategoria('');
            setCreandoCategoria(false);
        } else {
            console.log('❌ Error creando categoría:', error.message);
        }
    }

        // Crea una nueva subcategoría al vuelo
    async function crearSubcategoria() {
        const idUser = await obtenerIdUsuario();
        const { data, error } = await supabase
            .from('Categorias_Producto')
            .insert({
                ID_User: idUser,
                Nombre_Categoria: nombreNuevaSubcategoria,
                ID_CategoriaPadre: categoriaSeleccionada,
            })
            .select()
            .single();

        if (!error) {
            setSubcategorias((prev) => [...prev, data]);
            setSubcategoriaSeleccionada(data.ID_categoria);
            setNombreNuevaSubcategoria('');
            setCreandoSubcategoria(false);
        } else {
            console.log('❌ Error creando subcategoría:', error.message);
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

    // ---------------- SUBIR FOTOS A SUPABASE -----------------//
    // Sube imágenes a Storage y crea los registros con su orden correspondiente
    async function subirFotos(idProducto, archivos = fotosSeleccionadas) {
    if (!archivos || archivos.length === 0) return;

    const idUser = await obtenerIdUsuario();

    for (let i = 0; i < archivos.length; i++) {
        const archivo = archivos[i];

        // 1. Limpiar nombre del archivo para evitar caracteres inválidos
        const extension = archivo.name.split('.').pop();
        const nombreArchivo = `${idProducto}_${Date.now()}_${i}.${extension}`;

        // 2. Subir al Storage de Supabase
        const { error: errorSubida } = await supabase.storage
            .from('fotos-productos')
            .upload(nombreArchivo, archivo, {
                cacheControl: '3600',
                upsert: false
            });

        if (errorSubida) {
            console.error('❌ Error subiendo a Storage:', errorSubida.message);
            continue;
        }

        // 3. Obtener URL pública
        const { data: urlData } = supabase.storage
            .from('fotos-productos')
            .getPublicUrl(nombreArchivo);

        const urlPublica = urlData?.publicUrl;

        // 4. Insertar en Fotos_Productos guardando el orden exacto (i)
        const { error: errorInsert } = await supabase
            .from('Fotos_Productos')
            .insert({
                ID_Producto: idProducto,
                ID_User: idUser,
                URL_Foto: urlPublica,
                Orden: i, // 0 = Principal, 1 = Segunda, 2 = Tercera...
                Fecha_Carga: new Date().toISOString()
            });

        if (errorInsert) {
            console.error('❌ Error insertando foto en tabla:', errorInsert.message);
        } else {
            console.log(`✅ Foto ${i} guardada correctamente:`, urlPublica);
        }
    }
}
    // Permite reordenar para definir una nueva foto principal
    function marcarComoPrincipal(indice) {
    if (indice === 0) return; // Ya es la principal

    // Reordena los arrays de archivos y previews
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


    // Reinicia los campos del formulario de creación
    function limpiarFormulario() {
        setNombreProducto('');
        setDescripcionProducto('');
        setPrecioProducto('');
        setTallaProducto('');
        setStockProducto('');
        setCategoriaSeleccionada('');
        setSubcategoriaSeleccionada('');
        setFotosSeleccionadas([]);
        setPreviews([]);
    }

    // ---------- GUARDAR EL PRODUCTO COMPLETO ----------
        // Guarda el producto completo (Producto, Talla, Variante, Inventario y Fotos)
    async function guardarProductoNuevo() {
        const idCategoriaFinal = subcategoriaSeleccionada || categoriaSeleccionada;

        if (!nombreProducto || !idCategoriaFinal) {
            alert('Nombre y categoría son obligatorios');
            return;
        }

        // 1. Insertar Producto
        const { data: productoData, error: errorProducto } = await supabase
            .from('Productos')
            .insert({
                Nombre_Producto: nombreProducto,
                Descripcion: descripcionProducto,
                ID_Categoria: idCategoriaFinal,
            })
            .select()
            .single();

        if (errorProducto) {
            console.log('❌ Error creando producto:', errorProducto.message);
            return;
        }

        // 2. Insertar Talla
        const { data: tipoTallaData } = await supabase
            .from('Tipos_Talla')
            .insert({ Nombre_TipoTalla: tallaProducto })
            .select()
            .single();

        const { data: tallaData } = await supabase
            .from('Talla')
            .insert({ ID_TipoTalla: tipoTallaData.ID_TipoTalla })
            .select()
            .single();

        // 3. Insertar Variante
        const { data: varianteData, error: errorVariante } = await supabase
            .from('Variante Producto')
            .insert({
                ID_Producto: productoData.ID_Producto,
                ID_Talla: tallaData.ID_Talla,
                Precio_Actual: precioProducto,
            })
            .select()
            .single();

        if (errorVariante) {
            console.log('❌ Error creando variante:', errorVariante.message);
            return;
        }

        // 4. Inicializar Inventario
        await supabase.from('Inventario').insert({
            ID_Variante: varianteData.ID_Variante,
            Cantidad_Disponible: stockProducto,
            Cantidad_Reservada: 0,
        });

        // 5. Subir imágenes si existen
            if (fotosSeleccionadas.length > 0) {
                await subirFotos(productoData.ID_Producto, fotosSeleccionadas);
            }

            
        // 6. Cerrar modal y recargar datos
            setModalAbierto(null);
            limpiarFormulario();
            cargarVariantes();
    }

    // ---------- FILTRO DE BUSQUEDA ----------
    const filtrados = variantes.filter((v) =>
        v.Productos?.Nombre_Producto.toLowerCase().includes(busqueda.toLowerCase())
    );

    // Conteo para las tarjetas superiores
        // Activos: ID_EstadoProducto = 1 (o null/default)
        const totalActivos = variantes.filter((v) => (v.ID_EstadoProducto ?? 1) === 1).length;

        // Inactivos: ID_EstadoProducto = 2 
        const totalInactivos = variantes.filter((v) => v.ID_EstadoProducto === 2 || v.ID_EstadoProducto === 2).length;

        // Stock bajo: productos con stock entre 1 y 19 unidades por el momento
        const totalStockBajo = variantes.filter((v) => {
            const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
            return stock > 0 && stock < 20;
        }).length;

        // Sin stock: productos con stock igual a 0
        const totalSinStock = variantes.filter((v) => {
            const stock = v.Inventario?.[0]?.Cantidad_Disponible ?? 0;
            return stock === 0;
        }).length;



        //solo es para que se mire la camisa al no tener foto en el producto
    function IconoCamisa() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2L4 6v3h3v11h10V9h3V6l-4-4-3 2h-2l-3-2z" />
        </svg>
    );
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
                        {/* tarjetas de estadisticas de productos activos, inactivos, stock bajo y sin stock */}
                    <div className="stats-row">
                        <div className="stat-card">
                            <span className="stat-titulo">Productos activos</span>
                            <span className="stat-valor" style={{ color: '#2e7d32' }}>{totalActivos}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-titulo">Productos inactivos</span>
                            <span className="stat-valor" style={{ color: '#e65100' }}>{totalInactivos}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-titulo">Stock bajo</span>
                            <span className="stat-valor" style={{ color: '#f9a825' }}>{totalStockBajo}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-titulo">Sin stock</span>
                            <span className="stat-valor" style={{ color: '#d32f2f' }}>{totalSinStock}</span>
                        </div>
                    </div>

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
                                <th>Producto</th><
                                    th>Precio</th>
                                    <th>Stock</th>
                                    <th>Talla</th>
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

            
            <td>${v.Precio_Actual}</td>
            
            <td className={stock === 0 ? 'sin-stock' : stock < 5 ? 'stock-bajo' : ''}>
                {stock}
            </td>
            <td>{v.Talla?.Tipos_Talla?.Nombre_TipoTalla}</td>
            
{/*---------------- Botones para altear stock, editar y activar/desactivar producto ----------------*/}
            <td>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" title="Entrada de stock" onClick={() => abrirModalStock(v)}>
                        📦
                    </button>
                    <button type="button" title="Editar producto" onClick={() => abrirModalEditar(v)}>
                        ✏️
                    </button>
                    <button 
                        type="button" 
                        title={estaInactivo ? "Activar producto" : "Desactivar producto"} 
                        onClick={() => alternarEstadoProducto(v)}
                        style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.1rem' }}
                    >
                        {estaInactivo ? '👁️' : '❌'}
                                                </button>
                                            </div></td>
                                    </tr>
                                );
                            })}
                        
                            
                        </tbody>
                    </table>
                )}
            </main>

            {/* ---------- MODAL: AGREGAR PRODUCTO ---------- */}
            {modalAbierto === 'agregar' && (
                <div className="modal-overlay" onClick={() => setModalAbierto(null)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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
                            </>
                        )}

                        <div className="modal-row">
                            <div>
                                <label>Precio</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={precioProducto}
                                    onChange={(e) => setPrecioProducto(e.target.value)}
                                />
                            </div>
                            <div>
                                <label>Talla</label>
                                <input
                                    type="text"
                                    placeholder="ej:M"
                                    value={tallaProducto}
                                    onChange={(e) => setTallaProducto(e.target.value)}
                                />
                            </div>
                            <div>
                                <label>Stock</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={stockProducto}
                                    onChange={(e) => setStockProducto(e.target.value)}
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
                                    onChange={manejarSeleccionFotosEditar}
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

                        <button className="btn-guardar" onClick={guardarProductoNuevo}>
                            Guardar cambios
                        </button>
                    </div>
                </div>
            )}

            {/* ---------- MODAL: EDITAR PRODUCTO ---------- */}
        {modalAbierto === 'editar' && (
            <div className="modal-overlay" onClick={() => setModalAbierto(null)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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

            <div className="modal-row">
                <div>
                    <label>Precio</label>
                    <input
                        type="number"
                        step="0.01"
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

            <label>Fotos del producto</label>
            <div className="fotos-row">
                {/* Fotos ya guardadas en Supabase */}
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
    <div className="modal-overlay" onClick={() => setModalAbierto(null)}>
        <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
                <h2>Ajustar stock</h2>
                <button onClick={() => setModalAbierto(null)}>✕</button>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#555', textDecoration: 'underline', marginBottom: '14px' }}>
                {varianteStock?.Productos?.Nombre_Producto || 'Producto'} | Talla {varianteStock?.Talla?.Tipos_Talla?.Nombre_TipoTalla || 'Única'}
            </p>

            <label>Stock Actual</label>
            <p style={{ fontWeight: '600', marginBottom: '10px' }}>
                {varianteStock?.Inventario?.[0]?.Cantidad_Disponible ?? 0} Unidades
            </p>

            {/* Selector: Entrada o Salida */}
            <label>Tipo de movimiento</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <button
                    type="button"
                    onClick={() => {
                        setTipoMovimiento('entrada');
                        setMotivoStock('Compra a proveedor');
                    }}
                    style={{
                        flex: 1,
                        padding: '8px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        backgroundColor: tipoMovimiento === 'entrada' ? '#2e7d32' : '#f0f0f0',
                        color: tipoMovimiento === 'entrada' ? '#fff' : '#333',
                        fontWeight: '600'
                    }}
                >
                    + Ingresar
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setTipoMovimiento('salida');
                        setMotivoStock('Venta en tienda física');
                    }}
                    style={{
                        flex: 1,
                        padding: '8px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        backgroundColor: tipoMovimiento === 'salida' ? '#d32f2f' : '#f0f0f0',
                        color: tipoMovimiento === 'salida' ? '#fff' : '#333',
                        fontWeight: '600'
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

            
        </div>
    );
}

export default AdminInventario;