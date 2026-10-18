import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Cargar serviceAccountKey.json
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ No se encontró serviceAccountKey.json en la raíz del proyecto.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function migrarAuditoriaDescuentos() {
  console.log('🚀 Iniciando verificación y migración de tabla/colección Auditoria_Descuentos...');

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
    console.log(`✅ Colección "Auditoria_Descuentos" ya existe y cuenta con registros.`);
  }

  console.log('🎉 Migración completada.');
}

migrarAuditoriaDescuentos().catch((err) => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});

