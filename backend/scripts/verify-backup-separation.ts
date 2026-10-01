import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { createIntegralBackup, listBackups } from '../src/lib/backupService';
import { pool } from '../src/lib/db';

async function main() {
  console.log('--- TEST VERIFICACIÓN DE SEPARACIÓN MODULAR DE BACKUP ---');

  // 1. Crear backup
  console.log('1. Ejecutando createIntegralBackup()...');
  const metadata = await createIntegralBackup('TEST_SUITE_VERIFY', true);
  console.log('✅ Backup creado exitosamente:', metadata.filename);
  console.log('   SHA256:', metadata.sha256);
  console.log('   Total Registros:', metadata.totalRegistros);
  console.log('   Desglose Separación:', JSON.stringify(metadata.separacion_modulos, null, 2));

  // 2. Inspeccionar archivo ZIP físico
  const zipPath = metadata.filepath;
  if (!fs.existsSync(zipPath)) {
    throw new Error(`El archivo ZIP ${zipPath} no existe físicamente.`);
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().map((e) => e.entryName);
  console.log('\n2. Contenido del archivo ZIP generado:');
  entries.forEach((e) => console.log(`   📦 ${e}`));

  // Verificar existencia de archivos obligatorios
  const requiredFiles = [
    'usuarios/datos_usuarios.json',
    'datos_usuarios.json',
    'configuracion/datos_configuracion.json',
    'datos_configuracion.json',
    'configuraciones_sistema.json',
    'operacion/datos_operacion.json',
    'datos_operacion.json',
    'datos_completos.json',
    'manifiesto.json',
    'schema_3fn.sql',
    'dumps/dump_completo.sql',
    'dumps/dump_operacion.sql',
    'dumps/dump_configuracion.sql',
    'dumps/dump_usuarios.sql',
  ];

  for (const reqFile of requiredFiles) {
    if (!entries.includes(reqFile)) {
      throw new Error(`FALTA ARCHIVO OBLIGATORIO EN EL ZIP: ${reqFile}`);
    }
  }
  console.log('✅ Todos los archivos y Dumps SQL requeridos están presentes en el ZIP.');

  // 3. Verificar separación lógica de tablas
  console.log('\n3. Validando aislamiento de datos por módulo...');

  const usuariosData = JSON.parse(zip.readAsText('usuarios/datos_usuarios.json'));
  const configuracionData = JSON.parse(zip.readAsText('configuracion/datos_configuracion.json'));
  const operacionData = JSON.parse(zip.readAsText('operacion/datos_operacion.json'));

  console.log('   Tablas en usuarios/datos_usuarios.json:', Object.keys(usuariosData));
  console.log('   Tablas en configuracion/datos_configuracion.json:', Object.keys(configuracionData));
  console.log('   Tablas en operacion/datos_operacion.json:', Object.keys(operacionData));

  // Validar que tablas de usuarios NO están en operacion
  if (operacionData['usuarios'] || operacionData['operadores']) {
    throw new Error('FALLO DE AISLAMIENTO: Datos de usuarios encontrados dentro de operacion.');
  }

  // Validar que tablas de configuracion NO están en operacion
  if (operacionData['eventos'] || operacionData['configuraciones_sistema']) {
    throw new Error('FALLO DE AISLAMIENTO: Datos de configuracion encontrados dentro de operacion.');
  }

  // Validar que tablas de operacion NO están en configuracion ni usuarios
  if (configuracionData['acreditaciones'] || usuariosData['acreditaciones']) {
    throw new Error('FALLO DE AISLAMIENTO: Datos de operacion (acreditaciones) encontrados en modulos incorrectos.');
  }

  console.log('✅ Aislamiento estricto verificado: Ningún módulo comparte tablas inapropiadas.');

  // 4. Verificar listBackups()
  console.log('\n4. Verificando función listBackups()...');
  const backups = await listBackups();
  const current = backups.find((b) => b.filename === metadata.filename);
  if (!current) {
    throw new Error(`listBackups() no encontró el backup recién creado ${metadata.filename}`);
  }
  console.log('✅ Backup listado correctamente en el sistema:');
  console.log('   Filename:', current.filename);
  console.log('   Bytes:', current.sizeBytes);
  console.log('   Módulos separados:', current.separacion_modulos);
  console.log('   Dumps SQL incluidos:', current.dumps_sql);

  // 5. Verificar generación de Dumps SQL independientes de la base de datos
  console.log('\n5. Verificando generación de Dumps SQL independientes (pg_dump)...');
  const { createStandaloneSqlDump, listSqlDumps } = await import('../src/lib/backupService');
  
  const dumpCompleto = await createStandaloneSqlDump('completo', 'TEST_SUITE');
  console.log('✅ Dump Completo creado:', dumpCompleto.filename, `(${dumpCompleto.sizeBytes} bytes)`);

  const dumpOperacion = await createStandaloneSqlDump('operacion', 'TEST_SUITE');
  console.log('✅ Dump Operación creado:', dumpOperacion.filename, `(${dumpOperacion.sizeBytes} bytes)`);

  const sqlDumps = await listSqlDumps();
  console.log(`✅ Total de Dumps SQL independientes en disco: ${sqlDumps.length}`);
  if (sqlDumps.length < 2) {
    throw new Error('No se registraron los dumps SQL creados.');
  }

  console.log('\n🎉 ¡TODAS LAS VERIFICACIONES DE BACKUP MODULAR Y DUMPS SQL PASARON CON ÉXITO!');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Error en verificación:', err);
  pool.end();
  process.exit(1);
});
