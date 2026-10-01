import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db';
import { homologacionSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

const batchHomologacionesSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos una homologación'),
  accion: z.enum(['VALIDAR', 'RECHAZAR']),
  observaciones: z.string().optional(),
});

/**
 * GET /api/admin/homologaciones
 * Buscador de solicitudes de homologación de disertantes y expositores
 */
router.get('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const estado = req.query.estado as string;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(
        `(u.nombre ILIKE $${pIdx} OR u.apellido ILIKE $${pIdx} OR u.dni_pasaporte ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`
      );
      params.push(`%${q}%`);
      pIdx++;
    }

    if (estado && estado !== 'TODOS') {
      conditions.push(`he.estado_homologacion = $${pIdx++}`);
      params.push(estado.toUpperCase());
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT he.id, he.usuario_id, he.estado_homologacion, he.observaciones, he.documentacion_presentada,
             he.actualizado_en, u.creado_en as registrado_en,
             u.nombre as usuario_nombre, u.apellido as usuario_apellido, u.dni_pasaporte, u.email,
             r.nombre as rol_nombre
      FROM homologaciones_expositores he
      JOIN usuarios u ON he.usuario_id = u.id
      JOIN roles r ON u.rol_principal_id = r.id
      WHERE ${whereClause}
      ORDER BY he.actualizado_en DESC
    `;

    const result = await query(sql, params);
    res.json({ ok: true, homologaciones: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('Error en GET /api/admin/homologaciones:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/homologaciones
 * Actualización o resolución de homologación
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = homologacionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { usuario_id, accion, observaciones, documentacion_presentada } = parsed.data;

    let nuevoEstado = 'VALIDADO';
    if (accion === 'RECHAZAR' || accion === 'ANULAR') nuevoEstado = 'RECHAZADO';
    else if (accion === 'CREAR') nuevoEstado = 'PENDIENTE';

    const result = await query(
      `INSERT INTO homologaciones_expositores (usuario_id, estado_homologacion, observaciones, documentacion_presentada)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE
       SET estado_homologacion = $2, observaciones = $3, documentacion_presentada = COALESCE($4, homologaciones_expositores.documentacion_presentada), actualizado_en = NOW()
       RETURNING *`,
      [usuario_id, nuevoEstado, observaciones || null, documentacion_presentada || null]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
       VALUES ('RESOLUCION_HOMOLOGACION', $1, $2, $3, NOW())`,
      [req.operator?.email || 'ADMIN', usuario_id, JSON.stringify({ accion, estado: nuevoEstado, observaciones })]
    );

    res.json({ ok: true, homologacion: result.rows[0], mensaje: `Homologación actualizada a ${nuevoEstado}.` });
  } catch (error: any) {
    console.error('Error en POST /api/admin/homologaciones:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/homologaciones/batch
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchHomologacionesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids, accion, observaciones } = parsed.data;
    const nuevoEstado = accion === 'VALIDAR' ? 'VALIDADO' : 'RECHAZADO';

    const resUpd = await query(
      `UPDATE homologaciones_expositores
       SET estado_homologacion = $1, observaciones = COALESCE($2, observaciones), actualizado_en = NOW()
       WHERE id = ANY($3::int[])
       RETURNING id`,
      [nuevoEstado, observaciones || null, ids]
    );

    res.json({
      ok: true,
      processed: resUpd.rowCount,
      message: `Se actualizaron ${resUpd.rowCount} homologaciones a ${nuevoEstado}.`,
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/homologaciones/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
