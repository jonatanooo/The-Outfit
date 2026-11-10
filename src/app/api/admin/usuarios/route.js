import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, adminDb, tieneCredencialesAdmin } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = '__session';

function obtenerEtiquetaRol(idRol) {
  const num = Number(idRol);
  if (num === 1) return 'Administrador';
  if (num === 2) return 'Empleado';
  return 'Cliente';
}

/**
 * Verifica que quien invoca el endpoint pertenezca a la lista de Empleados/Administradores.
 */
async function verificarAccesoAdminPanelRequest(request) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (authHeader.trim() || null);

  const tokenValido = Boolean(
    bearerToken &&
    typeof bearerToken === 'string' &&
    bearerToken !== 'undefined' &&
    bearerToken !== 'null' &&
    bearerToken.length > 0
  );

  const cookieValida = Boolean(
    sessionCookie &&
    typeof sessionCookie === 'string' &&
    sessionCookie !== 'undefined' &&
    sessionCookie !== 'null' &&
    sessionCookie.trim().length > 0
  );

  if (!tokenValido && !cookieValida) {
    return null;
  }

  let decoded = null;

  if (tokenValido) {
    if (tieneCredencialesAdmin()) {
      try {
        decoded = await adminAuth.verifyIdToken(bearerToken, true);
      } catch {
        // cae al respaldo de decodificación
      }
    }
    if (!decoded) {
      try {
        const parts = bearerToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          const uid = payload.user_id || payload.sub;
          if (uid && (!payload.exp || Date.now() / 1000 < payload.exp)) {
            decoded = {
              uid,
              email: payload.email || '',
              email_verified: Boolean(payload.email_verified),
              rol: payload.rol,
              admin: payload.admin,
              empleado: payload.empleado,
            };
          }
        }
      } catch {
        // ignorar
      }
    }
  }

  if (!decoded && cookieValida) {
    try {
      if (sessionCookie.startsWith('v1.')) {
        const parts = sessionCookie.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload.uid && (!payload.exp || Date.now() < payload.exp)) {
            decoded = {
              uid: payload.uid,
              email: payload.email || '',
              email_verified: Boolean(payload.email_verified),
              rol: payload.rol,
              admin: payload.admin,
              empleado: payload.empleado,
            };
          }
        }
      }
    } catch {
      // ignorar
    }
  }

  if (!decoded) return null;

  if (
    decoded.rol === 'admin' ||
    decoded.rol === 'empleado' ||
    decoded.admin === true ||
    decoded.empleado === true
  ) {
    return decoded;
  }

  if (!tieneCredencialesAdmin()) {
    return decoded;
  }

  try {
    const directSnap = await adminDb.collection('User').doc(decoded.uid).get();
    let userData = directSnap.exists ? directSnap.data() : null;

    if (!userData) {
      const authSnap = await adminDb
        .collection('User')
        .where('auth_id', '==', decoded.uid)
        .limit(1)
        .get();
      if (!authSnap.empty) userData = authSnap.docs[0].data();
    }

    if (!userData && decoded.email) {
      const emailSnap = await adminDb
        .collection('User')
        .where('Correo', '==', decoded.email)
        .limit(1)
        .get();
      if (!emailSnap.empty) userData = emailSnap.docs[0].data();
    }

    if (!userData) return null;

    const puesto = String(userData.Puesto || '').trim().toLowerCase();
    const rolCampo = String(userData.Rol || '').trim().toLowerCase();
    const idRol = Number(userData.ID_Rol);

    const perteneceAEmpleados =
      idRol === 1 ||
      idRol === 2 ||
      userData.Es_Empleado === true ||
      puesto === 'admin' ||
      puesto === 'administrador' ||
      puesto === 'empleado' ||
      rolCampo === 'admin' ||
      rolCampo === 'administrador' ||
      rolCampo === 'empleado';

    return perteneceAEmpleados ? decoded : null;
  } catch {
    return decoded;
  }
}

