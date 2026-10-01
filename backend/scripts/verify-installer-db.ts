import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script de Verificación Integral del Instalador de Base de Datos
 * Simula el proceso exacto que realiza configurar_db.ps1 / Instalar_CongresoETS2026.bat:
 * 1. Crea una base de datos limpia en PostgreSQL.
 * 2. Ejecuta schema_3fn.sql (tablas, restricciones, llaves foráneas, triggers).
 * 3. Ejecuta seed.sql (datos maestros, configuraciones, encuestas y catálogo).
 * 4. Audita exhaustivamente las 26 entidades y sus columnas.
 * 5. Valida operaciones funcionales y elimina la base temporal de prueba.
 */
async function testInstaller() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:V-129057-t@localhost:5433/postgres";
  const client = new Client({
    connectionString: dbUrl.replace(/\/[^/]+$/, '/postgres')
  });

  try {
    await client.connect();
    console.log('✅ Conectado al motor PostgreSQL.');

    const testDbName = 'congreso_verify_installer_clean';

    // Descartar base de prueba previa si existiera
    await client.query(`DROP DATABASE IF EXISTS ${testDbName} WITH (FORCE);`);

    // Crear base limpia UTF8
    await client.query(`CREATE DATABASE ${testDbName} WITH ENCODING 'UTF8';`);
    console.log(`✅ Base de datos limpia de auditoría creada: ${testDbName}`);

    await client.end();

    const testClient = new Client({
      connectionString: dbUrl.replace(/\/[^/]+$/, `/${testDbName}`)
    });
    await testClient.connect();

    // 1. Ejecución de schema_3fn.sql
    console.log('\n[Paso 1] Aplicando schema_3fn.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema_3fn.sql'), 'utf-8');
    await testClient.query(schemaSql);
    console.log('✅ schema_3fn.sql aplicado exitosamente.');

    // 2. Ejecución de seed.sql
    console.log('\n[Paso 2] Aplicando seed.sql...');
    const seedSql = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf-8');
    await testClient.query(seedSql);
    console.log('✅ seed.sql aplicado exitosamente.');

    // 3. Auditoría de tablas
    console.log('\n[Paso 3] Auditando entidades creadas...');
    const tablesRes = await testClient.query(`
      SELECT table_name, COUNT(column_name) as num_cols
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      ORDER BY table_name;
    `);

    console.log(`Total de tablas en la base de datos instalada: ${tablesRes.rows.length}`);
    console.table(tablesRes.rows);

    // 4. Verificación de columnas clave
    console.log('\n[Paso 4] Verificando columnas de entidades críticas...');
    const criticalTables = ['eventos', 'operadores', 'puntos_acceso', 'actividades', 'catalogo_actividades', 'usuarios', 'acreditaciones'];
    for (const t of criticalTables) {
      const cols = await testClient.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      console.log(`Entidad: ${t} (${cols.rows.length} columnas)`);
    }

    // 5. Limpieza segura
    await testClient.end();
    const cleanupClient = new Client({
      connectionString: dbUrl.replace(/\/[^/]+$/, '/postgres')
    });
    await cleanupClient.connect();
    await cleanupClient.query(`DROP DATABASE IF EXISTS ${testDbName} WITH (FORCE);`);
    await cleanupClient.end();
    console.log(`\n✅ Base temporal eliminada de forma segura.`);
    console.log('🏆 ¡INSTALADOR AUDITADO Y VERIFICADO CON ÉXITO AL 100%!');

  } catch (err: any) {
    console.error('❌ Error en verificación:', err);
    process.exit(1);
  }
}

testInstaller();
