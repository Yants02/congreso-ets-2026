import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query, withTransaction } from './db';
import { createIntegralBackup } from './backupService';
import { sendConfirmationRequestEmail, sendPromotionEmail } from './mailService';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Tarea Cron ejecutada 48hs antes del evento:
 * 1. Emite tokens temporales de 24hs a todos los usuarios con estado CONFIRMADO.
 * 2. Simula o despacha notificaciones por lote de 50 envíos con enlaces únicos.
 * 3. Registra en confirmaciones_asistencia.
 */
export async function runConfirmationCron(
  eventoId?: number
): Promise<{ totalNotificados: number; lotes: number; eventoId: number }> {
  let targetEventoId = eventoId;
  if (!targetEventoId) {
    const evRes = await query(
      `SELECT id FROM eventos WHERE activo = TRUE ORDER BY (codigo = 'ETS_2026') DESC, fecha_inicio ASC LIMIT 1`
    );
    targetEventoId = evRes.rows[0]?.id || 1;
  }

  const confRes = await query(
    `SELECT u.id, u.email, u.nombre, u.apellido
     FROM usuarios u
     JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
     WHERE ei.codigo = 'CONFIRMADO' AND u.evento_id = $1`,
    [targetEventoId]
  );

  const confirmados = confRes.rows;

  // Consultar parámetro dinámico de vigencia de confirmación desde la BD
  const configRes = await query(
    `SELECT valor FROM configuraciones_sistema WHERE clave = 'ventana_reconfirmacion_horas'`
  );
  const vigenciaHoras = Number(configRes.rows[0]?.valor?.vigencia_token_horas) || 24;
  const expiraEn = new Date(Date.now() + vigenciaHoras * 60 * 60 * 1000);

  const batches = chunkArray(confirmados, 50);

  for (const batch of batches) {
    for (const user of batch) {
      const token = crypto.randomBytes(32).toString('hex');

      await query(
        `INSERT INTO confirmaciones_asistencia (usuario_id, token_hash, emitido_en, expira_en)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (token_hash) DO NOTHING`,
        [user.id, token, expiraEn]
      );

      // Despachar correo electrónico transaccional con enlace único de reconfirmación
      await sendConfirmationRequestEmail({
        to: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        token,
        horasVigencia: vigenciaHoras,
      }).catch((err) =>
        console.error(`Error al enviar reconfirmación a ${user.email}:`, err.message)
      );
    }
  }

  await query(
    `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
     VALUES ('CRON_48HS_DESPACHADO', 'SISTEMA', $1, NOW())`,
    [
      JSON.stringify({
        total_confirmados: confirmados.length,
        lotes: batches.length,
        evento_id: targetEventoId,
      }),
    ]
  );

  return {
    totalNotificados: confirmados.length,
    lotes: batches.length,
    eventoId: targetEventoId || 1,
  };
}

/**
 * Tarea para aplicar la baja automática a los usuarios CONFIRMADOS que no confirmaron
 * su asistencia tras vencer el plazo de 24 horas y reasignar vacantes liberadas
 * a los aspirantes en Lista de Espera por orden de llegada (FIFO) del mismo evento.
 */
