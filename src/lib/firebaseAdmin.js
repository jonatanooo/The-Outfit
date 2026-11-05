import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Normaliza la clave privada de Firebase Admin para soportar cualquier formato
 * configurado en Vercel o .env.local (con comillas envolventes, \\n escapados,
 * saltos CRLF, JSON completo o base64 en una sola línea).
 */
function normalizarPrivateKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return undefined;

  let key = rawKey.trim();

  // Si se pegó el JSON completo en la variable
  if (key.startsWith('{') && key.endsWith('}')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) {
        key = String(parsed.private_key).trim();
      }
    } catch {
      // Continuar con limpieza estándar
    }
  }

  // Quitar comillas dobles o simples envolventes (común al copiar de .env.local a Vercel)
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith('\\"') && key.endsWith('\\"'))
  ) {
    if (key.startsWith('\\"')) {
      key = key.slice(2, -2).trim();
    } else {
      key = key.slice(1, -1).trim();
    }
  }

  // Convertir secuencias \\n o \n literales y saltos \r\n a saltos de línea reales
  key = key.replace(/\\+n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Si contiene los encabezados PEM, asegurar formato PEM canónico para OpenSSL 3
  const matchPem = key.match(
    /-----BEGIN (?:RSA )?PRIVATE KEY-----([\s\S]*?)-----END (?:RSA )?PRIVATE KEY-----/
  );
  if (matchPem) {
    const base64Body = matchPem[1].replace(/\s+/g, '');
    const lines = base64Body.match(/.{1,64}/g) || [];
    return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
  }

  return key;
}

/**
 * Inicializa Firebase Admin de forma perezosa (lazy) exclusivamente a partir
 * de variables de entorno seguras, evitando fallos durante `next build` en Vercel.
 */
export function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = (
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    ''
  )
    .trim()
    .replace(/^['"]|['"]$/g, '');

  const clientEmail = (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');

  const privateKey = normalizarPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  // 1. Inicialización mediante variables de entorno separadas (Recomendado en producción/Vercel)
  if (projectId && clientEmail && privateKey) {
    try {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (error) {
      console.error(
        'Advertencia: No se pudo inicializar cert() con FIREBASE_ADMIN_PRIVATE_KEY, verificando alternativa:',
        error?.message
      );
    }
  }

  // 2. Alternativa mediante JSON en variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim().replace(
        /^['"]|['"]$/g,
        ''
      );
      const serviceAccount = JSON.parse(rawJson);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = normalizarPrivateKey(serviceAccount.private_key);
      }
      return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (error) {
      console.error('Error parseando la variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY:', error);
    }
  }

  // 3. Fallback seguro (permite que `next build` recolecte rutas sin romper el build)
  return initializeApp({
    projectId: projectId || 'the-outfit-2480c',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

function createLazyProxy(getter) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const instance = getter();
        const value = instance[prop];
        return typeof value === 'function' ? value.bind(instance) : value;
      },
    }
  );
}

export const adminApp = createLazyProxy(() => getAdminApp());
export const adminDb = createLazyProxy(() => getFirestore(getAdminApp()));
export const adminAuth = createLazyProxy(() => getAuth(getAdminApp()));
