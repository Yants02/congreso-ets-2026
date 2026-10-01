import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db';
import { puntoAccesoSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

const batchPuntosSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto de acceso'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

/**
 * GET /api/admin/puntos-acceso
 * Buscador de puntos de acceso y salas con métricas de movimientos
 */
router.get('/', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const tipoPunto = req.query.tipo_punto as string;
    const activoParam = req.query.activo as string;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(`(pa.nombre ILIKE $${pIdx} OR pa.ubicacion_fisica ILIKE $${pIdx})`);
      params.push(`%${q}%`);
      pIdx++;
    }

    if (tipoPunto && tipoPunto !== 'TODOS') {
      conditions.push(`pa.tipo_punto = $${pIdx++}`);
      params.push(tipoPunto);
    }

    if (activoParam !== undefined && activoParam !== 'TODOS') {
      conditions.push(`pa.activo = $${pIdx++}`);
      params.push(activoParam === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT pa.id, pa.nombre, pa.ubicacion_fisica, pa.tipo_punto, pa.capacidad_maxima, pa.activo,
             pa.evento_id,
             COUNT(a.id) as total_acreditaciones,
             COUNT(a.id) FILTER (WHERE a.tipo_movimiento = 'INGRESO') as total_ingresos,
             COUNT(a.id) FILTER (WHERE a.tipo_movimiento = 'EGRESO') as total_egresos
      FROM puntos_acceso pa
      LEFT JOIN acreditaciones a ON a.punto_acceso_id = pa.id
      WHERE ${whereClause}
      GROUP BY pa.id, pa.nombre, pa.ubicacion_fisica, pa.tipo_punto, pa.capacidad_maxima, pa.activo, pa.evento_id
      ORDER BY pa.id ASC
    `;

    const result = await query(sql, params);

    res.json({
      ok: true,
      total: result.rowCount,
      puntos_acceso: result.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/puntos-acceso:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/puntos-acceso/:id
 */
router.get('/:id', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const result = await query(`SELECT * FROM puntos_acceso WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Punto de acceso no encontrado' });
      return;
    }

    res.json({ ok: true, punto_acceso: result.rows[0] });
  } catch (error: any) {
    console.error('Error en GET /api/admin/puntos-acceso/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/puntos-acceso
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = puntoAccesoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { nombre, ubicacion_fisica, tipo_punto, capacidad_maxima, activo, evento_id } = parsed.data;

    const result = await query(
      `INSERT INTO puntos_acceso (nombre, ubicacion_fisica, tipo_punto, capacidad_maxima, activo, evento_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, ubicacion_fisica, tipo_punto || 'AULA_SALON', capacidad_maxima || 50, activo !== undefined ? activo : true, evento_id || 1]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('ALTA_PUNTO_ACCESO_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ punto: result.rows[0] })]
    );

    res.status(201).json({ ok: true, punto_acceso: result.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /api/admin/puntos-acceso:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/puntos-acceso/:id
 */
router.put('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const { nombre, ubicacion_fisica, tipo_punto, capacidad_maxima, activo } = req.body;

    const result = await query(
      `UPDATE puntos_acceso
       SET nombre = COALESCE($1, nombre),
           ubicacion_fisica = COALESCE($2, ubicacion_fisica),
           tipo_punto = COALESCE($3, tipo_punto),
           capacidad_maxima = COALESCE($4, capacidad_maxima),
           activo = COALESCE($5, activo),
           actualizado_en = NOW()
       WHERE id = $6
       RETURNING *`,
      [nombre, ubicacion_fisica, tipo_punto, capacidad_maxima, activo, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Punto de acceso no encontrado' });
      return;
    }

    res.json({ ok: true, punto_acceso: result.rows[0] });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/puntos-acceso/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/puntos-acceso/:id
 */
router.delete('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    // Si tiene acreditaciones, desactivar lógicamente
    const checkAcred = await query(`SELECT COUNT(*) as count FROM acreditaciones WHERE punto_acceso_id = $1`, [id]);
    const hasAcred = parseInt(checkAcred.rows[0].count, 10) > 0;

    if (hasAcred) {
      await query(`UPDATE puntos_acceso SET activo = FALSE, actualizado_en = NOW() WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'El punto posee registros históricos; se desactivó lógicamente.' });
    } else {
      await query(`DELETE FROM puntos_acceso WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'Punto de acceso eliminado exitosamente.' });
    }
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/puntos-acceso/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/puntos-acceso/batch
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchPuntosSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids, action } = parsed.data;

    if (action === 'activate') {
      const resUpd = await query(`UPDATE puntos_acceso SET activo = TRUE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} puntos activados.` });
    } else if (action === 'deactivate') {
      const resUpd = await query(`UPDATE puntos_acceso SET activo = FALSE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} puntos desactivados.` });
    } else if (action === 'delete') {
      const resDel = await query(
        `DELETE FROM puntos_acceso WHERE id = ANY($1::int[]) AND NOT EXISTS (SELECT 1 FROM acreditaciones WHERE punto_acceso_id = puntos_acceso.id) RETURNING id`,
        [ids]
      );
      await query(
        `UPDATE puntos_acceso SET activo = FALSE WHERE id = ANY($1::int[]) AND EXISTS (SELECT 1 FROM acreditaciones WHERE punto_acceso_id = puntos_acceso.id)`,
        [ids]
      );
      res.json({ ok: true, processed: resDel.rowCount, message: `${resDel.rowCount} puntos eliminados (aquellos con acreditaciones fueron desactivados).` });
    }
  } catch (error: any) {
    console.error('Error en POST /api/admin/puntos-acceso/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
