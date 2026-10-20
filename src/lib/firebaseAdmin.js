import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  // 1. Variable de entorno con el contenido JSON directo del Service Account
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || 'the-outfit-b0003',
      });
    } catch (e) {
      console.error('Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Ruta a archivo local serviceAccountKey.json o el archivo descargado
  const possiblePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(process.cwd(), 'service-account.json')
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
        return initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || 'the-outfit-b0003',
        });
      } catch (err) {
        console.error(`Error leyendo clave de servicio en ${p}:`, err);
      }
    }
  }

  // 3. Fallback con Application Default Credentials de Google Cloud o Project ID
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'the-outfit-b0003',
  });
}

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

