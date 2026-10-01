import { Router, Request, Response } from 'express';
import { query } from '../lib/db';

const router = Router();

/**
 * GET /api/vacantes/evento-activo
 * Retorna los datos básicos, fecha y ubicación del evento activo para portadas públicas
 */
router.get('/evento-activo', async (req: Request, res: Response): Promise<void> => {
  try {
    const previewId = req.query.preview_id as string | undefined;

    let sql = `
      SELECT id, codigo, nombre, anio, fecha_inicio, fecha_fin, 
              sede_nombre, sede_direccion, sede_mapa_url
       FROM eventos 
       WHERE codigo = 'ETS_2026' OR activo = TRUE 
       ORDER BY (codigo = 'ETS_2026') DESC, anio ASC 
       LIMIT 1
    `;
    let params: any[] = [];

    if (previewId) {
      sql = `
        SELECT id, codigo, nombre, anio, fecha_inicio, fecha_fin, 
              sede_nombre, sede_direccion, sede_mapa_url
        FROM eventos 
        WHERE id = $1
      `;
      params = [parseInt(previewId, 10)];
    }

    const evRes = await query(sql, params);
    if (evRes.rows.length > 0) {
      res.json({ ok: true, evento: evRes.rows[0] });
    } else {
      res.status(404).json({ ok: false, error: 'No hay eventos activos' });
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/vacantes
 * Consulta pública de métricas de ocupación, cupo global y aforo
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawEventoId = req.query.evento_id as string | undefined;
    const rawActividadId = req.query.actividad_id as string | undefined;
    let targetEventoId = rawEventoId ? parseInt(rawEventoId, 10) : null;
    if (!targetEventoId || isNaN(targetEventoId)) {
      const evRes = await query(
        `SELECT id FROM eventos WHERE codigo = 'ETS_2026' OR activo = TRUE ORDER BY (codigo = 'ETS_2026') DESC, anio ASC LIMIT 1`
      );
      targetEventoId = evRes.rows[0]?.id || 1;
    }

    const targetActividadId =
      rawActividadId && rawActividadId !== 'TODOS' ? parseInt(rawActividadId, 10) : null;

    const evCupoRes = await query(
      `SELECT id, codigo, nombre, COALESCE(cupo_maximo, 400) AS cupo_maximo FROM eventos WHERE id = $1`,
      [targetEventoId]
    );
    const evento = evCupoRes.rows[0] || { cupo_maximo: 400, nombre: 'Congreso ETS 2026' };
    const cupoMaximoEvento = Number(evento.cupo_maximo) || 400;

    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE ei.codigo = 'CONFIRMADO') AS confirmados,
        COUNT(*) FILTER (WHERE ei.codigo = 'LISTA_ESPERA') AS lista_espera,
        COUNT(*) FILTER (WHERE ei.codigo = 'SANCIONADO') AS sancionados,
        COUNT(*) FILTER (WHERE ei.codigo = 'BAJA_AUTOMATICA') AS bajas_automaticas,
        COUNT(*) FILTER (WHERE ei.codigo = 'CANCELADO') AS cancelados
      FROM usuarios u
      JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
      WHERE u.evento_id = $1
    `;
    const resStats = await query(statsQuery, [targetEventoId]);
    const row = resStats.rows[0] || {};
    const confirmadosEvento = parseInt(row.confirmados || '0', 10);
    const listaEspera = parseInt(row.lista_espera || '0', 10);
    const sancionados = parseInt(row.sancionados || '0', 10);
    const bajasAutomaticas = parseInt(row.bajas_automaticas || '0', 10);
    const cancelados = parseInt(row.cancelados || '0', 10);

    // Caso por actividad
    if (targetActividadId && !isNaN(targetActividadId)) {
      const actRes = await query(
        `SELECT a.id, a.nombre, a.cupo_maximo, a.disertante_nombre, a.horario_inicio, a.horario_fin,
                p.id AS punto_acceso_id, p.nombre AS punto_acceso_nombre, p.ubicacion_fisica, p.capacidad_maxima AS sala_capacidad
         FROM actividades a
         LEFT JOIN puntos_acceso p ON a.punto_acceso_id = p.id
         WHERE a.id = $1`,
        [targetActividadId]
      );

      if (actRes.rows.length > 0) {
        const act = actRes.rows[0];
        const cupoActividad = Number(act.cupo_maximo) || 50;

        const resInscAct = await query(
          `SELECT 
             COUNT(DISTINCT ai.usuario_id)::int AS reservas_confirmadas,
             (SELECT COUNT(DISTINCT ac.usuario_id)::int FROM acreditaciones ac WHERE ac.actividad_id = $1) AS acreditados_presentes
           FROM actividad_inscripciones ai
           WHERE ai.actividad_id = $1 AND ai.estado = 'CONFIRMADO'`,
          [targetActividadId]
        );
        const reservasConfirmadas = parseInt(resInscAct.rows[0]?.reservas_confirmadas || '0', 10);
        const acreditadosAct = parseInt(resInscAct.rows[0]?.acreditados_presentes || '0', 10);
        const ocupadosTotales = Math.max(reservasConfirmadas, acreditadosAct);

        res.json({
          tipo_filtro: 'ACTIVIDAD',
          evento_id: targetEventoId,
          evento_nombre: evento.nombre,
          actividad_id: act.id,
          actividad_nombre: act.nombre,
          disertante_nombre: act.disertante_nombre,
          punto_acceso_id: act.punto_acceso_id,
          punto_acceso_nombre: act.punto_acceso_nombre,
          ubicacion_fisica: act.ubicacion_fisica,
          cupo_maximo: cupoActividad,
          confirmados: ocupadosTotales,
          reservas_confirmadas: reservasConfirmadas,
          cupos_disponibles: Math.max(0, cupoActividad - ocupadosTotales),
          lista_espera: listaEspera,
          acreditados_presentes: acreditadosAct,
          porcentaje_asistencia: cupoActividad > 0 ? Math.round((ocupadosTotales / cupoActividad) * 100) : 0,
        });
        return;
      }
    }

    // Caso global del evento
    const resAcreditados = await query(
      `SELECT COUNT(DISTINCT a.usuario_id)::int AS acreditados 
       FROM (
         SELECT usuario_id, tipo_movimiento,
                ROW_NUMBER() OVER(PARTITION BY usuario_id ORDER BY timestamp_acreditacion DESC) as rn
         FROM acreditaciones
       ) a
       JOIN usuarios u ON a.usuario_id = u.id
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       WHERE a.rn = 1 AND a.tipo_movimiento = 'INGRESO' AND u.evento_id = $1 AND ei.codigo = 'CONFIRMADO'`,
      [targetEventoId]
    );
    const totalAcreditados = parseInt(resAcreditados.rows[0]?.acreditados || '0', 10);
    const porcentajeAsistencia =
      confirmadosEvento > 0
        ? Math.min(100, Math.round((totalAcreditados / confirmadosEvento) * 100))
        : 0;

    res.json({
      tipo_filtro: 'EVENTO',
      evento_id: targetEventoId,
      evento_nombre: evento.nombre,
      cupo_maximo: cupoMaximoEvento,
      confirmados: confirmadosEvento,
      cupos_disponibles: Math.max(0, cupoMaximoEvento - confirmadosEvento),
      lista_espera: listaEspera,
      sancionados,
      acreditados_presentes: totalAcreditados,
      bajas_automaticas: bajasAutomaticas,
      cancelados,
      porcentaje_asistencia: porcentajeAsistencia,
    });
  } catch (error: any) {
    console.error('Error en GET /api/vacantes:', error);
    res.status(500).json({ error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
