import { query } from './db';

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingActivity?: {
    id: number;
    nombre: string;
    horario_inicio: string;
    horario_fin: string;
    disertante_nombre: string | null;
    recinto_id: number;
    recinto_nombre: string;
  };
  message?: string;
}

/**
 * Verifica si existe solapamiento temporal de actividades en un mismo recinto.
 * 
 * Regla: Dos actividades A y B se superponen en el mismo recinto si y solo si:
 *   A.horario_inicio < B.horario_fin AND A.horario_fin > B.horario_inicio
 * 
 * @param recintoId ID del punto de acceso / recinto a verificar
 * @param horarioInicio Fecha y hora de inicio proyectada
 * @param horarioFin Fecha y hora de fin proyectada
 * @param excludeActividadId ID de actividad a ignorar (útil en updates/edición)
 */
export async function checkRecintoScheduleOverlap(
  recintoId: number,
  horarioInicio: Date | string,
  horarioFin: Date | string,
  excludeActividadId?: number
): Promise<ConflictCheckResult> {
  const inicioDate = new Date(horarioInicio);
  const finDate = new Date(horarioFin);

  if (isNaN(inicioDate.getTime()) || isNaN(finDate.getTime())) {
    throw new Error('Fechas de inicio o fin inválidas para comprobar solapamiento.');
  }

  if (inicioDate >= finDate) {
    return {
      hasConflict: true,
      message: 'El horario de inicio debe ser anterior al horario de finalización.',
    };
  }

  const sql = `
    SELECT 
      a.id,
      a.nombre,
      a.horario_inicio,
      a.horario_fin,
      a.disertante_nombre,
      pa.id as recinto_id,
      pa.nombre as recinto_nombre
    FROM actividades a
    JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
    WHERE a.punto_acceso_id = $1
      AND a.activo = TRUE
      AND ($2::int IS NULL OR a.id != $2)
      AND (a.horario_inicio < $4 AND a.horario_fin > $3)
    ORDER BY a.horario_inicio ASC
    LIMIT 1
  `;

  const res = await query(sql, [
    recintoId,
    excludeActividadId || null,
    inicioDate.toISOString(),
    finDate.toISOString(),
  ]);

  if (res.rows.length > 0) {
    const row = res.rows[0];
    const fmtInicio = new Date(row.horario_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fmtFin = new Date(row.horario_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      hasConflict: true,
      conflictingActivity: {
        id: row.id,
        nombre: row.nombre,
        horario_inicio: row.horario_inicio,
        horario_fin: row.horario_fin,
        disertante_nombre: row.disertante_nombre,
        recinto_id: row.recinto_id,
        recinto_nombre: row.recinto_nombre,
      },
      message: `El recinto '${row.recinto_nombre}' ya está ocupado de ${fmtInicio} a ${fmtFin} por '${row.nombre}'.`,
    };
  }

  return { hasConflict: false };
}

/**
 * Verifica si un disertante / expositor ya tiene una actividad programada en el mismo horario.
 * Un disertante no puede estar en dos actividades simultáneamente, incluso si son en diferentes salas.
 *
 * @param disertanteUsuarioId UUID del usuario si está registrado
 * @param disertanteNombre Nombre del disertante
 * @param horarioInicio Fecha y hora de inicio proyectada
 * @param horarioFin Fecha y hora de fin proyectada
 * @param excludeActividadId ID de actividad a ignorar (en edición)
 */
export async function checkDisertanteScheduleOverlap(
  disertanteUsuarioId: string | null | undefined,
  disertanteNombre: string | null | undefined,
  horarioInicio: Date | string,
  horarioFin: Date | string,
  excludeActividadId?: number
): Promise<ConflictCheckResult> {
  const inicioDate = new Date(horarioInicio);
  const finDate = new Date(horarioFin);

  if (isNaN(inicioDate.getTime()) || isNaN(finDate.getTime())) {
    throw new Error('Fechas de inicio o fin inválidas para comprobar solapamiento del disertante.');
  }

  if (inicioDate >= finDate) {
    return {
      hasConflict: true,
      message: 'El horario de inicio debe ser anterior al horario de finalización.',
    };
  }

  // Si no hay ni ID ni nombre provisto, no se puede verificar colisión de persona
  const cleanNombre = disertanteNombre ? disertanteNombre.trim() : null;
  const cleanId = disertanteUsuarioId ? disertanteUsuarioId.trim() : null;
  if (!cleanId && !cleanNombre) {
    return { hasConflict: false };
  }

  const sql = `
    SELECT 
      a.id,
      a.nombre,
      a.horario_inicio,
      a.horario_fin,
      a.disertante_nombre,
      a.disertante_usuario_id,
      pa.id as recinto_id,
      pa.nombre as recinto_nombre
    FROM actividades a
    JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
    WHERE a.activo = TRUE
      AND ($1::int IS NULL OR a.id != $1)
      AND (
        ($2::uuid IS NOT NULL AND a.disertante_usuario_id = $2::uuid)
        OR ($3::text IS NOT NULL AND LOWER(TRIM(a.disertante_nombre)) = LOWER(TRIM($3::text)))
      )
      AND (a.horario_inicio < $5 AND a.horario_fin > $4)
    ORDER BY a.horario_inicio ASC
    LIMIT 1
  `;

  const res = await query(sql, [
    excludeActividadId || null,
    cleanId || null,
    cleanNombre || null,
    inicioDate.toISOString(),
    finDate.toISOString(),
  ]);

  if (res.rows.length > 0) {
    const row = res.rows[0];
    const fmtInicio = new Date(row.horario_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fmtFin = new Date(row.horario_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nombreExp = cleanNombre || row.disertante_nombre || 'El expositor seleccionado';

    return {
      hasConflict: true,
      conflictingActivity: {
        id: row.id,
        nombre: row.nombre,
        horario_inicio: row.horario_inicio,
        horario_fin: row.horario_fin,
        disertante_nombre: row.disertante_nombre,
        recinto_id: row.recinto_id,
        recinto_nombre: row.recinto_nombre,
      },
      message: `${nombreExp} ya tiene asignada la actividad '${row.nombre}' en '${row.recinto_nombre}' de ${fmtInicio} a ${fmtFin}.`,
    };
  }

  return { hasConflict: false };
}
