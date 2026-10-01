-- ============================================================================
-- SEED DATA - CONGRESO ETS 2026
-- INICIALIZACIÓN DE CATÁLOGOS Y CONFIGURACIONES OPERATIVAS
-- ============================================================================

-- Roles Base
INSERT INTO roles (nombre, descripcion, jerarquia) VALUES
    ('Estudiante', 'Estudiante de Nivel Técnico Superior o afín', 1),
    ('Docente', 'Personal académico / Docente', 1),
    ('Expositor', 'Disertante o Tallerista con requerimiento de homologación', 2),
    ('Autoridad', 'Autoridad Institucional / Ministerial / Invitado Especial', 2),
    ('Operador', 'Personal de acreditación en puertas y aulas', 3),
    ('Verificador', 'Funcionario habilitado para homologar pergaminos de expositores', 4),
    ('Administrador', 'Personal directivo DETS para control y gestión', 4),
    ('Superadmin', 'Administrador total con facultades de sobrecupo y override', 5)
ON CONFLICT (nombre) DO UPDATE 
SET descripcion = EXCLUDED.descripcion, jerarquia = EXCLUDED.jerarquia;

-- Estados de Inscripción
INSERT INTO estados_inscripcion (codigo, nombre, permite_ingreso, descripcion) VALUES
    ('CONFIRMADO', 'Confirmado', TRUE, 'Inscripción activa con cupo asegurado y credencial habilitada'),
    ('LISTA_ESPERA', 'Lista de Espera', FALSE, 'Sin cupo inmediato por capacidad de aforo completada (FIFO)'),
    ('SANCIONADO', 'Sancionado', FALSE, 'Restricción disciplinaria activa por inclusión en Lista Negra / Blacklist'),
    ('BAJA_AUTOMATICA', 'Baja Automática 48hs', FALSE, 'No confirmó asistencia en la ventana de 24hs tras el aviso de 48hs'),
    ('CANCELADO', 'Cancelado', FALSE, 'Baja voluntaria o revocada manualmente')
ON CONFLICT (codigo) DO UPDATE 
SET nombre = EXCLUDED.nombre, permite_ingreso = EXCLUDED.permite_ingreso, descripcion = EXCLUDED.descripcion;

-- Puntos de Acceso Físicos (Auditorio Polo Saavedra)
INSERT INTO puntos_acceso (nombre, ubicacion_fisica, activo) VALUES
    ('Acceso General - Puerta Principal', 'Hall de Entrada Principal - PB', TRUE),
    ('Acceso General - Puerta Lateral', 'Acceso Rampa Accesible - PB', TRUE),
    ('Aula Magna - Auditorio Central', 'Auditorio Principal', TRUE),
    ('Aula 1 - Robótica y Automatización', 'Primer Piso - Sector Este', TRUE),
    ('Aula 2 - Inteligencia Artificial y Big Data', 'Primer Piso - Sector Oeste', TRUE),
    ('Taller 1 - Redes y Ciberseguridad', 'Subsuelo - Laboratorio A', TRUE),
    ('Taller 2 - Desarrollo Web y Cloud', 'Subsuelo - Laboratorio B', TRUE)
ON CONFLICT (nombre) DO UPDATE 
SET ubicacion_fisica = EXCLUDED.ubicacion_fisica, activo = EXCLUDED.activo;

-- Tipos de Acreditación
INSERT INTO tipos_acreditacion (codigo, descripcion, requiere_actividad) VALUES
    ('ACCESO_GENERAL', 'Ingreso al predio del Auditorio Polo Saavedra', FALSE),
    ('ACTIVIDAD_AULA', 'Ingreso a conferencia o panel en aula temática', TRUE),
    ('TALLER', 'Participación en taller práctico con cupo limitado', TRUE),
    ('MASTERCLASS', 'Clase magistral con expositor principal', TRUE)
ON CONFLICT (codigo) DO UPDATE 
SET descripcion = EXCLUDED.descripcion, requiere_actividad = EXCLUDED.requiere_actividad;

