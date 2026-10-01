import { Router, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../lib/db';
import { anularAcreditacionSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

const batchAcreditacionesSchema = z.object({
  ids: z.array(z.string().uuid().or(z.number().int().positive())).min(1, 'Debe seleccionar al menos una acreditación'),
  motivo: z.string().trim().min(3).max(500).optional().default('Anulación masiva por contingencia'),
});

/**
 * GET /api/admin/acreditaciones
 * Buscador forense de movimientos de ingreso/egreso y acreditaciones
 */
router.get('/', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const puntoAccesoId = req.query.punto_acceso_id as string;
    const tipoMovimiento = req.query.tipo_movimiento as string;
    const tipoAcreditacionId = req.query.tipo_acreditacion_id as string;
    const operadorId = req.query.operador_id as string;
    const esManual = req.query.es_manual as string;
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(`(u.nombre ILIKE $${pIdx} OR u.apellido ILIKE $${pIdx} OR u.dni_pasaporte ILIKE $${pIdx})`);
      params.push(`%${q}%`);
      pIdx++;
    }

    if (puntoAccesoId && puntoAccesoId !== 'TODOS') {
      const paId = parseInt(puntoAccesoId, 10);
      if (!isNaN(paId)) {
        conditions.push(`a.punto_acceso_id = $${pIdx++}`);
        params.push(paId);
      }
    }

    if (tipoMovimiento && tipoMovimiento !== 'TODOS') {
      conditions.push(`a.tipo_movimiento = $${pIdx++}`);
      params.push(tipoMovimiento.toUpperCase());
    }

    if (tipoAcreditacionId && tipoAcreditacionId !== 'TODOS') {
      const taId = parseInt(tipoAcreditacionId, 10);
      if (!isNaN(taId)) {
        conditions.push(`a.tipo_acreditacion_id = $${pIdx++}`);
        params.push(taId);
      }
    }

    if (operadorId && operadorId !== 'TODOS') {
      const opId = parseInt(operadorId, 10);
      if (!isNaN(opId)) {
        conditions.push(`a.operador_id = $${pIdx++}`);
        params.push(opId);
      }
    }

    if (esManual !== undefined && esManual !== 'TODOS') {
      conditions.push(`a.es_manual = $${pIdx++}`);
      params.push(esManual === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(*) as total
       FROM acreditaciones a
       JOIN usuarios u ON a.usuario_id = u.id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const sql = `
      SELECT a.id, a.timestamp_acreditacion, a.tipo_movimiento, a.es_manual, a.motivo_manual,
             u.id as usuario_id,
             u.nombre, u.nombre as usuario_nombre,
             u.apellido, u.apellido as usuario_apellido,
             u.dni_pasaporte, u.dni_pasaporte as dni,
             u.email, u.foto_url,
             r.nombre as rol_nombre,
             pa.id as punto_acceso_id, pa.nombre as punto_acceso_nombre,
             ta.id as tipo_acreditacion_id, ta.descripcion as tipo_acreditacion_nombre,
             act.id as actividad_id, act.nombre as actividad_nombre,
             op.id as operador_id,
             COALESCE(op.nombre || ' ' || op.apellido, op.nombre, 'Operador Sistema') as operador_nombre,
             op.nombre as op_nombre, op.apellido as operador_apellido
      FROM acreditaciones a
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN roles r ON u.rol_principal_id = r.id
      JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
      JOIN tipos_acreditacion ta ON a.tipo_acreditacion_id = ta.id
      LEFT JOIN actividades act ON a.actividad_id = act.id
      LEFT JOIN operadores op ON a.operador_id = op.id
      WHERE ${whereClause}
      ORDER BY a.timestamp_acreditacion DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const result = await query(sql, [...params, limit, offset]);

    res.json({
      ok: true,
      total,
      pagina_actual: page,
      limite: limit,
      total_paginas: Math.ceil(total / limit),
      acreditaciones: result.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/acreditaciones:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/acreditaciones/anular
 * Anulación de acreditación para contingencias de anti-passback
 */
router.post('/anular', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = anularAcreditacionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { id, motivo } = parsed.data;

    await withTransaction(async (client) => {
      const aRes = await client.query(`SELECT * FROM acreditaciones WHERE id = $1`, [id]);
      if (aRes.rowCount === 0) {
        throw new Error('Acreditación no encontrada');
      }

      await client.query(`DELETE FROM acreditaciones WHERE id = $1`, [id]);

      await client.query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
         VALUES ('ANULACION_ACREDITACION_MANUAL', $1, $2, NOW())`,
        [req.operator?.email || 'ADMIN', JSON.stringify({ acreditacion: aRes.rows[0], motivo })]
      );
    });

    res.json({ ok: true, mensaje: 'Acreditación anulada correctamente; vacante/aforo restablecido.' });
  } catch (error: any) {
    console.error('Error en POST /api/admin/acreditaciones/anular:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/acreditaciones/batch
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchAcreditacionesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids, motivo } = parsed.data;

    const resDel = await query(
      `DELETE FROM acreditaciones WHERE id = ANY($1) RETURNING id`,
      [ids]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('ANULACION_ACREDITACIONES_BATCH', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ count: resDel.rowCount, ids, motivo })]
    );

    res.json({
      ok: true,
      processed: resDel.rowCount,
      message: `${resDel.rowCount} acreditaciones anuladas correctamente.`,
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/acreditaciones/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
