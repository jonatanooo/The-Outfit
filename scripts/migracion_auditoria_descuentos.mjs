import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function inicializarAdminDesdeEntorno() {
  if (getApps().length > 0) return;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    return;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
    return;
  }

  console.error(
    '❌ Faltan las variables de entorno FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY (ejecuta con node --env-file=.env.local).'
  );
  process.exit(1);
}

inicializarAdminDesdeEntorno();

const db = getFirestore();

async function migrarAuditoriaDescuentos() {
  console.log('🚀 Iniciando verificación y migración de colección Auditoria_Descuentos...');

  const colRef = db.collection('Auditoria_Descuentos');
  const snap = await colRef.limit(1).get();

  if (snap.empty) {
    console.log('ℹ️ La colección "Auditoria_Descuentos" está vacía o recién inicializada.');
    const idInicial = Date.now().toString();
    await colRef.doc(idInicial).set({
      ID_AuditoriaDescuento: idInicial,
      ID_Producto: 'SISTEMA_INIT',
      Nombre_Producto: 'Inicialización de Colección de Auditoría de Descuentos',
      ID_User: 'SISTEMA',
      Usuario: 'Sistema The Outfit',
      Correo: 'admin@theoutfit.com',
      Fecha_Cambio: new Date().toISOString(),
      Estado_Anterior: {
        Precio_Original: 0,
        Porcentaje_Descuento: 0,
        Fecha_Inicio_Oferta: null,
        Fecha_Fin_Oferta: null
      },
      Estado_Nuevo: {
        Porcentaje_Descuento: 0,
        Precio_Con_Descuento: 0,
        Fecha_Inicio_Oferta: null,
        Fecha_Fin_Oferta: null,
        Vigente: false
      },
      Detalle: 'Colección de auditoría de ofertas creada y verificada exitosamente.'
    });
    console.log(`✅ Colección "Auditoria_Descuentos" inicializada con documento de control #${idInicial}.`);
  } else {
    console.log('✅ Colección "Auditoria_Descuentos" ya existe y cuenta con registros.');
  }

  console.log('🎉 Migración completada.');
}

migrarAuditoriaDescuentos().catch((err) => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
