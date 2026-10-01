import { pool, query } from '../src/lib/db';

async function testConnection() {
  console.log('--- Verificando conexión a PostgreSQL (congreso_ets2026_db) ---');
  try {
    const res = await query('SELECT NOW() as now, current_database() as db, current_user as user');
    console.log('✅ Conexión exitosa!');
    console.log(`   Base de datos: ${res.rows[0].db}`);
    console.log(`   Usuario: ${res.rows[0].user}`);
    console.log(`   Hora servidor: ${res.rows[0].now}`);

    const counts = await query(`
      SELECT 
        (SELECT COUNT(*) FROM usuarios) as total_usuarios,
        (SELECT COUNT(*) FROM roles) as total_roles,
        (SELECT COUNT(*) FROM operadores) as total_operadores,
        (SELECT COUNT(*) FROM actividades) as total_actividades,
        (SELECT COUNT(*) FROM puntos_acceso) as total_puntos
    `);

    console.log('📊 Resumen de Datos:');
    console.log(`   - Usuarios: ${counts.rows[0].total_usuarios}`);
    console.log(`   - Roles: ${counts.rows[0].total_roles}`);
    console.log(`   - Operadores: ${counts.rows[0].total_operadores}`);
    console.log(`   - Actividades: ${counts.rows[0].total_actividades}`);
    console.log(`   - Puntos de Acceso: ${counts.rows[0].total_puntos}`);

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error al conectar con PostgreSQL:', error.message);
    process.exit(1);
  }
}

testConnection();
