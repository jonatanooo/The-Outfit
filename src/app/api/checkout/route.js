import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { esOfertaActiva, calcularPrecioConDescuento } from '@/lib/descuentos';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = '__session';

/**
 * Obtiene el usuario autenticado y verifica que no esté baneado antes de procesar la compra.
 */
async function obtenerUsuarioVerificado(request) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!sessionCookie && !bearerToken) return null;

  let decoded = null;
  if (sessionCookie) {
    try {
      decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch {
      decoded = await adminAuth.verifyIdToken(sessionCookie, true);
    }
  } else if (bearerToken) {
    decoded = await adminAuth.verifyIdToken(bearerToken, true);
  }

  if (!decoded) return null;

  let userData = null;
  let docId = null;

  const directSnap = await adminDb.collection('User').doc(decoded.uid).get();
  if (directSnap.exists) {
    userData = directSnap.data();
    docId = directSnap.id;
  } else {
    const authSnap = await adminDb
      .collection('User')
      .where('auth_id', '==', decoded.uid)
      .limit(1)
      .get();
    if (!authSnap.empty) {
      userData = authSnap.docs[0].data();
      docId = authSnap.docs[0].id;
    } else if (decoded.email && decoded.email_verified === true) {
      const emailSnap = await adminDb
        .collection('User')
        .where('Correo', '==', decoded.email)
        .limit(1)
        .get();
      if (!emailSnap.empty) {
        const candidate = emailSnap.docs[0].data();
        if (!candidate.auth_id || candidate.auth_id === decoded.uid) {
          userData = candidate;
          docId = emailSnap.docs[0].id;
        }
      }
    }
  }

  if (
    userData &&
    (Number(userData.ID_EstadoUsuario) === 2 || userData.ID_EstadoUsuario === '2')
  ) {
    return { baneado: true };
  }

  return {
    uid: decoded.uid,
    idUser: userData?.ID_User ?? docId ?? decoded.uid,
    baneado: false,
  };
}

/**
 * Busca un documento en una colección por su ID de documento o por su campo ID (numérico o string).
 */
async function buscarRefPorId(nombreColeccion, campoId, valorId) {
  const strId = String(valorId);
  const directRef = adminDb.collection(nombreColeccion).doc(strId);
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    return directRef;
  }

  const opciones = [valorId, strId];
  if (!isNaN(Number(valorId))) opciones.push(Number(valorId));

  const qSnap = await adminDb
    .collection(nombreColeccion)
    .where(campoId, 'in', Array.from(new Set(opciones)))
    .limit(1)
    .get();

  if (!qSnap.empty) {
    return qSnap.docs[0].ref;
  }

  return null;
}

/**
 * POST /api/checkout
 * Ejecuta el checkout de forma 100% segura en el servidor mediante runTransaction:
 * 1. Ignora cualquier precio enviado desde localStorage; recalcula precios y descuentos desde Firestore.
 * 2. Verifica y descuenta el stock de forma atómica con adminDb.runTransaction() evitando overselling (Race Condition).
 * 3. Genera identificadores únicos criptográficos con doc().id (reemplazando Date.now()).
 */
