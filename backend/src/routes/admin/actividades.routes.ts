import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db';
import { actividadSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';
import { checkRecintoScheduleOverlap, checkDisertanteScheduleOverlap } from '../../lib/conflictEngine';

const router = Router();

const batchActividadesSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos una actividad'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

/**
 * GET /api/admin/actividades
 * Buscador de actividades con estadísticas de ocupación
 */
router.get('/', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const tipoAcreditacionId = req.query.tipo_acreditacion_id as string;
    const puntoAccesoId = req.query.punto_acceso_id as string;
    const activoParam = req.query.activo as string;
    const fechaParam = req.query.fecha as string;
    const eventoIdParam = req.query.evento_id as string;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(`(act.nombre ILIKE $${pIdx} OR act.disertante_nombre ILIKE $${pIdx})`);
      params.push(`%${q}%`);
      pIdx++;
    }

    if (eventoIdParam && eventoIdParam !== 'TODOS') {
      const evId = parseInt(eventoIdParam, 10);
      if (!isNaN(evId)) {
        conditions.push(`act.evento_id = $${pIdx++}`);
        params.push(evId);
      }
    }

    if (fechaParam && fechaParam !== 'TODAS' && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
      conditions.push(`(act.horario_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = $${pIdx++}::date`);
      params.push(fechaParam);
    }

    if (tipoAcreditacionId && tipoAcreditacionId !== 'TODOS') {
      const tId = parseInt(tipoAcreditacionId, 10);
      if (!isNaN(tId)) {
        conditions.push(`act.tipo_acreditacion_id = $${pIdx++}`);
        params.push(tId);
      }
    }

    if (puntoAccesoId && puntoAccesoId !== 'TODOS') {
      const paId = parseInt(puntoAccesoId, 10);
      if (!isNaN(paId)) {
        conditions.push(`act.punto_acceso_id = $${pIdx++}`);
        params.push(paId);
      }
    }

    if (activoParam !== undefined && activoParam !== 'TODOS') {
      conditions.push(`act.activo = $${pIdx++}`);
      params.push(activoParam === 'true');
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT act.id, act.nombre, act.descripcion, act.cupo_maximo,
             act.horario_inicio, act.horario_fin,
             TO_CHAR(act.horario_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as fecha_actividad,
             TO_CHAR(act.horario_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI') as hora_inicio,
             TO_CHAR(act.horario_fin AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI') as hora_fin,
             act.disertante_nombre,
             act.activo, act.evento_id, act.catalogo_actividad_id,
             ev.nombre as evento_nombre,
             TO_CHAR(ev.fecha_inicio, 'YYYY-MM-DD') as evento_fecha_inicio,
             TO_CHAR(ev.fecha_fin, 'YYYY-MM-DD') as evento_fecha_fin,
             ta.id as tipo_acreditacion_id, ta.descripcion as tipo_acreditacion_nombre, ta.codigo as tipo_acreditacion_codigo,
             pa.id as punto_acceso_id, pa.nombre as punto_acceso_nombre, pa.ubicacion_fisica,
             COALESCE(ca.codigo, '') as materia_codigo,
             (
               SELECT COUNT(a.id) 
               FROM acreditaciones a 
               WHERE a.actividad_id = act.id AND a.tipo_movimiento = 'INGRESO'
             ) as inscriptos_acreditados
      FROM actividades act
      LEFT JOIN eventos ev ON act.evento_id = ev.id
      JOIN tipos_acreditacion ta ON act.tipo_acreditacion_id = ta.id
      JOIN puntos_acceso pa ON act.punto_acceso_id = pa.id
      LEFT JOIN catalogo_actividades ca ON act.catalogo_actividad_id = ca.id
      WHERE ${whereClause}
      ORDER BY act.horario_inicio ASC, pa.nombre ASC, act.nombre ASC
    `;

    const result = await query(sql, params);

    res.json({
      ok: true,
      total: result.rowCount,
      actividades: result.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/actividades:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/actividades/verificar-disponibilidad
 * Permite chequear disponibilidad en tiempo real para un recinto y franja horaria.
 */
router.get('/verificar-disponibilidad', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const recintoId = parseInt(req.query.recinto_id as string, 10);
    const inicio = req.query.inicio as string;
    const fin = req.query.fin as string;
    const excludeId = req.query.exclude_id ? parseInt(req.query.exclude_id as string, 10) : undefined;

    if (!recintoId || isNaN(recintoId) || !inicio || !fin) {
      res.status(400).json({ ok: false, error: 'Parámetros recinto_id, inicio y fin requeridos' });
      return;
    }

    const conflict = await checkRecintoScheduleOverlap(recintoId, inicio, fin, excludeId);
    res.json({
      ok: true,
      disponible: !conflict.hasConflict,
      conflicto: conflict.conflictingActivity || null,
      message: conflict.message || 'Recinto y horario disponibles sin solapamientos.',
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'ERR_CHECK', message: error.message });
  }
});

/**
 * GET /api/admin/actividades/:id
 */
router.get('/:id', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const result = await query(
      `SELECT act.*, ta.descripcion as tipo_acreditacion_nombre, pa.nombre as punto_acceso_nombre,
              (SELECT COUNT(*) FROM acreditaciones a WHERE a.actividad_id = act.id AND a.tipo_movimiento = 'INGRESO') as acreditados_count
       FROM actividades act
       JOIN tipos_acreditacion ta ON act.tipo_acreditacion_id = ta.id
       JOIN puntos_acceso pa ON act.punto_acceso_id = pa.id
       WHERE act.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Actividad no encontrada' });
      return;
    }

    res.json({ ok: true, actividad: result.rows[0] });
  } catch (error: any) {
    console.error('Error en GET /api/admin/actividades/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/actividades
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = actividadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const {
      evento_id,
      nombre,
      descripcion,
      tipo_acreditacion_id,
      punto_acceso_id,
      cupo_maximo,
      horario_inicio,
      horario_fin,
      disertante_nombre,
      disertante_usuario_id,
      catalogo_actividad_id,
      activo,
    } = parsed.data;

    // Validación de Conflicto Espacio-Temporal en el Recinto
    const conflictRecinto = await checkRecintoScheduleOverlap(punto_acceso_id, horario_inicio, horario_fin);
    if (conflictRecinto.hasConflict) {
      res.status(409).json({
        ok: false,
        error: 'ERR_RECINTO_OCCUPIED',
        message: conflictRecinto.message || 'El recinto seleccionado ya se encuentra ocupado en ese horario.',
        conflicto: conflictRecinto.conflictingActivity,
      });
      return;
    }

    // Validación de Conflicto de Horario del Disertante / Expositor
    const conflictDisertante = await checkDisertanteScheduleOverlap(
      disertante_usuario_id,
      disertante_nombre,
      horario_inicio,
      horario_fin
    );
    if (conflictDisertante.hasConflict) {
      res.status(409).json({
        ok: false,
        error: 'ERR_DISERTANTE_OCCUPIED',
        message: conflictDisertante.message || 'El disertante / expositor seleccionado ya tiene una actividad en ese horario.',
        conflicto: conflictDisertante.conflictingActivity,
      });
      return;
    }

    const result = await query(
      `INSERT INTO actividades (
        evento_id, nombre, descripcion, tipo_acreditacion_id, punto_acceso_id,
        cupo_maximo, horario_inicio, horario_fin, disertante_nombre,
        disertante_usuario_id, catalogo_actividad_id, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        evento_id || 1,
        nombre,
        descripcion || null,
        tipo_acreditacion_id,
        punto_acceso_id,
        cupo_maximo,
        horario_inicio,
        horario_fin,
        disertante_nombre || null,
        disertante_usuario_id || null,
        catalogo_actividad_id || null,
        activo !== undefined ? activo : true,
      ]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('ALTA_ACTIVIDAD_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ actividad: result.rows[0] })]
    );

    res.status(201).json({ ok: true, actividad: result.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /api/admin/actividades:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/actividades/:id
 */
router.put('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const {
      nombre,
      descripcion,
      tipo_acreditacion_id,
      punto_acceso_id,
      cupo_maximo,
      horario_inicio,
      horario_fin,
      disertante_nombre,
      disertante_usuario_id,
      catalogo_actividad_id,
      activo,
    } = req.body;

    const currentRes = await query(
      `SELECT punto_acceso_id, horario_inicio, horario_fin, disertante_usuario_id, disertante_nombre FROM actividades WHERE id = $1`,
      [id]
    );
    if (currentRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Actividad no encontrada' });
      return;
    }
    const currentAct = currentRes.rows[0];
    const targetRecintoId = punto_acceso_id !== undefined ? punto_acceso_id : currentAct.punto_acceso_id;
    const targetInicio = horario_inicio !== undefined ? horario_inicio : currentAct.horario_inicio;
    const targetFin = horario_fin !== undefined ? horario_fin : currentAct.horario_fin;
    const targetDisertanteId = disertante_usuario_id !== undefined ? disertante_usuario_id : currentAct.disertante_usuario_id;
    const targetDisertanteNombre = disertante_nombre !== undefined ? disertante_nombre : currentAct.disertante_nombre;

    if (punto_acceso_id !== undefined || horario_inicio !== undefined || horario_fin !== undefined) {
      const conflictRecinto = await checkRecintoScheduleOverlap(targetRecintoId, targetInicio, targetFin, id);
      if (conflictRecinto.hasConflict) {
        const isRecintoChange = punto_acceso_id !== undefined && punto_acceso_id !== currentAct.punto_acceso_id;
        res.status(409).json({
          ok: false,
          error: isRecintoChange ? 'ERR_RECINTO_DESTINO_OCCUPIED' : 'ERR_RECINTO_OCCUPIED',
          message: conflictRecinto.message || 'El recinto ya se encuentra ocupado en ese horario.',
          conflicto: conflictRecinto.conflictingActivity,
        });
        return;
      }
    }

    if (disertante_usuario_id !== undefined || disertante_nombre !== undefined || horario_inicio !== undefined || horario_fin !== undefined) {
      const conflictDisertante = await checkDisertanteScheduleOverlap(
        targetDisertanteId,
        targetDisertanteNombre,
        targetInicio,
        targetFin,
        id
      );
      if (conflictDisertante.hasConflict) {
        res.status(409).json({
          ok: false,
          error: 'ERR_DISERTANTE_OCCUPIED',
          message: conflictDisertante.message || 'El disertante ya tiene asignada otra actividad en ese horario.',
          conflicto: conflictDisertante.conflictingActivity,
        });
        return;
      }
    }

    const result = await query(
      `UPDATE actividades
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           tipo_acreditacion_id = COALESCE($3, tipo_acreditacion_id),
           punto_acceso_id = COALESCE($4, punto_acceso_id),
           cupo_maximo = COALESCE($5, cupo_maximo),
           horario_inicio = COALESCE($6, horario_inicio),
           horario_fin = COALESCE($7, horario_fin),
           disertante_nombre = COALESCE($8, disertante_nombre),
           disertante_usuario_id = COALESCE($9::uuid, disertante_usuario_id),
           catalogo_actividad_id = COALESCE($10::int, catalogo_actividad_id),
           activo = COALESCE($11::boolean, activo),
           actualizado_en = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        nombre,
        descripcion,
        tipo_acreditacion_id,
        punto_acceso_id,
        cupo_maximo,
        horario_inicio,
        horario_fin,
        disertante_nombre,
        disertante_usuario_id,
        catalogo_actividad_id,
        activo,
        id,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Actividad no encontrada' });
      return;
    }

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('EDICION_ACTIVIDAD_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ id, cambios: req.body })]
    );

    res.json({ ok: true, actividad: result.rows[0] });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/actividades/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/actividades/:id
 */
router.delete('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    // Comprobar si tiene acreditaciones o inscripciones de reservas asociadas
    const checkHistory = await query(
      `SELECT 
        (SELECT COUNT(*) FROM acreditaciones WHERE actividad_id = $1) as acreditaciones_count,
        (SELECT COUNT(*) FROM actividad_inscripciones WHERE actividad_id = $1) as inscripciones_count`,
      [id]
    );
    const hasHistory = 
      parseInt(checkHistory.rows[0].acreditaciones_count, 10) > 0 || 
      parseInt(checkHistory.rows[0].inscripciones_count, 10) > 0;

    if (hasHistory) {
      // Desactivar lógicamente para preservar integridad histórica (Soft Delete)
      await query(`UPDATE actividades SET activo = FALSE, actualizado_en = NOW() WHERE id = $1`, [id]);
      res.json({
        ok: true,
        mensaje: 'La actividad tiene reservas o acreditaciones históricas registradas; fue desactivada lógicamente (Soft Delete).',
      });
    } else {
      await query(`DELETE FROM actividades WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'Actividad eliminada exitosamente del sistema.' });
    }

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('BAJA_ACTIVIDAD_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ id, softDelete: hasHistory })]
    );
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/actividades/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/actividades/batch
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchActividadesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids, action } = parsed.data;

    if (action === 'activate') {
      const resUpd = await query(`UPDATE actividades SET activo = TRUE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} actividades activadas exitosamente.` });
    } else if (action === 'deactivate') {
      const resUpd = await query(`UPDATE actividades SET activo = FALSE, actualizado_en = NOW() WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
      res.json({ ok: true, processed: resUpd.rowCount, message: `${resUpd.rowCount} actividades desactivadas exitosamente.` });
    } else if (action === 'delete') {
      // Eliminar solo las que no tengan acreditaciones ni inscripciones históricas
      const resDel = await query(
        `DELETE FROM actividades 
         WHERE id = ANY($1::int[]) 
           AND NOT EXISTS (SELECT 1 FROM acreditaciones WHERE actividad_id = actividades.id)
           AND NOT EXISTS (SELECT 1 FROM actividad_inscripciones WHERE actividad_id = actividades.id)
         RETURNING id`,
        [ids]
      );
      // Las demás desactivarlas con Soft Delete
      const resSoft = await query(
        `UPDATE actividades SET activo = FALSE, actualizado_en = NOW()
         WHERE id = ANY($1::int[]) 
           AND (
             EXISTS (SELECT 1 FROM acreditaciones WHERE actividad_id = actividades.id)
             OR EXISTS (SELECT 1 FROM actividad_inscripciones WHERE actividad_id = actividades.id)
           )
         RETURNING id`,
        [ids]
      );
      res.json({ 
        ok: true, 
        processed: (resDel.rowCount || 0) + (resSoft.rowCount || 0), 
        message: `${resDel.rowCount || 0} actividades eliminadas físicamente y ${resSoft.rowCount || 0} desactivadas con protección histórica (Soft Delete).` 
      });
    }
  } catch (error: any) {
    console.error('Error en POST /api/admin/actividades/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});
/**
 * PATCH /api/admin/actividades/:id/desplazar-horario
 * POLÍTICA A: Los horarios de los eventos pueden desplazarse en el tiempo
 * siempre que el horario no se solape con otro evento en el mismo recinto.
 */
router.patch('/:id/desplazar-horario', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const { delta_minutos, nuevo_horario_inicio, nuevo_horario_fin } = req.body;

    const currentRes = await query(
      `SELECT a.id, a.nombre, a.horario_inicio, a.horario_fin, a.punto_acceso_id, a.disertante_usuario_id, a.disertante_nombre, pa.nombre as recinto_nombre
       FROM actividades a
       JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
       WHERE a.id = $1`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Actividad no encontrada' });
      return;
    }

    const act = currentRes.rows[0];
    let finalInicio: Date;
    let finalFin: Date;

    if (delta_minutos !== undefined) {
      const delta = parseInt(delta_minutos, 10);
      if (isNaN(delta)) {
        res.status(400).json({ ok: false, error: 'delta_minutos debe ser un número entero' });
        return;
      }
      finalInicio = new Date(new Date(act.horario_inicio).getTime() + delta * 60000);
      finalFin = new Date(new Date(act.horario_fin).getTime() + delta * 60000);
    } else if (nuevo_horario_inicio && nuevo_horario_fin) {
      finalInicio = new Date(nuevo_horario_inicio);
      finalFin = new Date(nuevo_horario_fin);
    } else {
      res.status(400).json({
        ok: false,
        error: 'Debe especificar delta_minutos o el par nuevo_horario_inicio y nuevo_horario_fin',
      });
      return;
    }

    // Validación Política A: verificar no solapamiento en el mismo recinto
    const conflictRecinto = await checkRecintoScheduleOverlap(act.punto_acceso_id, finalInicio, finalFin, id);
    if (conflictRecinto.hasConflict) {
      res.status(409).json({
        ok: false,
        error: 'ERR_RECINTO_OCCUPIED',
        message: `Conflicto de horario en el recinto: ${conflictRecinto.message}`,
        conflicto: conflictRecinto.conflictingActivity,
      });
      return;
    }

    // Validación de conflicto para el disertante en el nuevo horario
    const conflictDisertante = await checkDisertanteScheduleOverlap(
      act.disertante_usuario_id,
      act.disertante_nombre,
      finalInicio,
      finalFin,
      id
    );
    if (conflictDisertante.hasConflict) {
      res.status(409).json({
        ok: false,
        error: 'ERR_DISERTANTE_OCCUPIED',
        message: `Conflicto de horario del disertante: ${conflictDisertante.message}`,
        conflicto: conflictDisertante.conflictingActivity,
      });
      return;
    }

    const result = await query(
      `UPDATE actividades
       SET horario_inicio = $1,
           horario_fin = $2,
           actualizado_en = NOW()
       WHERE id = $3
       RETURNING *`,
      [finalInicio.toISOString(), finalFin.toISOString(), id]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('DESPLAZAMIENTO_HORARIO_ACTIVIDAD', $1, $2, NOW())`,
      [
        req.operator?.email || 'ADMIN',
        JSON.stringify({
          actividad_id: id,
          actividad_nombre: act.nombre,
          recinto_id: act.punto_acceso_id,
          recinto_nombre: act.recinto_nombre,
          horario_anterior: { inicio: act.horario_inicio, fin: act.horario_fin },
          horario_nuevo: { inicio: finalInicio.toISOString(), fin: finalFin.toISOString() },
        }),
      ]
    );

    res.json({
      ok: true,
      mensaje: `Horario desplazado exitosamente a las ${finalInicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${finalFin.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      actividad: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error en PATCH /api/admin/actividades/:id/desplazar-horario:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PATCH /api/admin/actividades/:id/cambiar-recinto
 * POLÍTICA B: El editor de eventos debe permitir cambiar el recinto de un evento a otro
 * siempre que NO se superponga con otro evento en horario y recinto.
 */
router.patch('/:id/cambiar-recinto', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ ok: false, error: 'ID inválido' });
      return;
    }

    const nuevoRecintoId = parseInt(req.body.nuevo_punto_acceso_id || req.body.nuevo_recinto_id, 10);
    if (!nuevoRecintoId || isNaN(nuevoRecintoId)) {
      res.status(400).json({ ok: false, error: 'nuevo_punto_acceso_id inválido o no provisto' });
      return;
    }

    const currentRes = await query(
      `SELECT a.id, a.nombre, a.horario_inicio, a.horario_fin, a.punto_acceso_id, pa.nombre as recinto_origen
       FROM actividades a
       JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
       WHERE a.id = $1`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Actividad no encontrada' });
      return;
    }

    const act = currentRes.rows[0];

    // Verificar que el nuevo recinto exista y esté activo
    const targetRecintoRes = await query(
      `SELECT id, nombre, activo, capacidad_maxima FROM puntos_acceso WHERE id = $1`,
      [nuevoRecintoId]
    );
    if (targetRecintoRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'El recinto de destino especificado no existe' });
      return;
    }
    const targetRecinto = targetRecintoRes.rows[0];
    if (!targetRecinto.activo) {
      res.status(400).json({ ok: false, error: 'El recinto de destino se encuentra inactivo' });
      return;
    }

    // Validación Política B: Verificar ausencia de colisión en el recinto de destino para la franja actual
    const conflict = await checkRecintoScheduleOverlap(nuevoRecintoId, act.horario_inicio, act.horario_fin, id);
    if (conflict.hasConflict) {
      res.status(409).json({
        ok: false,
        error: 'ERR_RECINTO_DESTINO_OCCUPIED',
        message: `No se puede cambiar al recinto '${targetRecinto.nombre}': ${conflict.message}`,
        conflicto: conflict.conflictingActivity,
      });
      return;
    }

    const result = await query(
      `UPDATE actividades
       SET punto_acceso_id = $1,
           actualizado_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [nuevoRecintoId, id]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('CAMBIO_RECINTO_ACTIVIDAD', $1, $2, NOW())`,
      [
        req.operator?.email || 'ADMIN',
        JSON.stringify({
          actividad_id: id,
          actividad_nombre: act.nombre,
          recinto_anterior: { id: act.punto_acceso_id, nombre: act.recinto_origen },
          recinto_nuevo: { id: targetRecinto.id, nombre: targetRecinto.nombre },
          horario: { inicio: act.horario_inicio, fin: act.horario_fin },
        }),
      ]
    );

    res.json({
      ok: true,
      mensaje: `Recinto reasignado exitosamente a '${targetRecinto.nombre}' sin conflictos.`,
      actividad: result.rows[0],
      recinto_nuevo: targetRecinto,
    });
  } catch (error: any) {
    console.error('Error en PATCH /api/admin/actividades/:id/cambiar-recinto:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
