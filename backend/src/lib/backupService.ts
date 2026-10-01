import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { query, withTransaction } from './db';

const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || './backups');
const DUMP_DIR = path.resolve(process.env.DUMP_DIR || path.join(BACKUP_DIR, 'dumps'));

export interface BackupMetadata {
  filename: string;
  filepath: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  esManual: boolean;
  tablasExportadas: string[];
  totalRegistros: number;
  separacion_modulos?: {
    usuarios: { archivo: string; tablas: string[]; total_registros: number };
    configuracion: { archivo: string; tablas: string[]; total_registros: number };
    operacion: { archivo: string; tablas: string[]; total_registros: number };
  };
  dumps_sql?: string[];
}

export interface SqlDumpMetadata {
  filename: string;
  filepath: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  tipo: 'completo' | 'operacion' | 'configuracion' | 'usuarios';
  tablas?: string[];
}

export interface RestoreResult {
  success: boolean;
  totalRestaurados: number;
  tablasRestauradas: string[];
  sha256: string;
  manifiesto?: any;
  restauradoEn: string;
}

/**
 * Asegura que los directorios de backups y dumps existan
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  if (!fs.existsSync(DUMP_DIR)) {
    fs.mkdirSync(DUMP_DIR, { recursive: true });
  }
}

/**
 * Ejecuta pg_dump y retorna el resultado como string
 */
