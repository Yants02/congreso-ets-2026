import { Router, Response } from 'express';
import { query } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';
import { getJournalingLevel, setCachedJournalingLevel, JournalingLevel } from '../../middlewares/journalingMiddleware';

const router = Router();

/**
 * GET /api/admin/journaling/config
 * Obtiene el nivel de journaling activo y estadísticas de registros
 */
router.get('/config', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const nivel = await getJournalingLevel();

    const [statsRes, countRes] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total_logs,
          COUNT(*) FILTER (WHERE nivel = 'CRITICAL') as total_critical,
          COUNT(*) FILTER (WHERE nivel = 'WARN') as total_warn,
          COUNT(*) FILTER (WHERE nivel = 'INFO') as total_info,
          COALESCE(AVG(duracion_ms), 0) as avg_latency_ms
        FROM logs_journaling
      `),
      query(`SELECT pg_size_pretty(pg_total_relation_size('logs_journaling')) as table_size`),
    ]);

    res.json({
      ok: true,
      nivel_actual: nivel,
      stats: {
        total_logs: parseInt(statsRes.rows[0].total_logs, 10),
        total_critical: parseInt(statsRes.rows[0].total_critical, 10),
        total_warn: parseInt(statsRes.rows[0].total_warn, 10),
        total_info: parseInt(statsRes.rows[0].total_info, 10),
        avg_latency_ms: Number(parseFloat(statsRes.rows[0].avg_latency_ms).toFixed(2)),
        table_size: countRes.rows[0].table_size,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/journaling/config:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/journaling/config
 * Actualiza el nivel de journaling (DISABLED, ERRORS_ONLY, VERBOSE_ALL)
 */
router.put('/config', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { nivel } = req.body;
    if (nivel !== 'DISABLED' && nivel !== 'ERRORS_ONLY' && nivel !== 'VERBOSE_ALL') {
      res.status(400).json({
        ok: false,
        error: 'ERR_INVALID_LEVEL',
        message: 'Nivel inválido. Opciones permitidas: DISABLED, ERRORS_ONLY, VERBOSE_ALL',
      });
      return;
    }

    await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, actualizado_en)
       VALUES ('JOURNALING_DEBUG_MODE', $1, 'Nivel de Journaling de diagnóstico del sistema (DISABLED, ERRORS_ONLY, VERBOSE_ALL)', 'SISTEMA', NOW())
       ON CONFLICT (clave) DO UPDATE
       SET valor = $1, actualizado_en = NOW()`,
      [JSON.stringify(nivel)]
    );

    setCachedJournalingLevel(nivel as JournalingLevel);

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'JOURNALING_LEVEL_CHANGED', $1, $2)`,
      [req.operator?.email || 'SUPERADMIN', JSON.stringify({ nivel })]
    ).catch(() => {});

    res.json({
      ok: true,
      nivel_actual: nivel,
      mensaje: `Nivel de Journaling configurado a: ${nivel}`,
    });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/journaling/config:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/journaling/logs
 * Consulta filtrada y paginada de la bitácora de Journaling
 */
router.get('/logs', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const nivel = (req.query.nivel as string || '').trim().toUpperCase();
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(
        `(ruta ILIKE $${pIdx} OR metodo ILIKE $${pIdx} OR ip_origen ILIKE $${pIdx} OR usuario_email ILIKE $${pIdx})`
      );
      params.push(`%${q}%`);
      pIdx++;
    }

    if (nivel && nivel !== 'TODOS') {
      conditions.push(`nivel = $${pIdx++}`);
      params.push(nivel);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) as total FROM logs_journaling WHERE ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const sql = `
      SELECT id, nivel, metodo, ruta, status_code, duracion_ms, ip_origen, usuario_email,
             request_headers, request_body, error_detalles, timestamp
      FROM logs_journaling
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
    console.error('Error en GET /api/admin/journaling/logs:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/journaling/purge
 * Purga o limpia logs antiguos de journaling para liberar espacio
 */
router.delete('/purge', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const keepDays = parseInt((req.query.keep_days as string) || '7', 10);

    const deleteRes = await query(
      `DELETE FROM logs_journaling WHERE timestamp < NOW() - ($1 || ' days')::INTERVAL RETURNING id`,
      [keepDays]
    );

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('logs_journaling', 'JOURNALING_PURGE', $1, $2)`,
      [req.operator?.email || 'SUPERADMIN', JSON.stringify({ keep_days: keepDays, deleted_count: deleteRes.rowCount })]
    ).catch(() => {});

    res.json({
      ok: true,
      eliminados: deleteRes.rowCount,
      mensaje: `Se eliminaron ${deleteRes.rowCount} registros con más de ${keepDays} días de antigüedad.`,
    });
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/journaling/purge:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
