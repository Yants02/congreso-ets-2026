import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { query, withTransaction } from '../lib/db';
import { registerSchema, bajaVoluntariaSchema } from '../lib/schemas';
import { encryptQRPayload } from '../lib/cryptoQR';
import { sendWelcomeEmail, sendWaitlistEmail } from '../lib/mailService';

const router = Router();

// Rate limiter para proteger el formulario público de inscripción contra ataques de denegación o bots
const registroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: process.env.NODE_ENV === 'test' ? 1000 : 25, // Máximo 25 intentos por IP en producción
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'ERR_RATE_LIMIT_EXCEEDED',
    message: 'Has superado el límite de intentos de inscripción por ventana temporal. Por favor, aguarda unos minutos e intenta nuevamente.',
  },
});

/**
 * POST /api/registro
 * Registra un aspirante al congreso con validación de Ley 25.326, asignación de vacante y token QR
 */
router.post('/', registroLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'ERR_VALIDATION',
        message: 'Datos de registro inválidos',
        details: parsed.error.format(),
      });
      return;
    }

    const {
      dni_pasaporte,
      nombre,
      apellido,
      email,
      celular,
      rol_principal_id,
      roles_adicionales_ids,
      foto,
      consentimiento_datos,
    } = parsed.data;

    // Validación normativa de consentimiento informado (Ley 25.326)
    if (consentimiento_datos === false || req.body.consentimiento_datos === false) {
      res.status(400).json({
        ok: false,
        error: 'ERR_CONSENTIMIENTO_REQUERIDO',
        message:
          'Es obligatorio aceptar el consentimiento informado de tratamiento de datos personales conforme a la Ley Nacional 25.326.',
      });
      return;
    }

    // Obtener evento activo
    const eventoId = req.body.evento_id || null;
    let targetEventoId = eventoId;
    if (!targetEventoId) {
      const evRes = await query(
        `SELECT id FROM eventos WHERE codigo = 'ETS_2026' OR activo = TRUE ORDER BY (codigo = 'ETS_2026') DESC, anio ASC LIMIT 1`
      );
      targetEventoId = evRes.rows[0]?.id || 1;
    }

    // Verificar si ya existe usuario con este DNI en este evento
    const existingDni = await query(
      `SELECT u.id, ei.codigo AS estado_codigo
       FROM usuarios u
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       WHERE u.dni_pasaporte = $1 AND u.evento_id = $2`,
      [dni_pasaporte, targetEventoId]
    );

    if (existingDni.rows.length > 0) {
      const uExistente = existingDni.rows[0];
      const qrToken = encryptQRPayload({
        u: uExistente.id,
        d: dni_pasaporte,
        t: Date.now(),
      });

      res.status(409).json({
        ok: false,
        error: 'ERR_DNI_ALREADY_EXISTS',
        message: `El DNI ${dni_pasaporte} ya se encuentra registrado para esta edición con estado: ${uExistente.estado_codigo}`,
        usuario_id: uExistente.id,
        estado: uExistente.estado_codigo,
        qr_token: qrToken,
      });
      return;
    }

    // Verificar padrón preventivo de seguridad (Blacklist)
    const blacklisted = await query(
      `SELECT id, motivo FROM blacklist WHERE dni_pasaporte = $1 AND activo = TRUE LIMIT 1`,
      [dni_pasaporte]
    );

    if (blacklisted.rows.length > 0) {
      await query(
        `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
         VALUES ($1, $2, $3, $4)`,
        [
          'usuarios',
          'RECHAZO_BLACKLIST',
          'SISTEMA_REGISTRO',
          JSON.stringify({ dni_pasaporte, motivo: blacklisted.rows[0].motivo }),
        ]
      ).catch(() => {});

      res.status(403).json({
        ok: false,
        error: 'ERR_SECURITY_RESTRICTION',
        message:
          'No es posible procesar la inscripción debido a una observación administrativa en el padrón de seguridad.',
      });
      return;
    }

    // Preparar foto y metadata de Ley 25.326
    let fotoUrl: string | null = null;
    let fotoMetadata: Record<string, any> = {
      consentimiento_ley_25326: true,
      consentimiento_fecha: new Date().toISOString(),
      consentimiento_ip: req.ip || '127.0.0.1',
    };

    if (foto) {
      fotoUrl = foto.buffer_base64;
      fotoMetadata = {
        ...fotoMetadata,
        file_name: foto.file_name,
        mime_type: foto.mime_type,
        size_bytes: foto.size_bytes,
        cargado_en: new Date().toISOString(),
      };
    }

    // Invocación a la función transaccional con bloqueo pesimista en PostgreSQL
    const resProc = await query(
      `SELECT new_id, estado_codigo FROM registrar_usuario_seguro($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dni_pasaporte,
        nombre,
        apellido,
        email,
        celular,
        rol_principal_id,
        fotoUrl,
        fotoMetadata ? JSON.stringify(fotoMetadata) : null,
        false, // p_es_superadmin_override = false
        targetEventoId,
      ]
    );

    if (!resProc.rows || resProc.rows.length === 0) {
      res.status(500).json({ ok: false, error: 'ERR_DB_INSERT_FAILED', message: 'Fallo la inserción en base de datos' });
      return;
    }

    const { new_id: usuarioId, estado_codigo: estadoFinal } = resProc.rows[0];

    // Inserción de roles adicionales institucionales
    if (Array.isArray(roles_adicionales_ids) && roles_adicionales_ids.length > 0) {
      for (const rId of roles_adicionales_ids) {
        if (rId !== rol_principal_id) {
          await query(
            `INSERT INTO usuario_roles_adicionales (usuario_id, rol_id)
             VALUES ($1, $2)
             ON CONFLICT (usuario_id, rol_id) DO NOTHING`,
            [usuarioId, rId]
          );

          const checkExpositor = await query(
            `SELECT 1 FROM roles WHERE id = $1 AND nombre = 'Expositor'`,
            [rId]
          );
          if (checkExpositor.rows.length > 0) {
            await query(
              `INSERT INTO homologaciones_expositores (usuario_id, estado_homologacion)
               VALUES ($1, 'PENDIENTE')
               ON CONFLICT (usuario_id) DO NOTHING`,
              [usuarioId]
            );
          }
        }
      }
    }

    // Generar token QR seguro AES-256-CBC
    let qrToken: string | null = null;
    if (estadoFinal === 'CONFIRMADO') {
      qrToken = encryptQRPayload({
        u: usuarioId,
        d: dni_pasaporte,
        t: Date.now(),
      });
    }

    // Auditoría de consentimiento informado
    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, registro_id, accion, usuario_responsable, datos_nuevos)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'usuarios',
        usuarioId,
        'CONSENTIMIENTO_INFORMADO_LEY_25326',
        email,
        JSON.stringify({
          dni: dni_pasaporte,
          nombre: `${nombre} ${apellido}`,
          tratamiento_datos: true,
          uso_fotografia: Boolean(fotoUrl),
          base_legal: 'Ley 25.326 Art. 5',
        }),
      ]
    ).catch(() => {});

    // Enviar correo asíncrono según el estado de la vacante
    if (estadoFinal === 'CONFIRMADO') {
      sendWelcomeEmail({
        to: email,
        nombre,
        apellido,
        dni: dni_pasaporte,
        rol: req.body.rol_nombre || 'Participante',
        estado: estadoFinal,
      }).catch((err) => console.error('Error enviando correo de bienvenida:', err));
    } else if (estadoFinal === 'LISTA_ESPERA') {
      const waitCountRes = await query(
        `SELECT COUNT(*) as total FROM usuarios u 
         JOIN estados_inscripcion ei ON ei.id = u.estado_inscripcion_id 
         WHERE ei.codigo = 'LISTA_ESPERA'`
      ).catch(() => ({ rows: [{ total: 1 }] }));
      const orden = parseInt(waitCountRes.rows[0]?.total, 10) || 1;

      sendWaitlistEmail({
        to: email,
        nombre,
        apellido,
        dni: dni_pasaporte,
        orden,
      }).catch((err) => console.error('Error enviando correo de lista de espera:', err));
    }

    res.status(201).json({
      ok: true,
      success: true,
      usuario_id: usuarioId,
      estado: estadoFinal,
      mensaje:
        estadoFinal === 'CONFIRMADO'
          ? 'Inscripción confirmada con éxito. Ya puedes acceder a tu credencial digital.'
          : 'Cupo completo alcanzado. Has sido incorporado con éxito a la lista de espera oficial.',
      qr_token: qrToken,
    });
  } catch (error: any) {
    console.error('Error en POST /api/registro:', error);
    res.status(500).json({
      ok: false,
      error: 'ERR_INTERNAL',
      message: error.message || 'Error interno al procesar la inscripción',
    });
  }
});

/**
 * POST /api/registro/baja-voluntaria
 * Derecho al olvido (Ley 25.326)
 */
router.post('/baja-voluntaria', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = bajaVoluntariaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'ERR_VALIDATION',
        details: parsed.error.format(),
      });
      return;
    }

    const { dni_pasaporte, email, motivo } = parsed.data;

    const userRes = await query(
      `SELECT u.id, u.nombre, u.apellido, u.evento_id, ei.codigo as estado_codigo
       FROM usuarios u
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       WHERE u.dni_pasaporte = $1 AND LOWER(u.email) = LOWER($2)
       LIMIT 1`,
      [dni_pasaporte, email]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        ok: false,
        error: 'ERR_NOT_FOUND',
        message: 'No se localizó ningún registro coincidente con el DNI y correo especificados.',
      });
      return;
    }

    const user = userRes.rows[0];

    await withTransaction(async (client) => {
      const bajaEstado = await client.query(
        `SELECT id FROM estados_inscripcion WHERE codigo = 'CANCELADO' LIMIT 1`
      );
      const estadoCanceladoId = bajaEstado.rows[0]?.id;

      // Anonimizar foto y revocar consentimiento
      await client.query(
        `UPDATE usuarios 
         SET estado_inscripcion_id = $1, foto_url = NULL, actualizado_en = NOW()
         WHERE id = $2`,
        [estadoCanceladoId, user.id]
      );

      // Si estaba confirmado, promover al primero en lista de espera (FIFO)
      if (user.estado_codigo === 'CONFIRMADO') {
        const nextInLine = await client.query(
          `SELECT u.id, u.email, u.nombre, u.apellido, u.dni_pasaporte
           FROM usuarios u
           JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
           WHERE u.evento_id = $1 AND ei.codigo = 'LISTA_ESPERA'
           ORDER BY u.creado_en ASC
           LIMIT 1
           FOR UPDATE`,
          [user.evento_id]
        );

        if (nextInLine.rows.length > 0) {
          const promovido = nextInLine.rows[0];
          const confirmadoEstado = await client.query(
            `SELECT id FROM estados_inscripcion WHERE codigo = 'CONFIRMADO' LIMIT 1`
          );

          await client.query(
            `UPDATE usuarios 
             SET estado_inscripcion_id = $1, actualizado_en = NOW()
             WHERE id = $2`,
            [confirmadoEstado.rows[0].id, promovido.id]
          );

          await client.query(
            `INSERT INTO logs_auditoria (tabla_afectada, registro_id, accion, usuario_responsable, datos_nuevos)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              'usuarios',
              promovido.id,
              'PROMOCION_FIFO_AUTOMATICA',
              'SISTEMA_CRON',
              JSON.stringify({ motivo: 'Baja voluntaria de usuario', vacante_liberada_por: user.id }),
            ]
          );
        }
      }

      await client.query(
        `INSERT INTO logs_auditoria (tabla_afectada, registro_id, accion, usuario_responsable, datos_nuevos)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'usuarios',
          user.id,
          'BAJA_VOLUNTARIA_LEY_25326',
          email,
          JSON.stringify({ dni: dni_pasaporte, motivo: motivo || 'Solicitud del titular' }),
        ]
      );
    });

    res.json({
      ok: true,
      mensaje: 'Baja voluntaria procesada exitosamente y datos personales revocados según normativa.',
    });
  } catch (error: any) {
    console.error('Error en POST /api/registro/baja-voluntaria:', error);
    res.status(500).json({ ok: false, error: 'ERR_INTERNAL', message: error.message });
  }
});

/**
 * GET /api/registro/roles
 * Consulta pública de roles institucionales disponibles para la inscripción
 */
router.get('/roles', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rolesRes = await query(
      `SELECT id, nombre, descripcion 
       FROM roles 
       WHERE jerarquia <= 4 AND nombre NOT IN ('Operador', 'Verificador', 'Administrador', 'Superadmin')
       ORDER BY jerarquia ASC, id ASC`
    );
    res.json({ ok: true, roles: rolesRes.rows });
  } catch (error: any) {
    console.error('Error en GET /api/registro/roles:', error);
    res.status(500).json({ ok: false, error: 'ERR_DB', message: 'Error al consultar roles' });
  }
});

export default router;
