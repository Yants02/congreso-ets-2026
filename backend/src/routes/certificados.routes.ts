import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../lib/db';
import { generateCertificatePdf } from '../lib/certificatePdfService';
import { dniSchema, certificadoEmisionSchema } from '../lib/schemas';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

/**
 * GET /api/certificados/validar/:codigo
 * Validador público de autenticidad de diplomas con sello de fe pública
 */
router.get('/validar/:codigo', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawCodigo = req.params.codigo?.trim().toUpperCase();

    if (!rawCodigo || rawCodigo.length < 5) {
      res.status(400).json({ valido: false, message: 'Código de certificado inválido o malformado.' });
      return;
    }

    const sql = `
      SELECT c.id, c.codigo_verificacion, c.tipo_certificado, c.horas_catedra, c.emitido_en, c.metadata,
             u.nombre, u.apellido, u.dni_pasaporte, r.nombre AS rol_nombre,
             ev.id AS evento_id, ev.nombre AS evento_nombre, ev.anio AS evento_anio,
             TO_CHAR(ev.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
             TO_CHAR(ev.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
             (
               SELECT a.timestamp_acreditacion 
               FROM acreditaciones a 
               WHERE a.usuario_id = u.id 
               ORDER BY a.timestamp_acreditacion ASC 
               LIMIT 1
             ) AS fecha_acreditacion
      FROM certificados c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN roles r ON u.rol_principal_id = r.id
      LEFT JOIN eventos ev ON COALESCE(c.evento_id, u.evento_id) = ev.id
      WHERE UPPER(c.codigo_verificacion) = $1
    `;

    const result = await query(sql, [rawCodigo]);

    if (result.rowCount === 0) {
      res.status(404).json({
        valido: false,
        codigo_consultado: rawCodigo,
        message: 'El código de verificación no corresponde a ningún certificado emitido por el sistema oficial.',
      });
      return;
    }

    const cert = result.rows[0];
    const dni = cert.dni_pasaporte || '';
    const maskedDni =
      dni.length > 4
        ? `${dni.slice(0, 2)}.${'*'.repeat(Math.max(1, dni.length - 5))}.${dni.slice(-3)}`
        : dni;

    res.json({
      valido: true,
      estado: 'AUTÉNTICO Y REGISTRADO',
      estado_autenticidad: 'AUTÉNTICO Y REGISTRADO',
      codigo_verificacion: cert.codigo_verificacion,
      tipo_certificado: cert.tipo_certificado,
      horas_catedra: cert.horas_catedra,
      emitido_en: cert.emitido_en,
      titular: {
        nombre_completo: `${cert.nombre} ${cert.apellido}`,
        dni_enmascarado: maskedDni,
        rol_institucional: cert.rol_nombre,
      },
      evento: {
        denominacion: cert.metadata?.evento_nombre || cert.evento_nombre || 'Congreso de Educación Técnica Superior',
        anio: cert.metadata?.evento_anio || cert.evento_anio || 2026,
        entidad_emisora: cert.metadata?.institucion || 'Dirección de Educación Técnica Superior (DETS) • IFTS 04',
        ministerio: cert.metadata?.ministerio || 'Ministerio de Educación • Gobierno de la Ciudad de Buenos Aires',
        sede: cert.metadata?.sede || 'Auditorio Polo Saavedra, CABA',
        fechas:
          cert.metadata?.fechas ||
          (cert.fecha_inicio && cert.fecha_fin
            ? `${cert.fecha_inicio} al ${cert.fecha_fin}`
            : '6 de Noviembre de 2026'),
      },
      acreditacion_verificada: Boolean(cert.fecha_acreditacion),
      fecha_primera_acreditacion: cert.fecha_acreditacion,
    });
  } catch (error: any) {
    console.error('Error en GET /api/certificados/validar/:codigo:', error);
    res.status(500).json({ valido: false, message: 'Error al consultar validación del certificado.' });
  }
});

