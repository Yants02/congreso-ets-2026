import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db';
import { blacklistSchema, blacklistUpdateSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

const batchBlacklistSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un registro'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

/**
 * GET /api/admin/blacklist
 * Buscador de participantes con restricción de acceso / lista negra
 */
router.get('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const activoParam = req.query.activo as string;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(`(b.dni_pasaporte ILIKE $${pIdx} OR b.motivo ILIKE $${pIdx})`);
      params.push(`%${q}%`);
      pIdx++;
    }

    if (activoParam !== undefined && activoParam !== 'TODOS') {
      conditions.push(`b.activo = $${pIdx++}`);
      params.push(activoParam === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT b.id, b.dni_pasaporte, b.motivo, b.activo, b.creado_en,
             u.id as usuario_id, u.nombre as usuario_nombre, u.apellido as usuario_apellido, u.email as usuario_email
      FROM blacklist b
      LEFT JOIN usuarios u ON u.dni_pasaporte = b.dni_pasaporte
      WHERE ${whereClause}
      ORDER BY b.creado_en DESC
    `;

    const result = await query(sql, params);
    res.json({ ok: true, blacklist: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('Error en GET /api/admin/blacklist:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/blacklist
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = blacklistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { dni_pasaporte, motivo } = parsed.data;

    const result = await query(
      `INSERT INTO blacklist (dni_pasaporte, motivo, activo)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (dni_pasaporte) DO UPDATE 
       SET motivo = $2, activo = TRUE
       RETURNING *`,
      [dni_pasaporte, motivo]
    );

    // Sincronizar participante a la categoría SANCIONADO si ya existe en el sistema
    await query(
      `UPDATE usuarios 
       SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'SANCIONADO'),
           actualizado_en = NOW()
       WHERE dni_pasaporte = $1 
         AND estado_inscripcion_id != (SELECT id FROM estados_inscripcion WHERE codigo = 'CANCELADO')`,
      [dni_pasaporte]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('ALTA_BLACKLIST_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ dni_pasaporte, motivo })]
    );

    res.status(201).json({ ok: true, registro: result.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /api/admin/blacklist:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/blacklist/:id
 */
router.put('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const parsed = blacklistUpdateSchema.safeParse({ ...req.body, id });
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { motivo, activo } = parsed.data;

    const result = await query(
      `UPDATE blacklist
       SET motivo = COALESCE($1, motivo),
           activo = COALESCE($2, activo)
       WHERE id = $3
       RETURNING *`,
      [motivo, activo, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Registro de blacklist no encontrado' });
      return;
    }

    const reg = result.rows[0];
    if (activo === true) {
      await query(
        `UPDATE usuarios 
         SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'SANCIONADO'),
             actualizado_en = NOW()
         WHERE dni_pasaporte = $1 AND estado_inscripcion_id != (SELECT id FROM estados_inscripcion WHERE codigo = 'CANCELADO')`,
        [reg.dni_pasaporte]
      );
    } else if (activo === false) {
      await query(
        `UPDATE usuarios 
         SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'LISTA_ESPERA'),
             actualizado_en = NOW()
         WHERE dni_pasaporte = $1 AND estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'SANCIONADO')`,
        [reg.dni_pasaporte]
      );
    }

    res.json({ ok: true, registro: reg });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/blacklist/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/blacklist/:id
 */
router.delete('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const result = await query(`DELETE FROM blacklist WHERE id = $1 RETURNING dni_pasaporte`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Registro no encontrado' });
      return;
    }

    const dni = result.rows[0].dni_pasaporte;

    // Al retirar la sanción, mover al usuario sancionado a Lista de Espera para reevaluación
    await query(
      `UPDATE usuarios 
       SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'LISTA_ESPERA'),
           actualizado_en = NOW()
       WHERE dni_pasaporte = $1 AND estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'SANCIONADO')`,
      [dni]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('BAJA_BLACKLIST_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ id, dni })]
    );

    res.json({ ok: true, mensaje: 'DNI removido de la lista de exclusión correctamente.' });
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/blacklist/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/blacklist/batch
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchBlacklistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids, action } = parsed.data;

    if (action === 'activate') {
      const resUpd = await query(`UPDATE blacklist SET activo = TRUE WHERE id = ANY($1::int[]) RETURNING dni_pasaporte`, [ids]);
      const dnis = resUpd.rows.map((r) => r.dni_pasaporte);
      if (dnis.length > 0) {
        await query(
          `UPDATE usuarios 
           SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'SANCIONADO'),
               actualizado_en = NOW()
           WHERE dni_pasaporte = ANY($1::text[]) 
             AND estado_inscripcion_id != (SELECT id FROM estados_inscripcion WHERE codigo = 'CANCELADO')`,
          [dnis]
        );
      }
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} registros activados en blacklist.` });
    } else if (action === 'deactivate') {
      const resUpd = await query(`UPDATE blacklist SET activo = FALSE WHERE id = ANY($1::int[]) RETURNING dni_pasaporte`, [ids]);
      const dnis = resUpd.rows.map((r) => r.dni_pasaporte);
      if (dnis.length > 0) {
        await query(
          `UPDATE usuarios 
           SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'LISTA_ESPERA'),
               actualizado_en = NOW()
           WHERE dni_pasaporte = ANY($1::text[]) 
             AND estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'SANCIONADO')`,
          [dnis]
        );
      }
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} restricciones levantadas/desactivadas.` });
    } else if (action === 'delete') {
      const resDel = await query(`DELETE FROM blacklist WHERE id = ANY($1::int[]) RETURNING dni_pasaporte`, [ids]);
      const dnis = resDel.rows.map((r) => r.dni_pasaporte);
      if (dnis.length > 0) {
        await query(
          `UPDATE usuarios 
           SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'LISTA_ESPERA'),
               actualizado_en = NOW()
           WHERE dni_pasaporte = ANY($1::text[]) 
             AND estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'SANCIONADO')`,
          [dnis]
        );
      }
      res.json({ ok: true, processed: resDel.rowCount, message: `${resDel.rowCount} registros eliminados de blacklist.` });
    }
  } catch (error: any) {
    console.error('Error en POST /api/admin/blacklist/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
