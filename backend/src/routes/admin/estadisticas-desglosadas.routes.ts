import { Router, Response } from 'express';
import { query } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

/**
 * GET /api/admin/estadisticas/desglosadas
 * Retorna estadísticas analíticas independientes para los 5 ejes:
 * 1. Eventos (Ediciones)
 * 2. Recintos (Salas y Aforos)
 * 3. Horarios (Cronograma y Franjas)
 * 4. Presentadores (Expositores y Ponencias)
 * 5. Alumnos / Asistentes (Participantes y Acreditación)
 */
router.get('/desglosadas', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rawEventoId = req.query.evento_id as string | undefined;
    let targetEventoId = rawEventoId ? parseInt(rawEventoId, 10) : null;
    if (!targetEventoId || isNaN(targetEventoId)) {
      const evRes = await query(
        `SELECT id FROM eventos WHERE codigo = 'ETS_2026' OR activo = TRUE ORDER BY (codigo = 'ETS_2026') DESC, anio ASC LIMIT 1`
      );
      targetEventoId = evRes.rows[0]?.id || 1;
    }

    const [
      eventosRes,
      recintosRes,
      horariosRes,
      presentadoresRes,
      asistentesRes,
    ] = await Promise.all([
      // 1. ESTADÍSTICAS DE EVENTOS
      query(`
        SELECT 
          e.id,
          e.codigo,
          e.nombre,
          e.anio,
          e.fecha_inicio,
          e.fecha_fin,
          e.cupo_maximo,
          e.lugar_nombre,
          e.estado,
          COUNT(u.id) as total_inscriptos,
          COUNT(u.id) FILTER (WHERE ei.codigo = 'CONFIRMADO') as confirmados,
          COUNT(u.id) FILTER (WHERE ei.codigo = 'LISTA_ESPERA') as lista_espera,
          COUNT(u.id) FILTER (WHERE ei.codigo = 'SANCIONADO') as sancionados,
          COUNT(u.id) FILTER (WHERE ei.codigo = 'CANCELADO') as cancelados,
          ROUND(
            (COUNT(u.id) FILTER (WHERE ei.codigo = 'CONFIRMADO')::numeric / NULLIF(e.cupo_maximo, 0)) * 100, 
            1
          ) as porcentaje_ocupacion
        FROM eventos e
        LEFT JOIN usuarios u ON u.evento_id = e.id
        LEFT JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
        WHERE e.id = $1
        GROUP BY e.id
      `, [targetEventoId]),

      // 2. ESTADÍSTICAS DE RECINTOS
      query(`
        SELECT 
          pa.id,
          pa.nombre,
          pa.ubicacion_fisica,
          pa.capacidad_maxima,
          pa.tipo_punto,
          COUNT(a.id) as total_actividades,
          COALESCE(
            ROUND(
              SUM(EXTRACT(EPOCH FROM (a.horario_fin - a.horario_inicio)) / 3600)::numeric, 
              1
            ), 0
          ) as horas_ocupadas,
          COALESCE(SUM(a.cupo_maximo), 0) as cupo_total_ofrecido,
          COUNT(acr.id) as total_scans_acceso
        FROM puntos_acceso pa
        LEFT JOIN actividades a ON a.punto_acceso_id = pa.id AND a.activo = TRUE AND a.evento_id = $1
        LEFT JOIN acreditaciones acr ON acr.punto_acceso_id = pa.id
        WHERE pa.activo = TRUE
        GROUP BY pa.id, pa.nombre, pa.ubicacion_fisica, pa.capacidad_maxima, pa.tipo_punto
        ORDER BY total_actividades DESC, pa.capacidad_maxima DESC
      `, [targetEventoId]),

      // 3. ESTADÍSTICAS DE HORARIOS
      query(`
        SELECT 
          COUNT(id) as total_actividades,
          COUNT(id) FILTER (
            WHERE EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') >= 8 
              AND EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') < 12
          ) as franja_manana,
          COUNT(id) FILTER (
            WHERE EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') >= 12 
              AND EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') < 14
          ) as franja_mediodia,
          COUNT(id) FILTER (
            WHERE EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') >= 14 
              AND EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') < 18
          ) as franja_tarde,
          COUNT(id) FILTER (
            WHERE EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') >= 18 
              AND EXTRACT(HOUR FROM horario_inicio AT TIME ZONE 'UTC') <= 22
          ) as franja_noche,
          COALESCE(
            ROUND(AVG(EXTRACT(EPOCH FROM (horario_fin - horario_inicio)) / 60)::numeric, 0),
            0
          ) as duracion_promedio_minutos
        FROM actividades
        WHERE activo = TRUE AND evento_id = $1
      `, [targetEventoId]),

      // 4. ESTADÍSTICAS DE PRESENTADORES
      query(`
        SELECT 
          COUNT(DISTINCT u.id) as total_presentadores_registrados,
          COUNT(DISTINCT a.disertante_nombre) as total_disertantes_en_agenda,
          COUNT(a.id) as total_ponencias_programadas,
          COALESCE(SUM(a.cupo_maximo), 0) as aforo_total_ponencias,
          COALESCE(ROUND(AVG(a.cupo_maximo)::numeric, 0), 0) as promedio_aforo_por_charla
        FROM actividades a
        LEFT JOIN usuarios u ON a.disertante_usuario_id = u.id
        WHERE a.activo = TRUE AND a.evento_id = $1
      `, [targetEventoId]),

      // 5. ESTADÍSTICAS DE ALUMNOS / ASISTENTES
      query(`
        SELECT 
          COUNT(u.id) as total_asistentes_evento,
          COUNT(u.id) FILTER (WHERE r.nombre = 'Estudiante') as estudiantes,
          COUNT(u.id) FILTER (WHERE r.nombre = 'Docente') as docentes,
          COUNT(u.id) FILTER (WHERE r.nombre NOT IN ('Estudiante', 'Docente', 'Administrador', 'Superadmin', 'Operador')) as otros_perfiles,
          (
            SELECT COUNT(DISTINCT a.usuario_id) 
            FROM acreditaciones a
            WHERE a.tipo_movimiento = 'INGRESO'
          ) as asistentes_acreditados_en_sala,
          (
            SELECT COUNT(*) 
            FROM certificados c
            WHERE c.evento_id = ev.id
          ) as certificados_emitidos,
          (
            SELECT COUNT(*) 
            FROM encuesta_respuestas er
            JOIN encuestas enc ON er.encuesta_id = enc.id
            WHERE enc.evento_id = ev.id
          ) as encuestas_respondidas
        FROM eventos ev
        LEFT JOIN usuarios u ON u.evento_id = ev.id
        LEFT JOIN roles r ON u.rol_principal_id = r.id
        WHERE ev.id = $1
        GROUP BY ev.id
      `, [targetEventoId]),
    ]);

    res.json({
      ok: true,
      evento_id: targetEventoId,
      timestamp: new Date().toISOString(),
      estadisticas: {
        eventos: eventosRes.rows[0] || null,
        recintos: recintosRes.rows,
        horarios: horariosRes.rows[0] || null,
        presentadores: presentadoresRes.rows[0] || null,
        asistentes: asistentesRes.rows[0] || null,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/estadisticas/desglosadas:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
