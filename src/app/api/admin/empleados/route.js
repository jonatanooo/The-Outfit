import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = '__session';

/**
 * Verifica que quien invoca el endpoint sea un administrador autenticado.
 */
async function verificarAdminRequest(request) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!sessionCookie && !bearerToken) {
    return null;
  }

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

  if (decoded.rol === 'admin' || decoded.admin === true) {
    return decoded;
  }

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

  if (!userData && decoded.email && decoded.email_verified === true) {
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

  const esAdmin =
    idRol === 1 ||
    puesto === 'admin' ||
    puesto === 'administrador' ||
    rolCampo === 'admin' ||
    rolCampo === 'administrador';

  return esAdmin ? decoded : null;
}

/**
 * POST /api/admin/empleados
 * Crea un usuario/empleado de forma criptográficamente segura:
 * - NO almacena ninguna contraseña en texto plano en Firestore (elimina Contrasena: '12345').
 * - Crea el usuario en Firebase Auth con una entropía criptográfica aleatoria de 32 bytes.
 * - Genera un enlace seguro de restablecimiento de contraseña mediante adminAuth.generatePasswordResetLink().
 */
export async function POST(request) {
  try {
    const adminDecoded = await verificarAdminRequest(request);
    if (!adminDecoded) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere rol de administrador.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const nombres = String(body.nombres || '').trim();
    const apellidos = String(body.apellidos || '').trim();
    const correo = String(body.correo || '').trim().toLowerCase();
    const dui = String(body.dui || '').trim();
    const puesto = String(body.puesto || 'Empleado').trim();

    if (!nombres || !apellidos || !correo || !dui) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios.' },
        { status: 400 }
      );
    }

    // 1. Verificar duplicidad de DUI o Correo en Firestore
    const [duiSnap, correoSnap] = await Promise.all([
      adminDb.collection('User').where('DUI', '==', dui).limit(1).get(),
      adminDb.collection('User').where('Correo', '==', correo).limit(1).get(),
    ]);

    if (!duiSnap.empty) {
      return NextResponse.json(
        { error: 'Ese DUI ya está registrado para otro usuario.' },
        { status: 409 }
      );
    }

    if (!correoSnap.empty) {
      return NextResponse.json(
        { error: 'Ese correo electrónico ya está registrado.' },
        { status: 409 }
      );
    }

    // 2. Crear o recuperar el usuario en Firebase Auth con contraseña efímera de alta entropía (nunca almacenada)
    let authUserRecord = null;
    try {
      authUserRecord = await adminAuth.getUserByEmail(correo);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const randomPassword = `${crypto.randomBytes(24).toString('base64url')}!Aa1`;
        authUserRecord = await adminAuth.createUser({
          email: correo,
          password: randomPassword,
          displayName: `${nombres} ${apellidos}`.trim(),
          emailVerified: false,
        });
      } else {
        throw err;
      }
    }

    const esEmpleado = puesto === 'Empleado';
    const rolAsignado = esEmpleado ? 'empleado' : 'usuario';

    await adminAuth.setCustomUserClaims(authUserRecord.uid, {
      rol: rolAsignado,
      admin: false,
      empleado: esEmpleado,
    });

    // 3. Generar enlace seguro de configuración/restablecimiento de contraseña de Firebase Auth
    const resetLink = await adminAuth.generatePasswordResetLink(correo);

    // 4. Guardar perfil en Firestore SIN el campo Contrasena en texto plano y usando UID único (sin Date.now())
    const nuevoId = authUserRecord.uid;
    const ahora = new Date().toISOString();

    await adminDb.collection('User').doc(authUserRecord.uid).set({
      ID_User: nuevoId,
      auth_id: authUserRecord.uid,
      Nombres: nombres,
      Apellidos: apellidos,
      Correo: correo,
      Usuario: `${nombres} ${apellidos}`.trim(),
      DUI: dui,
      Puesto: puesto,
      ID_Rol: esEmpleado ? 2 : 3,
      ID_EstadoUsuario: 1,
      Es_Empleado: esEmpleado,
      Requiere_Cambio_Password: true,
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
    console.error('Error creando empleado de forma segura:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo crear el usuario.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/empleados
 * Activa o desactiva (banea) un usuario y sincroniza el bloqueo directamente en Firebase Auth
 * (disabled: true + revokeRefreshTokens) para evitar que un usuario baneado conserve tokens activos.
 */
export async function PATCH(request) {
  try {
    const adminDecoded = await verificarAdminRequest(request);
    if (!adminDecoded) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere rol de administrador.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { idUser, nuevoEstado } = body;
    if (!idUser || (nuevoEstado !== 1 && nuevoEstado !== 2)) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
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

    // Registrar en Auditoria_CambioEstado_User
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

