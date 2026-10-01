import { Router, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../lib/db';
import { encryptQRPayload } from '../../lib/cryptoQR';
import { sendWelcomeEmail, sendPromotionEmail, sendWaitlistEmail } from '../../lib/mailService';
import { sendPushNotificationToUser } from '../../lib/pushService';
import { usuarioManualCreateSchema, usuarioUpdateSchema, promoverSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

const router = Router();

const batchUsersSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1, 'Debe seleccionar al menos un usuario'),
    action: z.enum(['CANCELAR', 'CONFIRMAR', 'LISTA_ESPERA', 'SANCIONAR', 'ELIMINAR']).optional(),
    accion: z.enum(['CANCELAR', 'CONFIRMAR', 'LISTA_ESPERA', 'SANCIONAR', 'ELIMINAR']).optional(),
    motivo: z.string().optional(),
  })
  .refine((data) => data.action || data.accion, {
    message: "Debe especificar 'action' o 'accion'",
  });

/**
 * GET /api/admin/usuarios
 * Buscador multi-campo con filtros avanzados y paginación
 */
router.get('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const estado = req.query.estado as string;
    const rol = req.query.rol as string;
    const q = (req.query.q as string || req.query.search as string || '').trim();
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    const eventoIdParam = req.query.evento_id as string;
    if (eventoIdParam && eventoIdParam !== 'TODOS') {
      const evId = parseInt(eventoIdParam, 10);
      if (!isNaN(evId)) {
        conditions.push(`u.evento_id = $${pIdx++}`);
        params.push(evId);
      }
    }

    const actividadIdParam = req.query.actividad_id as string;
    if (actividadIdParam && actividadIdParam !== 'TODOS') {
      const actId = parseInt(actividadIdParam, 10);
      if (!isNaN(actId)) {
        conditions.push(
          `EXISTS (SELECT 1 FROM acreditaciones ac WHERE ac.usuario_id = u.id AND ac.actividad_id = $${pIdx++})`
        );
        params.push(actId);
      }
    }

    const puntoAccesoIdParam = req.query.punto_acceso_id as string;
    if (puntoAccesoIdParam && puntoAccesoIdParam !== 'TODOS') {
      const paId = parseInt(puntoAccesoIdParam, 10);
      if (!isNaN(paId)) {
        conditions.push(
          `EXISTS (SELECT 1 FROM acreditaciones ac WHERE ac.usuario_id = u.id AND ac.punto_acceso_id = $${pIdx++})`
        );
        params.push(paId);
      }
    }

    if (estado && estado !== 'TODOS') {
      conditions.push(`ei.codigo = $${pIdx++}`);
      params.push(estado.toUpperCase());
    }
    if (rol && rol !== 'TODOS') {
      const isNumeric = /^\d+$/.test(rol);
      if (isNumeric) {
        const rolId = parseInt(rol, 10);
        conditions.push(
          `(u.rol_principal_id = $${pIdx} OR EXISTS (SELECT 1 FROM usuario_roles_adicionales ura WHERE ura.usuario_id = u.id AND ura.rol_id = $${pIdx}))`
        );
        params.push(rolId);
        pIdx++;
      } else {
        conditions.push(
          `(r.nombre ILIKE $${pIdx} OR EXISTS (SELECT 1 FROM usuario_roles_adicionales ura JOIN roles r2 ON r2.id = ura.rol_id WHERE ura.usuario_id = u.id AND r2.nombre ILIKE $${pIdx}))`
        );
        params.push(rol);
        pIdx++;
      }
    }
    if (q) {
      conditions.push(
        `(u.dni_pasaporte ILIKE $${pIdx} OR u.nombre ILIKE $${pIdx} OR u.apellido ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`
      );
      params.push(`%${q}%`);
      pIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(*) as total
       FROM usuarios u
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       JOIN roles r ON u.rol_principal_id = r.id
       WHERE ${whereClause}`,
      params
    );
    const totalRegistros = parseInt(countRes.rows[0].total, 10);

    const usersRes = await query(
      `SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.email, u.celular,
              u.creado_en, u.actualizado_en, u.foto_url, u.evento_id,
              r.id as rol_id, r.id as rol_principal_id, r.nombre as rol_nombre,
              ei.id as estado_id, u.estado_inscripcion_id,
              ei.codigo as estado_codigo, ei.nombre as estado_nombre, ei.permite_ingreso,
              (SELECT COUNT(*) FROM acreditaciones a WHERE a.usuario_id = u.id AND a.tipo_movimiento = 'INGRESO') as ingresos_totales,
              COALESCE(he.estado_homologacion, 'NO_REQUERIDO') as homologacion_estado,
              COALESCE((
                SELECT string_agg(r2.nombre, ', ')
                FROM usuario_roles_adicionales ura
                JOIN roles r2 ON r2.id = ura.rol_id
                WHERE ura.usuario_id = u.id
              ), '') as roles_adicionales
       FROM usuarios u
       JOIN roles r ON u.rol_principal_id = r.id
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       LEFT JOIN homologaciones_expositores he ON he.usuario_id = u.id
       WHERE ${whereClause}
       ORDER BY u.creado_en DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    res.json({
      ok: true,
      total_registros: totalRegistros,
      pagina_actual: page,
      limite: limit,
      total_paginas: Math.ceil(totalRegistros / limit),
      usuarios: usersRes.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/usuarios:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/usuarios/:id
 * Detalle completo de un usuario
 */
router.get('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const userRes = await query(
      `SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.email, u.celular,
              u.creado_en, u.actualizado_en, u.foto_url, u.evento_id,
              r.id as rol_id, r.id as rol_principal_id, r.nombre as rol_nombre,
              ei.id as estado_id, u.estado_inscripcion_id,
              ei.codigo as estado_codigo, ei.nombre as estado_nombre, ei.permite_ingreso,
              COALESCE(he.estado_homologacion, 'NO_REQUERIDO') as homologacion_estado,
              c.codigo_verificacion as certificado_codigo
       FROM usuarios u
       JOIN roles r ON u.rol_principal_id = r.id
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       LEFT JOIN homologaciones_expositores he ON he.usuario_id = u.id
       LEFT JOIN certificados c ON c.usuario_id = u.id
       WHERE u.id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'ERR_USER_NOT_FOUND', message: 'Usuario no encontrado' });
      return;
    }

    const [rolesAdicionalesRes, acreditacionesRes] = await Promise.all([
      query(
        `SELECT r.id, r.nombre 
         FROM usuario_roles_adicionales ura 
         JOIN roles r ON r.id = ura.rol_id 
         WHERE ura.usuario_id = $1`,
        [id]
      ),
      query(
        `SELECT a.id, a.timestamp_acreditacion, a.tipo_movimiento, a.es_manual,
                p.nombre as punto_acceso, t.descripcion as tipo_acreditacion,
                op.nombre as operador_nombre
         FROM acreditaciones a
         JOIN puntos_acceso p ON a.punto_acceso_id = p.id
         JOIN tipos_acreditacion t ON a.tipo_acreditacion_id = t.id
         LEFT JOIN operadores op ON a.operador_id = op.id
         WHERE a.usuario_id = $1
         ORDER BY a.timestamp_acreditacion DESC`,
        [id]
      ),
    ]);

    res.json({
      ok: true,
      usuario: {
        ...userRes.rows[0],
        roles_adicionales: rolesAdicionalesRes.rows,
        historial_acreditaciones: acreditacionesRes.rows,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/usuarios/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/usuarios
 * Alta manual de inscripto por el administrador
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = usuarioManualCreateSchema.safeParse(req.body);
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
      rol_id,
      roles_adicionales_ids,
      estado_id,
      estado_codigo,
      estado,
      es_superadmin_override,
      superadmin_override,
      motivo_override,
      foto_url,
    } = parsed.data;

    const finalRolId = rol_principal_id || rol_id || 1;
    const finalOverride = Boolean(es_superadmin_override || superadmin_override);
    const targetEventoId = (req.body as any).evento_id || 1;

    // Validación de negocio: Solo 'Estudiante' (id: 1) admite Lista de espera, Baja Automática y Sancionados
    const ESTADOS_EXCLUSIVOS_ESTUDIANTE = ['LISTA_ESPERA', 'BAJA_AUTOMATICA', 'SANCIONADO'];
    const ESTADOS_EXCLUSIVOS_IDS = [2, 3, 5]; // id 2: LISTA_ESPERA, 3: BAJA_AUTOMATICA, 5: SANCIONADO
    const isEstudiante = Number(finalRolId) === 1;

    if (!isEstudiante) {
      if (estado_id && ESTADOS_EXCLUSIVOS_IDS.includes(Number(estado_id))) {
        res.status(400).json({
          ok: false,
          error: 'ERR_ROLE_RESTRICTION',
          message: 'Los estados "Lista de espera", "Baja Automática 48hs" y "Sancionados" solo aplican a participantes con rol "Estudiante".',
        });
        return;
      }
      const cod = (estado_codigo || estado || '').toUpperCase();
      if (cod && ESTADOS_EXCLUSIVOS_ESTUDIANTE.includes(cod)) {
        res.status(400).json({
          ok: false,
          error: 'ERR_ROLE_RESTRICTION',
          message: 'Los estados "Lista de espera", "Baja Automática 48hs" y "Sancionados" solo aplican a participantes con rol "Estudiante".',
        });
        return;
      }
    }

    const result = await withTransaction(async (client) => {
      // 1. Invocar función PL/pgSQL
      const regRes = await client.query(
        `SELECT new_id, estado_codigo FROM registrar_usuario_seguro($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          dni_pasaporte,
          nombre,
          apellido,
          email,
          celular,
          finalRolId,
          foto_url || null,
          null,
          finalOverride,
          targetEventoId,
        ]
      );

      const newId = regRes.rows[0].new_id;
      let finalEstado = regRes.rows[0].estado_codigo;

      // 2. Si se solicitó un estado específico diferente, resolver y actualizar
      let targetEstadoRes: any = null;
      if (estado_id !== undefined && estado_id !== null) {
        targetEstadoRes = await client.query(`SELECT id, codigo FROM estados_inscripcion WHERE id = $1`, [estado_id]);
      } else if (estado_codigo || estado) {
        const cod = (estado_codigo || estado)!.toUpperCase();
        targetEstadoRes = await client.query(`SELECT id, codigo FROM estados_inscripcion WHERE codigo = $1`, [cod]);
      }

      if (targetEstadoRes && targetEstadoRes.rows.length > 0) {
        const targetEstado = targetEstadoRes.rows[0];
        if (targetEstado.codigo !== finalEstado) {
          await client.query(
            `UPDATE usuarios SET estado_inscripcion_id = $1 WHERE id = $2`,
            [targetEstado.id, newId]
          );
          finalEstado = targetEstado.codigo;
        }
      }

      // 3. Roles adicionales
      if (roles_adicionales_ids && roles_adicionales_ids.length > 0) {
        for (const rId of roles_adicionales_ids) {
          await client.query(
            `INSERT INTO usuario_roles_adicionales (usuario_id, rol_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newId, rId]
          );
        }
      }

      // 4. Auditoría
      await client.query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
         VALUES ('ALTA_USUARIO_ADMIN', $1, $2, $3, NOW())`,
        [
          req.operator?.email || 'ADMIN',
          newId,
          JSON.stringify({ dni_pasaporte, estado: finalEstado, override: finalOverride, motivo: motivo_override }),
        ]
      );

      return { newId, finalEstado };
    });

    const qrToken = encryptQRPayload({
      u: result.newId,
      d: dni_pasaporte,
      t: Date.now(),
    });

    res.status(201).json({
      ok: true,
      mensaje: 'Usuario registrado exitosamente en el sistema.',
      usuario: {
        id: result.newId,
        dni_pasaporte,
        nombre,
        apellido,
        email,
        estado_codigo: result.finalEstado,
      },
      qr_token: qrToken,
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/usuarios:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/usuarios/:id
 * Edición de datos personales, rol o estado del inscripto
 */
router.put('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = usuarioUpdateSchema.safeParse({ ...req.body, id });

    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const {
      nombre,
      apellido,
      email,
      celular,
      rol_principal_id,
      rol_id,
      roles_adicionales_ids,
      estado_id,
      estado_codigo,
      estado,
      motivo_cambio,
    } = parsed.data;

    await withTransaction(async (client) => {
      const uRes = await client.query(
        `SELECT id, dni_pasaporte, estado_inscripcion_id, rol_principal_id FROM usuarios WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (uRes.rowCount === 0) {
        throw new Error('Usuario no encontrado');
      }

      const updates: string[] = ['actualizado_en = NOW()'];
      const params: any[] = [id];
      let pIdx = 2;

      if (nombre !== undefined && nombre !== null) {
        updates.push(`nombre = $${pIdx++}`);
        params.push(nombre);
      }
      if (apellido !== undefined && apellido !== null) {
        updates.push(`apellido = $${pIdx++}`);
        params.push(apellido);
      }
      if (email !== undefined && email !== null) {
        updates.push(`email = $${pIdx++}`);
        params.push(email);
      }
      if (celular !== undefined && celular !== null) {
        updates.push(`celular = $${pIdx++}`);
        params.push(celular);
      }

      const finalRolId = rol_principal_id || rol_id;
      if (finalRolId !== undefined && finalRolId !== null) {
        updates.push(`rol_principal_id = $${pIdx++}`);
        params.push(finalRolId);
      }

      // Resolver nuevo estado de inscripción
      let nuevoEstadoId: number | null = null;
      let nuevoEstadoCodigo: string | null = null;

      if (estado_id !== undefined && estado_id !== null) {
        const estRes = await client.query(`SELECT id, codigo FROM estados_inscripcion WHERE id = $1`, [estado_id]);
        if (estRes.rows.length > 0) {
          nuevoEstadoId = estRes.rows[0].id;
          nuevoEstadoCodigo = estRes.rows[0].codigo;
        }
      } else if (estado_codigo || estado) {
        const cod = (estado_codigo || estado)!.toUpperCase();
        const estRes = await client.query(`SELECT id, codigo FROM estados_inscripcion WHERE codigo = $1`, [cod]);
        if (estRes.rows.length > 0) {
          nuevoEstadoId = estRes.rows[0].id;
          nuevoEstadoCodigo = estRes.rows[0].codigo;
        }
      }

      const effectiveRolId = finalRolId !== undefined && finalRolId !== null ? finalRolId : uRes.rows[0].rol_principal_id;
      const isEstudiante = Number(effectiveRolId) === 1;
      const ESTADOS_EXCLUSIVOS_ESTUDIANTE = ['LISTA_ESPERA', 'BAJA_AUTOMATICA', 'SANCIONADO'];

      if (nuevoEstadoCodigo && ESTADOS_EXCLUSIVOS_ESTUDIANTE.includes(nuevoEstadoCodigo) && !isEstudiante) {
        throw new Error('Los estados "Lista de espera", "Baja Automática 48hs" y "Sancionados" solo aplican a participantes con rol "Estudiante".');
      }

      if (nuevoEstadoId !== null) {
        updates.push(`estado_inscripcion_id = $${pIdx++}`);
        params.push(nuevoEstadoId);
      }

      await client.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = $1`, params);

      if (roles_adicionales_ids !== undefined && roles_adicionales_ids !== null) {
        await client.query(`DELETE FROM usuario_roles_adicionales WHERE usuario_id = $1`, [id]);
        for (const rId of roles_adicionales_ids) {
          await client.query(`INSERT INTO usuario_roles_adicionales (usuario_id, rol_id) VALUES ($1, $2)`, [id, rId]);
        }
      }

      await client.query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
         VALUES ('EDICION_USUARIO_ADMIN', $1, $2, $3, NOW())`,
        [
          req.operator?.email || 'ADMIN',
          id,
          JSON.stringify({
            motivo: motivo_cambio || 'Modificación de perfil',
            campos: req.body,
            estado_anterior_id: uRes.rows[0].estado_inscripcion_id,
            nuevo_estado_id: nuevoEstadoId,
            nuevo_estado_codigo: nuevoEstadoCodigo,
          }),
        ]
      );
    });

    res.json({ ok: true, mensaje: 'Usuario actualizado correctamente.' });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/usuarios/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * DELETE /api/admin/usuarios/:id
 * Baja definitiva o anulación de usuario
 */
router.delete('/:id', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const motivo = (req.query.motivo as string) || 'Baja administrativa directa';

    await withTransaction(async (client) => {
      const uRes = await client.query(`SELECT id, dni_pasaporte, nombre, apellido FROM usuarios WHERE id = $1`, [id]);
      if (uRes.rowCount === 0) {
        throw new Error('Usuario no encontrado');
      }

      const u = uRes.rows[0];

      await client.query(`DELETE FROM acreditaciones WHERE usuario_id = $1`, [id]);
      await client.query(`DELETE FROM usuario_roles_adicionales WHERE usuario_id = $1`, [id]);
      await client.query(`DELETE FROM certificados WHERE usuario_id = $1`, [id]);
      await client.query(`DELETE FROM homologaciones_expositores WHERE usuario_id = $1`, [id]);
      await client.query(`DELETE FROM usuarios WHERE id = $1`, [id]);

      await client.query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
         VALUES ('BAJA_USUARIO_ADMIN', $1, $2, NOW())`,
        [
          req.operator?.email || 'SUPERADMIN',
          JSON.stringify({ usuario_id: id, dni: u.dni_pasaporte, nombre: `${u.nombre} ${u.apellido}`, motivo }),
        ]
      );
    });

    res.json({ ok: true, mensaje: 'Usuario eliminado exitosamente del sistema.' });
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/usuarios/:id:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/usuarios/batch
 * Operaciones masivas sobre inscriptos
 */
router.post('/batch', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = batchUsersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { ids } = parsed.data;
    const action = (parsed.data.action || parsed.data.accion)!;
    const motivo = parsed.data.motivo || `Operación en lote (${action}) por ${req.operator?.email || 'ADMIN'}`;

    if (action === 'ELIMINAR') {
      const deleteSql = `DELETE FROM usuarios WHERE id = ANY($1::uuid[]) RETURNING id`;
      const resDel = await query(deleteSql, [ids]);

      await query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
         VALUES ('USUARIOS_BATCH_ELIMINADOS', $1, $2, NOW())`,
        [req.operator?.email || 'ADMIN', JSON.stringify({ count: resDel.rowCount, ids, motivo })]
      );

      res.json({
        ok: true,
        success: true,
        action,
        processed: resDel.rowCount,
        message: `${resDel.rowCount} usuarios eliminados correctamente`,
      });
      return;
    }

    let nuevoEstadoCodigo = 'CONFIRMADO';
    if (action === 'CANCELAR') nuevoEstadoCodigo = 'CANCELADO';
    else if (action === 'LISTA_ESPERA') nuevoEstadoCodigo = 'LISTA_ESPERA';
    else if (action === 'SANCIONAR') nuevoEstadoCodigo = 'SANCIONADO';

    if (action === 'LISTA_ESPERA' || action === 'SANCIONAR') {
      const nonEstudiantes = await query(
        `SELECT u.id, u.nombre, u.apellido, r.nombre AS rol_nombre
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_principal_id
         WHERE u.id = ANY($1::uuid[]) AND u.rol_principal_id != 1`,
        [ids]
      );

      if (nonEstudiantes.rows.length > 0) {
        const nombres = nonEstudiantes.rows.map((r: any) => `${r.nombre} ${r.apellido} (${r.rol_nombre})`).slice(0, 3).join(', ');
        res.status(400).json({
          ok: false,
          error: 'ERR_ROLE_RESTRICTION',
          message: `Los estados "Lista de espera" y "Sancionados" solo aplican a participantes con rol "Estudiante". Participantes no válidos: ${nombres}${nonEstudiantes.rows.length > 3 ? '...' : ''}`,
        });
        return;
      }
    }

    const estadoRes = await query(`SELECT id FROM estados_inscripcion WHERE codigo = $1`, [nuevoEstadoCodigo]);
    if (estadoRes.rowCount === 0) {
      res.status(500).json({ error: 'Estado no configurado' });
      return;
    }
    const nuevoEstadoId = estadoRes.rows[0].id;

    if (action === 'SANCIONAR') {
      const usersDniRes = await query(`SELECT dni_pasaporte FROM usuarios WHERE id = ANY($1::uuid[])`, [ids]);
      for (const row of usersDniRes.rows) {
        await query(
          `INSERT INTO blacklist (dni_pasaporte, motivo, activo)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (dni_pasaporte) DO UPDATE SET motivo = $2, activo = TRUE`,
          [row.dni_pasaporte, motivo]
        );
      }
    }

    const resUpd = await query(
      `UPDATE usuarios 
       SET estado_inscripcion_id = $1, actualizado_en = NOW()
       WHERE id = ANY($2::uuid[])
       RETURNING id`,
      [nuevoEstadoId, ids]
    );

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('USUARIOS_BATCH_ESTADO', $1, $2, NOW())`,
      [
        req.operator?.email || 'ADMIN',
        JSON.stringify({ action, nuevoEstado: nuevoEstadoCodigo, count: resUpd.rowCount, ids, motivo }),
      ]
    );

    res.json({
      ok: true,
      success: true,
      action,
      nuevoEstado: nuevoEstadoCodigo,
      processed: resUpd.rowCount,
      message: `Se actualizaron ${resUpd.rowCount} usuarios al estado ${nuevoEstadoCodigo}`,
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/usuarios/batch:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/usuarios/promover
 * Promoción manual individual de aspirante en lista de espera
 */
router.post('/promover', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = promoverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { usuario_id, motivo } = parsed.data;

    await withTransaction(async (client) => {
      const uRes = await client.query(
        `SELECT u.id, u.email, u.nombre, u.apellido, ei.codigo as estado_codigo 
         FROM usuarios u
         JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
         WHERE u.id = $1
         FOR UPDATE`,
        [usuario_id]
      );

      if (uRes.rowCount === 0) {
        throw new Error('Usuario no localizado');
      }

      const confEstado = await client.query(
        `SELECT id FROM estados_inscripcion WHERE codigo = 'CONFIRMADO' LIMIT 1`
      );

      await client.query(
        `UPDATE usuarios 
         SET estado_inscripcion_id = $1, actualizado_en = NOW()
         WHERE id = $2`,
        [confEstado.rows[0].id, usuario_id]
      );

      await client.query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
         VALUES ('PROMOCION_MANUAL', $1, $2, $3, NOW())`,
        [
          req.operator?.email || 'ADMIN',
          usuario_id,
          JSON.stringify({ motivo: motivo || 'Promoción manual autorizada' }),
        ]
      );

      // Despachar correo y push de notificación de promoción
      const uData = uRes.rows[0];
      sendPromotionEmail({
        to: uData.email,
        nombre: uData.nombre,
        apellido: uData.apellido,
        dni: uData.dni_pasaporte || '',
      }).catch((err) => console.error('Error enviando correo de promoción manual:', err));

      sendPushNotificationToUser(usuario_id, {
        title: '🎉 ¡Vacante Confirmada en el Congreso ETS 2026!',
        body: 'Has sido promovido desde la lista de espera. Tu credencial oficial ya se encuentra disponible.',
        url: '/mi-credencial',
      }).catch((err) => console.error('Error enviando push de promoción manual:', err));
    });

    res.json({
      ok: true,
      mensaje: 'El aspirante ha sido promovido exitosamente a estado CONFIRMADO.',
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/usuarios/promover:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/usuarios/:id/reenviar-credencial
 * Reenvía la credencial oficial y código QR al correo del participante
 */
router.post('/:id/reenviar-credencial', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const uRes = await query(
      `SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.email, 
              r.nombre as rol_nombre, ei.codigo as estado_codigo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_principal_id
       JOIN estados_inscripcion ei ON ei.id = u.estado_inscripcion_id
       WHERE u.id::text = $1 OR u.dni_pasaporte = $1
       LIMIT 1`,
      [id]
    );

    if (uRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'ERR_NOT_FOUND', message: 'Participante no encontrado' });
      return;
    }

    const u = uRes.rows[0];

    if (u.estado_codigo === 'CONFIRMADO') {
      const sendRes = await sendWelcomeEmail({
        to: u.email,
        nombre: u.nombre,
        apellido: u.apellido,
        dni: u.dni_pasaporte,
        rol: u.rol_nombre,
        estado: 'CONFIRMADO',
      });

      if (!sendRes.success) {
        res.status(502).json({
          ok: false,
          error: 'ERR_MAIL_DELIVERY_FAILED',
          message: `No se pudo entregar el correo a ${u.email}: ${sendRes.error}`,
          error_detalle: sendRes.error,
        });
        return;
      }

      await query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
         VALUES ('REENVIO_CREDENCIAL_MAIL', $1, $2, $3, NOW())`,
        [req.operator?.email || 'ADMIN', u.id, JSON.stringify({ usuario_id: u.id, email: u.email, messageId: sendRes.messageId })]
      ).catch(() => {});

      res.json({
        ok: true,
        mensaje: `Credencial y código QR reenviados con éxito a ${u.email}`,
        simulado: sendRes.simulated,
        messageId: sendRes.messageId,
      });
    } else if (u.estado_codigo === 'LISTA_ESPERA') {
      const sendRes = await sendWaitlistEmail({
        to: u.email,
        nombre: u.nombre,
        apellido: u.apellido,
        dni: u.dni_pasaporte,
      });

      if (!sendRes.success) {
        res.status(502).json({
          ok: false,
          error: 'ERR_MAIL_DELIVERY_FAILED',
          message: `No se pudo entregar la constancia a ${u.email}: ${sendRes.error}`,
          error_detalle: sendRes.error,
        });
        return;
      }

      await query(
        `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
         VALUES ('REENVIO_ESPERA_MAIL', $1, $2, $3, NOW())`,
        [req.operator?.email || 'ADMIN', u.id, JSON.stringify({ usuario_id: u.id, email: u.email, messageId: sendRes.messageId })]
      ).catch(() => {});

      res.json({
        ok: true,
        mensaje: `Constancia de Lista de Espera reenviada con éxito a ${u.email}`,
        simulado: sendRes.simulated,
        messageId: sendRes.messageId,
      });
    } else {
      res.status(400).json({
        ok: false,
        error: 'ERR_ESTADO_INVALIDO',
        message: `No se puede emitir credencial activa para un usuario en estado ${u.estado_codigo}`,
      });
    }
  } catch (error: any) {
    console.error('Error reenviando credencial:', error);
    res.status(500).json({ ok: false, error: 'ERR_REENVIO_CREDENCIAL', message: error.message });
  }
});

export default router;
