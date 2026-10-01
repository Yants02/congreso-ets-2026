import { Router, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy, requirePermission } from '../../middlewares/authMiddleware';

const router = Router();

const presenterSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  dni_pasaporte: z.string().min(6, 'DNI o Pasaporte inválido'),
  celular: z.string().min(6, 'Número de celular inválido'),
  institucion: z.string().optional(),
  observaciones: z.string().optional(),
  evento_id: z.number().int().positive().optional(),
});

/**
 * GET /api/admin/presentadores
 * Retorna todos los expositores/presentadores con métricas de sus actividades asignadas
 */
router.get('/', requirePermission('presentadores', 3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const eventoId = req.query.evento_id ? parseInt(req.query.evento_id as string, 10) : 1;

    let searchSql = '';
    const params: any[] = [eventoId];
    if (q) {
      searchSql = `AND (u.nombre ILIKE $2 OR u.apellido ILIKE $2 OR u.email ILIKE $2 OR u.dni_pasaporte ILIKE $2 OR ar.disertante_nombre ILIKE $2 OR he.observaciones ILIKE $2)`;
      params.push(`%${q}%`);
    }

    const sql = `
      WITH actividades_resumen AS (
        SELECT 
          COALESCE(a.disertante_usuario_id::text, a.disertante_nombre) as presenter_key,
          a.disertante_usuario_id,
          a.disertante_nombre,
          COUNT(a.id) as total_actividades,
          COALESCE(SUM(a.cupo_maximo), 0) as cupo_acumulado,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'nombre', a.nombre,
              'horario_inicio', a.horario_inicio,
              'horario_fin', a.horario_fin,
              'recinto', pa.nombre
            ) ORDER BY a.horario_inicio ASC
          ) as actividades
        FROM actividades a
        LEFT JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
        WHERE a.activo = TRUE AND a.evento_id = $1
        GROUP BY COALESCE(a.disertante_usuario_id::text, a.disertante_nombre), a.disertante_usuario_id, a.disertante_nombre
      )
      SELECT 
        u.id as usuario_id,
        u.nombre,
        u.apellido,
        u.email,
        u.celular,
        u.dni_pasaporte,
        r.nombre as rol_nombre,
        he.estado_homologacion,
        he.observaciones as institucion_bio,
        COALESCE(ar.total_actividades, 0) as total_actividades,
        COALESCE(ar.cupo_acumulado, 0) as cupo_acumulado,
        COALESCE(ar.actividades, '[]'::json) as actividades
      FROM usuarios u
      JOIN roles r ON u.rol_principal_id = r.id
      LEFT JOIN homologaciones_expositores he ON he.usuario_id = u.id
      LEFT JOIN actividades_resumen ar ON ar.disertante_usuario_id = u.id
      WHERE (
        r.nombre ILIKE '%Expositor%'
        OR r.nombre ILIKE '%Disertante%'
        OR r.nombre ILIKE '%Docente%'
        OR r.nombre ILIKE '%Ponente%'
        OR he.id IS NOT NULL
        OR ar.total_actividades > 0
      )
        AND u.evento_id = $1
        ${searchSql}
      ORDER BY u.apellido ASC, u.nombre ASC
    `;

    const result = await query(sql, params);

    res.json({
      ok: true,
      total: result.rowCount,
      presentadores: result.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/presentadores:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/presentadores
 * Registra un nuevo presentador/expositor con homologación aprobada por defecto
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = presenterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { nombre, apellido, email, dni_pasaporte, celular, institucion, observaciones, evento_id } = parsed.data;

    // Obtener dinámicamente el ID del rol Disertante / Expositor (id 4 en la base de datos)
    const roleCheck = await query(
      `SELECT id FROM roles WHERE nombre ILIKE '%Expositor%' OR nombre ILIKE '%Disertante%' ORDER BY id ASC LIMIT 1`
    );
    const expositorRolId = (roleCheck.rows && roleCheck.rows[0]?.id) ? roleCheck.rows[0].id : 4;

    // Estado Confirmado = 1
    const userRes = await query(
      `INSERT INTO usuarios (
        nombre, apellido, email, dni_pasaporte, celular, rol_principal_id, estado_inscripcion_id, evento_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
      RETURNING *`,
      [nombre, apellido, email.toLowerCase().trim(), dni_pasaporte.trim(), celular.trim(), expositorRolId, evento_id || 1]
    );

    const newUser = userRes.rows[0];

    // Homologación de expositor automática
    await query(
      `INSERT INTO homologaciones_expositores (
        usuario_id, estado_homologacion, observaciones, fecha_validacion
      ) VALUES ($1, 'VALIDADO', $2, NOW())
      ON CONFLICT (usuario_id) DO UPDATE SET estado_homologacion = 'VALIDADO', observaciones = EXCLUDED.observaciones`,
      [newUser.id, institucion || observaciones || 'Expositor registrado institucionalmente']
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('ALTA_PRESENTADOR_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ usuario_id: newUser.id, nombre, apellido, email })]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Presentador registrado exitosamente.',
      presentador: newUser,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ ok: false, error: 'ERR_DUPLICATE', message: 'Ya existe un usuario con este DNI o Email.' });
      return;
    }
    console.error('Error en POST /api/admin/presentadores:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/presentadores/:id
 * Modifica datos del presentador
 */
router.put('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const { nombre, apellido, email, celular, institucion, estado_homologacion } = req.body;

    const userRes = await query(
      `UPDATE usuarios
       SET nombre = COALESCE($1, nombre),
           apellido = COALESCE($2, apellido),
           email = COALESCE($3, email),
           celular = COALESCE($4, celular),
           actualizado_en = NOW()
       WHERE id = $5
       RETURNING *`,
      [nombre, apellido, email ? email.toLowerCase().trim() : null, celular, id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Presentador no encontrado' });
      return;
    }

    if (institucion !== undefined || estado_homologacion !== undefined) {
      await query(
        `INSERT INTO homologaciones_expositores (usuario_id, observaciones, estado_homologacion, fecha_validacion)
         VALUES ($1, $2, COALESCE($3, 'VALIDADO'), NOW())
         ON CONFLICT (usuario_id) DO UPDATE
         SET observaciones = COALESCE($2, homologaciones_expositores.observaciones),
             estado_homologacion = COALESCE($3, homologaciones_expositores.estado_homologacion),
             actualizado_en = NOW()`,
        [id, institucion, estado_homologacion]
      );
    }

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('EDICION_PRESENTADOR_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ usuario_id: id, cambios: req.body })]
    );

    res.json({
      ok: true,
      mensaje: 'Presentador actualizado exitosamente.',
      presentador: userRes.rows[0],
    });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/presentadores/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/presentadores/:id
 * Da de baja o elimina un presentador
 */
router.delete('/:id', requirePermission('presentadores', 4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;

    // Verificar existencia del usuario
    const userCheck = await query(`SELECT id, nombre, apellido FROM usuarios WHERE id = $1`, [id]);
    if (userCheck.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'ERR_NOT_FOUND', message: 'Presentador no encontrado' });
      return;
    }

    const presenterUser = userCheck.rows[0];

    await withTransaction(async (client) => {
      // 1. Desvincular de actividades preservando el nombre histórico del disertante
      await client.query(
        `UPDATE actividades
         SET disertante_usuario_id = NULL,
             disertante_nombre = COALESCE(NULLIF(disertante_nombre, ''), $2)
         WHERE disertante_usuario_id = $1`,
        [id, `${presenterUser.nombre} ${presenterUser.apellido}`.trim()]
      );

      // 2. Eliminar inscripciones a actividades si las tuviera
      await client.query(`DELETE FROM actividad_inscripciones WHERE usuario_id = $1`, [id]);

      // 3. Eliminar confirmaciones de asistencia si las tuviera
      await client.query(`DELETE FROM confirmaciones_asistencia WHERE usuario_id = $1`, [id]);

      // 4. Eliminar acreditaciones si las tuviera
      await client.query(`DELETE FROM acreditaciones WHERE usuario_id = $1`, [id]);

      // 5. Eliminar certificados si los tuviera
      await client.query(`DELETE FROM certificados WHERE usuario_id = $1`, [id]);

      // 6. Eliminar roles adicionales si los tuviera
      await client.query(`DELETE FROM usuario_roles_adicionales WHERE usuario_id = $1`, [id]);

      // 7. Eliminar homologaciones de expositor
      await client.query(`DELETE FROM homologaciones_expositores WHERE usuario_id = $1`, [id]);

      // 8. Eliminar usuario
      await client.query(`DELETE FROM usuarios WHERE id = $1`, [id]);

      // 9. Registrar auditoría
      await client.query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
         VALUES ('BAJA_PRESENTADOR_ADMIN', $1, $2, NOW())`,
        [req.operator?.email || 'ADMIN', JSON.stringify({ usuario_id: id, nombre: presenterUser.nombre, apellido: presenterUser.apellido })]
      );
    });

    res.json({ ok: true, mensaje: `Presentador "${presenterUser.nombre} ${presenterUser.apellido}" eliminado correctamente.` });
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/presentadores/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
