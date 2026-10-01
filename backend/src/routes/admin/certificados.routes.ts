import { Router, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { query } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';
import { sendCertificateEmail } from '../../lib/mailService';
import { generateCertificatePdf } from '../../lib/certificatePdfService';

const router = Router();

const batchCertificadosSchema = z.object({
  usuario_ids: z.array(z.string().uuid()).min(1, 'Debe seleccionar al menos un asistente o estudiante'),
  tipo_certificado: z.enum(['ASISTENCIA', 'TALLER']).default('ASISTENCIA'),
});

/**
 * GET /api/admin/certificados
 * Buscador de diplomas y certificados emitidos con fe pública
 */
router.get('/', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string || req.query.search as string) || '').trim();
    const tipo = req.query.tipo_certificado as string;
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      conditions.push(
        `(c.codigo_verificacion ILIKE $${pIdx} OR u.nombre ILIKE $${pIdx} OR u.apellido ILIKE $${pIdx} OR u.dni_pasaporte ILIKE $${pIdx})`
      );
      params.push(`%${q}%`);
      pIdx++;
    }

    if (tipo && tipo !== 'TODOS') {
      conditions.push(`c.tipo_certificado = $${pIdx++}`);
      params.push(tipo);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(*) as total
       FROM certificados c
       JOIN usuarios u ON c.usuario_id = u.id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const sql = `
      SELECT c.id, c.codigo_verificacion, c.tipo_certificado, c.horas_catedra, c.emitido_en, c.metadata,
             u.id as usuario_id,
             u.nombre, u.apellido,
             u.nombre as usuario_nombre, u.apellido as usuario_apellido,
             u.dni_pasaporte,
             r.nombre as rol_nombre,
             ev.nombre as evento_nombre
      FROM certificados c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN roles r ON u.rol_principal_id = r.id
      LEFT JOIN eventos ev ON c.evento_id = ev.id
      WHERE ${whereClause}
      ORDER BY c.emitido_en DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const result = await query(sql, [...params, limit, offset]);

    res.json({
      ok: true,
      total,
      pagina_actual: page,
      limite: limit,
      total_paginas: Math.ceil(total / limit),
      certificados: result.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/certificados:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/certificados/download/:codigo
 * Descarga administrativa de certificado oficial (omite validación de encuesta de participante)
 */
router.get('/download/:codigo', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      res.status(404).json({ ok: false, error: 'ERR_NOT_FOUND', message: 'Certificado no encontrado en el sistema' });
      return;
    }

    const row = certRes.rows[0];

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
    res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error('Error en descarga admin de certificado:', error);
    res.status(500).json({ ok: false, error: 'ERR_PDF_GENERATION', message: error.message });
  }
});

/**
 * POST /api/admin/certificados
 * Emisión manual administrativa de certificado oficial exclusiva para asistentes / estudiantes
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.body.dni_pasaporte || req.body.usuario_id;
    const tipo_certificado = req.body.tipo_certificado || 'ASISTENCIA';

    if (tipo_certificado === 'ORGANIZADOR') {
      res.status(400).json({
        ok: false,
        error: 'ERR_INVALID_ROLE',
        message: 'A los usuarios u organizadores del sistema no se les emiten certificados ni diplomas desde esta plataforma. Solo se emiten a asistentes y estudiantes.',
      });
      return;
    }

    if (!rawId || String(rawId).trim().length < 3) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', message: 'Debe ingresar un DNI de asistente o estudiante válido.' });
      return;
    }

    const cleanInput = String(rawId).trim();

    // 1. Verificar si el identificador corresponde a un operador del sistema
    const opRes = await query(
      `SELECT id, nombre, apellido, email_institucional FROM operadores 
       WHERE email_institucional = $1 OR id::text = $1 LIMIT 1`,
      [cleanInput]
    );

    if (opRes.rows.length > 0) {
      res.status(400).json({
        ok: false,
        error: 'ERR_SYSTEM_USER_NO_CERTIFICATE',
        message: 'A los usuarios del sistema (operadores y administradores) no se les emiten certificados ni diplomas desde esta plataforma. Solo se emiten diplomas a los asistentes y estudiantes.',
      });
      return;
    }

    // 2. Buscar en la nómina de participantes/asistentes
    const userRes = await query(
      `SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.email, u.evento_id, 
              r.nombre as rol_nombre, r.jerarquia
       FROM usuarios u
       JOIN roles r ON u.rol_principal_id = r.id
       WHERE u.dni_pasaporte = $1 OR u.id::text = $1
       ORDER BY u.creado_en DESC LIMIT 1`,
      [cleanInput]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'ERR_USER_NOT_FOUND', message: 'Asistente o estudiante no encontrado con ese DNI o identificador.' });
      return;
    }

    const usuario = userRes.rows[0];

    // 3. Regla institucional estricta: NO emitir certificados a usuarios con roles de sistema (jerarquía >= 3)
    if (usuario.jerarquia >= 3 || ['Superadmin', 'Administrador', 'Operador', 'Verificador'].includes(usuario.rol_nombre)) {
      res.status(400).json({
        ok: false,
        error: 'ERR_SYSTEM_USER_NO_CERTIFICATE',
        message: `El usuario ${usuario.nombre} ${usuario.apellido} posee rol de sistema (${usuario.rol_nombre}). A los usuarios del sistema no se les generan ni emiten certificados desde esta plataforma; solo se emiten a asistentes y estudiantes.`,
      });
      return;
    }

    const codigoVerificacion = `ETS26-${randomBytes(4).toString('hex').toUpperCase()}`;

    const metadata = {
      emision_administrativa: true,
      operador: req.operator?.email || 'ADMIN',
      institucion: 'Dirección de Educación Técnica Superior (DETS) • IFTS 04',
      sede: 'Auditorio Polo Saavedra',
    };

    const insertRes = await query(
      `INSERT INTO certificados (codigo_verificacion, usuario_id, evento_id, tipo_certificado, horas_catedra, emitido_en, metadata)
       VALUES ($1, $2, $3, $4, 16, NOW(), $5)
       ON CONFLICT (usuario_id, tipo_certificado)
       DO UPDATE SET actualizado_en = NOW()
       RETURNING *`,
      [codigoVerificacion, usuario.id, usuario.evento_id || 1, tipo_certificado, JSON.stringify(metadata)]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('EMISION_CERTIFICADO_ADMIN', $1, $2, NOW())`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ certificado: insertRes.rows[0], destinatario: `${usuario.nombre} ${usuario.apellido}` })]
    );

    res.status(201).json({ ok: true, certificado: insertRes.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /api/admin/certificados:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/certificados/batch
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchCertificadosSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { usuario_ids, tipo_certificado } = parsed.data;
    let emitidos = 0;

    for (const uId of usuario_ids) {
      // Filtrar y omitir estrictamente usuarios del sistema
      const checkRes = await query(
        `SELECT u.id, r.jerarquia, r.nombre as rol_nombre
         FROM usuarios u
         JOIN roles r ON u.rol_principal_id = r.id
         WHERE u.id = $1`,
        [uId]
      );
      if (checkRes.rows.length === 0 || checkRes.rows[0].jerarquia >= 3) {
        continue; // Ignorar usuarios del sistema
      }

      const codigoVerificacion = `ETS26-${randomBytes(4).toString('hex').toUpperCase()}`;
      const metadata = { emision_masiva: true, operador: req.operator?.email || 'ADMIN' };

      await query(
        `INSERT INTO certificados (codigo_verificacion, usuario_id, evento_id, tipo_certificado, horas_catedra, emitido_en, metadata)
         VALUES ($1, $2, 1, $3, 16, NOW(), $4)
         ON CONFLICT (usuario_id, tipo_certificado) DO NOTHING`,
        [codigoVerificacion, uId, tipo_certificado, JSON.stringify(metadata)]
      );
      emitidos++;
    }

    res.json({ ok: true, processed: emitidos, message: `Se procesaron ${emitidos} certificados para asistentes/estudiantes.` });
  } catch (error: any) {
    console.error('Error en POST /api/admin/certificados/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/certificados/:id/enviar-correo
 * Envía el diploma oficial en PDF y enlace de verificación al correo del destinatario (exclusivo asistentes/estudiantes)
 */
router.post('/:id/enviar-correo', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const certRes = await query(
      `SELECT c.id, c.codigo_verificacion, c.tipo_certificado, c.horas_catedra, c.emitido_en,
              u.id as usuario_id, u.nombre, u.apellido, u.dni_pasaporte, u.email,
              r.nombre as rol_nombre, r.jerarquia
       FROM certificados c
       JOIN usuarios u ON c.usuario_id = u.id
       LEFT JOIN roles r ON r.id = u.rol_principal_id
       WHERE c.id::text = $1 OR c.codigo_verificacion = $1
       LIMIT 1`,
      [id]
    );

    if (certRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'ERR_NOT_FOUND', message: 'Certificado no encontrado' });
      return;
    }

    const cert = certRes.rows[0];

    // Regla estricta: No enviar correos de diplomas a usuarios del sistema
    if (cert.jerarquia >= 3 || ['Superadmin', 'Administrador', 'Operador', 'Verificador'].includes(cert.rol_nombre)) {
      res.status(400).json({
        ok: false,
        error: 'ERR_SYSTEM_USER_NO_CERTIFICATE',
        message: 'A los usuarios del sistema no se les envían certificados ni diplomas desde esta plataforma. Solo se envían a los asistentes y estudiantes.',
      });
      return;
    }

    // Generar PDF del diploma
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
    });

    const sendRes = await sendCertificateEmail({
      to: cert.email,
      nombre: cert.nombre,
      apellido: cert.apellido,
      codigoVerificacion: cert.codigo_verificacion,
      horasCatedra: cert.horas_catedra,
      pdfBuffer: Buffer.from(pdfBytes),
    });

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('certificados', 'ENVIAR_CERTIFICADO_MAIL', $1, $2)`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ certificado_id: cert.id, codigo: cert.codigo_verificacion, email: cert.email })]
    ).catch(() => {});

    res.json({
      ok: true,
      mensaje: `Certificado enviado con éxito al correo ${cert.email}`,
      simulado: sendRes.simulated,
    });
  } catch (error: any) {
    console.error('Error enviando certificado por correo:', error);
    res.status(500).json({ ok: false, error: 'ERR_SEND_CERTIFICATE', message: error.message });
  }
});

/**
 * GET /api/admin/certificados/plantilla
 * Obtener la plantilla activa de diseño del certificado
 */
router.get('/plantilla', requireHierarchy(3), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { getPlantillaCertificado } = await import('../../lib/certificatePdfService');
    const plantilla = await getPlantillaCertificado();
    res.json({ ok: true, plantilla });
  } catch (error: any) {
    console.error('Error en GET /api/admin/certificados/plantilla:', error);
    res.status(500).json({ ok: false, error: 'ERR_GET_TEMPLATE', message: error.message });
  }
});

/**
 * PUT /api/admin/certificados/plantilla
 * Guardar nueva configuración de la plantilla oficial de certificados (requiere Jerarquía >= 4)
 */
router.put('/plantilla', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const nuevaPlantilla = req.body;
    if (!nuevaPlantilla || typeof nuevaPlantilla !== 'object') {
      res.status(400).json({ ok: false, error: 'ERR_INVALID_BODY', message: 'Configuración de plantilla requerida' });
      return;
    }

    await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, actualizado_en)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (clave) DO UPDATE
       SET valor = $2, actualizado_en = NOW()`,
      [
        'plantilla_certificado_oficial',
        JSON.stringify(nuevaPlantilla),
        'Plantilla visual y parámetros de diplomas y certificados (Editor WYSIWYG)',
        'CERTIFICADOS',
      ]
    );

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'ACTUALIZAR_PLANTILLA_CERTIFICADO', $1, $2)`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ fecha: new Date().toISOString() })]
    ).catch(() => {});

    res.json({ ok: true, mensaje: 'Plantilla oficial de certificados guardada y aplicada exitosamente.' });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/certificados/plantilla:', error);
    res.status(500).json({ ok: false, error: 'ERR_SAVE_TEMPLATE', message: error.message });
  }
});

/**
 * POST /api/admin/certificados/plantilla/preview
 * Genera en memoria y transmite en streaming binario el PDF de muestra con los datos en edición
 */
router.post('/plantilla/preview', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plantilla, tipo_certificado } = req.body;
    const sampleData = {
      codigo_verificacion: 'ETS26-DEMO-PREVIEW',
      tipo_certificado: tipo_certificado || 'ASISTENCIA',
      horas_catedra: 16,
      emitido_en: new Date().toLocaleDateString('es-AR'),
      usuario: {
        nombre: 'JUAN MARTÍN',
        apellido: 'PÉREZ',
        dni_pasaporte: '35.890.123',
        rol_nombre: tipo_certificado === 'EXPOSITOR' ? 'Expositor' : 'Estudiante',
      },
    };

    const pdfBytes = await generateCertificatePdf(sampleData, plantilla);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Certificado_Preview.pdf"');
    res.setHeader('Content-Length', String(pdfBytes.length));
    res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error('Error en POST /api/admin/certificados/plantilla/preview:', error);
    res.status(500).json({ ok: false, error: 'ERR_PREVIEW_PDF', message: error.message });
  }
});

export default router;