export function executePgDumpToString(
  options: {
    tables?: string[];
    dataOnly?: boolean;
    schemaOnly?: boolean;
    clean?: boolean;
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const dbUrl =
      process.env.DATABASE_URL ||
      'postgresql://congreso_app:V-129057-t@localhost:5433/congreso_ets2026';

    const args = [dbUrl, '--no-owner', '--no-privileges'];
    if (options.clean) args.push('--clean', '--if-exists');
    if (options.dataOnly) args.push('--data-only');
    if (options.schemaOnly) args.push('--schema-only');
    if (options.tables && options.tables.length > 0) {
      for (const t of options.tables) {
        args.push('-t', t);
      }
    }

    const proc = spawn('pg_dump', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Fallo al invocar pg_dump: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`pg_dump finalizó con código ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Ejecuta pg_dump y escribe la salida en un archivo destino
 */
export function executePgDumpToFile(
  outputPath: string,
  options: {
    tables?: string[];
    dataOnly?: boolean;
    schemaOnly?: boolean;
    clean?: boolean;
  } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbUrl =
      process.env.DATABASE_URL ||
      'postgresql://congreso_app:V-129057-t@localhost:5433/congreso_ets2026';

    const args = [dbUrl, '--no-owner', '--no-privileges'];
    if (options.clean) args.push('--clean', '--if-exists');
    if (options.dataOnly) args.push('--data-only');
    if (options.schemaOnly) args.push('--schema-only');
    if (options.tables && options.tables.length > 0) {
      for (const t of options.tables) {
        args.push('-t', t);
      }
    }

    const outStream = fs.createWriteStream(outputPath);
    const proc = spawn('pg_dump', args);

    proc.stdout.pipe(outStream);

    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Fallo al invocar pg_dump: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump finalizó con código ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Genera un backup integral que incluye:
 * 1. Todos los datos relacionales de las tablas (PostgreSQL en formato JSON / SQL insert statements)
 * 2. Las configuraciones de funcionamiento del sistema (configuraciones_sistema)
 * 3. El esquema DDL 3FN completo para recrear la base desde cero
 */
export async function createIntegralBackup(
  actor = 'SISTEMA',
  esManual = true
): Promise<BackupMetadata> {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup_ets2026_${timestamp}_${esManual ? 'manual' : 'auto'}`;
  const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`);

  // Clasificación estricta en 3 bloques independientes
  const tablasUsuarios = [
    'usuarios',
    'operadores',
    'usuario_roles_adicionales',
    'blacklist',
    'suscripciones_push',
  ];

  const tablasConfiguracion = [
    'configuraciones_sistema',
    'eventos',
    'roles',
    'estados_inscripcion',
    'tipos_acreditacion',
    'puntos_acceso',
    'categorias_tematicas',
    'catalogo_actividades',
    'actividades',
    'encuestas',
    'encuesta_preguntas',
    'encuesta_opciones',
  ];

  const tablasOperacion = [
    'acreditaciones',
    'actividad_inscripciones',
    'confirmaciones_asistencia',
    'certificados',
    'encuesta_respuestas',
    'encuesta_respuestas_detalles',
    'homologaciones_expositores',
    'logs_auditoria',
  ];

  const tablas = [...tablasUsuarios, ...tablasConfiguracion, ...tablasOperacion];

  const datosUsuarios: Record<string, any[]> = {};
  const datosConfiguracion: Record<string, any[]> = {};
  const datosOperacion: Record<string, any[]> = {};
  const backupData: Record<string, any[]> = {};

  let totalRegistrosUsuarios = 0;
  let totalRegistrosConfiguracion = 0;
  let totalRegistrosOperacion = 0;

  // 1. Extraer datos de Usuarios
  for (const tabla of tablasUsuarios) {
    try {
      const res = await query(`SELECT * FROM ${tabla}`);
      datosUsuarios[tabla] = res.rows;
      backupData[tabla] = res.rows;
      totalRegistrosUsuarios += res.rows.length;
    } catch (err) {
      console.warn(`Error exportando tabla de usuarios ${tabla}:`, err);
      datosUsuarios[tabla] = [];
      backupData[tabla] = [];
    }
  }

  // 2. Extraer datos de Configuración
  for (const tabla of tablasConfiguracion) {
    try {
      const res = await query(`SELECT * FROM ${tabla}`);
      datosConfiguracion[tabla] = res.rows;
      backupData[tabla] = res.rows;
      totalRegistrosConfiguracion += res.rows.length;
    } catch (err) {
      console.warn(`Error exportando tabla de configuración ${tabla}:`, err);
      datosConfiguracion[tabla] = [];
      backupData[tabla] = [];
    }
  }

  // 3. Extraer datos de la Operación
  for (const tabla of tablasOperacion) {
    try {
      const res = await query(`SELECT * FROM ${tabla}`);
      datosOperacion[tabla] = res.rows;
      backupData[tabla] = res.rows;
      totalRegistrosOperacion += res.rows.length;
    } catch (err) {
      console.warn(`Error exportando tabla de operación ${tabla}:`, err);
      datosOperacion[tabla] = [];
      backupData[tabla] = [];
    }
  }

  const totalRegistros = totalRegistrosUsuarios + totalRegistrosConfiguracion + totalRegistrosOperacion;

  // Extraer las configuraciones de funcionamiento puntuales
  const configsRes = await query(
    `SELECT clave, valor, descripcion, categoria FROM configuraciones_sistema`
  );
  const configuracionesFuncionamiento = configsRes.rows;

  // Leer el DDL del esquema
  const ddlPath = path.join(process.cwd(), 'database', 'schema_3fn.sql');
  const ddlContent = fs.existsSync(ddlPath) ? fs.readFileSync(ddlPath, 'utf8') : '';

  // Generar Dumps SQL de las bases de datos del sistema de manera asíncrona antes de empaquetar
  let dumpCompletoSql = '';
  let dumpOperacionSql = '';
  let dumpConfiguracionSql = '';
  let dumpUsuariosSql = '';

  try {
    [dumpCompletoSql, dumpOperacionSql, dumpConfiguracionSql, dumpUsuariosSql] = await Promise.all([
      executePgDumpToString({ clean: true }),
      executePgDumpToString({ tables: tablasOperacion, dataOnly: true }),
      executePgDumpToString({ tables: tablasConfiguracion, dataOnly: true }),
      executePgDumpToString({ tables: tablasUsuarios, dataOnly: true }),
    ]);
  } catch (dumpErr) {
    console.warn('Advertencia al generar dumps SQL automáticos para el backup:', dumpErr);
  }

  // 6. Manifiesto del Backup con desglose de separación y dumps SQL
  const manifest = {
    sistema: '1er Congreso de Educación Técnica Superior (ETS 2026)',
    fecha_creacion: new Date().toISOString(),
    tipo_backup: esManual ? 'MANUAL' : 'AUTOMATICO',
    autor: actor,
    separacion_modulos: {
      usuarios: {
        archivo: 'usuarios/datos_usuarios.json',
        tablas: tablasUsuarios,
        total_registros: totalRegistrosUsuarios,
      },
      configuracion: {
        archivo: 'configuracion/datos_configuracion.json',
        tablas: tablasConfiguracion,
        total_registros: totalRegistrosConfiguracion,
      },
      operacion: {
        archivo: 'operacion/datos_operacion.json',
        tablas: tablasOperacion,
        total_registros: totalRegistrosOperacion,
      },
    },
    dumps_sql: [
      'dumps/dump_completo.sql',
      'dumps/dump_operacion.sql',
      'dumps/dump_configuracion.sql',
      'dumps/dump_usuarios.sql',
    ],
    tablas_incluidas: tablas,
    total_registros: totalRegistros,
  };

  // Empaquetar en archivo ZIP
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);

    // 1. BLOQUE A: Datos de Usuarios e Identidad (separado)
    archive.append(JSON.stringify(datosUsuarios, null, 2), {
      name: 'usuarios/datos_usuarios.json',
    });
    archive.append(JSON.stringify(datosUsuarios, null, 2), {
      name: 'datos_usuarios.json',
    });

    // 2. BLOQUE B: Datos de Configuración Institucional (separado)
    archive.append(JSON.stringify(datosConfiguracion, null, 2), {
      name: 'configuracion/datos_configuracion.json',
    });
    archive.append(JSON.stringify(datosConfiguracion, null, 2), {
      name: 'datos_configuracion.json',
    });
    archive.append(JSON.stringify(configuracionesFuncionamiento, null, 2), {
      name: 'configuraciones_sistema.json',
    });

    // 3. BLOQUE C: Datos de la Operación y Dinámica del Evento (separado)
    archive.append(JSON.stringify(datosOperacion, null, 2), {
      name: 'operacion/datos_operacion.json',
    });
    archive.append(JSON.stringify(datosOperacion, null, 2), {
      name: 'datos_operacion.json',
    });

    // 4. Consolidado para retrocompatibilidad
    archive.append(JSON.stringify(backupData, null, 2), { name: 'datos_completos.json' });

    // 5. Esquema DDL SQL para reconstrucción
    if (ddlContent) {
      archive.append(ddlContent, { name: 'schema_3fn.sql' });
    }

    // 6. BLOQUE DUMPS SQL DE LAS BASES DE DATOS (PostgreSQL nativo)
    if (dumpCompletoSql) {
      archive.append(dumpCompletoSql, { name: 'dumps/dump_completo.sql' });
      archive.append(dumpCompletoSql, { name: 'dump_completo.sql' });
    }
    if (dumpOperacionSql) {
      archive.append(dumpOperacionSql, { name: 'dumps/dump_operacion.sql' });
      archive.append(dumpOperacionSql, { name: 'operacion/dump_operacion.sql' });
    }
    if (dumpConfiguracionSql) {
      archive.append(dumpConfiguracionSql, { name: 'dumps/dump_configuracion.sql' });
      archive.append(dumpConfiguracionSql, { name: 'configuracion/dump_configuracion.sql' });
    }
    if (dumpUsuariosSql) {
      archive.append(dumpUsuariosSql, { name: 'dumps/dump_usuarios.sql' });
      archive.append(dumpUsuariosSql, { name: 'usuarios/dump_usuarios.sql' });
    }

    // 7. Manifiesto estructurado
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifiesto.json' });

    archive.finalize();
  });

  // Calcular Hash SHA-256
  const fileBuffer = fs.readFileSync(zipPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const sha256 = hashSum.digest('hex');
  const stats = fs.statSync(zipPath);

  const metadata: BackupMetadata = {
    filename: `${backupName}.zip`,
    filepath: zipPath,
    sizeBytes: stats.size,
    sha256,
    createdAt: new Date().toISOString(),
    esManual,
    tablasExportadas: tablas,
    totalRegistros,
    separacion_modulos: manifest.separacion_modulos,
    dumps_sql: manifest.dumps_sql,
  };

  // Registrar en logs_auditoria
  try {
    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [
        esManual ? 'BACKUP_MANUAL_GENERADO' : 'BACKUP_AUTOMATICO_GENERADO',
        actor,
        JSON.stringify(metadata),
      ]
    );
  } catch (err) {
    console.warn('No se pudo registrar log de auditoría del backup:', err);
  }

  return metadata;
}

/**
 * Genera un dump SQL independiente de la base de datos del sistema
 */
export async function createStandaloneSqlDump(
  tipo: 'completo' | 'operacion' | 'configuracion' | 'usuarios' = 'completo',
  actor = 'SISTEMA'
): Promise<SqlDumpMetadata> {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `dump_ets2026_${timestamp}_${tipo}.sql`;
  const filepath = path.join(DUMP_DIR, filename);

  const tablasUsuarios = [
    'usuarios',
    'operadores',
    'usuario_roles_adicionales',
    'blacklist',
    'suscripciones_push',
  ];

  const tablasConfiguracion = [
    'configuraciones_sistema',
    'eventos',
    'roles',
    'estados_inscripcion',
    'tipos_acreditacion',
    'puntos_acceso',
    'categorias_tematicas',
    'catalogo_actividades',
    'actividades',
    'encuestas',
    'encuesta_preguntas',
    'encuesta_opciones',
  ];

  const tablasOperacion = [
    'acreditaciones',
    'actividad_inscripciones',
    'confirmaciones_asistencia',
    'certificados',
    'encuesta_respuestas',
    'encuesta_respuestas_detalles',
    'homologaciones_expositores',
    'logs_auditoria',
  ];

  let targetTables: string[] | undefined = undefined;
  let dataOnly = false;
  let clean = false;

  if (tipo === 'usuarios') {
    targetTables = tablasUsuarios;
    dataOnly = true;
  } else if (tipo === 'configuracion') {
    targetTables = tablasConfiguracion;
    dataOnly = true;
  } else if (tipo === 'operacion') {
    targetTables = tablasOperacion;
    dataOnly = true;
  } else {
    clean = true;
  }

  await executePgDumpToFile(filepath, {
    tables: targetTables,
    dataOnly,
    clean,
  });

  const fileBuffer = fs.readFileSync(filepath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const sha256 = hashSum.digest('hex');
  const stats = fs.statSync(filepath);

  const metadata: SqlDumpMetadata = {
    filename,
    filepath,
    sizeBytes: stats.size,
    sha256,
    createdAt: new Date().toISOString(),
    tipo,
    tablas: targetTables || [...tablasUsuarios, ...tablasConfiguracion, ...tablasOperacion],
  };

  try {
    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('DUMP_SQL_GENERADO', $1, $2, NOW())`,
      [actor, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.warn('No se pudo registrar log de auditoría del dump SQL:', err);
  }

  return metadata;
}

/**
 * Lista todos los dumps SQL disponibles
 */
export async function listSqlDumps(): Promise<SqlDumpMetadata[]> {
  ensureBackupDir();
  const files = fs.readdirSync(DUMP_DIR).filter((f) => f.endsWith('.sql'));

  return files
    .map((filename) => {
      const fullPath = path.join(DUMP_DIR, filename);
      const stat = fs.statSync(fullPath);
      let tipo: 'completo' | 'operacion' | 'configuracion' | 'usuarios' = 'completo';
      if (filename.includes('_operacion')) tipo = 'operacion';
      else if (filename.includes('_configuracion')) tipo = 'configuracion';
      else if (filename.includes('_usuarios')) tipo = 'usuarios';

      return {
        filename,
        filepath: fullPath,
        sizeBytes: stat.size,
        sha256: '',
        createdAt: stat.mtime.toISOString(),
        tipo,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Retorna la ruta física de un dump SQL específico
 */
export function getSqlDumpPath(filename: string): string | null {
  ensureBackupDir();
  const safeName = path.basename(filename);
  const fullPath = path.join(DUMP_DIR, safeName);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * Lista todos los archivos de backup disponibles junto con sus metadatos modulares
 */
export async function listBackups(): Promise<any[]> {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.zip'));

  return files
    .map((filename) => {
      const fullPath = path.join(BACKUP_DIR, filename);
      const stat = fs.statSync(fullPath);
      let separacion_modulos = undefined;
      let total_registros = undefined;
      let dumps_sql = undefined;

      try {
        const zip = new AdmZip(fullPath);
        const manifestEntry = zip.getEntry('manifiesto.json');
        if (manifestEntry) {
          const manifest = JSON.parse(zip.readAsText(manifestEntry));
          separacion_modulos = manifest.separacion_modulos;
          total_registros = manifest.total_registros;
          dumps_sql = manifest.dumps_sql;
        }
      } catch (_) {}

      return {
        filename,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        esManual: filename.includes('manual'),
        totalRegistros: total_registros,
        separacion_modulos,
        dumps_sql,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Retorna la ruta física de un backup específico
 */
export function getBackupPath(filename: string): string | null {
  ensureBackupDir();
  const safeName = path.basename(filename);
  const fullPath = path.join(BACKUP_DIR, safeName);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * Restaura la base de datos a partir de un archivo ZIP de backup integral.
 * Soporta restauración completa o selectiva por módulo ('completo' | 'operacion' | 'configuracion' | 'usuarios').
 */
export async function restoreBackup(
  zipInput: string | Buffer,
  actor = 'SUPERADMIN',
  modo: 'completo' | 'operacion' | 'configuracion' | 'usuarios' = 'completo'
): Promise<RestoreResult> {
  const zip = typeof zipInput === 'string' ? new AdmZip(zipInput) : new AdmZip(zipInput);

  // Calcular SHA-256 del archivo/buffer
  const buffer = typeof zipInput === 'string' ? fs.readFileSync(zipInput) : zipInput;
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const zipEntries = zip.getEntries();
  const entryNames = zipEntries.map((e) => e.entryName);

  let manifiesto: any = null;
  if (entryNames.includes('manifiesto.json')) {
    try {
      manifiesto = JSON.parse(zip.readAsText('manifiesto.json'));
    } catch (_) {}
  }

  // Resolver qué datos cargar según el modo solicitado
  let backupData: Record<string, any[]> = {};

  if (modo === 'usuarios') {
    const jsonName = entryNames.includes('usuarios/datos_usuarios.json')
      ? 'usuarios/datos_usuarios.json'
      : entryNames.includes('datos_usuarios.json')
      ? 'datos_usuarios.json'
      : 'datos_completos.json';
    backupData = JSON.parse(zip.readAsText(jsonName));
  } else if (modo === 'configuracion') {
    const jsonName = entryNames.includes('configuracion/datos_configuracion.json')
      ? 'configuracion/datos_configuracion.json'
      : entryNames.includes('datos_configuracion.json')
      ? 'datos_configuracion.json'
      : 'datos_completos.json';
    backupData = JSON.parse(zip.readAsText(jsonName));
  } else if (modo === 'operacion') {
    const jsonName = entryNames.includes('operacion/datos_operacion.json')
      ? 'operacion/datos_operacion.json'
      : entryNames.includes('datos_operacion.json')
      ? 'datos_operacion.json'
      : 'datos_completos.json';
    backupData = JSON.parse(zip.readAsText(jsonName));
  } else {
    if (!entryNames.includes('datos_completos.json')) {
      throw new Error('ERR_INVALID_BACKUP: El archivo ZIP no contiene datos_completos.json.');
    }
    backupData = JSON.parse(zip.readAsText('datos_completos.json'));
  }

  const tablasOrdenadas = [
    'roles',
    'estados_inscripcion',
    'eventos',
    'puntos_acceso',
    'tipos_acreditacion',
    'categorias_tematicas',
    'catalogo_actividades',
    'usuarios',
    'actividades',
    'actividad_inscripciones',
    'operadores',
    'blacklist',
    'usuario_roles_adicionales',
    'homologaciones_expositores',
    'confirmaciones_asistencia',
    'acreditaciones',
    'certificados',
    'encuestas',
    'encuesta_preguntas',
    'encuesta_opciones',
    'encuesta_respuestas',
    'encuesta_respuestas_detalles',
    'suscripciones_push',
    'configuraciones_sistema',
  ];

  return await withTransaction(async (client) => {
    // 1. Limpieza controlada según el modo
    if (modo === 'completo') {
      await client.query(`
        DELETE FROM encuesta_respuestas_detalles;
        DELETE FROM encuesta_respuestas;
        DELETE FROM encuesta_opciones;
        DELETE FROM encuesta_preguntas;
        DELETE FROM encuestas;
        DELETE FROM certificados;
        DELETE FROM acreditaciones;
        DELETE FROM actividad_inscripciones;
        DELETE FROM actividades;
        DELETE FROM confirmaciones_asistencia;
        DELETE FROM homologaciones_expositores;
        DELETE FROM usuario_roles_adicionales;
        DELETE FROM usuarios;
        DELETE FROM blacklist;
        DELETE FROM catalogo_actividades;
        DELETE FROM categorias_tematicas;
        DELETE FROM operadores;
        DELETE FROM suscripciones_push;
        DELETE FROM configuraciones_sistema;
      `);
    } else if (modo === 'operacion') {
      await client.query(`
        DELETE FROM encuesta_respuestas_detalles;
        DELETE FROM encuesta_respuestas;
        DELETE FROM certificados;
        DELETE FROM acreditaciones;
        DELETE FROM actividad_inscripciones;
        DELETE FROM confirmaciones_asistencia;
        DELETE FROM homologaciones_expositores;
      `);
    }

    let totalRestaurados = 0;
    const tablasRestauradas: string[] = [];

    // 2. Inserción de datos restaurados
    for (const tabla of tablasOrdenadas) {
      const rows = backupData[tabla] || [];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

        const sql = `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        await client.query(sql, vals);
        totalRestaurados++;
      }
      tablasRestauradas.push(tabla);
    }

    // 2.1. Sincronización de secuencias SERIAL tras la inserción
    const secuencias = [
      { tabla: 'operadores', seq: 'operadores_id_seq' },
      { tabla: 'eventos', seq: 'eventos_id_seq' },
      { tabla: 'puntos_acceso', seq: 'puntos_acceso_id_seq' },
      { tabla: 'categorias_tematicas', seq: 'categorias_tematicas_id_seq' },
      { tabla: 'catalogo_actividades', seq: 'catalogo_actividades_id_seq' },
      { tabla: 'actividades', seq: 'actividades_id_seq' },
      { tabla: 'encuestas', seq: 'encuestas_id_seq' },
      { tabla: 'encuesta_preguntas', seq: 'encuesta_preguntas_id_seq' },
      { tabla: 'encuesta_opciones', seq: 'encuesta_opciones_id_seq' },
    ];

    for (const item of secuencias) {
      try {
        await client.query(`SELECT setval($1, (SELECT GREATEST(MAX(id), 1) FROM ${item.tabla}))`, [
          item.seq,
        ]);
      } catch (_) {
        // Ignorar si la tabla o secuencia no tiene registros aún
      }
    }

    // 3. Registrar auditoría inmutable
    const detalleAudit = {
      accion: `RESTAURACION_BACKUP_${modo.toUpperCase()}`,
      sha256,
      tablas_restauradas: tablasRestauradas,
      total_registros_restaurados: totalRestaurados,
      modo,
      origen: typeof zipInput === 'string' ? path.basename(zipInput) : 'CARGA_ARCHIVO_BUFFER',
      timestamp: new Date().toISOString(),
    };

    await client.query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('BACKUP_RESTAURADO', $1, $2, NOW())`,
      [actor, JSON.stringify(detalleAudit)]
    );

    return {
      success: true,
      totalRestaurados,
      tablasRestauradas,
      sha256,
      manifiesto,
      restauradoEn: new Date().toISOString(),
    };
  });
}
