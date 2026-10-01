import { Router, Request, Response } from 'express';
import { withTransaction } from '../lib/db';
import { z } from 'zod';

const router = Router();

const cancelarSchema = z.object({
  dni_pasaporte: z.string().min(5).max(25),
  motivo: z.string().max(300).optional(),
});

/**
 * POST /api/usuario/cancelar
 * Permite al usuario autogestionar la cancelación de su vacante desde la PWA / Credencial.
 * Si estaba CONFIRMADO, promueve automáticamente al primer aspirante de LISTA_ESPERA (FIFO).
 */
router.post('/cancelar', async (req: Request, res: Response) => {
  try {
    const parsed = cancelarSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'ERR_VALIDATION',
        details: parsed.error.format(),
      });
    }

    const { dni_pasaporte, motivo } = parsed.data;

    const result = await withTransaction(async (client) => {
      // 1. Buscar al usuario y su estado actual
      const userRes = await client.query(
        `SELECT u.id, u.nombre, u.apellido, u.email, u.evento_id, ei.codigo AS estado_codigo
         FROM usuarios u
         JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
         WHERE u.dni_pasaporte = $1
         ORDER BY u.actualizado_en DESC
         LIMIT 1`,
        [dni_pasaporte]
      );

      if (userRes.rowCount === 0) {
        throw {
          statusCode: 404,
          code: 'ERR_USER_NOT_FOUND',
          message: 'No se encontró ningún participante con el DNI ingresado.',
        };
      }

      const usuario = userRes.rows[0];

      if (usuario.estado_codigo === 'CANCELADO') {
        return {
          mensaje: 'Tu inscripción ya se encuentra cancelada.',
          usuario: {
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            dni: dni_pasaporte,
            estado: 'CANCELADO',
          },
        };
      }

      const estabaConfirmado = usuario.estado_codigo === 'CONFIRMADO';

      // 2. Pasar al usuario a estado CANCELADO
      await client.query(
        `UPDATE usuarios
         SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'CANCELADO'),
             actualizado_en = NOW()
         WHERE id = $1`,
        [usuario.id]
      );

      // Registrar en bitácora inmutable de auditoría
      await client.query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
         VALUES ('AUTO_BAJA_VOLUNTARIA', 'USUARIO', $1, $2, NOW())`,
        [
          usuario.id,
          JSON.stringify({
            dni_pasaporte,
            motivo: motivo || 'Cancelación voluntaria solicitada por el usuario desde PWA',
            estaba_confirmado: estabaConfirmado,
          }),
        ]
      );

      let usuarioPromovido = null;

      // 3. Si el usuario estaba CONFIRMADO, promover automáticamente al primer aspirante de LISTA_ESPERA (no sancionado)
      if (estabaConfirmado) {
        const waitIdRes = await client.query(
          `SELECT id FROM estados_inscripcion WHERE codigo = 'LISTA_ESPERA'`
        );
        const confIdRes = await client.query(
          `SELECT id FROM estados_inscripcion WHERE codigo = 'CONFIRMADO'`
        );
        const waitId = waitIdRes.rows[0]?.id;
        const confId = confIdRes.rows[0]?.id;

        if (waitId && confId) {
          const aspiranteRes = await client.query(
            `SELECT id, dni_pasaporte, nombre, apellido, email
             FROM usuarios
             WHERE estado_inscripcion_id = $1 AND evento_id = $2
               AND NOT EXISTS (
                 SELECT 1 FROM blacklist b WHERE b.dni_pasaporte = usuarios.dni_pasaporte AND b.activo = TRUE
               )
             ORDER BY creado_en ASC
             LIMIT 1`,
            [waitId, usuario.evento_id || 1]
          );

          if (aspiranteRes.rowCount && aspiranteRes.rowCount > 0) {
            const aspirante = aspiranteRes.rows[0];

            await client.query(
              `UPDATE usuarios
               SET estado_inscripcion_id = $1, actualizado_en = NOW()
               WHERE id = $2`,
              [confId, aspirante.id]
            );

            await client.query(
              `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
               VALUES ('PROMOCION_POR_AUTO_BAJA', 'SISTEMA', $1, $2, NOW())`,
              [
                aspirante.id,
                JSON.stringify({
                  motivo: `Vacante liberada por auto-baja de usuario ${dni_pasaporte}`,
                  promovido: `${aspirante.nombre} ${aspirante.apellido}`,
                  dni: aspirante.dni_pasaporte,
                }),
              ]
            );

            usuarioPromovido = { nombre: aspirante.nombre, apellido: aspirante.apellido };
          }
        }
      }

      return {
        mensaje:
          'Tu inscripción ha sido cancelada exitosamente. Se liberó la vacante para la comunidad.',
        usuario: {
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          dni: dni_pasaporte,
          estado: 'CANCELADO',
        },
        vacante_reasignada: Boolean(usuarioPromovido),
      };
    });

    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error en /api/usuario/cancelar:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.code || 'ERR_CANCELACION',
      message: error.message || 'Error al procesar la cancelación.',
    });
  }
});

export default router;
