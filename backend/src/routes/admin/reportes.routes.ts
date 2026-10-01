import { Router, Response } from 'express';
import archiver from 'archiver';
import { query } from '../../lib/db';
import { generateCertificatePdf } from '../../lib/certificatePdfService';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

/**
 * Escapa un campo de texto para cumplir con RFC 4180 de CSV
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * GET /api/admin/reportes/padron.csv
 * Padrón general de inscriptos con estado de vacante, rol institucional y acreditación
 */
router.get('/padron.csv', requireHierarchy(2), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rawEventoId = req.query.evento_id as string | undefined;
    const targetEventoId = rawEventoId ? parseInt(rawEventoId, 10) : null;

    let sql = `
      SELECT 
        u.id, 
        u.dni_pasaporte, 
        u.nombre, 
        u.apellido, 
        u.email, 
        COALESCE(u.celular, '') as celular,
        r.nombre AS rol, 
        ei.codigo AS estado_inscripcion,
        TO_CHAR(u.creado_en, 'YYYY-MM-DD HH24:MI:SS') AS fecha_registro,
        CASE WHEN EXISTS (SELECT 1 FROM acreditaciones a WHERE a.usuario_id = u.id) THEN 'SI' ELSE 'NO' END AS acreditado,
        COALESCE(c.codigo_verificacion, '') AS certificado_codigo
      FROM usuarios u
      JOIN roles r ON u.rol_principal_id = r.id
      JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
      LEFT JOIN certificados c ON c.usuario_id = u.id AND c.tipo_certificado = 'ASISTENCIA'
    `;
    const params: any[] = [];
    if (targetEventoId && !isNaN(targetEventoId)) {
      sql += ` WHERE u.evento_id = $1`;
      params.push(targetEventoId);
    }
    sql += ` ORDER BY u.id ASC`;

    const result = await query(sql, params);

    // Encabezados CSV con UTF-8 BOM
    const headers = [
      'ID',
      'DNI / Pasaporte',
      'Nombre',
      'Apellido',
      'Email',
      'Celular',
      'Rol Institucional',
      'Estado Vacante',
      'Fecha Registro',
      'Acreditado en Sede',
      'Código Certificado',
    ];

    let csvContent = '\uFEFF' + headers.map(escapeCsv).join(',') + '\r\n';

    for (const row of result.rows) {
      const line = [
        row.id,
        row.dni_pasaporte,
        row.nombre,
        row.apellido,
        row.email,
        row.celular,
        row.rol,
        row.estado_inscripcion,
        row.fecha_registro,
        row.acreditado,
        row.certificado_codigo,
      ];
      csvContent += line.map(escapeCsv).join(',') + '\r\n';
    }

    const filename = `padron_congreso_ets2026_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error al exportar padrón CSV:', error);
    res.status(500).json({ error: 'ERR_EXPORT_PADRON', message: error.message });
  }
});

/**
 * GET /api/admin/reportes/actividades/:id/firmas.csv
 * Planilla oficial de asistencia y firmas para acreditación en sala / taller
 */
router.get('/actividades/:id/firmas.csv', requireHierarchy(2), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const actividadId = parseInt(req.params.id, 10);
    if (isNaN(actividadId)) {
      res.status(400).json({ error: 'ID de actividad inválido' });
      return;
    }

    const actRes = await query(
      `SELECT a.id, a.nombre, a.cupo_maximo, pa.nombre as ubicacion_sala, 
              TO_CHAR(a.horario_inicio, 'YYYY-MM-DD HH24:MI') as fecha_inicio,
              TO_CHAR(a.horario_fin, 'HH24:MI') as hora_fin,
              ca.codigo as materia_codigo, ca.nombre as materia_nombre
       FROM actividades a
       LEFT JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
       LEFT JOIN catalogo_actividades ca ON a.catalogo_actividad_id = ca.id
       WHERE a.id = $1`,
      [actividadId]
    );

    if (actRes.rows.length === 0) {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const act = actRes.rows[0];

    // Participantes acreditados o asignados a la actividad
    const usersRes = await query(
      `SELECT DISTINCT
         u.id, u.dni_pasaporte, u.apellido, u.nombre, u.email, r.nombre as rol,
         TO_CHAR(ac.timestamp_acreditacion, 'YYYY-MM-DD HH24:MI') as acreditado_en
       FROM usuarios u
       JOIN roles r ON u.rol_principal_id = r.id
       LEFT JOIN acreditaciones ac ON ac.usuario_id = u.id AND ac.actividad_id = $1
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       WHERE (ac.id IS NOT NULL OR ei.codigo = 'CONFIRMADO')
       ORDER BY u.apellido ASC, u.nombre ASC`,
      [actividadId]
    );

    let csvContent = '\uFEFF';
    csvContent += escapeCsv(`PLANILLA DE FIRMAS Y ASISTENCIA - CONGRESO ETS 2026`) + '\r\n';
    csvContent += escapeCsv(`Actividad: ${act.nombre} (${act.materia_codigo || 'GRAL'})`) + '\r\n';
    csvContent += escapeCsv(`Horario: ${act.fecha_inicio} a ${act.hora_fin} hs | Sala: ${act.ubicacion_sala || 'Auditorio'} | Cupo: ${act.cupo_maximo}`) + '\r\n';
    csvContent += '\r\n';

    const headers = ['Nro', 'DNI / Pasaporte', 'Apellido y Nombre', 'Rol Institucional', 'Email', 'Ingreso en Sala', 'Firma / Conformidad'];
    csvContent += headers.map(escapeCsv).join(',') + '\r\n';

    let index = 1;
    for (const u of usersRes.rows) {
      const line = [
        index++,
        u.dni_pasaporte,
        `${u.apellido}, ${u.nombre}`,
        u.rol,
        u.email,
        u.acreditado_en || 'Pendiente',
        '', // Espacio para firma física
      ];
      csvContent += line.map(escapeCsv).join(',') + '\r\n';
    }

    const cleanName = act.nombre.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const filename = `firmas_actividad_${actividadId}_${cleanName}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error al exportar firmas CSV:', error);
    res.status(500).json({ error: 'ERR_EXPORT_FIRMAS', message: error.message });
  }
});

