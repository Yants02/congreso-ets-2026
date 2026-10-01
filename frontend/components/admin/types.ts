export interface OperadorSession {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  rol_nombre?: string;
  jerarquia: number;
  permisos?: string[];
}

export interface CatalogosConsolidados {
  roles: Array<{ id: number; nombre: string; descripcion: string; jerarquia: number; permisos?: string[] }>;
  roles_participantes?: Array<{ id: number; nombre: string; descripcion: string; jerarquia: number; permisos?: string[] }>;
  roles_operadores?: Array<{ id: number; nombre: string; descripcion: string; jerarquia: number; permisos?: string[] }>;
  estados: Array<{ id: number; codigo: string; nombre: string; descripcion: string }>;
  puntos_acceso: Array<{ id: number; nombre: string; ubicacion_fisica: string; capacidad_maxima: number; activo: boolean }>;
  tipos_acreditacion: Array<{ id: number; codigo: string; descripcion: string; requiere_actividad: boolean }>;
  actividades: Array<{ id: number; nombre: string; horario_inicio: string; horario_fin: string; disertante_nombre: string }>;
  materias_canonicas?: Array<{ id: number; codigo: string; nombre: string }>;
  categorias_tematicas?: Array<{ id: number; nombre: string }>;
  disertantes?: Array<{
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    dni_pasaporte: string;
    rol_nombre: string;
    homologacion_estado?: string;
  }>;
}

export interface UsuarioEntity {
  id: string;
  dni_pasaporte: string;
  nombre: string;
  apellido: string;
  email: string;
  celular: string;
  rol_principal_id?: number;
  rol_nombre: string;
  roles_adicionales?: string;
  estado_codigo: string;
  estado_nombre: string;
  creado_en: string;
  ingresos_totales: number;
}

export interface ActividadEntity {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo_acreditacion_id: number;
  tipo_acreditacion_nombre?: string;
  punto_acceso_id: number;
  punto_acceso_nombre?: string;
  cupo_maximo: number;
  horario_inicio: string;
  horario_fin: string;
  disertante_nombre: string;
  disertante_usuario_id?: string | null;
  activo: boolean;
  inscriptos_actuales?: number;
  fecha_actividad?: string;
  hora_inicio?: string;
  hora_fin?: string;
  evento_id?: number;
  evento_nombre?: string;
  evento_fecha_inicio?: string;
  evento_fecha_fin?: string;
}

export interface PuntoAccesoEntity {
  id: number;
  nombre: string;
  ubicacion_fisica: string;
  capacidad_maxima: number;
  activo: boolean;
  total_ingresos?: number;
  total_egresos?: number;
  aforo_actual?: number;
}

export interface OperadorEntity {
  id: number;
  nombre: string;
  apellido: string;
  email_institucional: string;
  punto_acceso_default_id: number;
  punto_acceso_nombre?: string;
  rol_id: number;
  rol_nombre?: string;
  jerarquia?: number;
  permisos?: string[];
  operador_permisos?: string[] | null;
  activo: boolean;
  creado_en: string;
}

export interface CatalogoMateriaEntity {
  id: number;
  codigo_materia: string;
  nombre_materia: string;
  descripcion?: string;
  categoria_id?: number;
  categoria_nombre?: string;
  creditos_academicos?: number;
  activo: boolean;
}

export interface BlacklistEntity {
  id: number;
  dni_pasaporte: string;
  motivo: string;
  registrado_por: string;
  registrado_en: string;
  activo: boolean;
}

export interface AcreditacionEntity {
  id: number | string;
  timestamp_acreditacion: string;
  tipo_movimiento: 'INGRESO' | 'EGRESO';
  usuario_id: string;
  nombre?: string;
  usuario_nombre?: string;
  apellido?: string;
  usuario_apellido?: string;
  dni_pasaporte?: string;
  dni?: string;
  email?: string;
  rol_nombre: string;
  punto_acceso_nombre: string;
  punto_acceso_id: number;
  operador_nombre: string;
  estado_pase?: string;
  motivo_anulacion?: string;
}

export interface CertificadoEntity {
  id: string;
  codigo_verificacion: string;
  usuario_id: string;
  nombre?: string;
  apellido?: string;
  usuario_nombre?: string;
  usuario_apellido?: string;
  dni_pasaporte: string;
  tipo_certificado: string;
  horas_catedra?: number;
  emitido_en: string;
  hash_integridad?: string;
}

export interface HomologacionEntity {
  id: number;
  usuario_id: string;
  usuario_nombre: string;
  usuario_apellido: string;
  dni_pasaporte: string;
  email: string;
  rol_nombre: string;
  estado_homologacion: 'PENDIENTE' | 'VALIDADO' | 'RECHAZADO' | 'ANULADO';
  documentacion_presentada?: string;
  observaciones?: string;
  actualizado_en: string;
  registrado_en?: string;
}

export interface EventoEntity {
  id: number;
  nombre: string;
  codigo_edicion: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  cupo_maximo: number;
  activo: boolean;
  sede_nombre?: string;
  sede_direccion?: string;
  sede_mapa_url?: string;
  total_inscriptos?: number;
  confirmados?: number;
}

export interface ConfiguracionEntity {
  clave: string;
  valor: any;
  descripcion?: string;
  actualizado_en: string;
}

export interface LogAuditoriaEntity {
  id: number;
  evento: string;
  actor_usuario: string;
  usuario_afectado_id?: string;
  detalles: any;
  timestamp: string;
  creado_en?: string;
}

export interface PresentadorEntity {
  usuario_id: string;
  nombre: string;
  apellido: string;
  email: string;
  celular: string;
  dni_pasaporte: string;
  rol_nombre: string;
  estado_homologacion?: string;
  institucion_bio?: string;
  total_actividades: number;
  cupo_acumulado: number;
  actividades?: Array<{
    id: number;
    nombre: string;
    horario_inicio: string;
    horario_fin: string;
    recinto: string;
  }>;
}

export interface EstadisticasDesglosadasData {
  eventos: {
    id: number;
    codigo: string;
    nombre: string;
    anio: number;
    fecha_inicio: string;
    fecha_fin: string;
    cupo_maximo: number;
    lugar_nombre: string;
    estado: string;
    total_inscriptos: number;
    confirmados: number;
    lista_espera: number;
    sancionados: number;
    cancelados: number;
    porcentaje_ocupacion: number;
  } | null;
  recintos: Array<{
    id: number;
    nombre: string;
    ubicacion_fisica: string;
    capacidad_maxima: number;
    tipo_punto: string;
    total_actividades: number;
    horas_ocupadas: number;
    cupo_total_ofrecido: number;
    total_scans_acceso: number;
  }>;
  horarios: {
    total_actividades: number;
    franja_manana: number;
    franja_mediodia: number;
    franja_tarde: number;
    franja_noche: number;
    duracion_promedio_minutos: number;
  } | null;
  presentadores: {
    total_presentadores_registrados: number;
    total_disertantes_en_agenda: number;
    total_ponencias_programadas: number;
    aforo_total_ponencias: number;
    promedio_aforo_por_charla: number;
  } | null;
  asistentes: {
    total_asistentes_evento: number;
    estudiantes: number;
    docentes: number;
    otros_perfiles: number;
    asistentes_acreditados_en_sala: number;
    certificados_emitidos: number;
    encuestas_respondidas: number;
  } | null;
}