export async function POST(request) {
  try {
    const usuario = await obtenerUsuarioVerificado(request);
    if (!usuario) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para realizar una compra.' },
        { status: 401 }
      );
    }

    if (usuario.baneado) {
      return NextResponse.json(
        { error: 'Tu cuenta fue desactivada o baneada.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const metodoEntrega = body.metodoEntrega === 'domicilio' ? 'domicilio' : 'tienda';
    const idDireccion = metodoEntrega === 'domicilio' ? body.idDireccionSeleccionada : null;
    const metodoPago = String(body.metodoPago || 'Tarjeta de crédito').trim();

    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: 'El carrito está vacío.' },
        { status: 400 }
      );
    }

    if (metodoEntrega === 'domicilio' && !idDireccion) {
      return NextResponse.json(
        { error: 'Debes seleccionar una dirección de entrega.' },
        { status: 400 }
      );
    }

    // 1. Obtener estado "Pendiente"
    let idEstado = 1;
    const estadoSnap = await adminDb
      .collection('Estado_Pedido')
      .where('Estado', '==', 'Pendiente')
      .limit(1)
      .get();
    if (!estadoSnap.empty) {
      idEstado = estadoSnap.docs[0].data().ID_EstadoPedido ?? 1;
    }

    // 2. Resolver las referencias de documento para cada variante e inventario antes de la transacción
    const itemsRefs = [];
    for (const item of rawItems) {
      const idVariante = item?.idVariante;
      const cantidad = Math.floor(Number(item?.cantidad ?? 0));
      if (!idVariante || isNaN(cantidad) || cantidad <= 0) {
        return NextResponse.json(
          { error: 'Cantidad o variante inválida en el carrito.' },
          { status: 400 }
        );
      }

      const varRef = await buscarRefPorId('Variante_Producto', 'ID_Variante', idVariante);
      if (!varRef) {
        return NextResponse.json(
          { error: `La variante #${idVariante} ya no existe.` },
          { status: 404 }
        );
      }

      const opcionesVar = [idVariante, String(idVariante)];
      if (!isNaN(Number(idVariante))) opcionesVar.push(Number(idVariante));

      const invQuerySnap = await adminDb
        .collection('Inventario')
        .where('ID_Variante', 'in', Array.from(new Set(opcionesVar)))
        .limit(1)
        .get();

      if (invQuerySnap.empty) {
        return NextResponse.json(
          { error: `No se encontró inventario para la variante #${idVariante}.` },
          { status: 404 }
        );
      }

      itemsRefs.push({
        idVariante,
        cantidad,
        nombreCliente: item.nombre || '',
        tallaCliente: item.talla || '',
        imagenCliente: item.imagen || '',
        varRef,
        invRef: invQuerySnap.docs[0].ref,
      });
    }

    // 3. Ejecutar transacción atómica en Firestore (lectura de precios reales + verificación de stock + escritura)
    const resultado = await adminDb.runTransaction(async (transaction) => {
      // Fase de lectura de la transacción (todas las lecturas deben ir antes de las escrituras)
      const lecturas = [];
      for (const entry of itemsRefs) {
        const [varSnap, invSnap] = await Promise.all([
          transaction.get(entry.varRef),
          transaction.get(entry.invRef),
        ]);

        if (!varSnap.exists) {
          throw new Error(`La prenda seleccionada (${entry.nombreCliente || entry.idVariante}) ya no existe.`);
        }

        const varData = varSnap.data();
        let prodData = null;
        if (varData.ID_Producto != null) {
          const prodRef = await buscarRefPorId('Productos', 'ID_Producto', varData.ID_Producto);
          if (prodRef) {
            const prodSnap = await transaction.get(prodRef);
            if (prodSnap.exists) prodData = prodSnap.data();
          }
        }

        lecturas.push({
          ...entry,
          varData,
          prodData,
          invData: invSnap.exists ? invSnap.data() : null,
        });
      }

      let subtotalOriginalCalculado = 0;
      let subtotalFinalCalculado = 0;
      const itemsVerificados = [];

      // Validar stock y calcular precios reales desde la base de datos (nunca desde localStorage)
      for (const item of lecturas) {
        const stockActual = Number(item.invData?.Cantidad_Disponible ?? 0);
        const nombreProd =
          item.prodData?.Nombre_Producto || item.nombreCliente || `Variante #${item.idVariante}`;

        if (stockActual < item.cantidad) {
          throw new Error(
            `Stock insuficiente para "${nombreProd}". Disponible: ${stockActual}, solicitado: ${item.cantidad}.`
          );
        }

        const precioBase = Number(item.varData.Precio_Actual ?? 0);
        if (isNaN(precioBase) || precioBase < 0) {
          throw new Error(`Precio inválido en base de datos para "${nombreProd}".`);
        }

        // Verificar si tiene oferta activa en Variante_Producto o en Productos padre
        let porcentajeDescuento = 0;
        let enOferta = false;
        if (esOfertaActiva(item.varData)) {
          enOferta = true;
          porcentajeDescuento = Number(item.varData.Porcentaje_Descuento ?? 0);
        } else if (item.prodData && esOfertaActiva(item.prodData)) {
          enOferta = true;
          porcentajeDescuento = Number(item.prodData.Porcentaje_Descuento ?? 0);
        }

        const precioUnitarioReal = enOferta
          ? calcularPrecioConDescuento(precioBase, porcentajeDescuento)
          : precioBase;

        const lineaOriginal = Math.round(precioBase * item.cantidad * 100) / 100;
        const lineaFinal = Math.round(precioUnitarioReal * item.cantidad * 100) / 100;

        subtotalOriginalCalculado = Math.round((subtotalOriginalCalculado + lineaOriginal) * 100) / 100;
        subtotalFinalCalculado = Math.round((subtotalFinalCalculado + lineaFinal) * 100) / 100;

        itemsVerificados.push({
          idVariante: item.varData.ID_Variante ?? item.idVariante,
          nombre: nombreProd,
          talla: item.tallaCliente,
          imagen: item.prodData?.Imagen_Principal || item.imagenCliente || '',
          cantidad: item.cantidad,
          precioOriginal: precioBase,
          precio: precioUnitarioReal,
          enOferta,
          porcentajeDescuento: enOferta ? porcentajeDescuento : 0,
          subtotalLinea: lineaFinal,
          invRef: item.invRef,
          stockAnterior: stockActual,
          nuevoStock: stockActual - item.cantidad,
        });
      }

      const totalAhorroCalculado = Math.max(
        0,
        Math.round((subtotalOriginalCalculado - subtotalFinalCalculado) * 100) / 100
      );

      // Generar referencias con IDs únicos criptográficos de Firestore (doc().id)
      const ahoraIso = new Date().toISOString();
      const pedidoRef = adminDb.collection('Pedido').doc();
      const idPedido = pedidoRef.id;

      transaction.set(pedidoRef, {
        ID_Pedido: idPedido,
        ID_User: usuario.idUser,
        ID_Direccion: metodoEntrega === 'domicilio' ? idDireccion : null,
        Fecha_Pedido: ahoraIso,
        Subtotal: subtotalOriginalCalculado,
        Descuento: totalAhorroCalculado,
        Total: subtotalFinalCalculado,
        ID_EstadoPedidoo: idEstado,
      });

      for (const item of itemsVerificados) {
        const detalleRef = adminDb.collection('Pedido_Detalle').doc();
        transaction.set(detalleRef, {
          ID_PedidoDetalle: detalleRef.id,
          ID_Pedido: idPedido,
          ID_Variante: item.idVariante,
          Cantidad: item.cantidad,
          Precio_Unitario: item.precio,
          Precio_Original: item.precioOriginal,
          Subtotal: item.subtotalLinea,
        });

        transaction.update(item.invRef, {
          Cantidad_Disponible: item.nuevoStock,
          Fecha_Actualizacion: ahoraIso,
        });

        const auditInvRef = adminDb.collection('Auditoria_Inventario').doc();
        transaction.set(auditInvRef, {
          ID_Auditoria: auditInvRef.id,
          ID_Variante: item.idVariante,
          ID_UserAccion: usuario.idUser,
          Cantidad_Anterior: item.stockAnterior,
          Cantidad_Nueva: item.nuevoStock,
          Tipo_Movimiento: 'Salida',
          Motivo: `Venta en línea (Pedido #${idPedido})`,
          Fecha_Accion: ahoraIso,
        });
      }

      const transRef = adminDb.collection('Transacciones_Pago').doc();
      transaction.set(transRef, {
        ID_Transaccion: transRef.id,
        ID_Pedido: idPedido,
        Monto: subtotalFinalCalculado,
        Metodo_Pago: metodoPago,
        Fecha_Transaccion: ahoraIso,
        Estado_transaccion: 'Aprobado',
        Verificado_Servidor: true,
      });

      return {
        idPedido,
        idTransaccion: transRef.id,
        subtotalOriginal: subtotalOriginalCalculado,
        totalAhorro: totalAhorroCalculado,
        total: subtotalFinalCalculado,
        items: itemsVerificados.map(({ invRef, nuevoStock, ...rest }) => rest),
      };
    });

    return NextResponse.json({
      ok: true,
      ...resultado,
    });
  } catch (error) {
    console.error('Error en transacción de checkout:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo procesar la compra.' },
      { status: 400 }
    );
  }
}

