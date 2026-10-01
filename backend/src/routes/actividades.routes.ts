import { Router, Request, Response } from 'express';
import { query } from '../lib/db';
import { actividadSchema } from '../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../middlewares/authMiddleware';
import { generateAttendanceSheetPdf } from '../lib/attendanceSheetPdfService';

const router = Router();

/**
 * GET /api/actividades
 * Listado de todas las actividades con relaciones, salas y cupo
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawEventoId = req.query.evento_id as string | undefined;

    let targetEventoId = rawEventoId ? parseInt(rawEventoId, 10) : null;
    if (!targetEventoId || isNaN(targetEventoId)) {
      const evRes = await query(
        `SELECT id FROM eventos WHERE codigo = 'ETS_2026' OR activo = TRUE ORDER BY (codigo = 'ETS_2026') DESC, anio ASC LIMIT 1`
      );
      targetEventoId = evRes.rows[0]?.id || 1;
    }

    const sqlQuery = `
      SELECT 
        a.id,
        a.evento_id,
        e.nombre AS evento_nombre,
        TO_CHAR(e.fecha_inicio, 'YYYY-MM-DD') AS evento_fecha_inicio,
        TO_CHAR(e.fecha_fin, 'YYYY-MM-DD') AS evento_fecha_fin,
        a.nombre,
        a.descripcion,
        a.tipo_acreditacion_id,
        ta.codigo AS tipo_codigo,
        ta.descripcion AS tipo_descripcion,
        a.punto_acceso_id,
        pa.nombre AS punto_acceso_nombre,
        pa.ubicacion_fisica AS punto_acceso_ubicacion,
        pa.capacidad_maxima AS sala_capacidad_maxima,
        a.cupo_maximo,
        a.horario_inicio,
        a.horario_fin,
        a.disertante_nombre,
        a.disertante_usuario_id,
        u_dis.email AS disertante_email,
        a.activo,
        a.catalogo_actividad_id,
        ca.codigo AS catalogo_codigo,
        ca.nombre AS catalogo_nombre,
        ca.horas_catedra AS catalogo_horas,
        ct.nombre AS categoria_nombre,
        (
          SELECT COUNT(*)::int 
          FROM actividad_inscripciones ai 
          WHERE ai.actividad_id = a.id AND ai.estado = 'CONFIRMADO'
        ) AS reservas_confirmadas,
        (
          SELECT COUNT(*)::int 
          FROM acreditaciones ac 
          WHERE ac.actividad_id = a.id
        ) AS ocupacion_actual
      FROM actividades a
      INNER JOIN eventos e ON e.id = a.evento_id
      INNER JOIN tipos_acreditacion ta ON ta.id = a.tipo_acreditacion_id
      LEFT JOIN puntos_acceso pa ON pa.id = a.punto_acceso_id
      LEFT JOIN usuarios u_dis ON u_dis.id = a.disertante_usuario_id
      LEFT JOIN catalogo_actividades ca ON ca.id = a.catalogo_actividad_id
      LEFT JOIN categorias_tematicas ct ON ct.id = ca.categoria_tematica_id
      WHERE a.evento_id = $1 AND a.activo = TRUE
      ORDER BY a.horario_inicio ASC, a.nombre ASC
    `;

    const result = await query(sqlQuery, [targetEventoId]);

    // Formatear para facilitar consumo por SectionPrograma con soporte multidia
    const actividades = result.rows.map((row) => ({
      id: row.id,
      title: row.nombre,
      descripcion: row.descripcion || '',
      categoria: row.categoria_nombre || row.tipo_descripcion || 'General',
      expositor: row.disertante_nombre || '',
      sala: row.punto_acceso_nombre || '',
      ubicacion: row.punto_acceso_ubicacion || '',
      horario_inicio: row.horario_inicio,
      horario_fin: row.horario_fin,
      fecha_actividad: row.horario_inicio ? new Date(row.horario_inicio).toISOString().slice(0, 10) : '',
      hora_inicio: row.horario_inicio ? new Date(row.horario_inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '',
      hora_fin: row.horario_fin ? new Date(row.horario_fin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '',
      evento_nombre: row.evento_nombre,
      evento_fecha_inicio: row.evento_fecha_inicio,
      evento_fecha_fin: row.evento_fecha_fin,
      cupo_maximo: row.cupo_maximo,
      ocupacion_actual: row.ocupacion_actual,
      reservas_confirmadas: row.reservas_confirmadas,
      activo: row.activo,
    }));

    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    res.json({
      success: true,
      total: actividades.length,
      actividades,
    });
  } catch (error: any) {
    console.error('Error en GET /api/actividades:', error);
    res.status(500).json({ error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/actividades
 * Alta de nueva actividad (Requiere jerarquía >= 4)
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
    } = parsed.data;

    const salaCheck = await query(
      `SELECT capacidad_maxima, nombre FROM puntos_acceso WHERE id = $1`,
      [punto_acceso_id]
    );
    const capMaxSala = salaCheck.rows[0]?.capacidad_maxima || 5000;
    if (cupo_maximo > capMaxSala) {
      res.status(400).json({
        error: 'ERR_CAPACIDAD_EXCEDIDA',
        message: `El cupo solicitado (${cupo_maximo}) supera el aforo físico de la sala "${salaCheck.rows[0]?.nombre || 'Sala'}" (${capMaxSala} butacas).`,
      });
      return;
    }

    let finalDisertanteNombre = disertante_nombre ? disertante_nombre.trim() : null;
    if (disertante_usuario_id) {
      const uDis = await query(`SELECT nombre, apellido FROM usuarios WHERE id = $1`, [
        disertante_usuario_id,
      ]);
      if (uDis.rows.length > 0) {
        finalDisertanteNombre = `${uDis.rows[0].nombre} ${uDis.rows[0].apellido}`;
      }
    }

    const insertRes = await query(
      `INSERT INTO actividades (
        evento_id, nombre, descripcion, tipo_acreditacion_id, punto_acceso_id,
        cupo_maximo, horario_inicio, horario_fin, disertante_nombre,
        disertante_usuario_id, catalogo_actividad_id, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
      RETURNING id, evento_id, nombre`,
      [
        evento_id,
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        tipo_acreditacion_id,
        punto_acceso_id,
        cupo_maximo,
        horario_inicio,
        horario_fin,
        finalDisertanteNombre,
        disertante_usuario_id || null,
        catalogo_actividad_id || null,
      ]
    );

    res.status(201).json({
      success: true,
      actividad: insertRes.rows[0],
      mensaje: 'Actividad registrada exitosamente en la agenda del congreso.',
    });
  } catch (error: any) {
    console.error('Error en POST /api/actividades:', error);
    res.status(500).json({ error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/actividades/:id/planilla-pdf
 * Descarga la Planilla Oficial de Asistencia en Sala en formato PDF
 */
router.get('/:id/planilla-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const actividadId = parseInt(req.params.id, 10);
    if (isNaN(actividadId)) {
      res.status(400).json({ error: 'ERR_INVALID_ID', message: 'ID de actividad inválido.' });
      return;
    }

    const { pdfBuffer, filename } = await generateAttendanceSheetPdf(actividadId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(Buffer.from(pdfBuffer));
  } catch (error: any) {
    console.error('Error generando planilla de asistencia PDF:', error);
    res.status(500).json({ error: 'ERR_PDF_GENERATION', message: error.message });
  }
});

export default router;
