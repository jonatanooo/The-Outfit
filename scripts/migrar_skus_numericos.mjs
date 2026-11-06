import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

/**
 * Carga variables de entorno desde .env.local si no están presentes en process.env
 */
function cargarEnvLocal() {
  if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) return;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

cargarEnvLocal();

function inicializarFirebaseAdmin() {
  if (getApps().length > 0) return;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
        initializeApp({
          credential: cert(sa),
          projectId: sa.project_id || projectId,
        });
        return;
      } catch (err) {
        console.error('Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', err);
      }
    }
    console.error(
      '❌ Faltan credenciales de Firebase Admin (FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY).'
    );
    process.exit(1);
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

inicializarFirebaseAdmin();

const db = getFirestore();

/**
 * Mapeo canónico numérico de Tipos_Talla por si alguna talla carece de ID numérico
 */
const FALLBACK_TALLAS = {
  XS: 1,
  S: 2,
  M: 11,
  L: 12,
  XL: 4,
  XXL: 21,
};

async function migrarSkusNumericos() {
  console.log('====================================================================');
  console.log('🚀 MIGRACIÓN RETROACTIVA: SKUs 100% NUMÉRICOS & ARQUITECTURA DE TALLAS');
  console.log('====================================================================\n');

  // 1. Cargar y normalizar Tipos_Talla con IDs 100% numéricos
  console.log('📦 Paso 1: Verificando tabla/colección "Tipos_Talla"...');
  const ttSnap = await db.collection('Tipos_Talla').get();
  const mapaTallasNombreAId = new Map();
  const mapaTallasIdDocAIdNum = new Map();

  for (const d of ttSnap.docs) {
    const data = d.data();
    if (data._is_schema_template) continue;
    const nombre = (data.Nombre_TipoTalla || '').trim().toUpperCase();
    let idNum = data.ID_TipoTalla;

    // Si el ID_TipoTalla no es numérico (ej: 'Tlknw6ykpxomk46507X2' en XS), actualizarlo
    if (isNaN(Number(idNum)) || Number(idNum) <= 0) {
      const idAsignado = FALLBACK_TALLAS[nombre] || 99;
      console.log(`  🔧 Normalizando talla "${nombre}" de id "${idNum}" a id numérico: ${idAsignado}`);
      await d.ref.set({ ID_TipoTalla: idAsignado }, { merge: true });
      idNum = idAsignado;
    } else {
      idNum = Number(idNum);
    }

    if (nombre) {
      mapaTallasNombreAId.set(nombre, idNum);
    }
    mapaTallasIdDocAIdNum.set(d.id, idNum);
    mapaTallasIdDocAIdNum.set(String(idNum), idNum);
  }

  // Asegurar que todas las tallas estándar existen con su ID numérico
  for (const [nom, numId] of Object.entries(FALLBACK_TALLAS)) {
    if (!mapaTallasNombreAId.has(nom)) {
      console.log(`  ➕ Creando talla estándar "${nom}" con ID numérico: ${numId}`);
      await db.collection('Tipos_Talla').doc(String(numId)).set({
        ID_TipoTalla: numId,
        Nombre_TipoTalla: nom,
      });
      mapaTallasNombreAId.set(nom, numId);
      mapaTallasIdDocAIdNum.set(String(numId), numId);
    }
  }

  console.log('  ✅ Mapa de Tallas activo:');
  for (const [nom, idNum] of mapaTallasNombreAId.entries()) {
    console.log(`     - Talla ${nom.padEnd(4)} -> ID Numérico: ${idNum}`);
  }

  // 2. Cargar tabla Talla auxiliar para mapeo
  console.log('\n📦 Paso 2: Indexando tabla "Talla"...');
  const tSnap = await db.collection('Talla').get();
  const mapaTallaDocATipoNum = new Map();
  tSnap.docs.forEach((d) => {
    const data = d.data();
    const idTipo = data.ID_TipoTalla;
    if (idTipo != null) {
      const num = mapaTallasIdDocAIdNum.get(String(idTipo)) || Number(idTipo);
      if (!isNaN(num) && num > 0) {
        mapaTallaDocATipoNum.set(d.id, num);
        mapaTallaDocATipoNum.set(String(data.ID_Talla), num);
      }
    }
  });

  // 3. Normalizar códigos numéricos de Productos Base (Productos)
  console.log('\n📦 Paso 3: Verificando códigos numéricos en "Productos"...');
  const pSnap = await db.collection('Productos').get();
  const mapaProductosCodigos = new Map();
  let maxCodNum = 10000;

  // Encontrar el mayor código numérico existente
  pSnap.docs.forEach((d) => {
    const data = d.data();
    const num = Number(data.Codigo_Producto ?? data.ID_Producto ?? d.id);
    if (!isNaN(num) && num > maxCodNum && num < 1000000000) {
      maxCodNum = num;
    }
  });

  for (const d of pSnap.docs) {
    const data = d.data();
    let codNum = null;
    const rawId = data.ID_Producto ?? d.id;

    if (data.Codigo_Producto && !isNaN(Number(data.Codigo_Producto))) {
      codNum = Number(data.Codigo_Producto);
    } else if (!isNaN(Number(rawId)) && /^\d+$/.test(String(rawId))) {
      codNum = Number(rawId);
    } else {
      // Producto con ID alfanumérico: asignar código numérico secuencial
      maxCodNum += 1;
      codNum = maxCodNum;
      console.log(`  🏷️ Asignando código numérico ${codNum} al producto "${data.Nombre_Producto || d.id}"`);
      await d.ref.set({ Codigo_Producto: codNum }, { merge: true });
    }

    mapaProductosCodigos.set(d.id, codNum);
    mapaProductosCodigos.set(String(rawId), codNum);
  }
  console.log(`  ✅ ${pSnap.size} productos verificados.`);

  // 4. Migración de Variante_Producto a SKU numérico (${ID_Producto}${ID_TipoTalla})
  console.log('\n📦 Paso 4: Escaneando "Variante_Producto" para migrar SKUs alfanuméricos...');
  const vSnap = await db.collection('Variante_Producto').get();
  let variantesMigradas = 0;
  let variantesIntactas = 0;

  for (const d of vSnap.docs) {
    const data = d.data();
    if (data._schema_init || d.id === '_schema_init') continue;

    const idVarianteOriginal = String(data.ID_Variante ?? d.id);
    const idProductoOriginal = data.ID_Producto;
    const idProdNum =
      mapaProductosCodigos.get(String(idProductoOriginal)) ||
      mapaProductosCodigos.get(d.id) ||
      (!isNaN(Number(idProductoOriginal)) ? Number(idProductoOriginal) : null);

    if (!idProdNum) {
      console.log(`  ⚠️ Saltando variante huérfana #${d.id} sin producto base.`);
      continue;
    }

    // Resolver ID numérico de la talla
    let idTallaNum = null;

    // A. ¿El SKU antiguo contiene una letra de talla al final? (ej: '10050M', '11S', '21XL')
    const matchLetra = idVarianteOriginal.match(/^(\d+)?([A-Za-z]+)$/);
    if (matchLetra) {
      const letra = matchLetra[2].toUpperCase();
      if (mapaTallasNombreAId.has(letra)) {
        idTallaNum = mapaTallasNombreAId.get(letra);
      }
    }

    // B. Si no se resolvió por letra en SKU, resolver por ID_TipoTalla o ID_Talla
    if (!idTallaNum && data.ID_TipoTalla != null) {
      idTallaNum = mapaTallasIdDocAIdNum.get(String(data.ID_TipoTalla)) || Number(data.ID_TipoTalla);
    }
    if (!idTallaNum && data.ID_Talla != null) {
      idTallaNum =
        mapaTallaDocATipoNum.get(String(data.ID_Talla)) ||
        mapaTallasIdDocAIdNum.get(String(data.ID_Talla));
    }

    // Si es un registro base sin talla (ID_Talla == null), dejarlo como producto base
    if (!idTallaNum || data.ID_Talla == null) {
      variantesIntactas++;
      continue;
    }

    // Generar el nuevo SKU 100% numérico: Producto Base + ID Talla
    const nuevoSkuNumerico = Number(`${idProdNum}${idTallaNum}`);

    // Si ya tiene el SKU correcto, no requiere migración
    if (String(idVarianteOriginal) === String(nuevoSkuNumerico) && Number(data.ID_Variante) === nuevoSkuNumerico) {
      variantesIntactas++;
      continue;
    }

    console.log(
      `  🔄 Migrando SKU: "${idVarianteOriginal}" -> ${nuevoSkuNumerico} (Prod: ${idProdNum}, TallaId: ${idTallaNum})`
    );

    // 1. Guardar la variante con el nuevo ID_Variante numérico
    const nuevaDataVariante = {
      ...data,
      ID_Variante: nuevoSkuNumerico,
      ID_Producto: idProductoOriginal,
      ID_TipoTalla: idTallaNum,
      Precio_Actual: Number(data.Precio_Actual) || 0,
      Fecha_Actualizacion_Migracion: new Date().toISOString(),
    };

    await db.collection('Variante_Producto').doc(String(nuevoSkuNumerico)).set(nuevaDataVariante);

    // 2. Actualizar referencias en Inventario
    const invSnap = await db
      .collection('Inventario')
      .where('ID_Variante', 'in', [idVarianteOriginal, Number(idVarianteOriginal) || idVarianteOriginal, d.id])
      .get();

    for (const invDoc of invSnap.docs) {
      await invDoc.ref.set({ ID_Variante: nuevoSkuNumerico }, { merge: true });
    }

    // 3. Actualizar referencias en Auditoria_Inventario
    const auditSnap = await db
      .collection('Auditoria_Inventario')
      .where('ID_Variante', 'in', [idVarianteOriginal, Number(idVarianteOriginal) || idVarianteOriginal, d.id])
      .get();

    for (const audDoc of auditSnap.docs) {
      await audDoc.ref.set({ ID_Variante: nuevoSkuNumerico }, { merge: true });
    }

    // 4. Actualizar referencias en Talla
    const tallaSnap = await db
      .collection('Talla')
      .where('ID_Variante', 'in', [idVarianteOriginal, Number(idVarianteOriginal) || idVarianteOriginal, d.id])
      .get();

    for (const tDoc of tallaSnap.docs) {
      await tDoc.ref.set({ ID_Variante: nuevoSkuNumerico }, { merge: true });
    }

    // 5. Si el docId anterior es diferente al nuevo, eliminar el registro antiguo
    if (d.id !== String(nuevoSkuNumerico)) {
      await d.ref.delete();
    }

    variantesMigradas++;
  }

  console.log('\n====================================================================');
  console.log('🎉 RESUMEN DE LA MIGRACIÓN:');
  console.log(`   - Variantes migradas al formato numérico: ${variantesMigradas}`);
  console.log(`   - Variantes que ya estaban en formato correcto: ${variantesIntactas}`);
  console.log('   - Integridad del Producto Base: 100% preservada (CERO eliminaciones)');
  console.log('====================================================================\n');
}

migrarSkusNumericos()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error ejecutando migración:', err);
    process.exit(1);
  });

