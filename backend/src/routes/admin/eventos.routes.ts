import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

const eventoSchema = z.object({
  codigo: z.string().min(2).max(50).optional(),
  codigo_edicion: z.string().min(2).max(50).optional(),
  nombre: z.string().min(3).max(150),
  anio: z.number().int().min(2020).max(2100),
  fecha_inicio: z.string().min(1),
  fecha_fin: z.string().min(1),
  cupo_maximo: z.number().int().positive().default(400),
  activo: z.boolean().default(true),
  sede_nombre: z.string().max(255).optional().default('Sede Principal'),
  sede_direccion: z.string().max(255).optional().default('Dirección a definir'),
  sede_mapa_url: z.string().optional().default(''),
}).transform((data) => ({
  ...data,
  codigo: (data.codigo || data.codigo_edicion || '').trim(),
})).refine((data) => data.codigo.length >= 2, {
  message: 'Código de edición es requerido (mínimo 2 caracteres)',
  path: ['codigo'],
});

/**
 * GET /api/admin/eventos
 * Listar y buscar ediciones o eventos institucionales
 */
router.get('/', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const activoParam = req.query.activo as string;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(`(ev.codigo ILIKE $${pIdx} OR ev.nombre ILIKE $${pIdx})`);
      params.push(`%${q}%`);
      pIdx++;
    }

    if (activoParam !== undefined && activoParam !== 'TODOS') {
      conditions.push(`ev.activo = $${pIdx++}`);
      params.push(activoParam === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT ev.*,
             ev.codigo as codigo_edicion,
             (SELECT COUNT(*) FROM usuarios u WHERE u.evento_id = ev.id) as total_inscriptos,
             (SELECT COUNT(*) FROM actividades act WHERE act.evento_id = ev.id) as total_actividades
      FROM eventos ev
      WHERE ${whereClause}
      ORDER BY ev.anio DESC, ev.id ASC
    `;

    const result = await query(sql, params);
    res.json({ ok: true, eventos: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('Error en GET /api/admin/eventos:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/eventos/:id/detalle
 */
router.get('/:id/detalle', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const evRes = await query(`SELECT * FROM eventos WHERE id = $1`, [id]);
    if (evRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Evento no encontrado' });
      return;
    }

    const [statsRes, actividadesRes] = await Promise.all([
      query(
        `SELECT            COUNT(*) FILTER (WHERE ei.codigo = 'CONFIRMADO') as confirmados,
            COUNT(*) FILTER (WHERE ei.codigo = 'LISTA_ESPERA') as lista_espera,
            COUNT(*) FILTER (WHERE ei.codigo = 'SANCIONADO') as sancionados,
            COUNT(*) FILTER (WHERE ei.codigo = 'CANCELADO') as cancelados
         FROM usuarios u
         JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
         WHERE u.evento_id = $1`,
        [id]
      ),
      query(
        `SELECT act.id, act.nombre, act.cupo_maximo, pa.nombre as punto_acceso
         FROM actividades act
         JOIN puntos_acceso pa ON act.punto_acceso_id = pa.id
         WHERE act.evento_id = $1
         ORDER BY act.horario_inicio ASC`,
        [id]
      ),
    ]);

    res.json({
      ok: true,
      evento: evRes.rows[0],
      metricas: statsRes.rows[0],
      actividades: actividadesRes.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/eventos/:id/detalle:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/eventos
 */
router.post('/', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = eventoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { codigo, nombre, anio, fecha_inicio, fecha_fin, cupo_maximo, activo, sede_nombre, sede_direccion, sede_mapa_url } = parsed.data;

    const result = await query(
      `INSERT INTO eventos (codigo, nombre, anio, fecha_inicio, fecha_fin, cupo_maximo, activo, sede_nombre, sede_direccion, sede_mapa_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [codigo, nombre, anio, fecha_inicio, fecha_fin, cupo_maximo, activo, sede_nombre, sede_direccion, sede_mapa_url]
    );

    if (activo && result.rows[0]) {
      await query(`UPDATE eventos SET activo = false WHERE id != $1`, [result.rows[0].id]);
    }

    res.status(201).json({ ok: true, evento: result.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /api/admin/eventos:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/eventos/:id
 */
router.put('/:id', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const { nombre, anio, fecha_inicio, fecha_fin, cupo_maximo, activo, sede_nombre, sede_direccion, sede_mapa_url } = req.body;
    const codigo = req.body.codigo || req.body.codigo_edicion || null;

    const result = await query(
      `UPDATE eventos
       SET codigo = COALESCE($1, codigo),
           nombre = COALESCE($2, nombre),
           anio = COALESCE($3, anio),
           fecha_inicio = COALESCE($4, fecha_inicio),
           fecha_fin = COALESCE($5, fecha_fin),
           cupo_maximo = COALESCE($6, cupo_maximo),
           activo = COALESCE($7, activo),
           sede_nombre = COALESCE($8, sede_nombre),
           sede_direccion = COALESCE($9, sede_direccion),
           sede_mapa_url = COALESCE($10, sede_mapa_url),
           actualizado_en = NOW()
       WHERE id = $11
       RETURNING *`,
      [codigo, nombre, anio, fecha_inicio, fecha_fin, cupo_maximo, activo, sede_nombre, sede_direccion, sede_mapa_url, id]
    );

    if (activo === true) {
      await query(`UPDATE eventos SET activo = false WHERE id != $1`, [id]);
    }

    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Evento no encontrado' });
      return;
    }

    res.json({ ok: true, evento: result.rows[0] });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/eventos/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/eventos/:id
 */
router.delete('/:id', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    // Comprobar si tiene participantes inscriptos
    const checkUsers = await query(`SELECT COUNT(*) as count FROM usuarios WHERE evento_id = $1`, [id]);
    const hasUsers = parseInt(checkUsers.rows[0].count, 10) > 0;

    if (hasUsers) {
      await query(`UPDATE eventos SET activo = FALSE, actualizado_en = NOW() WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'El evento tiene inscriptos asociados; fue desactivado lógicamente.' });
    } else {
      await query(`DELETE FROM eventos WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'Evento eliminado correctamente.' });
    }
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/eventos/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
