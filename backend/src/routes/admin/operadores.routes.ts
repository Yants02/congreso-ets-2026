import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db';
import { hashPassword } from '../../lib/authService';
import { AuthenticatedRequest, requireHierarchy, requirePermission } from '../../middlewares/authMiddleware';

const router = Router();

const batchOperadoresSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un operador'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

/**
 * GET /api/admin/operadores
 * Listar y buscar operadores de puerta y verificadores
 */
router.get('/', requirePermission('operadores', 4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const search = ((req.query.q as string || req.query.search as string) || '').trim();
    const activoParam = req.query.activo as string;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (search) {
      conditions.push(`(o.nombre ILIKE $${pIdx} OR o.apellido ILIKE $${pIdx} OR o.email_institucional ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    if (activoParam !== undefined && activoParam !== 'TODOS') {
      conditions.push(`o.activo = $${pIdx++}`);
      params.push(activoParam === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT o.id, o.nombre, o.apellido, o.email_institucional, 
             o.punto_acceso_default_id, p.nombre as punto_acceso_nombre,
             o.rol_id, r.nombre as rol_nombre, r.jerarquia,
             o.permisos as operador_permisos,
             COALESCE(o.permisos, r.permisos, '[]'::jsonb) as permisos,
             o.activo, o.creado_en,
             (SELECT COUNT(*) FROM acreditaciones a WHERE a.operador_id = o.id) as total_acreditaciones_realizadas
      FROM operadores o
      LEFT JOIN puntos_acceso p ON o.punto_acceso_default_id = p.id
      LEFT JOIN roles r ON o.rol_id = r.id
      WHERE ${whereClause}
      ORDER BY o.id ASC
    `;

    const result = await query(sql, params);
    res.json({ ok: true, operadores: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('Error en GET /api/admin/operadores:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/operadores/:id
 */
router.get('/:id', requirePermission('operadores', 4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const sql = `
      SELECT o.id, o.nombre, o.apellido, o.email_institucional, 
             o.punto_acceso_default_id, p.nombre as punto_acceso_nombre,
             o.rol_id, r.nombre as rol_nombre, r.jerarquia,
             o.permisos as operador_permisos,
             COALESCE(o.permisos, r.permisos, '[]'::jsonb) as permisos,
             o.activo, o.creado_en
      FROM operadores o
      LEFT JOIN puntos_acceso p ON o.punto_acceso_default_id = p.id
      LEFT JOIN roles r ON o.rol_id = r.id
      WHERE o.id = $1
    `;

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Operador no encontrado' });
      return;
    }

    res.json({ ok: true, operador: result.rows[0] });
  } catch (error: any) {
    console.error('Error en GET /api/admin/operadores/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/operadores
 */
router.post('/', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { nombre, apellido, email_institucional, punto_acceso_default_id, rol_id, password, permisos } = req.body;

    if (!nombre || !apellido || !email_institucional || !punto_acceso_default_id) {
      res.status(400).json({ ok: false, error: 'ERR_MISSING_FIELDS', message: 'Faltan campos obligatorios' });
      return;
    }

    const checkEmail = await query(`SELECT id FROM operadores WHERE email_institucional = $1`, [email_institucional]);
    if (checkEmail.rowCount && checkEmail.rowCount > 0) {
      res.status(409).json({ ok: false, error: 'ERR_EMAIL_EXISTS', message: 'Ya existe un operador con ese correo institucional' });
      return;
    }

    const passwordHash = password ? hashPassword(password) : hashPassword('Congreso2026!');
    const rolIdFinal = rol_id || 5;
    const permisosVal = Array.isArray(permisos) ? JSON.stringify(permisos) : (permisos ? JSON.stringify(permisos) : null);

    const insertRes = await query(
      `INSERT INTO operadores (nombre, apellido, email_institucional, punto_acceso_default_id, rol_id, password_hash, permisos, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE)
       RETURNING id, nombre, apellido, email_institucional, punto_acceso_default_id, rol_id, permisos, activo, creado_en`,
      [nombre, apellido, email_institucional, punto_acceso_default_id, rolIdFinal, passwordHash, permisosVal]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('OPERADOR_CREATE', $1, $2, NOW())`,
      [req.operator?.email || 'SUPERADMIN', JSON.stringify({ operador: insertRes.rows[0] })]
    );

    res.status(201).json({ ok: true, operador: insertRes.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /api/admin/operadores:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/operadores/:id
 */
router.put('/:id', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const { nombre, apellido, email_institucional, punto_acceso_default_id, rol_id, activo, password, permisos } = req.body;

    if (email_institucional) {
      const checkEmail = await query(`SELECT id FROM operadores WHERE email_institucional = $1 AND id != $2`, [email_institucional, id]);
      if (checkEmail.rowCount && checkEmail.rowCount > 0) {
        res.status(409).json({ ok: false, error: 'ERR_EMAIL_EXISTS', message: 'El correo pertenece a otro operador' });
        return;
      }
    }

    const permisosVal = Array.isArray(permisos) ? JSON.stringify(permisos) : (permisos !== undefined ? (permisos === null ? null : JSON.stringify(permisos)) : undefined);

    let sql = `
      UPDATE operadores
      SET nombre = COALESCE($1, nombre),
          apellido = COALESCE($2, apellido),
          email_institucional = COALESCE($3, email_institucional),
          punto_acceso_default_id = COALESCE($4, punto_acceso_default_id),
          rol_id = COALESCE($5, rol_id),
          activo = COALESCE($6, activo),
    `;
    const params: any[] = [nombre, apellido, email_institucional, punto_acceso_default_id, rol_id, activo];

    if (permisosVal !== undefined) {
      sql += ` permisos = $7::jsonb, `;
      params.push(permisosVal);
    }

    sql += ` actualizado_en = NOW() `;

    let pIdx = params.length + 1;
    if (password && password.trim().length > 0) {
      const newHash = hashPassword(password);
      sql += `, password_hash = $${pIdx++} WHERE id = $${pIdx} RETURNING id, nombre, apellido, email_institucional, activo, permisos`;
      params.push(newHash, id);
    } else {
      sql += ` WHERE id = $${pIdx} RETURNING id, nombre, apellido, email_institucional, activo, permisos`;
      params.push(id);
    }

    const updateRes = await query(sql, params);
    if (updateRes.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'Operador no encontrado' });
      return;
    }

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('OPERADOR_UPDATE', $1, $2, NOW())`,
      [req.operator?.email || 'SUPERADMIN', JSON.stringify({ id, activo })]
    );

    res.json({ ok: true, operador: updateRes.rows[0] });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/operadores/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/operadores/:id
 */
router.delete('/:id', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    if (id === 1) {
      res.status(403).json({ ok: false, error: 'ERR_FORBIDDEN', message: 'No es posible eliminar al Superadmin principal del sistema' });
      return;
    }

    // Verificar acreditaciones realizadas
    const checkAcred = await query(`SELECT COUNT(*) as count FROM acreditaciones WHERE operador_id = $1`, [id]);
    const hasAcred = parseInt(checkAcred.rows[0].count, 10) > 0;

    if (hasAcred) {
      await query(`UPDATE operadores SET activo = FALSE, actualizado_en = NOW() WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'El operador posee acreditaciones históricas; fue desactivado lógicamente.' });
    } else {
      await query(`DELETE FROM operadores WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'Operador eliminado correctamente.' });
    }

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('OPERADOR_DELETE', $1, $2, NOW())`,
      [req.operator?.email || 'SUPERADMIN', JSON.stringify({ id })]
    );
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/operadores/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/operadores/batch
 */
router.post('/batch', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchOperadoresSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids, action } = parsed.data;
    const safeIds = ids.filter((id) => id !== 1); // Proteger Superadmin

    if (action === 'activate') {
      const resUpd = await query(`UPDATE operadores SET activo = TRUE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [safeIds]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} operadores activados.` });
    } else if (action === 'deactivate') {
      const resUpd = await query(`UPDATE operadores SET activo = FALSE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [safeIds]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} operadores desactivados.` });
    } else if (action === 'delete') {
      const resDel = await query(
        `DELETE FROM operadores WHERE id = ANY($1::int[]) AND NOT EXISTS (SELECT 1 FROM acreditaciones WHERE operador_id = operadores.id) RETURNING id`,
        [safeIds]
      );
      await query(
        `UPDATE operadores SET activo = FALSE WHERE id = ANY($1::int[]) AND EXISTS (SELECT 1 FROM acreditaciones WHERE operador_id = operadores.id)`,
        [safeIds]
      );
      res.json({ ok: true, processed: resDel.rowCount, message: `${resDel.rowCount} operadores eliminados o desactivados.` });
    }
  } catch (error: any) {
    console.error('Error en POST /api/admin/operadores/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
