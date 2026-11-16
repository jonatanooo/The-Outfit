import { db } from './firebaseClient';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

function esDocPlantillaUser(docSnap) {
  if (!docSnap) return true;
  if (docSnap.id === '_schema_init' || docSnap.id === '_placeholder') return true;
  const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
  return Boolean(data?._is_schema_template || data?._info);
}

/**
 * Convierte cualquier formato de fecha de Firestore (Timestamp, ISO, Date, numérico o DD/MM/YYYY)
 * a milisegundos Unix para ordenar cronológicamente sin fallos.
 */
export function obtenerTimestampFecha(fechaRaw) {
  if (!fechaRaw) return 0;

  if (fechaRaw instanceof Date) {
    return isNaN(fechaRaw.getTime()) ? 0 : fechaRaw.getTime();
  }

  if (typeof fechaRaw === 'object') {
    if (typeof fechaRaw.toDate === 'function') {
      const d = fechaRaw.toDate();
      return d && !isNaN(d.getTime()) ? d.getTime() : 0;
    }
    const segs = fechaRaw.seconds ?? fechaRaw._seconds;
    if (segs != null && !isNaN(Number(segs))) {
      const nanos = Number(fechaRaw.nanoseconds ?? fechaRaw._nanoseconds ?? 0);
      return Number(segs) * 1000 + Math.floor(nanos / 1e6);
    }
  }

  if (typeof fechaRaw === 'number' && !isNaN(fechaRaw)) {
    return fechaRaw < 1e12 ? fechaRaw * 1000 : fechaRaw;
  }

  const str = String(fechaRaw).trim();
  if (!str) return 0;

  // Soportar formato local D/M/YYYY o DD/MM/YYYY
  const matchLocal = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?/i);
  if (matchLocal) {
    const dia = Number(matchLocal[1]);
    const mes = Number(matchLocal[2]) - 1;
    const anio = Number(matchLocal[3]);
    let hora = matchLocal[4] != null ? Number(matchLocal[4]) : 0;
    const min = matchLocal[5] != null ? Number(matchLocal[5]) : 0;
    const seg = matchLocal[6] != null ? Number(matchLocal[6]) : 0;
    const ampm = (matchLocal[7] || '').toLowerCase();
    if (ampm.includes('p') && hora < 12) hora += 12;
    if (ampm.includes('a') && hora === 12) hora = 0;
    const dLocal = new Date(anio, mes, dia, hora, min, seg);
    if (!isNaN(dLocal.getTime())) return dLocal.getTime();
  }

  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normaliza el nombre de un estado de pedido en minúsculas y sin acentos.
 */