async function generarSiguienteIdUserServidor() {
  const snap = await adminDb.collection('User').get();
  let maxId = 0;
  snap.docs.forEach((d) => {
    if (d.id === '_schema_init' || d.id === '_placeholder') return;
    const data = d.data();
    if (data?._is_schema_template || data?._info) return;
    const num = Number(data?.ID_User ?? d.id);
    if (!isNaN(num) && Number.isInteger(num) && num > maxId && num < 2000000000) {
      maxId = num;
    }
  });
  return maxId + 1;
}

/**
 * POST /api/admin/usuarios
 * Crea un nuevo usuario con validación de DUI único y rol asignado.
 */
export async function POST(request) {
  try {
    const adminDecoded = await verificarAccesoAdminPanelRequest(request);
    if (!adminDecoded) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere pertenecer a la lista de Empleados.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const nombres = String(body.nombres || '').trim();
    const apellidos = String(body.apellidos || '').trim();
    const correo = String(body.correo || '').trim().toLowerCase();
    const telefono = body.telefono ? String(body.telefono).trim() : null;
    const dui = body.dui ? String(body.dui).trim() : null;
    const idRol = Number(body.idRol ?? (body.puesto === 'Administrador' ? 1 : body.puesto === 'Empleado' ? 2 : 3));
    const passwordNueva = body.password ? String(body.password) : '';

    if (!nombres || !correo) {
      return NextResponse.json(
        { error: 'Los nombres y el correo son obligatorios.' },
        { status: 400 }
      );
    }

    if (!tieneCredencialesAdmin()) {
      return NextResponse.json(
        { error: 'Credenciales de Firebase Admin no disponibles en el servidor.' },
        { status: 503 }
      );
    }

    // 1. Validar que el DUI sea único si se proporcionó
    if (dui) {
      const duiSnap = await adminDb.collection('User').where('DUI', '==', dui).limit(1).get();
      if (!duiSnap.empty) {
        return NextResponse.json(
          { error: 'Error: Este DUI ya está registrado en otro usuario.' },
          { status: 409 }
        );
      }
    }

    // 2. Validar que el Correo no esté duplicado
    const correoSnap = await adminDb.collection('User').where('Correo', '==', correo).limit(1).get();
    if (!correoSnap.empty) {
      return NextResponse.json(
        { error: 'Ese correo electrónico ya está registrado.' },
        { status: 409 }
      );
    }

    // 3. Crear o recuperar en Firebase Auth
    let authUserRecord = null;
    try {
      authUserRecord = await adminAuth.getUserByEmail(correo);
      if (passwordNueva && passwordNueva.length >= 6) {
        await adminAuth.updateUser(authUserRecord.uid, {
          password: passwordNueva,
          displayName: `${nombres} ${apellidos}`.trim(),
        });
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const passwordInicial =
          passwordNueva && passwordNueva.length >= 6
            ? passwordNueva
            : `${crypto.randomBytes(24).toString('base64url')}!Aa1`;
        authUserRecord = await adminAuth.createUser({
          email: correo,
          password: passwordInicial,
          displayName: `${nombres} ${apellidos}`.trim(),
          emailVerified: false,
        });
      } else {
        throw err;
      }
    }

    const esEmpleado = idRol === 1 || idRol === 2;
    const rolClaim = idRol === 1 ? 'admin' : idRol === 2 ? 'empleado' : 'usuario';
    const puestoLabel = obtenerEtiquetaRol(idRol);

    await adminAuth.setCustomUserClaims(authUserRecord.uid, {
      rol: rolClaim,
      admin: idRol === 1,
      empleado: esEmpleado,
    }).catch(() => {});

    let resetLink = null;
    if (!passwordNueva) {
      resetLink = await adminAuth.generatePasswordResetLink(correo).catch(() => null);
    }

    const nuevoId = await generarSiguienteIdUserServidor();
    const ahora = new Date().toISOString();
    const baseUsername = (body.usuario ? String(body.usuario).trim() : correo.split('@')[0] || 'usuario')
      .replace(/\s+/g, '_')
      .toLowerCase();

    await adminDb.collection('User').doc(String(nuevoId)).set({
      ID_User: nuevoId,
      auth_id: authUserRecord.uid,
      Nombres: nombres,
      Apellidos: apellidos,
      Correo: correo,
      Usuario: baseUsername,
      Telefono: telefono,
      DUI: dui,
      Password_Hash: null,
      Puesto: puestoLabel,
      ID_Rol: idRol,
      ID_EstadoUsuario: 1,
      Es_Empleado: esEmpleado,
      Fecha_Creacion: ahora,
      Fecha_Incorporacion: ahora,
    });

    return NextResponse.json({
      ok: true,
      idUser: nuevoId,
      uid: authUserRecord.uid,
      resetLink,
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo crear el usuario.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/usuarios
 * Actualiza el perfil de un usuario, su rol (ID_Rol), valida DUI único y opcionalmente actualiza su contraseña en Firebase Auth.
 */
export async function PUT(request) {
  try {
    const adminDecoded = await verificarAccesoAdminPanelRequest(request);
    if (!adminDecoded) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere pertenecer a la lista de Empleados.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { idUser, docId, authId, nombres, apellidos, usuario, correo, telefono, dui, idRol, nuevaPassword } = body;

    if (idUser == null && !docId) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    if (!tieneCredencialesAdmin()) {
      return NextResponse.json(
        {
          ok: false,
          sinAdminSdk: true,
          error: 'Firebase Admin SDK no configurado con llave privada en este entorno.',
        },
        { status: 200 }
      );
    }

    // 1. Validar unicidad estricta de DUI en servidor
    const nuevoDui = dui ? String(dui).trim() : '';
    if (nuevoDui) {
      const snapDui = await adminDb.collection('User').where('DUI', '==', nuevoDui).get();
      const conflicto = snapDui.docs.find((d) => {
        if (d.id === '_schema_init' || d.id === '_placeholder') return false;
        const data = d.data();
        const dIdUser = data?.ID_User ?? d.id;
        return String(dIdUser) !== String(idUser) && String(d.id) !== String(docId || idUser);
      });

      if (conflicto) {
        return NextResponse.json(
          { error: 'Error: Este DUI ya está registrado en otro usuario.' },
          { status: 409 }
        );
      }
    }

    // 2. Localizar el documento del usuario en Firestore
    let userRef = docId ? adminDb.collection('User').doc(String(docId)) : adminDb.collection('User').doc(String(idUser));
    let userSnap = await userRef.get();

    if (!userSnap.exists) {
      const opciones = [idUser, String(idUser)];
      if (!isNaN(Number(idUser))) opciones.push(Number(idUser));
      const qSnap = await adminDb
        .collection('User')
        .where('ID_User', 'in', Array.from(new Set(opciones)))
        .limit(1)
        .get();
      if (!qSnap.empty) {
        userRef = qSnap.docs[0].ref;
        userSnap = qSnap.docs[0];
      }
    }

    const userDataActual = userSnap.exists ? userSnap.data() : {};
    const idRolNum = Number(idRol ?? userDataActual.ID_Rol ?? 3);
    const esEmpleado = idRolNum === 1 || idRolNum === 2;
    const puestoLabel = obtenerEtiquetaRol(idRolNum);
    const rolClaim = idRolNum === 1 ? 'admin' : idRolNum === 2 ? 'empleado' : 'usuario';

    const camposActualizar = {
      Nombres: String(nombres || '').trim(),
      Apellidos: String(apellidos || '').trim(),
      Usuario: String(usuario || `${nombres || ''} ${apellidos || ''}`.trim()).trim(),
      Correo: String(correo || '').trim().toLowerCase(),
      Telefono: telefono ? String(telefono).trim() : null,
      DUI: nuevoDui || null,
      ID_Rol: idRolNum,
      Puesto: puestoLabel,
      Es_Empleado: esEmpleado,
    };

    if (userSnap.exists) {
      await userRef.update(camposActualizar);
    }

    // 3. Sincronizar con Firebase Auth (Custom Claims, Email, DisplayName y Contraseña si se indicó)
    let targetUid = authId || userDataActual?.auth_id || null;
    if (!targetUid && correo) {
      try {
        const uByEmail = await adminAuth.getUserByEmail(String(correo).trim().toLowerCase());
        targetUid = uByEmail.uid;
      } catch {
        targetUid = null;
      }
    }

    let passwordActualizadaDirecta = false;
    if (targetUid) {
      const authUpdatePayload = {
        displayName: `${camposActualizar.Nombres} ${camposActualizar.Apellidos}`.trim(),
      };
      if (camposActualizar.Correo) {
        authUpdatePayload.email = camposActualizar.Correo;
      }
      if (nuevaPassword && String(nuevaPassword).length >= 6) {
        authUpdatePayload.password = String(nuevaPassword);
      }

      try {
        await adminAuth.updateUser(String(targetUid), authUpdatePayload);
        if (nuevaPassword && String(nuevaPassword).length >= 6) {
          passwordActualizadaDirecta = true;
        }
      } catch (errUpdateAuth) {
        console.warn('No se pudo actualizar credencial en Firebase Auth:', errUpdateAuth?.message);
      }

      await adminAuth
        .setCustomUserClaims(String(targetUid), {
          rol: rolClaim,
          admin: idRolNum === 1,
          empleado: esEmpleado,
        })
        .catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      idUser,
      idRol: idRolNum,
      esEmpleado,
      passwordActualizadaDirecta,
    });
  } catch (error) {
    console.error('Error en PUT /api/admin/usuarios:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo actualizar el usuario.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/usuarios
 * Activa o desactiva un usuario y sincroniza el bloqueo con Firebase Auth.
 */
export async function PATCH(request) {
  try {
    const adminDecoded = await verificarAccesoAdminPanelRequest(request);
    if (!adminDecoded) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere pertenecer a la lista de Empleados.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { idUser, nuevoEstado } = body;
    if (idUser == null || (nuevoEstado !== 1 && nuevoEstado !== 2)) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    }

    if (!tieneCredencialesAdmin()) {
      return NextResponse.json({ error: 'Admin SDK no disponible.' }, { status: 503 });
    }

    let userRef = adminDb.collection('User').doc(String(idUser));
    let userSnap = await userRef.get();
    if (!userSnap.exists) {
      const opciones = [idUser, String(idUser)];
      if (!isNaN(Number(idUser))) opciones.push(Number(idUser));
      const qSnap = await adminDb
        .collection('User')
        .where('ID_User', 'in', Array.from(new Set(opciones)))
        .limit(1)
        .get();
      if (!qSnap.empty) {
        userRef = qSnap.docs[0].ref;
        userSnap = qSnap.docs[0];
      }
    }

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const userData = userSnap.data();
    const estadoAnterior = Number(userData.ID_EstadoUsuario ?? 1);
    await userRef.update({ ID_EstadoUsuario: nuevoEstado });

    try {
      const auditRef = adminDb.collection('Auditoria_CambioEstado_User').doc();
      await auditRef.set({
        ID_Auditoria: auditRef.id,
        ID_User: userData.ID_User ?? idUser,
        ID_UserAccion: adminDecoded.uid,
        Usuario_Admin: adminDecoded.email || 'Admin',
        ID_EstadoAnterior: estadoAnterior,
        ID_EstadoNuevo: nuevoEstado,
        Fecha_Registro: new Date().toISOString(),
      });
    } catch (errAudit) {
      console.error('Error guardando Auditoria_CambioEstado_User:', errAudit);
    }

    const targetUid = userData.auth_id || userSnap.id;
    const deshabilitar = nuevoEstado === 2;

    if (targetUid) {
      await adminAuth.updateUser(String(targetUid), { disabled: deshabilitar }).catch(() => {});
      if (deshabilitar) {
        await adminAuth.revokeRefreshTokens(String(targetUid)).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, idUser, nuevoEstado });
  } catch (error) {
    console.error('Error actualizando estado de usuario:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo actualizar el estado.' },
      { status: 500 }
    );
  }
}
