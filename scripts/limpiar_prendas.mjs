import { adminDb, tieneCredencialesAdmin } from '../src/lib/firebaseAdmin.js';

const COLECCIONES_A_ELIMINAR = [
  'Productos',
  'Fotos_Productos',
  'Producto_Material',
  'Variante_Producto',
  'Inventario',
  'Auditoria_Inventario'
];

const COLECCIONES_PROTEGIDAS = new Set([
  'User',
  'Roles',
  'Colores',
  'Talla',
  'Tipos_Talla',
  'Marca',
  'Categorias_Producto',
  'Almacenes'
]);

async function limpiarColeccion(nombreColeccion) {
  if (COLECCIONES_PROTEGIDAS.has(nombreColeccion)) {
    throw new Error(`¡ALERTA DE SEGURIDAD! Intento de borrar colección protegida: ${nombreColeccion}`);
  }

  const colRef = adminDb.collection(nombreColeccion);
  let totalEliminados = 0;

  while (true) {
    const snap = await colRef.limit(400).get();
    if (snap.empty) break;

    const batch = adminDb.batch();
    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalEliminados += snap.size;
    console.log(`[${nombreColeccion}] Eliminados ${totalEliminados} documentos...`);
  }

  return totalEliminados;
}

export async function ejecutarResetPrendas() {
  console.log('=== INICIO DE RESET DE PRENDAS ===');
  console.log('Verificando credenciales de Firebase Admin...');
  if (!tieneCredencialesAdmin()) {
    throw new Error('No hay credenciales de Firebase Admin configuradas.');
  }

  const resultados = {};

  for (const col of COLECCIONES_A_ELIMINAR) {
    console.log(`\nIniciando limpieza de colección: "${col}"`);
    const eliminados = await limpiarColeccion(col);
    resultados[col] = eliminados;
    console.log(`✓ Limpieza completada en "${col}": ${eliminados} documentos borrados.`);
  }

  console.log('\n=== RESUMEN DE LIMPIEZA ===');
  console.table(resultados);
  console.log('✓ Catálogos maestros protegidos intactos (User, Roles, Colores, Talla, Tipos_Talla, Marca, Categorias_Producto, Almacenes).');
  console.log('=== FIN DEL RESET ===\n');

  return resultados;
}

// Si se ejecuta directamente desde terminal:
const esEjecucionDirecta = process.argv[1] && (
  process.argv[1].endsWith('limpiar_prendas.mjs') ||
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/limpiar_prendas.mjs')
);

if (esEjecucionDirecta) {
  ejecutarResetPrendas()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error durante la ejecución del reset:', err);
      process.exit(1);
    });
}

