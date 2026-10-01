import { Router, Request, Response } from 'express';
import { query, getClient } from '../lib/db';
import { z } from 'zod';
import { requireHierarchy, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

const respuestaDetalleSchema = z.object({
  pregunta_id: z.number().int().positive(),
  valor_numerico: z.number().int().min(1).max(5).optional(),
  respuesta_texto: z.string().max(2000).optional(),
  opcion_id: z.number().int().positive().optional(),
});

const encuestaResponderSchema = z.object({
  encuesta_id: z.number().int().positive(),
  usuario_id: z.string().uuid(),
  respuestas: z.array(respuestaDetalleSchema).min(1),
});

/**
 * GET /api/encuestas/activa
 * Obtiene la encuesta institucional activa con sus preguntas
 */
router.get('/activa', async (_req: Request, res: Response): Promise<void> => {
  try {
    const encuestaRes = await query(
      `SELECT id, titulo, descripcion, etapa, es_obligatoria
       FROM encuestas
       WHERE activa = TRUE
       ORDER BY (CASE WHEN etapa = 'POST_EVENTO' THEN 1 WHEN etapa = 'ACREDITACION' THEN 2 ELSE 3 END), id DESC
       LIMIT 1`
    );

    if (encuestaRes.rows.length === 0) {
      res.json({ ok: true, encuesta: null });
      return;
    }

    const encuesta = encuestaRes.rows[0];

    const preguntasRes = await query(
      `SELECT id, orden, texto_pregunta, tipo_pregunta, es_obligatoria, peso_ponderacion
       FROM encuesta_preguntas
       WHERE encuesta_id = $1 AND activo = TRUE
       ORDER BY orden ASC, id ASC`,
      [encuesta.id]
    );

    res.json({
      ok: true,
      encuesta: {
        ...encuesta,
        preguntas: preguntasRes.rows,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/encuestas/activa:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/encuestas/estado/:usuarioId
 * Comprueba si el usuario completó la encuesta obligatoria
 */
router.get('/estado/:usuarioId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { usuarioId } = req.params;

    // Buscar encuesta activa obligatoria
    const encActiva = await query(
      `SELECT id, es_obligatoria FROM encuestas WHERE activa = TRUE AND es_obligatoria = TRUE LIMIT 1`
    );

    if (encActiva.rows.length === 0) {
      // Si no hay encuesta obligatoria activa, no bloquea
      res.json({ ok: true, completada: true, requerida: false });
      return;
    }

    const encuestaId = encActiva.rows[0].id;

    const respCheck = await query(
      `SELECT id, creado_en FROM encuesta_respuestas 
       WHERE encuesta_id = $1 AND usuario_id = $2`,
      [encuestaId, usuarioId]
    );

    const completada = respCheck.rows.length > 0;

    res.json({
      ok: true,
      encuesta_id: encuestaId,
      requerida: true,
      completada,
      fecha_completada: completada ? respCheck.rows[0].creado_en : null,
    });
  } catch (error: any) {
    console.error('Error en GET /api/encuestas/estado/:usuarioId:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/encuestas/responder
 * Registra las respuestas del participante con transacción atómica
 */
router.post('/responder', async (req: Request, res: Response): Promise<void> => {
  const client = await getClient();
  try {
    const parsed = encuestaResponderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { encuesta_id, usuario_id, respuestas } = parsed.data;

    // Verificar que el usuario exista
    const userRes = await client.query(`SELECT id, rol_principal_id, nombre, apellido FROM usuarios WHERE id = $1`, [usuario_id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'ERR_USER_NOT_FOUND', message: 'Usuario no encontrado' });
      return;
    }
    const user = userRes.rows[0];

    await client.query('BEGIN');

    // Registrar cabecera de respuesta
    const respHead = await client.query(
      `INSERT INTO encuesta_respuestas (encuesta_id, usuario_id, rol_id, ip_origen)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (encuesta_id, usuario_id) DO UPDATE 
       SET creado_en = NOW()
       RETURNING id`,
      [encuesta_id, usuario_id, user.rol_principal_id, req.ip || '127.0.0.1']
    );

    const respuestaId = respHead.rows[0].id;

    // Limpiar respuestas anteriores si se reintenta
    await client.query(`DELETE FROM encuesta_respuestas_detalles WHERE respuesta_id = $1`, [respuestaId]);

    // Insertar detalles
    for (const r of respuestas) {
      await client.query(
        `INSERT INTO encuesta_respuestas_detalles (respuesta_id, pregunta_id, opcion_id, valor_numerico, respuesta_texto)
         VALUES ($1, $2, $3, $4, $5)`,
        [respuestaId, r.pregunta_id, r.opcion_id || null, r.valor_numerico || null, r.respuesta_texto || null]
      );
    }

    // Auditoría
    await client.query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
       VALUES ('ENCUESTA_SATISFACCION_COMPLETADA', $1, $2, $3, NOW())`,
      [
        `${user.nombre} ${user.apellido}`,
        usuario_id,
        JSON.stringify({ encuesta_id, total_respuestas: respuestas.length }),
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      mensaje: '¡Muchas gracias por su evaluación! Su Certificado Oficial ha sido desbloqueado.',
      respuesta_id: respuestaId,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error en POST /api/encuestas/responder:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/encuestas/metricas (y /api/admin/encuestas/metricas)
 * Retorna las métricas cuantitativas y cualitativas para el panel directivo
 */
router.get('/metricas', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 1. Total de respuestas y promedios globales
    const resumenRes = await query(`
      SELECT 
        COUNT(DISTINCT er.id)::int as total_encuestas,
        ROUND(AVG(erd.valor_numerico), 2) as promedio_general
      FROM encuesta_respuestas er
      JOIN encuesta_respuestas_detalles erd ON er.id = erd.respuesta_id
      WHERE erd.valor_numerico IS NOT NULL
    `);

    // 2. Desglose por pregunta
    const preguntasMetricasRes = await query(`
      SELECT 
        ep.id,
        ep.orden,
        ep.texto_pregunta,
        ep.tipo_pregunta,
        ROUND(AVG(erd.valor_numerico), 2) as promedio,
        COUNT(erd.id)::int as total_votos,
        COUNT(CASE WHEN erd.valor_numerico = 5 THEN 1 END)::int as estrellas_5,
        COUNT(CASE WHEN erd.valor_numerico = 4 THEN 1 END)::int as estrellas_4,
        COUNT(CASE WHEN erd.valor_numerico = 3 THEN 1 END)::int as estrellas_3,
        COUNT(CASE WHEN erd.valor_numerico = 2 THEN 1 END)::int as estrellas_2,
        COUNT(CASE WHEN erd.valor_numerico = 1 THEN 1 END)::int as estrellas_1
      FROM encuesta_preguntas ep
      LEFT JOIN encuesta_respuestas_detalles erd ON ep.id = erd.pregunta_id
      WHERE ep.activo = TRUE
      GROUP BY ep.id, ep.orden, ep.texto_pregunta, ep.tipo_pregunta
      ORDER BY ep.orden ASC
    `);

    // 3. Comentarios y sugerencias abiertas
    const comentariosRes = await query(`
      SELECT 
        erd.id,
        erd.respuesta_texto,
        er.creado_en,
        r.nombre as rol_nombre
      FROM encuesta_respuestas_detalles erd
      JOIN encuesta_respuestas er ON erd.respuesta_id = er.id
      LEFT JOIN roles r ON er.rol_id = r.id
      WHERE erd.respuesta_texto IS NOT NULL AND TRIM(erd.respuesta_texto) != ''
      ORDER BY er.creado_en DESC
      LIMIT 100
    `);

    res.json({
      ok: true,
      resumen: resumenRes.rows[0] || { total_encuestas: 0, promedio_general: 0 },
      preguntas: preguntasMetricasRes.rows,
      comentarios: comentariosRes.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/encuestas/metricas:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

// =========================================================================
// CRUD ADMINISTRATIVO DE ENCUESTAS Y PREGUNTAS
// =========================================================================

/**
 * GET /api/encuestas (y /api/admin/encuestas)
 * Lista todas las encuestas institucionales con sus preguntas y conteo de respuestas
 */
router.get('/', requireHierarchy(3), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const encuestasRes = await query(`
      SELECT 
        e.id, e.titulo, e.descripcion, e.etapa, e.es_obligatoria, e.activa,
        e.evento_id, e.creado_en,
        (SELECT COUNT(*)::int FROM encuesta_preguntas ep WHERE ep.encuesta_id = e.id AND ep.activo = TRUE) as total_preguntas,
        (SELECT COUNT(*)::int FROM encuesta_respuestas er WHERE er.encuesta_id = e.id) as total_respuestas
      FROM encuestas e
      ORDER BY e.id DESC
    `);

    // Para cada encuesta, adjuntar sus preguntas
    const preguntasRes = await query(`
      SELECT id, encuesta_id, orden, texto_pregunta, tipo_pregunta, es_obligatoria, peso_ponderacion, activo
      FROM encuesta_preguntas
      WHERE activo = TRUE
      ORDER BY orden ASC, id ASC
    `);

    const preguntasPorEncuesta: Record<number, any[]> = {};
    for (const p of preguntasRes.rows) {
      if (!preguntasPorEncuesta[p.encuesta_id]) preguntasPorEncuesta[p.encuesta_id] = [];
      preguntasPorEncuesta[p.encuesta_id].push(p);
    }

    const data = encuestasRes.rows.map((e) => ({
      ...e,
      preguntas: preguntasPorEncuesta[e.id] || [],
    }));

    res.json({ ok: true, encuestas: data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'ERR_LIST_SURVEYS', message: error.message });
  }
});

/**
 * POST /api/encuestas
 * Crea una nueva encuesta institucional
 */
router.post('/', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { titulo, descripcion, etapa, es_obligatoria, activa, evento_id } = req.body;
    if (!titulo || !etapa) {
      res.status(400).json({ ok: false, message: 'Título y Etapa son requeridos.' });
      return;
    }

    const ins = await query(
      `INSERT INTO encuestas (titulo, descripcion, etapa, es_obligatoria, activa, evento_id, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, titulo, descripcion, etapa, es_obligatoria, activa, evento_id`,
      [
        titulo.trim(),
        descripcion ? descripcion.trim() : null,
        etapa,
        es_obligatoria === true || es_obligatoria === 'true',
        activa === true || activa === 'true',
        evento_id ? parseInt(evento_id, 10) : 1,
      ]
    );

    res.status(201).json({ ok: true, mensaje: 'Encuesta creada correctamente.', encuesta: ins.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'ERR_CREATE_SURVEY', message: error.message });
  }
});

/**
 * PUT /api/encuestas/:id
 * Actualiza una encuesta existente
 */
router.put('/:id', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { titulo, descripcion, etapa, es_obligatoria, activa } = req.body;

    const upd = await query(
      `UPDATE encuestas
       SET titulo = COALESCE($1, titulo),
           descripcion = COALESCE($2, descripcion),
           etapa = COALESCE($3, etapa),
           es_obligatoria = COALESCE($4, es_obligatoria),
           activa = COALESCE($5, activa),
           actualizado_en = NOW()
       WHERE id = $6
       RETURNING id, titulo, descripcion, etapa, es_obligatoria, activa`,
      [titulo, descripcion, etapa, es_obligatoria, activa, id]
    );

    if (upd.rowCount === 0) {
      res.status(404).json({ ok: false, message: 'Encuesta no encontrada.' });
      return;
    }

    res.json({ ok: true, mensaje: 'Encuesta actualizada con éxito.', encuesta: upd.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'ERR_UPDATE_SURVEY', message: error.message });
  }
});

/**
 * DELETE /api/encuestas/:id
 * Desactiva o elimina una encuesta
 */
router.delete('/:id', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    // Ver si tiene respuestas registradas
    const respCount = await query(`SELECT COUNT(*)::int as c FROM encuesta_respuestas WHERE encuesta_id = $1`, [id]);
    if (respCount.rows[0].c > 0) {
      // Soft-delete (desactivar) para preservar integridad referencial de respuestas ya dadas
      await query(`UPDATE encuestas SET activa = FALSE WHERE id = $1`, [id]);
      res.json({ ok: true, mensaje: 'La encuesta tiene respuestas asociadas, fue desactivada.' });
      return;
    }

    await query(`DELETE FROM encuesta_preguntas WHERE encuesta_id = $1`, [id]);
    await query(`DELETE FROM encuestas WHERE id = $1`, [id]);
    res.json({ ok: true, mensaje: 'Encuesta eliminada correctamente.' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'ERR_DELETE_SURVEY', message: error.message });
  }
});

/**
 * POST /api/encuestas/:id/preguntas
 * Agrega una nueva pregunta a la encuesta
 */
router.post('/:id/preguntas', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const encuestaId = parseInt(req.params.id, 10);
    const { texto_pregunta, tipo_pregunta, es_obligatoria, orden, peso_ponderacion } = req.body;

    if (!texto_pregunta || !tipo_pregunta) {
      res.status(400).json({ ok: false, message: 'Texto de la pregunta y tipo son requeridos.' });
      return;
    }

    const ins = await query(
      `INSERT INTO encuesta_preguntas (encuesta_id, orden, texto_pregunta, tipo_pregunta, es_obligatoria, peso_ponderacion, activo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, encuesta_id, orden, texto_pregunta, tipo_pregunta, es_obligatoria, peso_ponderacion`,
      [
        encuestaId,
        orden ? parseInt(orden, 10) : 1,
        texto_pregunta.trim(),
        tipo_pregunta,
        es_obligatoria === true || es_obligatoria === 'true',
        peso_ponderacion ? parseFloat(peso_ponderacion) : 1.0,
      ]
    );

    res.status(201).json({ ok: true, mensaje: 'Pregunta agregada con éxito.', pregunta: ins.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'ERR_ADD_QUESTION', message: error.message });
  }
});

/**
 * PUT /api/encuestas/:id/sync-completa
 * Guarda y sincroniza atómicamente el título, etapa, obligatoriedad y todas las preguntas de la encuesta
 */
router.put('/:id/sync-completa', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await getClient();
  try {
    const encuestaId = parseInt(req.params.id, 10);
    const { titulo, descripcion, etapa, es_obligatoria, activa, preguntas } = req.body;

    await client.query('BEGIN');

    // 1. Actualizar datos de la encuesta
    await client.query(
      `UPDATE encuestas
       SET titulo = COALESCE($1, titulo),
           descripcion = COALESCE($2, descripcion),
           etapa = COALESCE($3, etapa),
           es_obligatoria = COALESCE($4, es_obligatoria),
           activa = COALESCE($5, activa),
           actualizado_en = NOW()
       WHERE id = $6`,
      [titulo, descripcion, etapa, es_obligatoria, activa, encuestaId]
    );

    // 2. Si se proporcionó la lista de preguntas, sincronizarlas
    if (Array.isArray(preguntas)) {
      // Marcar inactivas las anteriores que no tengan respuestas registradas
      await client.query(
        `UPDATE encuesta_preguntas 
         SET activo = FALSE 
         WHERE encuesta_id = $1`,
        [encuestaId]
      );

      // Insertar o reactivar las preguntas enviadas
      for (let i = 0; i < preguntas.length; i++) {
        const p = preguntas[i];
        if (!p.texto_pregunta || !p.texto_pregunta.trim()) continue;

        await client.query(
          `INSERT INTO encuesta_preguntas (encuesta_id, orden, texto_pregunta, tipo_pregunta, es_obligatoria, peso_ponderacion, activo)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
          [
            encuestaId,
            i + 1,
            p.texto_pregunta.trim(),
            p.tipo_pregunta || 'CALIFICACION_1_A_5',
            p.es_obligatoria === true,
            p.peso_ponderacion || 1.0,
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Auditoría
    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('encuestas', 'WYSIWYG_SYNC_ENCUESTA', $1, $2)`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ encuesta_id: encuestaId, total_preguntas: preguntas?.length || 0 })]
    ).catch(() => {});

    res.json({ ok: true, mensaje: 'Encuesta y preguntas sincronizadas exitosamente desde el Editor WYSIWYG.' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error en sync-completa de encuesta:', error);
    res.status(500).json({ ok: false, error: 'ERR_SYNC_SURVEY', message: error.message });
  } finally {
    client.release();
  }
});

export default router;