/**
 * GET /api/certificados/download/:codigo
 * Emisión y descarga en streaming binario del PDF vectorial oficial
 */
router.get('/download/:codigo', async (req: Request, res: Response): Promise<void> => {
  try {
    const codigo = req.params.codigo?.trim().toUpperCase();

    if (!codigo || codigo.length < 5) {
      res.status(400).json({ ok: false, error: 'Código de verificación inválido' });
      return;
    }

    const certRes = await query(
      `SELECT c.id, c.codigo_verificacion, c.tipo_certificado, c.horas_catedra, c.emitido_en, c.metadata,
              u.id as usuario_id, u.nombre, u.apellido, u.dni_pasaporte, r.nombre as rol_nombre
       FROM certificados c
       JOIN usuarios u ON c.usuario_id = u.id
       JOIN roles r ON u.rol_principal_id = r.id
       WHERE UPPER(c.codigo_verificacion) = $1
       LIMIT 1`,
      [codigo]
    );

    if (certRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Certificado no encontrado en el sistema', code: 'ERR_NOT_FOUND' });
      return;
    }

    const row = certRes.rows[0];

    // Verificar si la petición proviene de un operador/admin (staff jerarquía >= 3)
    const isStaff = Boolean((req as AuthenticatedRequest).operator && (req as AuthenticatedRequest).operator!.jerarquia >= 3);

    if (!isStaff) {
      // Verificar si existe una encuesta obligatoria activa y si el usuario la completó
      const surveyCheck = await query(
        `SELECT e.id FROM encuestas e
         WHERE e.activa = TRUE AND e.es_obligatoria = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM encuesta_respuestas er
           WHERE er.encuesta_id = e.id AND er.usuario_id = $1
         )
         LIMIT 1`,
        [row.usuario_id]
      );

      if (surveyCheck.rows.length > 0) {
        res.status(403).json({
          ok: false,
          error: 'ERR_SURVEY_REQUIRED',
          message: 'Debe completar la Encuesta de Calidad y Satisfacción del Congreso para habilitar la descarga de su Certificado Oficial.',
          encuesta_id: surveyCheck.rows[0].id,
        });
        return;
      }
    }

    const pdfBytes = await generateCertificatePdf({
      codigo_verificacion: row.codigo_verificacion,
      tipo_certificado: row.tipo_certificado,
      horas_catedra: row.horas_catedra,
      emitido_en: row.emitido_en,
      usuario: {
        nombre: row.nombre,
        apellido: row.apellido,
        dni_pasaporte: row.dni_pasaporte,
        rol_nombre: row.rol_nombre,
      },
      metadata: row.metadata,
    });

    const filename = `Certificado_ETS2026_${row.codigo_verificacion}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBytes.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error('Error al descargar PDF de certificado:', error);
    res.status(500).json({ ok: false, error: 'Error al generar el documento PDF', message: error.message });
  }
});

/**
 * GET /api/certificados?dni=...
 * Consulta o emisión de certificado oficial de asistencia / expositor por DNI
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawDni = req.query.dni as string;
    const rawEventoId = req.query.evento_id as string;

    const parsedDni = dniSchema.safeParse(rawDni);
    if (!parsedDni.success) {
      res.status(400).json({
        error: 'ERR_VALIDATION',
        message: 'DNI o Pasaporte inválido. Debe contener entre 5 y 25 caracteres alfanuméricos.',
      });
      return;
    }
    const dni = parsedDni.data;
    const targetEventoId = rawEventoId ? parseInt(rawEventoId, 10) : null;

    let userQuery = `
      SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.email, u.celular,
             u.evento_id, r.nombre AS rol_nombre, e.codigo AS estado_codigo
      FROM usuarios u
      JOIN roles r ON u.rol_principal_id = r.id
      JOIN estados_inscripcion e ON u.estado_inscripcion_id = e.id
      WHERE u.dni_pasaporte = $1
    `;
    const userParams: any[] = [dni];
    if (targetEventoId && !isNaN(targetEventoId)) {
      userQuery += ` AND u.evento_id = $2`;
      userParams.push(targetEventoId);
    } else {
      userQuery += ` ORDER BY u.creado_en DESC`;
    }

    const userRes = await query(userQuery, userParams);

    if (userRes.rowCount === 0) {
      res.status(404).json({
        error: 'ERR_NOT_FOUND',
        message: 'No se encontró ningún participante registrado con el DNI ingresado.',
      });
      return;
    }

    const usuario = userRes.rows[0];

    // Verificar acreditación efectiva en puerta
    const acreditacionesRes = await query(
      `SELECT a.id, a.timestamp_acreditacion, p.nombre AS punto_nombre, t.descripcion AS tipo_acreditacion
       FROM acreditaciones a
       JOIN puntos_acceso p ON a.punto_acceso_id = p.id
       JOIN tipos_acreditacion t ON a.tipo_acreditacion_id = t.id
       WHERE a.usuario_id = $1
       ORDER BY a.timestamp_acreditacion ASC`,
      [usuario.id]
    );

    if (acreditacionesRes.rowCount === 0) {
      res.status(403).json({
        error: 'ERR_NO_ACREDITADO',
        message:
          'El participante no registra ingreso efectivo en el congreso. Los certificados oficiales se emiten únicamente a quienes hayan completado su acreditación presencial en sede.',
        usuario: {
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          dni_pasaporte: usuario.dni_pasaporte,
          rol: usuario.rol_nombre,
          estado: usuario.estado_codigo,
        },
      });
      return;
    }

    let tipoCertificado = 'ASISTENCIA';
    const esExpositor = await query(
      `SELECT 1 FROM roles r 
       WHERE (r.id = (SELECT rol_principal_id FROM usuarios WHERE id = $1) OR 
              EXISTS (SELECT 1 FROM usuario_roles_adicionales ura WHERE ura.usuario_id = $1 AND ura.rol_id = r.id))
         AND r.nombre = 'Expositor'`,
      [usuario.id]
    );

    if (esExpositor.rowCount && esExpositor.rowCount > 0) {
      const homolRes = await query(
        `SELECT estado_homologacion FROM homologaciones_expositores WHERE usuario_id = $1`,
        [usuario.id]
      );
      if (homolRes.rows.length > 0 && homolRes.rows[0].estado_homologacion === 'VALIDADO') {
        tipoCertificado = 'EXPOSITOR';
      }
    }

    const evRes = await query(
      `SELECT ev.id, ev.codigo, ev.nombre, ev.anio, ev.fecha_inicio, ev.fecha_fin
       FROM usuarios u
       LEFT JOIN eventos ev ON u.evento_id = ev.id
       WHERE u.id = $1`,
      [usuario.id]
    );
    const evData = evRes.rows[0];
    const eventoId = evData?.id || 1;

    const certExistente = await query(
      `SELECT c.id, c.codigo_verificacion, c.tipo_certificado, c.horas_catedra, c.emitido_en, c.metadata
       FROM certificados c
       WHERE c.usuario_id = $1 AND c.tipo_certificado = $2 AND COALESCE(c.evento_id, 1) = $3`,
      [usuario.id, tipoCertificado, eventoId]
    );

    let certificadoFinal;

    if (certExistente.rowCount && certExistente.rowCount > 0) {
      certificadoFinal = certExistente.rows[0];
    } else {
      const anioSuffix = evData?.anio ? String(evData.anio).slice(-2) : '26';
      const prefijoCodigo = `ETS${anioSuffix}`;
      const codigoVerificacion = `${prefijoCodigo}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const primeraAcreditacion = acreditacionesRes.rows[0];

      const talleresRes = await query(
        `SELECT DISTINCT act.nombre, ca.codigo, ca.nombre AS materia_nombre, COALESCE(ca.horas_catedra, 4) as horas
         FROM acreditaciones a
         JOIN actividades act ON a.actividad_id = act.id
         LEFT JOIN catalogo_actividades ca ON act.catalogo_actividad_id = ca.id
         WHERE a.usuario_id = $1 AND a.tipo_movimiento = 'INGRESO'`,
        [usuario.id]
      );
      const horasTalleres = talleresRes.rows.reduce(
        (sum: number, t: any) => sum + Number(t.horas),
        0
      );
      const horasBase = 8;
      const horasCatedraFinal = Math.max(16, horasBase + horasTalleres);

      const fechasTexto =
        evData?.fecha_inicio && evData?.fecha_fin
          ? `${new Date(evData.fecha_inicio).toLocaleDateString('es-AR')} al ${new Date(evData.fecha_fin).toLocaleDateString('es-AR')}`
          : '15, 16 y 17 de Octubre de 2026';

      const metadata = {
        primera_acreditacion: primeraAcreditacion.timestamp_acreditacion,
        punto_acceso: primeraAcreditacion.punto_nombre,
        total_ingresos: acreditacionesRes.rowCount,
        horas_base: horasBase,
        horas_talleres_especificos: horasTalleres,
        talleres_asistidos: talleresRes.rows.map((t: any) => ({
          nombre: t.nombre,
          materia: t.materia_nombre || t.nombre,
          horas: t.horas,
        })),
        evento_nombre: evData?.nombre || 'Congreso de Educación Técnica Superior',
        evento_anio: evData?.anio || 2026,
        institucion:
          'Dirección de Educación Técnica Superior (DETS) • Instituto de Formación Técnica Superior N° 04',
        ministerio: 'Ministerio de Educación • Gobierno de la Ciudad Autónoma de Buenos Aires',
        sede: 'Auditorio Polo Saavedra',
        fechas: fechasTexto,
      };

      const insertRes = await query(
        `INSERT INTO certificados (codigo_verificacion, usuario_id, tipo_certificado, horas_catedra, emitido_en, metadata, evento_id)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)
         RETURNING id, codigo_verificacion, tipo_certificado, horas_catedra, emitido_en, metadata`,
        [
          codigoVerificacion,
          usuario.id,
          tipoCertificado,
          horasCatedraFinal,
          JSON.stringify(metadata),
          eventoId,
        ]
      );

      certificadoFinal = insertRes.rows[0];

      await query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
         VALUES ('EMISION_CERTIFICADO', 'PORTAL_AUTONOMO', $1, $2, NOW())`,
        [
          usuario.id,
          JSON.stringify({
            codigo_verificacion: codigoVerificacion,
            tipo_certificado: tipoCertificado,
            horas_catedra: horasCatedraFinal,
          }),
        ]
      );
    }

    const surveyCheck = await query(
      `SELECT e.id FROM encuestas e
       WHERE e.activa = TRUE AND e.es_obligatoria = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM encuesta_respuestas er
         WHERE er.encuesta_id = e.id AND er.usuario_id = $1
       )
       LIMIT 1`,
      [usuario.id]
    );
    const encuestaPendiente = surveyCheck.rows.length > 0;

    res.json({
      success: true,
      ok: true,
      encuesta_pendiente: encuestaPendiente,
      encuesta_id: encuestaPendiente ? surveyCheck.rows[0].id : null,
      certificado: {
        ...certificadoFinal,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          dni_pasaporte: usuario.dni_pasaporte,
          email: usuario.email,
          rol_nombre: usuario.rol_nombre,
        },
        acreditaciones_registradas: acreditacionesRes.rowCount,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/certificados:', error);
    res.status(500).json({ error: 'ERR_DATABASE', message: error.message || 'Error interno al procesar certificado.' });
  }
});

/**
 * POST /api/certificados
 * Emisión administrativa manual/forzada de certificados
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = certificadoEmisionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { dni_pasaporte, tipo_certificado } = parsed.data;
    const targetEventoId = req.body.evento_id ? parseInt(req.body.evento_id, 10) : null;

    let userQuery = `
      SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.email, u.evento_id, 
             r.nombre AS rol_nombre, r.jerarquia
      FROM usuarios u
      JOIN roles r ON u.rol_principal_id = r.id
      WHERE u.dni_pasaporte = $1
    `;
    const userParams: any[] = [dni_pasaporte.trim()];
    if (targetEventoId && !isNaN(targetEventoId)) {
      userQuery += ` AND u.evento_id = $2`;
      userParams.push(targetEventoId);
    } else {
      userQuery += ` ORDER BY u.creado_en DESC`;
    }

    const userRes = await query(userQuery, userParams);

    if (userRes.rowCount === 0) {
      res.status(404).json({ error: 'ERR_NOT_FOUND', message: 'Asistente no encontrado.' });
      return;
    }

    const usuario = userRes.rows[0];

    if (usuario.jerarquia >= 3 || tipo_certificado === 'ORGANIZADOR') {
      res.status(400).json({
        error: 'ERR_SYSTEM_USER_NO_CERTIFICATE',
        message: 'A los usuarios del sistema no se les emiten certificados ni diplomas desde esta plataforma. Solo se emiten a los asistentes y estudiantes.',
      });
      return;
    }

    const evRes = await query(
      `SELECT id, codigo, nombre, anio, fecha_inicio, fecha_fin FROM eventos WHERE id = $1`,
      [usuario.evento_id || 1]
    );
    const evData = evRes.rows[0];
    const anioSuffix = evData?.anio ? String(evData.anio).slice(-2) : '26';
    const prefijoCodigo = `ETS${anioSuffix}`;
    const codigoVerificacion = `${prefijoCodigo}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const fechasTexto =
      evData?.fecha_inicio && evData?.fecha_fin
        ? `${new Date(evData.fecha_inicio).toLocaleDateString('es-AR')} al ${new Date(evData.fecha_fin).toLocaleDateString('es-AR')}`
        : '15, 16 y 17 de Octubre de 2026';

    const metadata = {
      emision_administrativa: true,
      evento_nombre: evData?.nombre || 'Congreso de Educación Técnica Superior',
      evento_anio: evData?.anio || 2026,
      institucion:
        'Dirección de Educación Técnica Superior (DETS) • Instituto de Formación Técnica Superior N° 04',
      sede: 'Auditorio Polo Saavedra',
      fechas: fechasTexto,
    };

    const insertCert = await query(
      `INSERT INTO certificados (codigo_verificacion, usuario_id, evento_id, tipo_certificado, horas_catedra, emitido_en, metadata)
       VALUES ($1, $2, $3, $4, 16, NOW(), $5)
       ON CONFLICT (usuario_id, tipo_certificado)
       DO UPDATE SET actualizado_en = NOW()
       RETURNING id, codigo_verificacion, tipo_certificado, horas_catedra, emitido_en, metadata`,
      [
        codigoVerificacion,
        usuario.id,
        usuario.evento_id || 1,
        tipo_certificado,
        JSON.stringify(metadata),
      ]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
       VALUES ('EMISION_CERTIFICADO_ADMIN', 'SUPERADMIN', $1, $2, NOW())`,
      [
        usuario.id,
        JSON.stringify({
          codigo_verificacion: codigoVerificacion,
          tipo_certificado,
        }),
      ]
    );

    res.json({
      success: true,
      certificado: {
        ...insertCert.rows[0],
        usuario,
      },
    });
  } catch (error: any) {
    console.error('Error en POST /api/certificados:', error);
    res.status(500).json({ error: 'ERR_SERVER', message: error.message });
  }
});

export default router;
