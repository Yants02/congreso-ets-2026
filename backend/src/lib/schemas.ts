import { z } from 'zod';

// ============================================================================
// CAMPOS ATÓMICOS REUTILIZABLES CON VALIDACIÓN ESTRICTA
// ============================================================================

export const dniSchema = z
  .string()
  .trim()
  .min(5, 'El DNI o Pasaporte debe tener al menos 5 caracteres')
  .max(25, 'El DNI o Pasaporte no puede superar 25 caracteres')
  .regex(
    /^[A-Za-z0-9_-]{5,25}$/,
    'El DNI o Pasaporte solo puede contener letras, números, guiones y guiones bajos (sin caracteres especiales)'
  );

export const nombreSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(100, 'El nombre no puede superar 100 caracteres')
  .regex(
    /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'().-]{2,100}$/,
    'El nombre solo puede contener letras, tildes, espacios, guiones o apóstrofes'
  );

export const apellidoSchema = z
  .string()
  .trim()
  .min(2, 'El apellido debe tener al menos 2 caracteres')
  .max(100, 'El apellido no puede superar 100 caracteres')
  .regex(
    /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'().-]{2,100}$/,
    'El apellido solo puede contener letras, tildes, espacios, guiones o apóstrofes'
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Formato de correo electrónico institucional inválido')
  .max(150, 'El correo electrónico no puede superar 150 caracteres');

export const celularSchema = z
  .string()
  .trim()
  .regex(
    /^\+?[0-9\s\-()]{7,25}$/,
    'Formato de celular inválido (debe contener entre 7 y 25 dígitos numéricos, pudiendo incluir código de país +)'
  );

export const fotoSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Formato de imagen no admitido (solo JPEG, PNG o WebP)' }),
  }),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, 'La foto no debe superar los 5MB'),
  buffer_base64: z.string().min(10, 'Buffer base64 de imagen inválido'),
});

// ============================================================================
// ESQUEMAS DE OPERACIONES DE USUARIOS Y REGISTRO
// ============================================================================

export const registerSchema = z.object({
  dni_pasaporte: dniSchema,
  nombre: nombreSchema,
  apellido: apellidoSchema,
  email: emailSchema,
  celular: celularSchema,
  rol_principal_id: z.number().int().positive('Debe seleccionar un rol institucional válido'),
  roles_adicionales_ids: z.array(z.number().int().positive()).optional().default([]),
  foto: fotoSchema.optional(),
  consentimiento_datos: z.boolean().optional().default(true),
});

export const bajaVoluntariaSchema = z.object({
  dni_pasaporte: dniSchema,
  email: emailSchema,
  motivo: z.string().trim().max(500).optional(),
  confirmacion_olvido: z.boolean().refine((val) => val === true, {
    message: 'Debés confirmar expresamente la solicitud de revocación y baja voluntaria.',
  }),
});

export const usuarioManualCreateSchema = z.object({
  dni_pasaporte: dniSchema,
  nombre: nombreSchema,
  apellido: apellidoSchema,
  email: emailSchema,
  celular: celularSchema,
  rol_principal_id: z.number().int().positive('Debe seleccionar un rol institucional válido').optional().nullable(),
  rol_id: z.number().int().positive().optional().nullable(),
  roles_adicionales_ids: z.array(z.number().int().positive()).optional().default([]),
  estado_id: z.number().int().positive().optional().nullable(),
  estado_codigo: z.enum(['CONFIRMADO', 'LISTA_ESPERA', 'BAJA_AUTOMATICA', 'CANCELADO', 'SANCIONADO']).optional().nullable(),
  estado: z.string().optional().nullable(),
  es_superadmin_override: z.boolean().optional().default(false),
  superadmin_override: z.boolean().optional(),
  motivo_override: z.string().trim().max(500).optional().nullable(),
  foto_url: z.string().optional().nullable(),
});

export const usuarioUpdateSchema = z.object({
  id: z.string().uuid('Identificador UUID de usuario inválido'),
  nombre: nombreSchema.optional().nullable(),
  apellido: apellidoSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  celular: celularSchema.optional().nullable(),
  rol_principal_id: z.number().int().positive().optional().nullable(),
  rol_id: z.number().int().positive().optional().nullable(),
  roles_adicionales_ids: z.array(z.number().int().positive()).optional().nullable(),
  estado_id: z.number().int().positive().optional().nullable(),
  estado_codigo: z
    .enum(['CONFIRMADO', 'LISTA_ESPERA', 'BAJA_AUTOMATICA', 'CANCELADO', 'SANCIONADO'])
    .optional()
    .nullable(),
  estado: z.string().optional().nullable(),
  motivo_cambio: z.string().trim().max(500).optional().nullable(),
  override_superadmin: z.boolean().optional(),
  superadmin_override: z.boolean().optional(),
  motivo_override: z.string().trim().max(500).optional().nullable(),
  codigo_autorizacion: z.string().optional().nullable(),
});

