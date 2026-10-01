import { Router, Response } from 'express';
import { query } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

/**
 * GET /api/admin/auditoria
 * Buscador forense de la bitácora inmutable de auditoría
 */
router.get('/', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const evento = req.query.evento as string;
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(
        `(evento ILIKE $${pIdx} OR actor_usuario ILIKE $${pIdx} OR detalles::text ILIKE $${pIdx})`
      );
      params.push(`%${q}%`);
      pIdx++;
    }

    if (evento && evento !== 'TODOS') {
      conditions.push(`evento = $${pIdx++}`);
      params.push(evento);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) as total FROM logs_auditoria WHERE ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const sql = `
      SELECT id, evento, actor_usuario, usuario_afectado_id, detalles, timestamp, timestamp as creado_en
      FROM logs_auditoria
      WHERE ${whereClause}
      ORDER BY timestamp DESC, id DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const result = await query(sql, [...params, limit, offset]);

    res.json({
      ok: true,
      total_registros: total,
      pagina_actual: page,
      limite: limit,
      total_paginas: Math.ceil(total / limit),
      logs: result.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/auditoria:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
