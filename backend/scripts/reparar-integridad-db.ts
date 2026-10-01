import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Cargar variables de entorno del backend
dotenv.config({ path: path.join(__dirname, '../.env') });

export interface RepairReportItem {
  categoria: string;
  elemento: string;
  estado: 'CORRECTO' | 'REPARADO' | 'ADVERTENCIA' | 'ERROR';
  detalle: string;
}

export async function runDatabaseRepair(customConnectionString?: string): Promise<{
  success: boolean;
  items: RepairReportItem[];
}> {
  const connectionString =
    customConnectionString ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:V-129057-t@localhost:5433/congreso_ets2026';

  const client = new Client({ connectionString });
  const items: RepairReportItem[] = [];

  try {
    await client.connect();
    items.push({
      categoria: 'Conexión',
      elemento: 'Servidor PostgreSQL',
      estado: 'CORRECTO',
      detalle: 'Conexión establecida con éxito a la base de datos.',
    });

    await client.query('BEGIN');

    // =========================================================================
    // FASE 1: EXTENSIONES BASE
    // =========================================================================
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    items.push({
      categoria: 'Esquema',
      elemento: 'Extensión pgcrypto',
      estado: 'CORRECTO',
      detalle: 'Extensión criptográfica activa para generación de UUIDs.',
    });

    // =========================================================================
    // FASE 2: VERIFICACIÓN Y CREACIÓN DE TABLAS FALTANTES (26 TABLAS)
    // =========================================================================
    const schemaSqlPath = path.join(__dirname, '../database/schema_3fn.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf-8');
      await client.query(schemaSql);
      items.push({
        categoria: 'Esquema',
        elemento: 'Tablas y DDL Maestro (schema_3fn.sql)',
        estado: 'CORRECTO',
        detalle: 'Estructura relacional canónica de 26 tablas aplicada y asegurada.',
      });
    }

    // =========================================================================
    // FASE 3: AUDITORÍA Y AGREGADO DINÁMICO DE COLUMNAS FALTANTES
    // =========================================================================
    const columnasCriticas: { tabla: string; columna: string; ddl: string; defaultVal?: string }[] = [
      // Eventos
      { tabla: 'eventos', columna: 'actualizado_en', ddl: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      // Operadores
      { tabla: 'operadores', columna: 'actualizado_en', ddl: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      // Puntos de acceso (recintos)
      { tabla: 'puntos_acceso', columna: 'capacidad_maxima', ddl: 'INT NOT NULL DEFAULT 50' },
      { tabla: 'puntos_acceso', columna: 'actualizado_en', ddl: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      { tabla: 'puntos_acceso', columna: 'tipo_punto', ddl: "VARCHAR(30) NOT NULL DEFAULT 'PUESTO_ACCESO'" },
      { tabla: 'puntos_acceso', columna: 'evento_id', ddl: 'INT REFERENCES eventos(id) ON DELETE CASCADE' },
      // Actividades
      { tabla: 'actividades', columna: 'disertante_usuario_id', ddl: 'UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL' },
      { tabla: 'actividades', columna: 'catalogo_actividad_id', ddl: 'INT NULL REFERENCES catalogo_actividades(id) ON DELETE SET NULL' },
      { tabla: 'actividades', columna: 'actualizado_en', ddl: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      // Catalogo Actividades
      { tabla: 'catalogo_actividades', columna: 'actualizado_en', ddl: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      // Suscripciones push
      { tabla: 'suscripciones_push', columna: 'user_agent', ddl: 'TEXT NULL' },
      { tabla: 'suscripciones_push', columna: 'actualizado_en', ddl: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      // Logs auditoría
      { tabla: 'logs_auditoria', columna: 'tabla_afectada', ddl: 'VARCHAR(100) NULL' },
      { tabla: 'logs_auditoria', columna: 'accion', ddl: 'VARCHAR(50) NULL' },
      { tabla: 'logs_auditoria', columna: 'usuario_responsable', ddl: 'VARCHAR(100) NULL' },
      { tabla: 'logs_auditoria', columna: 'datos_nuevos', ddl: 'JSONB NULL' },
      { tabla: 'logs_auditoria', columna: 'registro_id', ddl: 'VARCHAR(100) NULL' },
      // Usuarios
      { tabla: 'usuarios', columna: 'actualizado_en', ddl: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      { tabla: 'usuarios', columna: 'evento_id', ddl: 'INT NOT NULL DEFAULT 1' },
    ];

    for (const c of columnasCriticas) {
      const checkCol = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [c.tabla, c.columna]
      );
      if (checkCol.rows.length === 0) {
        await client.query(`ALTER TABLE ${c.tabla} ADD COLUMN IF NOT EXISTS ${c.columna} ${c.ddl};`);
        items.push({
          categoria: 'Columnas',
          elemento: `${c.tabla}.${c.columna}`,
          estado: 'REPARADO',
          detalle: `Columna faltante agregada con definición: ${c.ddl}`,
        });
      }
    }

    // =========================================================================
    // FASE 4: INTEGRIDAD DE REGISTROS MAESTROS BASE (SEED CONDICIONAL)
    // =========================================================================
    // 1. Roles
    await client.query(`
      INSERT INTO roles (id, nombre, descripcion, jerarquia) VALUES
        (1, 'Asistente General', 'Asistencia abierta a conferencias y áreas comunes', 1),
        (2, 'Estudiante IFTS', 'Estudiante regular de Institutos de Formación Técnica Superior', 1),
        (3, 'Docente / Directivo IFTS', 'Personal académico o directivo de institutos técnicos', 2),
        (4, 'Disertante / Expositor', 'Orador invitado o panelista temático', 2),
        (5, 'Operador de Puerta', 'Control de acreditaciones con escáner QR en puntos de acceso', 3),
        (6, 'Verificador de Mesa', 'Mesa de entradas, resolución de contingencias y reasignaciones', 3),
        (7, 'Administrador DETS', 'Gestión integral académica, aforos, certificados y encuestas', 4),
        (8, 'Superadmin', 'Administrador total con facultades de sobrecupo y override', 5)
      ON CONFLICT (id) DO UPDATE 
      SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, jerarquia = EXCLUDED.jerarquia;
    `);

    // 2. Estados de inscripción
    await client.query(`
      INSERT INTO estados_inscripcion (id, codigo, nombre, permite_ingreso, descripcion) VALUES
        (1, 'CONFIRMADO', 'Confirmado', TRUE, 'Inscripción activa con cupo asegurado y identificacion habilitada'),
        (2, 'LISTA_ESPERA', 'Lista de Espera', FALSE, 'Sin cupo inmediato por capacidad de aforo completada (FIFO)'),
        (3, 'SANCIONADO', 'Sancionado', FALSE, 'Restricción disciplinaria activa por inclusión en Lista Negra / Blacklist'),
        (4, 'BAJA_AUTOMATICA', 'Baja Automática 48hs', FALSE, 'No confirmó asistencia en la ventana de 24hs tras el aviso de 48hs'),
        (5, 'CANCELADO', 'Cancelado', FALSE, 'Baja voluntaria o revocada manualmente')
      ON CONFLICT (id) DO UPDATE 
      SET codigo = EXCLUDED.codigo, nombre = EXCLUDED.nombre, permite_ingreso = EXCLUDED.permite_ingreso, descripcion = EXCLUDED.descripcion;
    `);

    // 3. Evento principal garantizado
    await client.query(`
      INSERT INTO eventos (id, codigo, nombre, descripcion, anio, fecha_inicio, fecha_fin, activo) VALUES
        (1, 'ETS_2026', '1er Congreso de Educación Técnica Superior 2026', 'Edición inaugural en Auditorio Polo Saavedra', 2026, '2026-11-06', '2026-11-06', TRUE)
      ON CONFLICT (id) DO UPDATE
      SET nombre = EXCLUDED.nombre, anio = EXCLUDED.anio;
    `);

    // 4. Tipos de acreditación
    await client.query(`
      INSERT INTO tipos_acreditacion (id, codigo, descripcion, requiere_actividad) VALUES
        (1, 'ACCESO_GENERAL', 'Ingreso al predio del Auditorio Polo Saavedra', FALSE),
        (2, 'ACTIVIDAD_AULA', 'Ingreso a conferencia o panel en aula temática', TRUE),
        (3, 'TALLER', 'Participación en taller práctico con cupo limitado', TRUE),
        (4, 'MASTERCLASS', 'Clase magistral con expositor principal', TRUE)
      ON CONFLICT (id) DO UPDATE 
      SET descripcion = EXCLUDED.descripcion, requiere_actividad = EXCLUDED.requiere_actividad;
    `);

    // 5. Puntos de acceso base
    await client.query(`
      INSERT INTO puntos_acceso (id, evento_id, nombre, ubicacion_fisica, tipo_punto, capacidad_maxima, activo) VALUES
        (1, 1, 'Acceso General - Puerta Principal', 'Hall de Entrada Principal - PB', 'PUESTO_ACCESO', 500, TRUE),
        (2, 1, 'Acceso General - Puerta Lateral', 'Acceso Rampa Accesible - PB', 'PUESTO_ACCESO', 500, TRUE),
        (3, 1, 'Aula Magna - Auditorio Central', 'Auditorio Principal', 'AULA_SALON', 400, TRUE),
        (4, 1, 'Aula 1 - Robótica y Automatización', 'Primer Piso - Sector Este', 'AULA_SALON', 100, TRUE),
        (5, 1, 'Aula 2 - Inteligencia Artificial y Big Data', 'Primer Piso - Sector Oeste', 'AULA_SALON', 60, TRUE),
        (6, 1, 'Taller 1 - Redes y Ciberseguridad', 'Subsuelo - Laboratorio A', 'TALLER_LAB', 35, TRUE),
        (7, 1, 'Taller 2 - Desarrollo Web y Cloud', 'Subsuelo - Laboratorio B', 'TALLER_LAB', 50, TRUE)
      ON CONFLICT (id) DO UPDATE 
      SET nombre = EXCLUDED.nombre, ubicacion_fisica = EXCLUDED.ubicacion_fisica,
          capacidad_maxima = CASE WHEN puntos_acceso.capacidad_maxima <= 0 OR puntos_acceso.capacidad_maxima IS NULL THEN EXCLUDED.capacidad_maxima ELSE puntos_acceso.capacidad_maxima END;
    `);

    // Normalizar aforos de recintos con valor 0 o nulos
    const updCap = await client.query(`
      UPDATE puntos_acceso
      SET capacidad_maxima = 50
      WHERE capacidad_maxima IS NULL OR capacidad_maxima <= 0;
    `);
    if (updCap.rowCount && updCap.rowCount > 0) {
      items.push({
        categoria: 'Aforos',
        elemento: 'puntos_acceso.capacidad_maxima',
        estado: 'REPARADO',
        detalle: `Se normalizó la capacidad mínima (50) en ${updCap.rowCount} recintos con aforo nulo o inválido.`,
      });
    }

    // =========================================================================
    // FASE 5: REPARACIÓN DE CLAVES FORÁNEAS E INTEGRIDAD DE USUARIOS
    // =========================================================================
    // Usuarios con evento_id huérfano
    const fixUsrEvento = await client.query(`
      UPDATE usuarios 
      SET evento_id = 1 
      WHERE evento_id IS NULL OR NOT EXISTS (SELECT 1 FROM eventos WHERE id = usuarios.evento_id);
    `);
    if (fixUsrEvento.rowCount && fixUsrEvento.rowCount > 0) {
      items.push({
        categoria: 'Integridad Referencial',
        elemento: 'usuarios.evento_id',
        estado: 'REPARADO',
        detalle: `Reasignados ${fixUsrEvento.rowCount} usuarios huérfanos al Evento Principal (ID: 1).`,
      });
    }

    // Usuarios con rol_principal_id huérfano
    const fixUsrRol = await client.query(`
      UPDATE usuarios 
      SET rol_principal_id = 1 
      WHERE rol_principal_id IS NULL OR NOT EXISTS (SELECT 1 FROM roles WHERE id = usuarios.rol_principal_id);
    `);
    if (fixUsrRol.rowCount && fixUsrRol.rowCount > 0) {
      items.push({
        categoria: 'Integridad Referencial',
        elemento: 'usuarios.rol_principal_id',
        estado: 'REPARADO',
        detalle: `Reasignados ${fixUsrRol.rowCount} usuarios huérfanos al Rol Asistente General (ID: 1).`,
      });
    }

    // Usuarios con estado_inscripcion_id huérfano
    const fixUsrEstado = await client.query(`
      UPDATE usuarios 
      SET estado_inscripcion_id = 1 
      WHERE estado_inscripcion_id IS NULL OR NOT EXISTS (SELECT 1 FROM estados_inscripcion WHERE id = usuarios.estado_inscripcion_id);
    `);
    if (fixUsrEstado.rowCount && fixUsrEstado.rowCount > 0) {
      items.push({
        categoria: 'Integridad Referencial',
        elemento: 'usuarios.estado_inscripcion_id',
        estado: 'REPARADO',
        detalle: `Reasignados ${fixUsrEstado.rowCount} usuarios huérfanos al Estado Confirmado (ID: 1).`,
      });
    }

    // =========================================================================
    // FASE 6: INTEGRIDAD DE OPERADORES Y ACCESOS
    // =========================================================================
    const fixOpPunto = await client.query(`
      UPDATE operadores 
      SET punto_acceso_default_id = 1 
      WHERE punto_acceso_default_id IS NULL OR NOT EXISTS (SELECT 1 FROM puntos_acceso WHERE id = operadores.punto_acceso_default_id);
    `);
    if (fixOpPunto.rowCount && fixOpPunto.rowCount > 0) {
      items.push({
        categoria: 'Integridad Referencial',
        elemento: 'operadores.punto_acceso_default_id',
        estado: 'REPARADO',
        detalle: `Reasignados ${fixOpPunto.rowCount} operadores a Puerta Principal (ID: 1).`,
      });
    }

    // =========================================================================
    // FASE 7: INTEGRIDAD DE ACTIVIDADES Y REVALIDACIÓN DE AFOROS
    // =========================================================================
    const fixActPunto = await client.query(`
      UPDATE actividades 
      SET punto_acceso_id = 3 
      WHERE punto_acceso_id IS NULL OR NOT EXISTS (SELECT 1 FROM puntos_acceso WHERE id = actividades.punto_acceso_id);
    `);
    if (fixActPunto.rowCount && fixActPunto.rowCount > 0) {
      items.push({
        categoria: 'Integridad Referencial',
        elemento: 'actividades.punto_acceso_id',
        estado: 'REPARADO',
        detalle: `Reasignadas ${fixActPunto.rowCount} actividades a Aula Magna / Auditorio (ID: 3).`,
      });
    }

    const fixActTipo = await client.query(`
      UPDATE actividades 
      SET tipo_acreditacion_id = 1 
      WHERE tipo_acreditacion_id IS NULL OR NOT EXISTS (SELECT 1 FROM tipos_acreditacion WHERE id = actividades.tipo_acreditacion_id);
    `);
    if (fixActTipo.rowCount && fixActTipo.rowCount > 0) {
      items.push({
        categoria: 'Integridad Referencial',
        elemento: 'actividades.tipo_acreditacion_id',
        estado: 'REPARADO',
        detalle: `Reasignadas ${fixActTipo.rowCount} actividades con tipo huérfano a ACCESO_GENERAL.`,
      });
    }

    // Verificar si existen actividades cuyo cupo_maximo supere el aforo del recinto
    const aforoCheck = await client.query(`
      SELECT act.id, act.nombre, act.cupo_maximo, pa.nombre as sala_nombre, pa.capacidad_maxima
      FROM actividades act
      JOIN puntos_acceso pa ON act.punto_acceso_id = pa.id
      WHERE act.cupo_maximo > pa.capacidad_maxima;
    `);
    if (aforoCheck.rows.length > 0) {
      for (const r of aforoCheck.rows) {
        items.push({
          categoria: 'Advertencia de Aforo',
          elemento: `Actividad #${r.id} (${r.nombre})`,
          estado: 'ADVERTENCIA',
          detalle: `El cupo configurado (${r.cupo_maximo}) supera la capacidad física de "${r.sala_nombre}" (${r.capacidad_maxima} butacas).`,
        });
      }
    } else {
      items.push({
        categoria: 'Aforos',
        elemento: 'Relación Actividades vs Recintos',
        estado: 'CORRECTO',
        detalle: 'Todos los cupos de actividades respetan la capacidad máxima de sus recintos.',
      });
    }

    // =========================================================================
    // FASE 8: LIMPIEZA DE REGISTROS OPERACIONALES HUÉRFANOS
    // =========================================================================
    // Inscripciones a actividades huérfanas
    const delInscHuerfanas = await client.query(`
      DELETE FROM actividad_inscripciones 
      WHERE NOT EXISTS (SELECT 1 FROM actividades WHERE id = actividad_inscripciones.actividad_id)
         OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id = actividad_inscripciones.usuario_id);
    `);
    if (delInscHuerfanas.rowCount && delInscHuerfanas.rowCount > 0) {
      items.push({
        categoria: 'Limpieza de Huérfanos',
        elemento: 'actividad_inscripciones',
        estado: 'REPARADO',
        detalle: `Eliminadas ${delInscHuerfanas.rowCount} reservas huérfanas sin usuario o actividad válida.`,
      });
    }

    // Acreditaciones huérfanas
    const delAcredHuerfanas = await client.query(`
      DELETE FROM acreditaciones 
      WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE id = acreditaciones.usuario_id);
    `);
    if (delAcredHuerfanas.rowCount && delAcredHuerfanas.rowCount > 0) {
      items.push({
        categoria: 'Limpieza de Huérfanos',
        elemento: 'acreditaciones',
        estado: 'REPARADO',
        detalle: `Depuradas ${delAcredHuerfanas.rowCount} acreditaciones vinculadas a usuarios inexistentes.`,
      });
    }

    // =========================================================================
    // FASE 9: SINCRONIZACIÓN DE SECUENCIAS AUTOINCREMENTALES (SERIAL)
    // =========================================================================
    const tablasSecuencias = [
      { tabla: 'roles', seq: 'roles_id_seq' },
      { tabla: 'estados_inscripcion', seq: 'estados_inscripcion_id_seq' },
      { tabla: 'eventos', seq: 'eventos_id_seq' },
      { tabla: 'tipos_acreditacion', seq: 'tipos_acreditacion_id_seq' },
      { tabla: 'categorias_tematicas', seq: 'categorias_tematicas_id_seq' },
      { tabla: 'puntos_acceso', seq: 'puntos_acceso_id_seq' },
      { tabla: 'catalogo_actividades', seq: 'catalogo_actividades_id_seq' },
      { tabla: 'operadores', seq: 'operadores_id_seq' },
      { tabla: 'actividades', seq: 'actividades_id_seq' },
      { tabla: 'actividad_inscripciones', seq: 'actividad_inscripciones_id_seq' },
      { tabla: 'homologaciones_expositores', seq: 'homologaciones_expositores_id_seq' },
      { tabla: 'blacklist', seq: 'blacklist_id_seq' },
      { tabla: 'confirmaciones_asistencia', seq: 'confirmaciones_asistencia_id_seq' },
      { tabla: 'encuestas', seq: 'encuestas_id_seq' },
      { tabla: 'encuesta_preguntas', seq: 'encuesta_preguntas_id_seq' },
      { tabla: 'encuesta_opciones', seq: 'encuesta_opciones_id_seq' },
      { tabla: 'encuesta_respuestas_detalles', seq: 'encuesta_respuestas_detalles_id_seq' },
      { tabla: 'suscripciones_push', seq: 'suscripciones_push_id_seq' },
      { tabla: 'logs_auditoria', seq: 'logs_auditoria_id_seq' },
      { tabla: 'logs_journaling', seq: 'logs_journaling_id_seq' },
    ];

    let secSincronizadas = 0;
    for (const ts of tablasSecuencias) {
      try {
        const seqCheck = await client.query(`SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = $1`, [ts.seq]);
        if (seqCheck.rows.length > 0) {
          await client.query(`SELECT setval($1, COALESCE((SELECT GREATEST(MAX(id), 1) FROM ${ts.tabla}), 1))`, [ts.seq]);
          secSincronizadas++;
        }
      } catch {
        // Ignorar si la tabla o secuencia no aplica
      }
    }
    items.push({
      categoria: 'Secuencias',
      elemento: 'Autoincrementables (SERIAL)',
      estado: 'CORRECTO',
      detalle: `${secSincronizadas} secuencias sincronizadas al valor MAX(id) real para evitar colisiones.`,
    });

    await client.query('COMMIT');
    await client.end();
    return { success: true, items };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
    items.push({
      categoria: 'Error Crítico',
      elemento: 'Transacción de Reparación',
      estado: 'ERROR',
      detalle: error.message,
    });
    return { success: false, items };
  }
}

// Ejecución autónoma si es llamado por CLI
if (require.main === module) {
  (async () => {
    console.log('========================================================================');
    console.log('  HERRAMIENTA AUTÓNOMA DE VERIFICACIÓN Y REPARACIÓN DE BASE DE DATOS  ');
    console.log('  Sistema Congreso ETS 2026 - DETS GCABA                                ');
    console.log('========================================================================\n');

    const result = await runDatabaseRepair();
    console.table(result.items);

    const errores = result.items.filter((i) => i.estado === 'ERROR').length;
    const reparados = result.items.filter((i) => i.estado === 'REPARADO').length;
    const advertencias = result.items.filter((i) => i.estado === 'ADVERTENCIA').length;

    console.log('\n------------------------------------------------------------------------');
    console.log(`Resumen de Diagnóstico y Reparación:`);
    console.log(`- Elementos Reparados    : ${reparados}`);
    console.log(`- Advertencias de Aforo  : ${advertencias}`);
    console.log(`- Errores Críticos       : ${errores}`);
    console.log('------------------------------------------------------------------------');

    if (result.success && errores === 0) {
      console.log('🎉 ¡LA BASE DE DATOS ESTÁ 100% SALUDABLE Y SIN INCONSISTENCIAS REFERENCIALES!');
      process.exit(0);
    } else {
      console.error('❌ Se registraron anomalías que requieren intervención.');
      process.exit(1);
    }
  })();
}