export const promoverSchema = z.object({
  usuario_id: z.string().uuid('Identificador de usuario UUID v4 inválido'),
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo de la promoción debe tener al menos 3 caracteres')
    .optional()
    .nullable(),
});

// ============================================================================
// ESQUEMAS DE ACREDITACIÓN Y CONTROL DE ACCESOS
// ============================================================================

export const acreditarSchema = z
  .object({
    qr_token: z
      .string()
      .trim()
      .min(10, 'El token QR debe tener formato válido')
      .optional()
      .nullable(),
    dni_pasaporte: dniSchema.optional().nullable(),
    tipo_acreditacion_id: z
      .number()
      .int()
      .positive('Tipo de acreditación inválido')
      .optional()
      .default(1),
    punto_acceso_id: z.number().int().positive('Punto de acceso inválido').optional().default(1),
    actividad_id: z.number().int().positive().optional().nullable(),
    operador_id: z.number().int().positive('Operador inválido').optional().default(1),
    es_manual: z.boolean().optional().default(false),
    motivo_manual: z.string().trim().max(500).optional().nullable(),
    tipo_movimiento: z.enum(['INGRESO', 'EGRESO']).optional().default('INGRESO'),
  })
  .refine((data) => Boolean(data.qr_token || data.dni_pasaporte), {
    message: 'Debe proveer el token QR o el DNI del participante',
  });

export const walkInRegisterSchema = z.object({
  dni_pasaporte: dniSchema,
  nombre: nombreSchema,
  apellido: apellidoSchema,
  email: emailSchema,
  celular: celularSchema.optional().default('+5491100000000'),
  rol_principal_id: z.number().int().positive().optional().default(1),
  punto_acceso_id: z.number().int().positive().optional().default(1),
  evento_id: z.number().int().positive().optional(),
});

export const anularAcreditacionSchema = z.object({
  id: z.coerce.number().int().positive('ID de acreditación inválido'),
  motivo: z.string().trim().min(3).max(500).optional().default('Anulación manual por contingencia'),
});

export const batchAcreditarSchema = z.object({
  acreditaciones: z.array(
    z.object({
      qr_token: z.string().trim().min(10),
      tipo_acreditacion_id: z.number().int().positive(),
      punto_acceso_id: z.number().int().positive(),
      actividad_id: z.number().int().positive().optional().nullable(),
      operador_id: z.number().int().positive().optional().nullable(),
      tipo_movimiento: z.enum(['INGRESO', 'EGRESO']).optional().default('INGRESO'),
      timestamp: z.string().min(1),
    })
  ),
});

// ============================================================================
// ESQUEMAS DE HOMOLOGACIÓN, BLACKLIST Y AGENDA
// ============================================================================

export const homologacionSchema = z.object({
  usuario_id: z.string().uuid('UUID de usuario inválido'),
  accion: z.enum(['VALIDAR', 'ANULAR', 'RECHAZAR', 'CREAR'], {
    errorMap: () => ({ message: 'Acción inválida (debe ser VALIDAR, ANULAR, RECHAZAR o CREAR)' }),
  }),
  observaciones: z.string().trim().max(1000).optional().nullable(),
  motivo_anulacion: z.string().trim().max(1000).optional().nullable(),
  documentacion_presentada: z.string().trim().max(1000).optional().nullable(),
});

export const blacklistSchema = z.object({
  dni_pasaporte: dniSchema,
  motivo: z
    .string()
    .trim()
    .min(5, 'El motivo de inclusión en lista negra debe tener al menos 5 caracteres')
    .max(500, 'El motivo no puede superar 500 caracteres'),
});

export const blacklistUpdateSchema = z.object({
  id: z.number().int().positive('ID de blacklist inválido'),
  motivo: z.string().trim().min(5).max(500).optional(),
  activo: z.boolean().optional(),
});

