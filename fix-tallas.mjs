import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Configura las variables FIREBASE_ADMIN_* en .env.local y ejecuta con: node --env-file=.env.local fix-tallas.mjs');
    process.exit(1);
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

const db = getFirestore();

async function run() {
  const nuevoId = Date.now();
  await db.collection('Tipos_Talla').doc(String(nuevoId)).set({
    ID_TipoTalla: nuevoId,
    Nombre_TipoTalla: 'XXL',
  });
  console.log('Talla XXL registrada en Firestore con ID:', nuevoId);
}

run();
