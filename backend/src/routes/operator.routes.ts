import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../lib/db';
import { acreditarSchema, batchAcreditarSchema, walkInRegisterSchema } from '../lib/schemas';
import { decryptQRPayload, encryptQRPayload } from '../lib/cryptoQR';

const router = Router();

/**
 * GET /api/operator/config
 * Devuelve operadores activos, puntos de acceso y tipos de acreditación
 */
router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [operadoresRes, puntosRes, tiposRes, actividadesRes] = await Promise.all([
      query(`
        SELECT id, nombre, apellido, email_institucional, punto_acceso_default_id
        FROM operadores
        WHERE activo = TRUE
        ORDER BY id ASC
      `),
      query(`
        SELECT id, nombre, ubicacion_fisica, activo
        FROM puntos_acceso
        WHERE activo = TRUE
        ORDER BY id ASC
      `),
      query(`
        SELECT id, codigo, descripcion, requiere_actividad
        FROM tipos_acreditacion
        ORDER BY id ASC
      `),
      query(`
        SELECT id, nombre, tipo_acreditacion_id, punto_acceso_id, cupo_maximo, disertante_nombre
        FROM actividades
        WHERE activo = TRUE
        ORDER BY id ASC
      `),
    ]);

    res.json({
      ok: true,
      operadores: operadoresRes.rows,
      puntos_acceso: puntosRes.rows,
      tipos_acreditacion: tiposRes.rows,
      actividades: actividadesRes.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/operator/config:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/operator/recent
 * Ticker en vivo de las últimas 10 acreditaciones
 */
router.get('/recent', async (_req: Request, res: Response): Promise<void> => {
  try {
    const recentRes = await query(`
      SELECT 
        a.id,
        a.timestamp_acreditacion,
        a.tipo_movimiento,
        u.id AS usuario_id,
        u.nombre,
        u.apellido,
        u.dni_pasaporte,
        u.foto_url,
        r.nombre AS rol_nombre,
        pa.nombre AS punto_acceso_nombre,
        COALESCE(o.nombre || ' ' || o.apellido, 'Operador Sistema') AS operador_nombre,
        ta.descripcion AS tipo_acreditacion_nombre,
        act.nombre AS actividad_nombre
      FROM acreditaciones a
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN roles r ON u.rol_principal_id = r.id
      JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
      LEFT JOIN operadores o ON a.operador_id = o.id
      JOIN tipos_acreditacion ta ON a.tipo_acreditacion_id = ta.id
      LEFT JOIN actividades act ON a.actividad_id = act.id
      ORDER BY a.timestamp_acreditacion DESC
      LIMIT 10
    `);

    res.json({
      ok: true,
      acreditaciones: recentRes.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/operator/recent:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/operator/acreditar
 * Validación de credencial QR, control Anti-Passback bidireccional y registro de acceso
 */
router.post('/acreditar', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = acreditarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'ERR_VALIDATION',
        message: 'Parámetros de acreditación inválidos.',
        details: parsed.error.format(),
      });
      return;
    }

    const {
      qr_token,
      dni_pasaporte,
      punto_acceso_id,
      tipo_acreditacion_id,
      actividad_id,
      operador_id,
      es_manual,
      motivo_manual,
    } = parsed.data;

    let usuarioId: string | null = null;
    let dniFinal: string | null = null;

    if (qr_token) {
      try {
        const payload = decryptQRPayload(qr_token);
        usuarioId = payload.u;
        dniFinal = payload.d;
      } catch (err: any) {
        res.status(400).json({
          error: 'ERR_INVALID_QR',
          message: 'El código QR escaneado es inválido, adulterado o no corresponde a esta plataforma.',
        });
        return;
      }
    } else if (dni_pasaporte) {
      dniFinal = dni_pasaporte;
    }

    const userRes = await query(
      `SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.foto_url,
              r.nombre AS rol,
              ei.codigo AS estado_codigo, ei.permite_ingreso
       FROM usuarios u
       JOIN roles r ON u.rol_principal_id = r.id
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       WHERE ${usuarioId ? 'u.id = $1' : 'u.dni_pasaporte = $1'}`,
      [usuarioId || dniFinal]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({
        error: 'ERR_USER_NOT_FOUND',
        message: 'No se encontró ningún participante registrado con los datos provistos.',
      });
      return;
    }

    const usuario = userRes.rows[0];
    usuarioId = usuario.id;

    if (!usuario.permite_ingreso || usuario.estado_codigo !== 'CONFIRMADO') {
      res.status(403).json({
        error: 'ERR_ACCESS_DENIED',
        message: `Acceso no autorizado. El participante se encuentra en estado "${usuario.estado_codigo}".`,
        usuario: {
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          dni_pasaporte: usuario.dni_pasaporte,
          foto_url: usuario.foto_url,
          rol: usuario.rol,
          estado: usuario.estado_codigo,
        },
      });
      return;
    }

    // Aforo en actividad si aplica
    if (actividad_id) {
      const actRes = await query(
        `SELECT a.id, a.nombre, a.cupo_maximo, a.activo,
                (SELECT COUNT(*)::int FROM acreditaciones ac WHERE ac.actividad_id = a.id) AS ocupacion_actual,
                EXISTS (
                  SELECT 1 FROM acreditaciones ac2 
                  WHERE ac2.usuario_id = $1 AND ac2.actividad_id = a.id
                ) AS ya_acreditado_en_actividad
         FROM actividades a
         WHERE a.id = $2`,
        [usuarioId, actividad_id]
      );

      if (actRes.rowCount === 0) {
        res.status(404).json({
          error: 'ERR_ACTIVIDAD_NOT_FOUND',
          message: 'La actividad seleccionada no existe en la agenda.',
        });
        return;
      }

      const act = actRes.rows[0];

      if (!act.activo) {
        res.status(400).json({
          error: 'ERR_ACTIVIDAD_INACTIVA',
          message: `La actividad "${act.nombre}" se encuentra suspendida o inactiva.`,
        });
        return;
      }

      if (!act.ya_acreditado_en_actividad && act.ocupacion_actual >= act.cupo_maximo) {
        res.status(409).json({
          error: 'ERR_ACTIVIDAD_FULL',
          message: `El cupo de la sala para "${act.nombre}" está colmado (Capacidad máxima: ${act.cupo_maximo} personas).`,
        });
        return;
      }

      if (act.ya_acreditado_en_actividad) {
        res.json({
          success: true,
          reingreso: true,
          message: `¡Reingreso verificado a "${act.nombre}"!`,
          usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            dni_pasaporte: usuario.dni_pasaporte,
            rol: usuario.rol,
          },
        });
        return;
      }
    }

    const operadorId = operador_id || 1;
    const tipoMovimiento = (parsed.data as any).tipo_movimiento || 'INGRESO';

    // Anti-Passback
    const movQuery = await query(
      `SELECT a.id, a.tipo_movimiento, a.timestamp_acreditacion, pa.nombre AS punto_nombre
       FROM acreditaciones a
       JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
       WHERE a.usuario_id = $1 AND COALESCE(a.actividad_id, 0) = COALESCE($2, 0)
       ORDER BY a.timestamp_acreditacion DESC
       LIMIT 1`,
      [usuarioId, actividad_id || 0]
    );
    const prevMov = movQuery.rows[0];

    if (tipoMovimiento === 'INGRESO' && prevMov && prevMov.tipo_movimiento === 'INGRESO') {
      const horaPrev = new Date(prevMov.timestamp_acreditacion).toLocaleTimeString('es-AR');
      const puntoPrev = prevMov.punto_nombre || 'otro punto';

      res.status(409).json({
        error: 'ERR_PASSBACK_VIOLATION',
        message: `Doble ingreso no permitido. Credencial ya acreditada a las ${horaPrev} en ${puntoPrev}.`,
        usuario: {
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          dni_pasaporte: usuario.dni_pasaporte,
          foto_url: usuario.foto_url,
          rol: usuario.rol,
        },
      });
      return;
    }

    if (tipoMovimiento === 'EGRESO' && (!prevMov || prevMov.tipo_movimiento === 'EGRESO')) {
      res.status(400).json({
        error: 'ERR_NOT_INSIDE',
        message: 'El participante no registra un ingreso activo previo para registrar su egreso.',
      });
      return;
    }

    const insertAcred = await query(
      `INSERT INTO acreditaciones (
        usuario_id, operador_id, tipo_acreditacion_id, actividad_id, punto_acceso_id, es_manual, motivo_manual, tipo_movimiento, timestamp_acreditacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, timestamp_acreditacion`,
      [
        usuarioId,
        operadorId,
        tipo_acreditacion_id,
        actividad_id || null,
        punto_acceso_id,
        es_manual,
        motivo_manual,
        tipoMovimiento,
      ]
    );

    res.json({
      success: true,
      acreditacion_id: insertAcred.rows[0]?.id,
      tipo_movimiento: tipoMovimiento,
      reingreso: Boolean(prevMov && prevMov.tipo_movimiento === 'EGRESO'),
      mensaje: tipoMovimiento === 'EGRESO' ? 'Egreso registrado con éxito' : 'Acreditación autorizada con éxito',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        dni_pasaporte: usuario.dni_pasaporte,
        rol: usuario.rol,
        foto_url: usuario.foto_url,
      },
      timestamp: insertAcred.rows[0]?.timestamp_acreditacion,
    });
  } catch (error: any) {
    console.error('Error en POST /api/operator/acreditar:', error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER', message: error.message });
  }
});

/**
 * POST /api/operator/acreditar-batch
 * Sincronización en lote para terminales offline (IndexedDB)
 */
router.post('/acreditar-batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = batchAcreditarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { acreditaciones } = parsed.data;
    let procesados = 0;
    let errores = 0;

    await withTransaction(async (client) => {
      for (const item of acreditaciones) {
        try {
          const payload = decryptQRPayload(item.qr_token);
          await client.query(
            `INSERT INTO acreditaciones (
              usuario_id, operador_id, tipo_acreditacion_id, actividad_id, punto_acceso_id, tipo_movimiento, timestamp_acreditacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              payload.u,
              item.operador_id || 1,
              item.tipo_acreditacion_id,
              item.actividad_id || null,
              item.punto_acceso_id,
              item.tipo_movimiento || 'INGRESO',
              new Date(item.timestamp),
            ]
          );
          procesados++;
        } catch (e) {
          errores++;
        }
      }
    });

    res.json({
      success: true,
      procesados,
      errores,
      mensaje: `Sincronización por lotes finalizada: ${procesados} acreditaciones procesadas.`,
    });
  } catch (error: any) {
    console.error('Error en POST /api/operator/acreditar-batch:', error);
    res.status(500).json({ error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/operator/walk-in
 * Alta rápida de mostrador para asistentes espontáneos in situ.
 */
router.post('/walk-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = walkInRegisterSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const {
      dni_pasaporte,
      nombre,
      apellido,
      email,
      celular,
      rol_principal_id,
      punto_acceso_id,
      evento_id,
    } = parsed.data;

    const targetEventoId = evento_id || 1;

    // Invocación a registrar_usuario_seguro con superadmin_override = true para asegurar confirmación in situ
    const regRes = await query(
      `SELECT new_id, estado_codigo FROM registrar_usuario_seguro($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dni_pasaporte,
        nombre,
        apellido,
        email,
        celular,
        rol_principal_id,
        null, // fotoUrl
        null, // fotoMetadata
        true, // override para ingreso in situ de mostrador
        targetEventoId,
      ]
    );

    if (!regRes.rows || regRes.rows.length === 0) {
      res.status(500).json({ error: 'ERR_DB_REGISTER_FAILED', message: 'No se pudo registrar al usuario en BD.' });
      return;
    }

    const usuarioId = regRes.rows[0].new_id;

    // Registrar inmediatamente la acreditación de ingreso en el punto de acceso
    await query(
      `INSERT INTO acreditaciones (
        usuario_id, operador_id, tipo_acreditacion_id, actividad_id, punto_acceso_id, es_manual, motivo_manual, tipo_movimiento, timestamp_acreditacion
      ) VALUES ($1, 1, 1, NULL, $2, TRUE, 'Acreditación Rápida de Mostrador (Walk-in)', 'INGRESO', NOW())`,
      [usuarioId, punto_acceso_id]
    );

    // Auditoría
    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
       VALUES ('ACREDITACION_WALK_IN', 'OPERADOR_MOSTRADOR', $1, $2, NOW())`,
      [
        usuarioId,
        JSON.stringify({
          dni_pasaporte,
          punto_acceso_id,
          modalidad: 'Walk-in Presencial',
        }),
      ]
    );

    const qrToken = encryptQRPayload({
      u: usuarioId,
      d: dni_pasaporte,
      t: Date.now(),
    });

    res.json({
      success: true,
      mensaje: `¡${nombre} ${apellido} registrado y acreditado en puerta exitosamente!`,
      usuario: {
        id: usuarioId,
        nombre,
        apellido,
        dni_pasaporte,
        email,
        rol_principal_id,
      },
      qr_token: qrToken,
    });
  } catch (error: any) {
    console.error('Error en /api/operator/walk-in:', error);
    res.status(500).json({ error: 'ERR_WALK_IN_FAILED', message: error.message });
  }
});

export default router;
