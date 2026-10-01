import { Router, Request, Response } from 'express';
import { query } from '../../lib/db';

const router = Router();

/**
 * GET /api/admin/catalogos
 * Endpoint consolidado que provee roles, estados, puntos de acceso,
 * tipos de acreditación, actividades, catálogo canónico y disertantes.
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      rolesRes,
      rolesParticipantesRes,
      estadosRes,
      puntosRes,
      tiposRes,
      actividadesRes,
      catActividadesRes,
      categoriasRes,
      disertantesRes,
    ] = await Promise.all([
      query(`SELECT id, nombre, descripcion, jerarquia, COALESCE(permisos, '[]'::jsonb) as permisos FROM roles ORDER BY jerarquia ASC, id ASC`),
      query(`SELECT id, nombre, descripcion, jerarquia, COALESCE(permisos, '[]'::jsonb) as permisos FROM roles WHERE jerarquia <= 2 ORDER BY jerarquia ASC, id ASC`),
      query(`SELECT id, codigo, nombre, permite_ingreso FROM estados_inscripcion ORDER BY id ASC`),
      query(`SELECT id, nombre, ubicacion_fisica, tipo_punto, capacidad_maxima, activo FROM puntos_acceso WHERE activo = TRUE ORDER BY id ASC`),
      query(`SELECT id, codigo, descripcion, requiere_actividad FROM tipos_acreditacion ORDER BY id ASC`),
      query(`SELECT id, nombre, tipo_acreditacion_id, punto_acceso_id, cupo_maximo, disertante_nombre, disertante_usuario_id, catalogo_actividad_id FROM actividades WHERE activo = TRUE ORDER BY id ASC`),
      query(`SELECT id, codigo, nombre, descripcion, tipo_acreditacion_id, categoria_tematica_id, horas_catedra, activo FROM catalogo_actividades WHERE activo = TRUE ORDER BY codigo ASC`),
      query(`SELECT id, nombre, descripcion, activo FROM categorias_tematicas WHERE activo = TRUE ORDER BY nombre ASC`),
      query(`
        SELECT DISTINCT u.id, u.nombre, u.apellido, u.email, u.dni_pasaporte, r.nombre AS rol_nombre,
               COALESCE(he.estado_homologacion, 'NO_REQUERIDO') AS homologacion_estado
        FROM usuarios u
        JOIN roles r ON r.id = u.rol_principal_id
        LEFT JOIN homologaciones_expositores he ON he.usuario_id = u.id
        WHERE r.nombre IN ('Expositor', 'Docente', 'Autoridad') 
           OR he.id IS NOT NULL
           OR EXISTS (
              SELECT 1 FROM usuario_roles_adicionales ura 
              JOIN roles r2 ON r2.id = ura.rol_id 
              WHERE ura.usuario_id = u.id AND r2.nombre IN ('Expositor', 'Docente')
           )
        ORDER BY u.apellido ASC, u.nombre ASC
      `),
    ]);

    const rolesOperadores = rolesRes.rows.filter(
      (r: any) => r.jerarquia >= 3
    );

    res.json({
      ok: true,
      roles: rolesRes.rows,
      roles_participantes: rolesParticipantesRes.rows,
      roles_operadores: rolesOperadores,
      estados: estadosRes.rows,
      puntos_acceso: puntosRes.rows,
      tipos_acreditacion: tiposRes.rows,
      actividades: actividadesRes.rows,
      catalogo_actividades: catActividadesRes.rows,
      categorias_tematicas: categoriasRes.rows,
      disertantes: disertantesRes.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/catalogos:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

// ==========================================
// CRUD ROLES INSTITUCIONALES
// ==========================================
router.post('/roles', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, descripcion, jerarquia, permisos } = req.body;
    if (!nombre) {
      res.status(400).json({ ok: false, message: 'El nombre del rol es requerido.' });
      return;
    }
    const permisosJson = Array.isArray(permisos) ? JSON.stringify(permisos) : '[]';
    const ins = await query(
      `INSERT INTO roles (nombre, descripcion, jerarquia, permisos) VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
      [nombre.trim(), descripcion ? descripcion.trim() : null, jerarquia ? parseInt(jerarquia, 10) : 1, permisosJson]
    );
    res.status(201).json({ ok: true, mensaje: 'Rol institucional creado.', rol: ins.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/roles/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { nombre, descripcion, jerarquia, permisos } = req.body;
    const permisosJson = Array.isArray(permisos) ? JSON.stringify(permisos) : (permisos ? JSON.stringify(permisos) : null);
    
    let sql = `UPDATE roles SET nombre = COALESCE($1, nombre), descripcion = COALESCE($2, descripcion), jerarquia = COALESCE($3, jerarquia)`;
    const params: any[] = [nombre, descripcion, jerarquia];

    if (permisos !== undefined) {
      sql += `, permisos = $4::jsonb WHERE id = $5 RETURNING *`;
      params.push(permisosJson, id);
    } else {
      sql += ` WHERE id = $4 RETURNING *`;
      params.push(id);
    }

    const upd = await query(sql, params);
    res.json({ ok: true, mensaje: 'Rol actualizado.', rol: upd.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/roles/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const inUse = await query(`SELECT COUNT(*)::int as c FROM usuarios WHERE rol_principal_id = $1`, [id]);
    if (inUse.rows[0].c > 0) {
      res.status(409).json({ ok: false, message: 'No se puede eliminar el rol porque está asignado a usuarios existentes.' });
      return;
    }
    await query(`DELETE FROM roles WHERE id = $1`, [id]);
    res.json({ ok: true, mensaje: 'Rol institucional eliminado.' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// CRUD TIPOS DE ACREDITACIÓN
// ==========================================
router.post('/tipos-acreditacion', async (req: Request, res: Response): Promise<void> => {
  try {
    const { codigo, descripcion, requiere_actividad } = req.body;
    if (!codigo || !descripcion) {
      res.status(400).json({ ok: false, message: 'Código y Descripción son obligatorios.' });
      return;
    }
    const ins = await query(
      `INSERT INTO tipos_acreditacion (codigo, descripcion, requiere_actividad) VALUES ($1, $2, $3) RETURNING *`,
      [codigo.toUpperCase().trim(), descripcion.trim(), requiere_actividad === true || requiere_actividad === 'true']
    );
    res.status(201).json({ ok: true, mensaje: 'Tipo de acreditación creado.', tipo: ins.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/tipos-acreditacion/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { descripcion, requiere_actividad } = req.body;
    const upd = await query(
      `UPDATE tipos_acreditacion SET descripcion = COALESCE($1, descripcion), requiere_actividad = COALESCE($2, requiere_actividad) WHERE id = $3 RETURNING *`,
      [descripcion, requiere_actividad, id]
    );
    res.json({ ok: true, mensaje: 'Tipo de acreditación actualizado.', tipo: upd.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// CRUD CATEGORÍAS TEMÁTICAS
// ==========================================
router.post('/categorias-tematicas', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) {
      res.status(400).json({ ok: false, message: 'El nombre es obligatorio.' });
      return;
    }
    const ins = await query(
      `INSERT INTO categorias_tematicas (nombre, descripcion, activo) VALUES ($1, $2, TRUE) RETURNING *`,
      [nombre.trim(), descripcion ? descripcion.trim() : null]
    );
    res.status(201).json({ ok: true, mensaje: 'Categoría temática creada.', categoria: ins.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/categorias-tematicas/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { nombre, descripcion, activo } = req.body;
    const upd = await query(
      `UPDATE categorias_tematicas SET nombre = COALESCE($1, nombre), descripcion = COALESCE($2, descripcion), activo = COALESCE($3, activo) WHERE id = $4 RETURNING *`,
      [nombre, descripcion, activo, id]
    );
    res.json({ ok: true, mensaje: 'Categoría temática actualizada.', categoria: upd.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