-- Operadores Iniciales (Contraseñas por defecto: SuperAdmin2026!, Verificador2026!, Operador2026!, AdminCongreso2026!)
INSERT INTO operadores (nombre, apellido, email_institucional, punto_acceso_default_id, rol_id, password_hash, activo) VALUES
    ('Operador 1', 'Puerta Principal', 'operador1.puerta@bue.edu.ar', 1, 5, '519a19591492bc470768b209e257eb3c:d947231ce81bfbe779836371cb765f04230d70da6d892ba94a530eb6a5f54316d9a9f2ce5eec5926ec03ddc4a9a0d8bbecceba462f92a472c3d014bc9fa86178', TRUE),
    ('Operador 2', 'Puerta Lateral', 'operador2.lateral@bue.edu.ar', 2, 5, '519a19591492bc470768b209e257eb3c:d947231ce81bfbe779836371cb765f04230d70da6d892ba94a530eb6a5f54316d9a9f2ce5eec5926ec03ddc4a9a0d8bbecceba462f92a472c3d014bc9fa86178', TRUE),
    ('Verificador', 'DETS Pergaminos', 'verificador.dets@bue.edu.ar', 1, 6, 'e8db685d65d095f87b8979b00ca36df2:82243d4c67676fb13437e408ec20584eb266cf17f041707ea24e930fbf0c8f5f8be0fec7d6a5ee5be602511414774338450125c192e4be0bbcf9b8ae2fe7e721', TRUE),
    ('Administrador', 'General DETS', 'admin@ifts04.edu.ar', 1, 7, '538c470bca95df46c04dce90b4d83bb3:a7bb8abcf659ac6c7a3cbdb35470359dfe93ab963a1ad458a810e58b90630c707279df9ae6d641c158fd45883fff51ccba64d260cd7b050453262e3f07178eeb', TRUE),
    ('Superadmin', 'General', 'superadmin.congreso@bue.edu.ar', 1, 8, 'f8bb2219633e8e7d23d85836fae758a5:fe5e227091448b111dc54b1f49e49cb4a52ff37cffcf385b2ee50ba3ee27bb61c7414bc9697d812239f60f64beae89fa0821d3780369a4781498b3f6e1f0e4b8', TRUE)
ON CONFLICT (email_institucional) DO UPDATE
SET rol_id = EXCLUDED.rol_id, password_hash = EXCLUDED.password_hash;

-- Actividades y Salas de Ejemplo
INSERT INTO actividades (nombre, descripcion, tipo_acreditacion_id, punto_acceso_id, cupo_maximo, horario_inicio, horario_fin, disertante_nombre) VALUES
    ('Acreditación General y Café de Bienvenida', 'Recepción de asistentes, entrega de credenciales y café de bienvenida institucional', 1, 1, 500, '2026-11-06 08:30:00-03', '2026-11-06 09:30:00-03', 'Personal de Acreditación DETS'),
    ('Apertura Oficial y Conferencia Magistral', 'Acto de bienvenida y apertura institucional', 1, 3, 400, '2026-11-06 09:30:00-03', '2026-11-06 10:30:00-03', 'Autoridades DETS y Ministerio'),
    ('Taller Hands-on: Ciberseguridad Defensiva', 'Prácticas de hardening y respuesta a incidentes en entornos educativos', 3, 6, 35, '2026-11-06 11:00:00-03', '2026-11-06 13:00:00-03', 'Ing. Marcos Benítez'),
    ('Panel: Inteligencia Artificial en la Formación Técnica', 'Desafíos curriculares y adopción en IFTS', 2, 5, 60, '2026-11-06 14:00:00-03', '2026-11-06 16:00:00-03', 'Lic. Valeria Rossi'),
    ('Masterclass: Arquitecturas Cloud y DevOps', 'Diseño de aplicaciones escalables modernas', 4, 3, 120, '2026-11-06 16:30:00-03', '2026-11-06 18:00:00-03', 'Dr. Esteban Guida'),
    ('Mesa de Debate: Inserción Laboral y Prácticas Profesionalizantes en IFTS', 'Articulación entre institutos técnicos y el sector productivo tecnológico', 2, 4, 100, '2026-11-06 16:45:00-03', '2026-11-06 18:00:00-03', 'Directivos de IFTS y Cámaras Tecnológicas')
ON CONFLICT DO NOTHING;

-- Configuraciones de Funcionamiento del Sistema
INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria) VALUES
    ('aforo_maximo_confirmados', '{"cupo": 400}', 'Límite máximo de inscripciones confirmadas automáticas', 'GENERAL'),
    ('ventana_reconfirmacion_horas', '{"pre_evento_horas": 48, "vigencia_token_horas": 24}', 'Plazos para el envío de correos de confirmación y expiración', 'GENERAL'),
    ('cron_backup_automatico', '{"activo": true, "frecuencia": "0 2 * * *", "retencion_dias": 15, "directorio": "./backups", "nocturno_activo": true, "nocturno_hora": "02:00", "diurno_activo": true, "diurno_intervalo_min": 30, "diurno_inicio": "08:00", "diurno_fin": "19:00"}', 'Programación y retención de backups automáticos', 'BACKUP'),
    ('repositorio_git', '{"ruta_local": "/media/nestor/960GB/GIT_Congreso/", "remoto_url": "", "rama_default": "main", "sincronizacion_automatica": false}', 'Parámetros del repositorio Git local y sincronización con remoto', 'GIT'),
    ('politica_acreditacion', '{"exigir_dni_fisico": true, "mostrar_foto_operador": true, "reloj_animado_credencial": true}', 'Políticas de seguridad operativa en puerta', 'SEGURIDAD')
