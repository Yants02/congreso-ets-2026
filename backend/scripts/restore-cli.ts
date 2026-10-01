#!/usr/bin/env tsx
/**
 * Herramienta de Disaster Recovery y Restauración por Línea de Comandos (CLI)
 * Sistema Congreso ETS 2026 - DETS GCABA
 * 
 * Uso:
 *   npx tsx scripts/restore-cli.ts <ruta_al_backup.zip | ruta_al_backup.sql> [--mode=completo|usuarios|operacion|configuracion]
 *   npm run db:restore -- <ruta_al_backup>
 */

import fs from 'fs';
import path from 'path';
import { query, pool } from '../src/lib/db';
import { restoreBackup, listBackups, listSqlDumps } from '../src/lib/backupService';

async function main() {
  console.log('\n========================================================================');
  console.log('  SISTEMA CONGRESO ETS 2026 - HERRAMIENTA DE DISASTER RECOVERY (CLI)');
  console.log('========================================================================\n');

  const args = process.argv.slice(2);
  let targetFile: string | null = null;
  let mode: 'completo' | 'operacion' | 'configuracion' | 'usuarios' = 'completo';

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const parsedMode = arg.split('=')[1].toLowerCase();
      if (['completo', 'operacion', 'configuracion', 'usuarios'].includes(parsedMode)) {
        mode = parsedMode as any;
      }
    } else if (!arg.startsWith('--')) {
      targetFile = arg;
    }
  }

  // Si no se proporcionó archivo, mostrar backups disponibles
  if (!targetFile) {
    console.log('ℹ️  No se especificó un archivo de respaldo. Analizando copias disponibles...\n');
    
    try {
      const zips = await listBackups();
      const sqls = await listSqlDumps();

      console.log('📦 Paquetes ZIP disponibles en backups/:');
      if (zips.length === 0) {
        console.log('   (Ningún archivo .zip encontrado)');
      } else {
        zips.forEach((z, i) => {
          console.log(`   [${i + 1}] ${z.filename} (${(z.sizeBytes / 1024).toFixed(1)} KB) - ${z.createdAt}`);
        });
      }

      console.log('\n📄 Dumps SQL disponibles en backups/dumps/:');
      if (sqls.length === 0) {
        console.log('   (Ningún archivo .sql encontrado)');
      } else {
        sqls.forEach((s, i) => {
          console.log(`   [${i + 1}] ${s.filename} (${(s.sizeBytes / 1024).toFixed(1)} KB) [Tipo: ${s.tipo}] - ${s.createdAt}`);
        });
      }

      console.log('\n👉 Para restaurar una copia, ejecute:');
      console.log('   npm run db:restore -- ./backups/nombre_archivo.zip\n');
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Error listando respaldos:', err.message);
      process.exit(1);
    }
  }

  // Resolver ruta absoluta
  const resolvedPath = path.resolve(targetFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ El archivo especificado no existe: ${resolvedPath}`);
    process.exit(1);
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  console.log(`📂 Archivo a restaurar: ${path.basename(resolvedPath)}`);
  console.log(`🎯 Modo seleccionado:   ${mode.toUpperCase()}`);
  console.log('⏳ Iniciando proceso atómico de restauración en PostgreSQL...\n');

  try {
    if (ext === '.zip') {
      const res = await restoreBackup(resolvedPath, 'CLI_DISASTER_RECOVERY', mode);
      
      console.log('========================================================================');
      console.log('  ✅ RESTAURACIÓN COMPLETADA CON ÉXITO');
      console.log('========================================================================');
      console.log(`• Tablas restauradas : ${res.tablasRestauradas.length}`);
      console.log(`• Total registros    : ${res.totalRestaurados}`);
      console.log(`• SHA-256 integridad : ${res.sha256}`);
      console.log(`• Fecha / Hora       : ${res.restauradoEn}`);
      console.log('• Detalle de tablas  : ' + res.tablasRestauradas.join(', '));
      console.log('========================================================================\n');
    } else if (ext === '.sql') {
      const sqlContent = fs.readFileSync(resolvedPath, 'utf8');
      console.log('• Ejecutando sentencias SQL en base de datos...');
      
      await query('BEGIN');
      await query(sqlContent);
      await query('COMMIT');

      console.log('========================================================================');
      console.log('  ✅ DUMP SQL APLICADO CORRECTAMENTE');
      console.log('========================================================================');
      console.log(`• Archivo SQL aplicado: ${path.basename(resolvedPath)}`);
      console.log('========================================================================\n');
    } else {
      console.error(`❌ Formato no soportado: ${ext}. Solo se admiten archivos .zip y .sql`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n❌ ERROR CRÍTICO EN RESTAURACIÓN:', err.message);
    try { await query('ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