/**
 * GET /api/admin/reportes/accesos.csv
 * Registro completo de movimientos de molinetes y puntos de acceso
 */
router.get('/accesos.csv', requireHierarchy(2), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT 
        a.id, 
        TO_CHAR(a.timestamp_acreditacion, 'YYYY-MM-DD HH24:MI:SS') AS timestamp,
        pa.nombre AS punto_acceso, 
        a.tipo_movimiento,
        u.dni_pasaporte, 
        u.nombre, 
        u.apellido, 
        r.nombre AS rol,
        COALESCE(op.nombre || ' ' || op.apellido, 'Sistema Autónomo') AS operador
      FROM acreditaciones a
      JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN roles r ON u.rol_principal_id = r.id
      LEFT JOIN operadores op ON a.operador_id = op.id
      ORDER BY a.timestamp_acreditacion DESC
    `);

    const headers = [
      'ID Movimiento',
      'Fecha y Hora',
      'Punto de Acceso',
      'Tipo Movimiento',
      'DNI / Pasaporte',
      'Nombre',
      'Apellido',
      'Rol Institucional',
      'Operador Responsable',
    ];

    let csvContent = '\uFEFF' + headers.map(escapeCsv).join(',') + '\r\n';

    for (const row of result.rows) {
      const line = [
        row.id,
        row.timestamp,
        row.punto_acceso,
        row.tipo_movimiento,
        row.dni_pasaporte,
        row.nombre,
        row.apellido,
        row.rol,
        row.operador,
      ];
      csvContent += line.map(escapeCsv).join(',') + '\r\n';
    }

    const filename = `accesos_molinetes_ets2026_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error al exportar accesos CSV:', error);
    res.status(500).json({ error: 'ERR_EXPORT_ACCESOS', message: error.message });
  }
});

/**
 * GET /api/admin/reportes/certificados.zip
 * Descarga masiva en streaming ZIP con todos los diplomas PDF emitidos
 */
router.get('/certificados.zip', requireHierarchy(3), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const certsRes = await query(`
      SELECT c.id, c.codigo_verificacion, c.tipo_certificado, c.horas_catedra, c.emitido_en, c.metadata,
             u.nombre, u.apellido, u.dni_pasaporte, r.nombre as rol_nombre
      FROM certificados c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN roles r ON u.rol_principal_id = r.id
      ORDER BY u.apellido ASC, u.nombre ASC
    `);

    if (certsRes.rows.length === 0) {
      res.status(404).json({ error: 'No existen certificados emitidos para descargar.' });
      return;
    }

    const zipFilename = `diplomas_oficiales_ets2026_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', {
      zlib: { level: 6 }, // Nivel de compresión balanceado
    });

    archive.on('error', (err: any) => {
      console.error('Error en streaming ZIP:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: 'ERR_ZIP_STREAMING', message: err.message });
      }
    });

    // Enviar el stream directo a la respuesta HTTP
    archive.pipe(res);

    for (const cert of certsRes.rows) {
      try {
        const pdfBytes = await generateCertificatePdf({
          codigo_verificacion: cert.codigo_verificacion,
          tipo_certificado: cert.tipo_certificado,
          horas_catedra: cert.horas_catedra,
          emitido_en: cert.emitido_en,
          usuario: {
            nombre: cert.nombre,
            apellido: cert.apellido,
            dni_pasaporte: cert.dni_pasaporte,
            rol_nombre: cert.rol_nombre,
          },
          metadata: cert.metadata,
        });

        const safeLastName = cert.apellido.replace(/[^a-zA-Z0-9]/g, '_');
        const safeFirstName = cert.nombre.replace(/[^a-zA-Z0-9]/g, '_');
        const entryName = `Certificado_${cert.dni_pasaporte}_${safeLastName}_${safeFirstName}_${cert.codigo_verificacion}.pdf`;

        archive.append(Buffer.from(pdfBytes), { name: entryName });
      } catch (pdfErr) {
        console.error(`Error generando PDF para certificado ${cert.codigo_verificacion}:`, pdfErr);
      }
    }

    await archive.finalize();
  } catch (error: any) {
    console.error('Error al generar archivo ZIP masivo:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'ERR_GENERATE_ZIP', message: error.message });
    }
  }
});

export default router;