ON CONFLICT (clave) DO UPDATE 
SET valor = EXCLUDED.valor, descripcion = EXCLUDED.descripcion, categoria = EXCLUDED.categoria;

-- Eventos Base
INSERT INTO eventos (codigo, nombre, descripcion, anio, fecha_inicio, fecha_fin, activo) VALUES
    ('ETS_2026', '1er Congreso de Educación Técnica Superior 2026', 'Edición inaugural en Auditorio Polo Saavedra', 2026, '2026-11-06', '2026-11-06', TRUE),
    ('ETS_2027', '2do Congreso de Educación Técnica Superior 2027', 'Edición de consolidación y nuevas especialidades', 2027, '2027-11-05', '2027-11-05', TRUE)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre, anio = EXCLUDED.anio, fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin;

-- Asignar actividades existentes a ETS 2026
UPDATE actividades 
SET evento_id = (SELECT id FROM eventos WHERE codigo = 'ETS_2026') 
WHERE evento_id IS NULL;

-- Categorías Temáticas Normalizadas
INSERT INTO categorias_tematicas (nombre, descripcion) VALUES
    ('Inteligencia Artificial y Machine Learning', 'Modelos generativos, agentes y automatización inteligente'),
    ('Ciberseguridad y Protección de Datos', 'Defensa de infraestructuras, normativas y forensia digital'),
    ('Desarrollo Cloud y Arquitecturas Web', 'Sistemas distribuidos, microservicios, DevOps y APIs'),
    ('Robótica, Automatización e IoT', 'Sistemas embebidos, sensores y robótica aplicada'),
    ('Inserción Laboral y Prácticas IFTS', 'Pasantías, articulación con cámaras empresariales y mentorías'),
    ('Ciencia de Datos y Analítica', 'Big data, visualización estratégica y pipelines de datos')
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion;

-- Encuesta Modelo Inicial
INSERT INTO encuestas (id, evento_id, titulo, descripcion, etapa, es_obligatoria, activa)
VALUES (
    1,
    (SELECT id FROM eventos WHERE codigo = 'ETS_2026'),
    'Sondeo de Intereses y Preferencias Temáticas ETS 2026/2027',
    'Ayúdanos a priorizar los próximos talleres, masterclasses y disertaciones técnicas.',
    'INSCRIPCION',
    FALSE,
    TRUE
)
ON CONFLICT (id) DO UPDATE
SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion, etapa = EXCLUDED.etapa;

SELECT setval('encuestas_id_seq', (SELECT GREATEST(MAX(id), 1) FROM encuestas));

INSERT INTO encuesta_preguntas (id, encuesta_id, orden, texto_pregunta, tipo_pregunta, es_obligatoria, peso_ponderacion)
VALUES 
    (1, 1, 1, '¿Cuáles de las siguientes áreas técnicas consideras fundamentales para tu desarrollo profesional?', 'OPCION_MULTIPLE', TRUE, 1.20),
    (2, 1, 2, '¿Qué nivel de interés tienes en profundizar sobre Inteligencia Artificial aplicada en la industria?', 'CALIFICACION_1_A_5', FALSE, 1.00),
    (3, 1, 3, '¿Qué temática o taller específico te gustaría que se incorpore en la próxima edición?', 'TEXTO_ABIERTO', FALSE, 1.00)
ON CONFLICT (id) DO NOTHING;

SELECT setval('encuesta_preguntas_id_seq', (SELECT GREATEST(MAX(id), 3) FROM encuesta_preguntas));

INSERT INTO encuesta_opciones (pregunta_id, categoria_tematica_id, orden, texto_opcion, valor_ponderacion)
SELECT 1, c.id, 1, 'Inteligencia Artificial y Modelos Predictivos', 1.00 FROM categorias_tematicas c WHERE c.nombre = 'Inteligencia Artificial y Machine Learning'
UNION ALL
SELECT 1, c.id, 2, 'Ciberseguridad Ofensiva y Defensiva', 1.00 FROM categorias_tematicas c WHERE c.nombre = 'Ciberseguridad y Protección de Datos'
UNION ALL
SELECT 1, c.id, 3, 'Desarrollo Cloud & Microservicios', 1.00 FROM categorias_tematicas c WHERE c.nombre = 'Desarrollo Cloud y Arquitecturas Web'
UNION ALL
SELECT 1, c.id, 4, 'Robótica e Internet de las Cosas (IoT)', 1.00 FROM categorias_tematicas c WHERE c.nombre = 'Robótica, Automatización e IoT'
UNION ALL
SELECT 1, c.id, 5, 'Prácticas Profesionalizantes e Inserción en Empresas', 1.00 FROM categorias_tematicas c WHERE c.nombre = 'Inserción Laboral y Prácticas IFTS'
ON CONFLICT DO NOTHING;

