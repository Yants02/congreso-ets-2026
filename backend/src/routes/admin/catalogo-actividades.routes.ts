import { Router, Response } from 'express';
import { query } from '../../lib/db';
import { catalogoActividadSchema, catalogoActividadBatchSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

/**
 * GET /api/admin/catalogo-actividades
 * Buscador de materias y talleres canónicos del catálogo institucional
 */
router.get('/', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const categoriaId = req.query.categoria_tematica_id as string;
    const tipoAcreditacionId = req.query.tipo_acreditacion_id as string;
    const activoParam = req.query.activo as string;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(`(ca.codigo ILIKE $${pIdx} OR ca.nombre ILIKE $${pIdx} OR ca.descripcion ILIKE $${pIdx})`);
      params.push(`%${q}%`);
      pIdx++;
    }

    if (categoriaId && categoriaId !== 'TODOS') {
      const cId = parseInt(categoriaId, 10);
      if (!isNaN(cId)) {
        conditions.push(`ca.categoria_tematica_id = $${pIdx++}`);
        params.push(cId);
      }
    }

    if (tipoAcreditacionId && tipoAcreditacionId !== 'TODOS') {
      const tId = parseInt(tipoAcreditacionId, 10);
      if (!isNaN(tId)) {
        conditions.push(`ca.tipo_acreditacion_id = $${pIdx++}`);
        params.push(tId);
      }
    }

    if (activoParam !== undefined && activoParam !== 'TODOS') {
      conditions.push(`ca.activo = $${pIdx++}`);
      params.push(activoParam === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT ca.id, ca.codigo, ca.nombre, ca.descripcion, ca.horas_catedra, ca.activo, ca.creado_en,
             ta.id as tipo_acreditacion_id, ta.descripcion as tipo_acreditacion_nombre,
             ct.id as categoria_tematica_id, ct.nombre as categoria_tematica_nombre,
             (SELECT COUNT(*) FROM actividades act WHERE act.catalogo_actividad_id = ca.id) as instancias_activas
      FROM catalogo_actividades ca
      JOIN tipos_acreditacion ta ON ca.tipo_acreditacion_id = ta.id
      LEFT JOIN categorias_tematicas ct ON ca.categoria_tematica_id = ct.id
      WHERE ${whereClause}
      ORDER BY ca.codigo ASC
    `;

    const result = await query(sql, params);
    res.json({ ok: true, catalogo: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('Error en GET /api/admin/catalogo-actividades:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/catalogo-actividades/:id
 */
router.get('/:id', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const sql = `
      SELECT ca.*, ta.descripcion as tipo_acreditacion_nombre, ct.nombre as categoria_tematica_nombre
      FROM catalogo_actividades ca
      JOIN tipos_acreditacion ta ON ca.tipo_acreditacion_id = ta.id
      LEFT JOIN categorias_tematicas ct ON ca.categoria_tematica_id = ct.id
      WHERE ca.id = $1
    `;

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Elemento de catálogo no encontrado' });
      return;
    }

    res.json({ ok: true, item: result.rows[0] });
  } catch (error: any) {
    console.error('Error en GET /api/admin/catalogo-actividades/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/catalogo-actividades
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = catalogoActividadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { codigo, nombre, descripcion, tipo_acreditacion_id, categoria_tematica_id, horas_catedra, activo } = parsed.data;

    // Comprobar unicidad de código
    const checkCodigo = await query(`SELECT id FROM catalogo_actividades WHERE codigo = $1`, [codigo]);
    if (checkCodigo.rowCount && checkCodigo.rowCount > 0) {
      res.status(409).json({ ok: false, error: 'ERR_CODE_EXISTS', message: 'Ya existe un ítem en el catálogo con ese código' });
      return;
    }

    const result = await query(
      `INSERT INTO catalogo_actividades (codigo, nombre, descripcion, tipo_acreditacion_id, categoria_tematica_id, horas_catedra, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [codigo, nombre, descripcion || null, tipo_acreditacion_id, categoria_tematica_id || null, horas_catedra || 2, activo !== undefined ? activo : true]
    );

    res.status(201).json({ ok: true, item: result.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /api/admin/catalogo-actividades:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/catalogo-actividades/:id
 */
router.put('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const { codigo, nombre, descripcion, tipo_acreditacion_id, categoria_tematica_id, horas_catedra, activo } = req.body;

    if (codigo) {
      const checkCodigo = await query(`SELECT id FROM catalogo_actividades WHERE codigo = $1 AND id != $2`, [codigo, id]);
      if (checkCodigo.rowCount && checkCodigo.rowCount > 0) {
        res.status(409).json({ ok: false, error: 'ERR_CODE_EXISTS', message: 'El código ya pertenece a otro registro del catálogo' });
        return;
      }
    }

    const result = await query(
      `UPDATE catalogo_actividades
       SET codigo = COALESCE($1, codigo),
           nombre = COALESCE($2, nombre),
           descripcion = COALESCE($3, descripcion),
           tipo_acreditacion_id = COALESCE($4, tipo_acreditacion_id),
           categoria_tematica_id = COALESCE($5, categoria_tematica_id),
           horas_catedra = COALESCE($6, horas_catedra),
           activo = COALESCE($7, activo),
           actualizado_en = NOW()
       WHERE id = $8
       RETURNING *`,
      [codigo, nombre, descripcion, tipo_acreditacion_id, categoria_tematica_id, horas_catedra, activo, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Registro no encontrado' });
      return;
    }

    res.json({ ok: true, item: result.rows[0] });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/catalogo-actividades/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/catalogo-actividades/:id
 */
router.delete('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const checkAct = await query(`SELECT COUNT(*) as count FROM actividades WHERE catalogo_actividad_id = $1`, [id]);
    const hasAct = parseInt(checkAct.rows[0].count, 10) > 0;

    if (hasAct) {
      await query(`UPDATE catalogo_actividades SET activo = FALSE, actualizado_en = NOW() WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'Posee actividades programadas asociadas; fue desactivado lógicamente.' });
    } else {
      await query(`DELETE FROM catalogo_actividades WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'Ítem del catálogo eliminado exitosamente.' });
    }
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/catalogo-actividades/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/catalogo-actividades/batch
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = catalogoActividadBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids, action } = parsed.data;

    if (action === 'activate') {
      const resUpd = await query(`UPDATE catalogo_actividades SET activo = TRUE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} materias activadas.` });
    } else if (action === 'deactivate') {
      const resUpd = await query(`UPDATE catalogo_actividades SET activo = FALSE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} materias desactivadas.` });
    } else if (action === 'delete') {
      const resDel = await query(
        `DELETE FROM catalogo_actividades WHERE id = ANY($1::int[]) AND NOT EXISTS (SELECT 1 FROM actividades WHERE catalogo_actividad_id = catalogo_actividades.id) RETURNING id`,
        [ids]
      );
      await query(
        `UPDATE catalogo_actividades SET activo = FALSE WHERE id = ANY($1::int[]) AND EXISTS (SELECT 1 FROM actividades WHERE catalogo_actividad_id = catalogo_actividades.id)`,
        [ids]
      );
      res.json({ ok: true, processed: resDel.rowCount, message: `${resDel.rowCount} materias eliminadas o desactivadas.` });
    }
  } catch (error: any) {
    console.error('Error en POST /api/admin/catalogo-actividades/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