export async function runAutoDropAndPromotionCron(eventoId?: number): Promise<{
  bajasCount: number;
  promovidosCount: number;
  eventoId: number;
}> {
  return withTransaction(async (client) => {
    let targetEventoId = eventoId;
    if (!targetEventoId) {
      const evRes = await client.query(
        `SELECT id FROM eventos WHERE activo = TRUE ORDER BY (codigo = 'ETS_2026') DESC, fecha_inicio ASC LIMIT 1`
      );
      targetEventoId = evRes.rows[0]?.id || 1;
    }

    // Obtener IDs de estados
    const estBajaRes = await client.query(
      `SELECT id FROM estados_inscripcion WHERE codigo = 'BAJA_AUTOMATICA'`
    );
    const estConfRes = await client.query(
      `SELECT id FROM estados_inscripcion WHERE codigo = 'CONFIRMADO'`
    );
    const estWaitRes = await client.query(
      `SELECT id FROM estados_inscripcion WHERE codigo = 'LISTA_ESPERA'`
    );

    const bajaId = estBajaRes.rows[0].id;
    const confId = estConfRes.rows[0].id;
    const waitId = estWaitRes.rows[0]?.id;

    // Actualizar a BAJA_AUTOMATICA a quienes tienen token vencido (>24hs), no confirmaron y NO están acreditados en puerta
    const updateRes = await client.query(
      `UPDATE usuarios u
       SET estado_inscripcion_id = $1, actualizado_en = NOW()
       WHERE u.estado_inscripcion_id = $2
         AND u.evento_id = $3
         AND NOT EXISTS (
           SELECT 1 FROM acreditaciones a
           WHERE a.usuario_id = u.id
         )
         AND EXISTS (
           SELECT 1 FROM confirmaciones_asistencia c
           WHERE c.usuario_id = u.id
             AND c.confirmado_en IS NULL
             AND c.expira_en < NOW()
         )
       RETURNING u.id`,
      [bajaId, confId, targetEventoId]
    );

    const bajasCount = updateRes.rowCount || 0;

    await client.query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('BAJA_AUTOMATICA_48HS', 'CRON_SISTEMA', $1, NOW())`,
      [JSON.stringify({ bajas_count: bajasCount, evento_id: targetEventoId })]
    );

    // Reasignación automática de vacantes liberadas a aspirantes en Lista de Espera (FIFO) del mismo evento
    let promovidosCount = 0;
    if (bajasCount > 0 && waitId) {
      const waitlistRes = await client.query(
        `SELECT id, dni_pasaporte, nombre, apellido, email
         FROM usuarios
         WHERE estado_inscripcion_id = $1
           AND evento_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM blacklist b 
             WHERE b.dni_pasaporte = usuarios.dni_pasaporte AND b.activo = TRUE
           )
         ORDER BY creado_en ASC
         LIMIT $3`,
        [waitId, targetEventoId, bajasCount]
      );

      for (const aspirante of waitlistRes.rows) {
        await client.query(
          `UPDATE usuarios
           SET estado_inscripcion_id = $1, actualizado_en = NOW()
           WHERE id = $2`,
          [confId, aspirante.id]
        );

        await client.query(
          `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
           VALUES ('PROMOCION_LISTA_ESPERA', 'CRON_SISTEMA', $1, $2, NOW())`,
          [
            aspirante.id,
            JSON.stringify({
              motivo: 'Asignación automática de vacante liberada tras baja de 48hs (FIFO)',
              dni: aspirante.dni_pasaporte,
              nombre: `${aspirante.nombre} ${aspirante.apellido}`,
            }),
          ]
        );

        // Notificación automática por correo electrónico al aspirante promovido
        await sendPromotionEmail({
          to: aspirante.email,
          nombre: aspirante.nombre,
          apellido: aspirante.apellido,
          dni: aspirante.dni_pasaporte,
        }).catch((err) =>
          console.error(
            `Error al enviar notificación de promoción a ${aspirante.email}:`,
            err.message
          )
        );

        promovidosCount++;
      }
    }

    return { bajasCount, promovidosCount, eventoId: targetEventoId || 1 };
  });
}

/**
 * Tarea programada de Backup Automático periódico y rotación de retención
 * 1. Genera copia de seguridad consolidada y dump SQL.
 * 2. Purga archivos con más de 'diasRetencion' días (default: 7 días)
 *    para evitar saturación de disco.
 */
export async function runScheduledBackup(
  actor = 'CRON_AUTOMATICO',
  diasRetencion = 7
): Promise<{ backup: any; purgados: number; conservados: number }> {
  // 1. Generar nuevo backup
  const backup = await createIntegralBackup(actor, false);

  // 2. Rotación de retención de archivos antiguos
  const backupDir = path.resolve(process.env.BACKUP_DIR || './backups');
  const dumpsDir = path.resolve(process.env.DUMP_DIR || path.join(backupDir, 'dumps'));
  const ahora = Date.now();
  const limiteTiempoMs = diasRetencion * 24 * 60 * 60 * 1000;
  let purgados = 0;
  let conservados = 0;

  const purgarDirectorio = (dir: string, extension: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(extension)) continue;
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        const edadMs = ahora - stats.mtimeMs;
        if (edadMs > limiteTiempoMs) {
          fs.unlinkSync(fullPath);
          purgados++;
          console.log(`[BACKUP ROTATION] Archivo antiguo purgado: ${file}`);
        } else {
          conservados++;
        }
      } catch (err: any) {
        console.warn(`[BACKUP ROTATION] Error procesando ${file}:`, err.message);
      }
    }
  };

  purgarDirectorio(backupDir, '.zip');
  purgarDirectorio(dumpsDir, '.sql');

  return { backup, purgados, conservados };
}