export function claveEstadoPedido(estado) {
  return String(estado ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Devuelve la clase CSS semántica según el estado del pedido (compatible con transacciones.css).
 */
export function claseEstadoPedido(estado) {
  const k = claveEstadoPedido(estado);
  if (k.includes('pendiente')) return 'estado-pendiente';
  if (k.includes('entregado')) return 'estado-entregado';
  if (k.includes('camino')) return 'estado-encamino';
  if (k.includes('cancel')) return 'estado-cancelado';
  return '';
}

/**
 * Genera los pasos de progreso del historial de un pedido (misma lógica del Panel Admin).
 */
export function pasosHistorialPedido(t) {
  const k = claveEstadoPedido(t?.estado);
  const enCamino = k.includes('camino') || k.includes('entregado');
  const entregado = k.includes('entregado');
  return [
    {
      texto: 'Pago confirmado',
      hora: t?.pagoFecha
        ? new Date(t.pagoFecha).toLocaleTimeString('es-SV', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        : '',
      hecho: Boolean(t?.hayPago),
    },
    {
      texto: 'Listo para entrega',
      hora: '',
      hecho: !k.includes('pendiente') && !k.includes('cancel'),
    },
    { texto: 'En camino', hora: '', hecho: enCamino },
    { texto: 'Entregado', hora: '', hecho: entregado },
  ];
}

/**
 * Resuelve todos los identificadores asociados al usuario autenticado en la colección `User`
 * (uid de Firebase Auth, ID_User numérico/string y _docId) junto con sus datos de perfil.
 */
export async function obtenerIdsUsuarioAutenticado(firebaseUser, userProfileOverride = null) {
  const candidatosRaw = new Set();
  let perfilUsuario = userProfileOverride ? { ...userProfileOverride } : null;

  if (!firebaseUser?.uid && !perfilUsuario) {
    return { candidatos: [], candidatosSet: new Set(), perfilUsuario: null };
  }

  const agregarCandidato = (val) => {
    if (val === null || val === undefined || val === '') return;
    candidatosRaw.add(val);
    candidatosRaw.add(String(val));
    const num = Number(val);
    if (!isNaN(num) && Number.isFinite(num) && String(val).trim() !== '') {
      candidatosRaw.add(num);
    }
  };

  if (firebaseUser?.uid) {
    agregarCandidato(firebaseUser.uid);
  }
  if (perfilUsuario) {
    agregarCandidato(perfilUsuario.ID_User);
    agregarCandidato(perfilUsuario._docId);
  }

  if (firebaseUser?.uid) {
    try {
      // 1. Buscar por Document ID directo === uid
      const directSnap = await getDoc(doc(db, 'User', firebaseUser.uid));
      if (directSnap.exists() && !esDocPlantillaUser(directSnap)) {
        const data = directSnap.data();
        agregarCandidato(directSnap.id);
        agregarCandidato(data?.ID_User);
        if (!perfilUsuario) perfilUsuario = { ...data, _docId: directSnap.id };
      }

      // 2. Buscar por auth_id === uid
      const snapAuth = await getDocs(
        query(collection(db, 'User'), where('auth_id', '==', firebaseUser.uid))
      );
      snapAuth.docs.forEach((d) => {
        if (esDocPlantillaUser(d)) return;
        const data = d.data();
        agregarCandidato(d.id);
        agregarCandidato(data?.ID_User);
        if (!perfilUsuario) perfilUsuario = { ...data, _docId: d.id };
      });

      // 3. Buscar por Correo si existe
      const emailRaw = String(firebaseUser.email || '').trim();
      const emailLower = emailRaw.toLowerCase();
      const correos = Array.from(new Set([emailRaw, emailLower].filter(Boolean)));
      if (correos.length > 0) {
        const snapCorreo = await getDocs(
          query(collection(db, 'User'), where('Correo', 'in', correos))
        );
        snapCorreo.docs.forEach((d) => {
          if (esDocPlantillaUser(d)) return;
          const data = d.data();
          if (!data?.auth_id || data.auth_id === firebaseUser.uid) {
            agregarCandidato(d.id);
            agregarCandidato(data?.ID_User);
            if (!perfilUsuario) perfilUsuario = { ...data, _docId: d.id };
          }
        });
      }
    } catch (err) {
      console.error('Error resolviendo IDs de usuario en Firestore:', err);
    }
  }

  const candidatos = Array.from(candidatosRaw);
  const candidatosSet = new Set(candidatos.map((v) => String(v)));

  return { candidatos, candidatosSet, perfilUsuario };
}

/**
 * Normaliza un documento ensamblado de `Pedido` al formato de vista de detalle e historial.
 */
export function normalizarPedido(p, firebaseUser = null) {
  const pagos = p.Transacciones_Pago ?? [];
  const pagoPrincipal = pagos[0] ?? null;

  const productos = (p.Pedido_Detalle ?? []).map((d) => {
    const variante = d['Variante Producto'] ?? d.Variante_Producto ?? null;
    const fotos = (variante?.Productos?.Fotos_Productos ?? [])
      .slice()
      .sort((a, b) => (a.Orden ?? 0) - (b.Orden ?? 0));
    const fotoPrincipal =
      fotos.find((f) => f.Es_Principal)?.URL_Foto ??
      fotos[0]?.URL_Foto ??
      variante?.Productos?.Imagen_Principal ??
      null;

    const nombreProducto =
      variante?.Productos?.Nombre_Producto ??
      (d.ID_Variante != null ? `Artículo #${d.ID_Variante}` : 'Producto');

    return {
      id: d.ID_PedidoDetalle,
      idVariante: d.ID_Variante,
      nombre: nombreProducto,
      talla: variante?.Talla?.Tipos_Talla?.Nombre_TipoTalla ?? '',
      foto: fotoPrincipal,
      cantidad: Number(d.Cantidad ?? 1),
      precio: Number(d.Precio_Unitario ?? 0),
      subtotal: Number(d.Subtotal ?? (d.Cantidad ?? 1) * (d.Precio_Unitario ?? 0)),
    };
  });

  const dir = p.Direcciones ?? null;
  const nombreCompletoPerfil = [p.User?.Nombres, p.User?.Apellidos]
    .filter(Boolean)
    .join(' ')
    .trim();
  const nombreCliente =
    p.User?.Usuario ||
    nombreCompletoPerfil ||
    firebaseUser?.displayName ||
    firebaseUser?.email ||
    'Sin cliente';

  const fechaTimestamp = obtenerTimestampFecha(p.Fecha_Pedido);
  const fechaObj = fechaTimestamp > 0 ? new Date(fechaTimestamp) : null;
  const fechaValida = Boolean(fechaObj && !isNaN(fechaObj.getTime()));

  const fechaCorta = fechaValida ? fechaObj.toLocaleDateString('es-SV') : '—';
  const horaCorta = fechaValida
    ? fechaObj.toLocaleTimeString('es-SV', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';
  const fechaHoraLista = fechaValida
    ? horaCorta
      ? `${fechaCorta} · ${horaCorta}`
      : fechaCorta
    : '—';
  const fechaLarga = fechaValida
    ? fechaObj.toLocaleString('es-SV', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '—';

  return {
    id: p.ID_Pedido,
    cliente: nombreCliente,
    telefono: p.User?.Telefono ?? '',
    dui: p.User?.DUI ?? '',
    fechaISO: fechaValida ? fechaObj.toISOString() : (p.Fecha_Pedido ?? ''),
    fechaTimestamp,
    fechaCorta,
    horaCorta,
    fechaHoraLista,
    fechaLarga,
    total: Number(p.Total ?? 0),
    subtotal: Number(p.Subtotal ?? 0),
    descuento: Number(p.Descuento ?? 0),
    envio: 0,
    entrega: dir
      ? `${dir.Calle ?? ''}${dir.Departamento ? ', ' + dir.Departamento : ''}`.trim()
      : 'Recoger en tienda',
    entregaSub: dir ? 'Envío a domicilio' : 'Sucursal principal',
    pago: pagoPrincipal?.Metodo_Pago ?? 'Sin registrar',
    pagoFecha: pagoPrincipal?.Fecha_Transaccion ?? null,
    montoPagado: pagos.reduce((s, x) => s + Number(x.Monto ?? 0), 0),
    hayPago: pagos.length > 0,
    idEstado: p.Estado_Pedido?.ID_EstadoPedido ?? p.ID_EstadoPedidoo ?? p.ID_EstadoPedido ?? null,
    estado: (p.Estado_Pedido?.Estado ?? 'Pendiente').trim(),
    estadoDesc: p.Estado_Pedido?.Descripcion ?? '',
    productos,
  };
}

/**
 * Carga y ensambla exclusivamente los pedidos realizados por el usuario autenticado.
 */
export async function cargarPedidosCliente(firebaseUser, userProfileOverride = null) {
  if (!firebaseUser?.uid && !userProfileOverride) {
    return [];
  }

  const { candidatos, candidatosSet, perfilUsuario } = await obtenerIdsUsuarioAutenticado(
    firebaseUser,
    userProfileOverride
  );

  if (candidatos.length === 0) {
    return [];
  }

  // Consultar la colección `Pedido` en lotes de máximo 10 valores por límite de Firestore `in`
  const pedidosDocsMap = new Map();
  const lotes = [];
  for (let i = 0; i < candidatos.length; i += 10) {
    lotes.push(candidatos.slice(i, i + 10));
  }

  const snapsLotes = await Promise.all(
    lotes.map((lote) =>
      getDocs(query(collection(db, 'Pedido'), where('ID_User', 'in', lote)))
    )
  );

  snapsLotes.forEach((snap) => {
    snap.docs.forEach((d) => {
      const data = d.data();
      // Verificación estricta en memoria de que el pedido pertenece al usuario logueado
      if (data?.ID_User != null && candidatosSet.has(String(data.ID_User))) {
        pedidosDocsMap.set(d.id, { docId: d.id, data });
      }
    });
  });

  if (pedidosDocsMap.size === 0) {
    return [];
  }

  // Consultar colecciones relacionadas en paralelo
  const [
    detallesSnap,
    transSnap,
    estadosSnap,
    dirSnap,
    varSnap,
    prodSnap,
    fotosSnap,
    tallaSnap,
    tiposTallaSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'Pedido_Detalle')),
    getDocs(collection(db, 'Transacciones_Pago')),
    getDocs(collection(db, 'Estado_Pedido')),
    getDocs(collection(db, 'Direcciones')),
    getDocs(collection(db, 'Variante_Producto')),
    getDocs(collection(db, 'Productos')),
    getDocs(collection(db, 'Fotos_Productos')),
    getDocs(collection(db, 'Talla')),
    getDocs(collection(db, 'Tipos_Talla')),
  ]);

  // 1. Fotos por producto
  const fotosPorProd = {};
  fotosSnap.docs.forEach((d) => {
    const f = d.data();
    const pid = f.ID_Producto;
    if (pid != null) {
      if (!fotosPorProd[pid]) fotosPorProd[pid] = [];
      fotosPorProd[pid].push(f);
      if (!fotosPorProd[String(pid)]) fotosPorProd[String(pid)] = fotosPorProd[pid];
    }
  });

  // 2. Tipos de Talla y Talla
  const tiposTallaMap = {};
  tiposTallaSnap.docs.forEach((d) => {
    const t = d.data();
    const id = t.ID_TipoTalla ?? d.id;
    tiposTallaMap[id] = t;
    tiposTallaMap[String(id)] = t;
  });

  const tallaMap = {};
  tallaSnap.docs.forEach((d) => {
    const t = d.data();
    const id = t.ID_Talla ?? d.id;
    tallaMap[id] = { ...t, Tipos_Talla: tiposTallaMap[t.ID_TipoTalla] || null };
    tallaMap[String(id)] = tallaMap[id];
  });

  // 3. Productos y Variantes
  const prodMap = {};
  prodSnap.docs.forEach((d) => {
    const p = d.data();
    const pid = p.ID_Producto ?? d.id;
    prodMap[pid] = {
      ...p,
      Fotos_Productos: fotosPorProd[pid] || fotosPorProd[String(pid)] || [],
    };
    prodMap[String(pid)] = prodMap[pid];
  });

  const varMap = {};
  varSnap.docs.forEach((d) => {
    const v = d.data();
    const vid = v.ID_Variante ?? d.id;
    varMap[vid] = {
      ...v,
      Productos: prodMap[v.ID_Producto] || prodMap[String(v.ID_Producto)] || null,
      Talla: tallaMap[v.ID_Talla] || tallaMap[String(v.ID_Talla)] || null,
    };
    varMap[String(vid)] = varMap[vid];
  });

  // 4. Detalles de pedido
  const detallesPorPedido = {};
  detallesSnap.docs.forEach((d) => {
    const det = d.data();
    const pedId = det.ID_Pedido;
    if (pedId != null) {
      const item = {
        ...det,
        ID_PedidoDetalle: det.ID_PedidoDetalle ?? d.id,
        Variante_Producto: varMap[det.ID_Variante] || varMap[String(det.ID_Variante)] || null,
      };
      if (!detallesPorPedido[pedId]) detallesPorPedido[pedId] = [];
      detallesPorPedido[pedId].push(item);
      if (!detallesPorPedido[String(pedId)]) detallesPorPedido[String(pedId)] = detallesPorPedido[pedId];
    }
  });

  // 5. Transacciones de pago
  const transPorPedido = {};
  transSnap.docs.forEach((d) => {
    const t = d.data();
    const pedId = t.ID_Pedido;
    if (pedId != null) {
      if (!transPorPedido[pedId]) transPorPedido[pedId] = [];
      transPorPedido[pedId].push(t);
      if (!transPorPedido[String(pedId)]) transPorPedido[String(pedId)] = transPorPedido[pedId];
    }
  });

  // 6. Estados y Direcciones
  const estadosMap = {};
  estadosSnap.docs.forEach((d) => {
    const e = d.data();
    const id = e.ID_EstadoPedido ?? d.id;
    estadosMap[id] = e;
    estadosMap[String(id)] = e;
  });

  const dirMap = {};
  dirSnap.docs.forEach((d) => {
    const dir = d.data();
    const id = dir.ID_Direccion ?? d.id;
    dirMap[id] = dir;
    dirMap[String(id)] = dir;
  });

  // 7. Ensamblar y normalizar pedidos
  const pedidosLista = Array.from(pedidosDocsMap.values()).map(({ docId, data: p }) => {
    const pid = p.ID_Pedido ?? docId;
    const fechaTs = obtenerTimestampFecha(p.Fecha_Pedido);
    const fechaIso = fechaTs > 0 ? new Date(fechaTs).toISOString() : p.Fecha_Pedido;
    const idEstado = p.ID_EstadoPedidoo ?? p.ID_EstadoPedido;

    const ensamblado = {
      ...p,
      _docId: docId,
      ID_Pedido: pid,
      Fecha_Pedido: fechaIso,
      Total: Number(p.Total ?? 0),
      Subtotal: Number(p.Subtotal ?? 0),
      Descuento: Number(p.Descuento ?? 0),
      ID_User: p.ID_User,
      ID_Direccion: p.ID_Direccion,
      ID_EstadoPedidoo: idEstado,
      Estado_Pedido: estadosMap[idEstado] || estadosMap[String(idEstado)] || null,
      User: perfilUsuario,
      Direcciones: dirMap[p.ID_Direccion] || dirMap[String(p.ID_Direccion)] || null,
      Transacciones_Pago:
        transPorPedido[pid] || transPorPedido[String(pid)] || transPorPedido[docId] || [],
      Pedido_Detalle:
        detallesPorPedido[pid] || detallesPorPedido[String(pid)] || detallesPorPedido[docId] || [],
    };

    const normalizado = normalizarPedido(ensamblado, firebaseUser);
    return { ...normalizado, _docId: docId };
  });

  // Ordenar estrictamente de más reciente a más viejo
  pedidosLista.sort(
    (a, b) =>
      obtenerTimestampFecha(b.fechaTimestamp || b.fechaISO) -
      obtenerTimestampFecha(a.fechaTimestamp || a.fechaISO)
  );

  return pedidosLista;
}

/**
 * Obtiene un pedido específico verificando que pertenezca al usuario autenticado.
 */
export async function cargarPedidoClientePorId(firebaseUser, pedidoId, userProfileOverride = null) {
  if (!pedidoId) return null;
  const pedidos = await cargarPedidosCliente(firebaseUser, userProfileOverride);
  const target = decodeURIComponent(String(pedidoId));
  return (
    pedidos.find(
      (p) => String(p.id) === target || (p._docId && String(p._docId) === target)
    ) || null
  );
}