export const actividadSchema = z
  .object({
    evento_id: z.number().int().positive('Debe seleccionar la edición o evento correspondiente').optional().default(1),
    nombre: z
      .string()
      .trim()
      .min(3, 'El nombre de la actividad debe tener al menos 3 caracteres')
      .max(150, 'El nombre no puede superar 150 caracteres'),
    descripcion: z.string().trim().max(1000).optional().nullable(),
    tipo_acreditacion_id: z.number().int().positive('Tipo de acreditación inválido'),
    punto_acceso_id: z.number().int().positive('Punto de acceso/aula inválido'),
    cupo_maximo: z
      .number()
      .int()
      .min(1, 'El cupo de la actividad debe ser al menos 1')
      .max(2000, 'El cupo no puede superar 2000'),
    horario_inicio: z.string().min(1, 'Horario de inicio requerido'),
    catalogo_actividad_id: z.number().int().positive().optional().nullable(),
    disertante_usuario_id: z.preprocess(
      (val) => (val === '' || val === undefined ? null : val),
      z.string().uuid('UUID de disertante inválido').nullable().optional()
    ),
    horario_fin: z.string().min(1, 'Horario de finalización requerido'),
    disertante_nombre: z.string().trim().max(150).optional().nullable(),
    activo: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      const inicio = new Date(data.horario_inicio);
      const fin = new Date(data.horario_fin);
      return !isNaN(inicio.getTime()) && !isNaN(fin.getTime()) && fin > inicio;
    },
    {
      message: 'El horario de finalización debe ser posterior al horario de inicio',
      path: ['horario_fin'],
    }
  );

export const puntoAccesoSchema = z.object({
  evento_id: z.number().int().positive().optional().nullable(),
  nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(100),
  ubicacion_fisica: z
    .string()
    .trim()
    .min(3, 'La ubicación debe tener al menos 3 caracteres')
    .max(150),
  tipo_punto: z.enum(['PUESTO_ACCESO', 'AULA_SALON', 'TALLER_LAB']).default('AULA_SALON'),
  capacidad_maxima: z
    .number()
    .int()
    .min(1, 'La capacidad máxima debe ser al menos 1')
    .max(5000)
    .default(50),
  activo: z.boolean().optional().default(true),
});

// ============================================================================
// ESQUEMAS DEL CATÁLOGO MAESTRO DE ACTIVIDADES (MATERIAS/TALLERES CANÓNICOS)
// ============================================================================

export const catalogoActividadSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(50, 'El código no puede superar 50 caracteres')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'El código solo puede contener letras, números, guiones y guiones bajos'
    ),
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre de la actividad/materia debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede superar 150 caracteres'),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  tipo_acreditacion_id: z
    .number()
    .int()
    .positive('Debe seleccionar un tipo de acreditación válido'),
  categoria_tematica_id: z
    .number()
    .int()
    .positive('Debe seleccionar una categoría temática válida')
    .optional()
    .nullable(),
  horas_catedra: z
    .number()
    .int()
    .min(1, 'Las horas cátedra deben ser al menos 1')
    .max(100, 'Las horas cátedra no pueden superar 100')
    .default(2),
  activo: z.boolean().optional().default(true),
});

export const catalogoActividadBatchSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe proporcionar al menos un ID'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

export const configuracionUpdateSchema = z.object({
  clave: z
    .string()
    .trim()
    .min(3, 'Clave requerida')
    .max(100, 'Clave no puede superar 100 caracteres'),
  valor: z.any().refine((val) => val !== undefined && val !== null, {
    message: 'El valor no puede ser nulo o indefinido',
  }),
  descripcion: z.string().trim().max(500).optional().nullable(),
});

// ============================================================================
// ESQUEMAS DE CERTIFICADOS Y RECONFIRMACIÓN
// ============================================================================

export const certificadoEmisionSchema = z.object({
  dni_pasaporte: dniSchema,
  tipo_certificado: z
    .enum(['ASISTENCIA', 'EXPOSITOR', 'DISERTANTE', 'ORGANIZADOR'])
    .optional()
    .default('ASISTENCIA'),
});

// ============================================================================
// ESQUEMAS DE NOTIFICACIONES WEB PUSH
// ============================================================================

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('Endpoint de suscripción inválido'),
  keys: z.object({
    p256dh: z.string().min(1, 'Clave p256dh requerida'),
    auth: z.string().min(1, 'Clave auth requerida'),
  }),
  usuario_id: z.string().uuid('UUID de usuario inválido').optional().nullable(),
});

export const pushBroadcastSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(150, 'Título demasiado largo'),
  body: z.string().trim().min(1, 'El mensaje es requerido').max(500, 'Mensaje demasiado largo'),
  url: z.string().trim().optional().default('/'),
  tag: z.string().trim().optional(),
  rol_id: z.number().int().positive().optional().nullable(),
  solo_acreditados: z.boolean().optional().default(false),
  urgente: z.boolean().optional().default(false),
  filtro: z.object({
    rol_id: z.number().int().optional().nullable(),
    solo_acreditados: z.boolean().optional().default(false),
  }).optional(),
});

// ============================================================================
// ESQUEMAS DE AUTENTICACIÓN Y OPERADORES
// ============================================================================

export const loginSchema = z.object({
  email: z.string().trim().email('Formato de correo institucional inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  recordar: z.boolean().optional().default(false),
});
