-- ============================================================================
-- ARQUITECTURA DE BASE DE DATOS - CONGRESO ETS (MULTI-EVENTO Y TEMARIOS)
-- ESPECIFICACIONES TÉCNICAS Y SCRIPTS DDL (POSTGRESQL 15+ / 16+)
-- NORMALIZACIÓN ESTRICTA EN TERCERA FORMA NORMAL (3FN)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLAS DE CATÁLOGOS Y DOMINIO MAESTRO (1FN, 2FN, 3FN)
-- ----------------------------------------------------------------------------

-- Catálogo de Roles de Usuarios
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    jerarquia INT NOT NULL DEFAULT 1, -- 1: Asistente, 2: Expositor, 3: Verificador, 4: Admin, 5: Superadmin
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Catálogo de Estados de Inscripción
CREATE TABLE IF NOT EXISTS estados_inscripcion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE, -- 'CONFIRMADO', 'LISTA_ESPERA', 'BAJA_AUTOMATICA', 'CANCELADO'
    nombre VARCHAR(50) NOT NULL,
    permite_ingreso BOOLEAN NOT NULL DEFAULT FALSE,
    descripcion TEXT
);

-- Catálogo de Puntos de Acceso Físicos (Normalización de ubicaciones en 3FN)
CREATE TABLE IF NOT EXISTS puntos_acceso (
    id SERIAL PRIMARY KEY,
    evento_id INT REFERENCES eventos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    ubicacion_fisica VARCHAR(150) NOT NULL,
    tipo_punto VARCHAR(30) NOT NULL DEFAULT 'PUESTO_ACCESO', -- 'PUESTO_ACCESO', 'SALA_CONFERENCIA', 'AULA_TALLER', 'ESPACIO_NETWORKING'
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Catálogo de Tipos de Acreditación (Normalización en 3FN)
CREATE TABLE IF NOT EXISTS tipos_acreditacion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE, -- 'ACCESO_GENERAL', 'ACTIVIDAD_AULA', 'TALLER', 'MASTERCLASS'
    descripcion VARCHAR(150) NOT NULL,
    requiere_actividad BOOLEAN NOT NULL DEFAULT FALSE
);

-- Catálogo de Eventos Institucionales / Ediciones Anuales en el Tiempo
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    lema VARCHAR(250),
    descripcion TEXT,
    anio INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    horario_apertura VARCHAR(10) DEFAULT '08:00',
    horario_cierre VARCHAR(10) DEFAULT '18:30',
    lugar_nombre VARCHAR(150),
    direccion VARCHAR(200),
    ciudad VARCHAR(100),
    cupo_maximo INT NOT NULL DEFAULT 400,
    estado VARCHAR(30) NOT NULL DEFAULT 'PUBLICADO', -- 'EN_PLANIFICACION', 'PUBLICADO', 'EN_CURSO', 'FINALIZADO', 'ARCHIVADO'
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Catálogo de Actividades / Talleres / Aulas (Normalización de aforos específicos)
CREATE TABLE IF NOT EXISTS actividades (
    id SERIAL PRIMARY KEY,
    evento_id INT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    tipo_acreditacion_id INT NOT NULL REFERENCES tipos_acreditacion(id) ON DELETE RESTRICT,
    punto_acceso_id INT NOT NULL REFERENCES puntos_acceso(id) ON DELETE RESTRICT,
    cupo_maximo INT NOT NULL DEFAULT 50,
    horario_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    horario_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    disertante_nombre VARCHAR(150),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Catálogo de Operadores de Acreditación
CREATE TABLE IF NOT EXISTS operadores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email_institucional VARCHAR(150) NOT NULL UNIQUE,
    punto_acceso_default_id INT NOT NULL REFERENCES puntos_acceso(id) ON DELETE RESTRICT,
    rol_id INT NOT NULL REFERENCES roles(id) DEFAULT 5,
    password_hash VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. TABLA PRINCIPAL DE USUARIOS E IDENTIDADES (MULTI-EVENTO 3FN)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_pasaporte VARCHAR(50) NOT NULL,
    evento_id INT NOT NULL REFERENCES eventos(id) ON DELETE RESTRICT DEFAULT 1,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    celular VARCHAR(30) NOT NULL,
    rol_principal_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    estado_inscripcion_id INT NOT NULL REFERENCES estados_inscripcion(id) ON DELETE RESTRICT,
    foto_url TEXT NULL,
    foto_metadata JSONB NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_usuario_dni_evento UNIQUE (dni_pasaporte, evento_id)
);

-- Relación N:N para Asignación de Roles Adicionales
CREATE TABLE IF NOT EXISTS usuario_roles_adicionales (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    asignado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (usuario_id, rol_id)
);

-- ----------------------------------------------------------------------------
-- 3. VALIDACIÓN DOCUMENTAL DE EXPOSITORES (HOMOLOGACIÓN DE PERGAMINOS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS homologaciones_expositores (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    estado_homologacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado_homologacion IN ('PENDIENTE', 'VALIDADO', 'RECHAZADO', 'ANULADO')),
    documentacion_presentada TEXT,
    observaciones TEXT,
    funcionario_validador_id INT NULL REFERENCES operadores(id) ON DELETE SET NULL,
    fecha_validacion TIMESTAMP WITH TIME ZONE NULL,
    funcionario_anulador_id INT NULL REFERENCES operadores(id) ON DELETE SET NULL,
    fecha_anulacion TIMESTAMP WITH TIME ZONE NULL,
    motivo_anulacion TEXT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. LISTA NEGRA (BLACKLIST)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS blacklist (
    id SERIAL PRIMARY KEY,
    dni_pasaporte VARCHAR(50) NOT NULL UNIQUE,
    motivo TEXT NOT NULL,
    registrado_por VARCHAR(100) DEFAULT 'SISTEMA',
    registrado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- ----------------------------------------------------------------------------
-- 5. RECONFIRMACIÓN INTERACTIVA (48 HORAS) Y TOKENS TEMPORALES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS confirmaciones_asistencia (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    emitido_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmado_en TIMESTAMP WITH TIME ZONE NULL,
    ip_confirmacion VARCHAR(45) NULL
);

-- ----------------------------------------------------------------------------
-- 6. ACREDITACIONES Y CONTROL DE ACCESOS EN SEDE (ANTI-PASSBACK COMPUESTO)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS acreditaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    operador_id INT NOT NULL REFERENCES operadores(id) ON DELETE RESTRICT,
    tipo_acreditacion_id INT NOT NULL REFERENCES tipos_acreditacion(id) ON DELETE RESTRICT,
    actividad_id INT NULL REFERENCES actividades(id) ON DELETE RESTRICT,
    punto_acceso_id INT NOT NULL REFERENCES puntos_acceso(id) ON DELETE RESTRICT,
    es_manual BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_manual TEXT NULL,
    tipo_movimiento VARCHAR(20) NOT NULL DEFAULT 'INGRESO' CHECK (tipo_movimiento IN ('INGRESO', 'EGRESO')),
    timestamp_acreditacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. CERTIFICADOS OFICIALES Y VALIDACIÓN CRIPTOGRÁFICA
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS certificados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_verificacion VARCHAR(50) NOT NULL UNIQUE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evento_id INT REFERENCES eventos(id) ON DELETE SET NULL DEFAULT 1,
    tipo_certificado VARCHAR(50) NOT NULL DEFAULT 'ASISTENCIA'
        CHECK (tipo_certificado IN ('ASISTENCIA', 'EXPOSITOR', 'DISERTANTE', 'ORGANIZADOR')),
    horas_catedra INT NOT NULL DEFAULT 16,
    emitido_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NULL,
    CONSTRAINT uq_usuario_tipo_certificado UNIQUE (usuario_id, tipo_certificado)
);

-- ----------------------------------------------------------------------------
-- 8. MÓDULO DE ENCUESTAS DINÁMICAS Y TEMARIOS (3FN)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categorias_tematicas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encuestas (
    id SERIAL PRIMARY KEY,
    evento_id INT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    etapa VARCHAR(50) NOT NULL DEFAULT 'INSCRIPCION'
        CHECK (etapa IN ('INSCRIPCION', 'CONFIRMACION', 'ACREDITACION', 'POST_EVENTO', 'SONDEO_ABIERTO')),
    es_obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encuesta_preguntas (
    id SERIAL PRIMARY KEY,
    encuesta_id INT NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    categoria_tematica_id INT NULL REFERENCES categorias_tematicas(id) ON DELETE SET NULL,
    orden INT NOT NULL DEFAULT 1,
    texto_pregunta TEXT NOT NULL,
    tipo_pregunta VARCHAR(50) NOT NULL DEFAULT 'OPCION_MULTIPLE'
        CHECK (tipo_pregunta IN ('OPCION_UNICA', 'OPCION_MULTIPLE', 'CALIFICACION_1_A_5', 'TEXTO_ABIERTO')),
    es_obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
    peso_ponderacion NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS encuesta_opciones (
    id SERIAL PRIMARY KEY,
    pregunta_id INT NOT NULL REFERENCES encuesta_preguntas(id) ON DELETE CASCADE,
    categoria_tematica_id INT NULL REFERENCES categorias_tematicas(id) ON DELETE SET NULL,
    orden INT NOT NULL DEFAULT 1,
    texto_opcion VARCHAR(250) NOT NULL,
    valor_ponderacion NUMERIC(4,2) NOT NULL DEFAULT 1.00
);

CREATE TABLE IF NOT EXISTS encuesta_respuestas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encuesta_id INT NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    rol_id INT NULL REFERENCES roles(id) ON DELETE SET NULL,
    ip_origen VARCHAR(45) NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_encuesta_usuario UNIQUE (encuesta_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS encuesta_respuestas_detalles (
    id BIGSERIAL PRIMARY KEY,
    respuesta_id UUID NOT NULL REFERENCES encuesta_respuestas(id) ON DELETE CASCADE,
    pregunta_id INT NOT NULL REFERENCES encuesta_preguntas(id) ON DELETE CASCADE,
    opcion_id INT NULL REFERENCES encuesta_opciones(id) ON DELETE SET NULL,
    categoria_tematica_id INT NULL REFERENCES categorias_tematicas(id) ON DELETE SET NULL,
    valor_numerico INT NULL,
    respuesta_texto TEXT NULL
);

-- ----------------------------------------------------------------------------
-- 9. CONFIGURACIÓN DEL SISTEMA, PUSH Y LOGS DE AUDITORÍA
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS configuraciones_sistema (
    clave VARCHAR(100) PRIMARY KEY,
    valor JSONB NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(50) DEFAULT 'GENERAL',
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suscripciones_push (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs_auditoria (
    id BIGSERIAL PRIMARY KEY,
    evento VARCHAR(100) NOT NULL,
    actor_usuario VARCHAR(100) NOT NULL,
    usuario_afectado_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    detalles JSONB NULL,
    ip_origen VARCHAR(45) NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Módulo de Journaling y Diagnóstico HTTP en tiempo real
CREATE TABLE IF NOT EXISTS logs_journaling (
    id BIGSERIAL PRIMARY KEY,
    nivel VARCHAR(10) NOT NULL, -- 'ERROR', 'WARN', 'INFO'
    metodo VARCHAR(10) NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    status_code INTEGER NOT NULL,
    duracion_ms INTEGER,
    ip_origen VARCHAR(45),
    usuario_email VARCHAR(120),
    request_headers JSONB,
    request_body JSONB,
    error_detalles TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_journaling_timestamp ON logs_journaling(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_journaling_nivel ON logs_journaling(nivel, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_journaling_status ON logs_journaling(status_code);

-- ----------------------------------------------------------------------------
-- 10. ÍNDICES DE RENDIMIENTO Y CONSTRAINTS COMPUESTOS
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_principal_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado_inscripcion_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_evento ON usuarios(evento_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_dni_evento ON usuarios(dni_pasaporte, evento_id);

CREATE INDEX IF NOT EXISTS idx_acreditaciones_usuario ON acreditaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_acreditaciones_actividad ON acreditaciones(actividad_id);
CREATE INDEX IF NOT EXISTS idx_acreditaciones_timestamp ON acreditaciones(timestamp_acreditacion);

-- Índice optimizado para auditoría y consulta rápida de último movimiento
CREATE INDEX IF NOT EXISTS idx_acreditaciones_usuario_fecha 
    ON acreditaciones(usuario_id, punto_acceso_id, timestamp_acreditacion DESC);

CREATE INDEX IF NOT EXISTS idx_certificados_usuario ON certificados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_certificados_codigo ON certificados(codigo_verificacion);
CREATE INDEX IF NOT EXISTS idx_certificados_evento ON certificados(evento_id);

CREATE INDEX IF NOT EXISTS idx_encuestas_evento ON encuestas(evento_id);
CREATE INDEX IF NOT EXISTS idx_encuestas_etapa ON encuestas(etapa, activa);
CREATE INDEX IF NOT EXISTS idx_encuesta_preguntas_encuesta ON encuesta_preguntas(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_opciones_pregunta ON encuesta_opciones(pregunta_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_respuestas_encuesta ON encuesta_respuestas(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_respuestas_usuario ON encuesta_respuestas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_respuestas_detalles_resp ON encuesta_respuestas_detalles(respuesta_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_respuestas_detalles_cat ON encuesta_respuestas_detalles(categoria_tematica_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_respuestas_detalles_preg ON encuesta_respuestas_detalles(pregunta_id);

-- ----------------------------------------------------------------------------
-- 11. FUNCIÓN TRANSACCIONAL CON BLOQUEO PESIMISTA Y GESTIÓN MULTI-EVENTO (3FN)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION registrar_usuario_seguro(
    p_dni_pasaporte VARCHAR(50),
    p_nombre VARCHAR(100),
    p_apellido VARCHAR(100),
    p_email VARCHAR(150),
    p_celular VARCHAR(30),
    p_rol_principal_id INT,
    p_foto_url TEXT,
    p_foto_metadata JSONB,
    p_es_superadmin_override BOOLEAN DEFAULT FALSE,
    p_evento_id INT DEFAULT NULL
) RETURNS TABLE(new_id UUID, estado_codigo VARCHAR(30)) AS $$
DECLARE
    v_count INT;
    v_estado_id INT;
    v_estado_codigo VARCHAR(30);
    v_inserted_id UUID;
    v_id_confirmado INT;
    v_id_espera INT;
    v_id_cancelado INT;
    v_id_baja INT;
    v_en_blacklist BOOLEAN;
    v_max_cupo INT := 400;
    v_evento_id INT;
    v_usuario_existente_id UUID;
    v_estado_actual_id INT;
BEGIN
    -- Determinar evento de destino (por parámetro o evento activo por defecto)
    IF p_evento_id IS NOT NULL THEN
        v_evento_id := p_evento_id;
    ELSE
        SELECT id INTO v_evento_id FROM eventos WHERE activo = TRUE ORDER BY anio DESC LIMIT 1;
        IF v_evento_id IS NULL THEN
            v_evento_id := 1;
        END IF;
    END IF;

    -- Obtener cupo dinámico del evento
    SELECT COALESCE(cupo_maximo, 400) INTO v_max_cupo FROM eventos WHERE id = v_evento_id;
    IF v_max_cupo IS NULL THEN
        v_max_cupo := 400;
    END IF;

    -- Obtener IDs de estados normalizados
    SELECT id INTO v_id_confirmado FROM estados_inscripcion WHERE codigo = 'CONFIRMADO';
    SELECT id INTO v_id_espera FROM estados_inscripcion WHERE codigo = 'LISTA_ESPERA';
    SELECT id INTO v_id_sancionado FROM estados_inscripcion WHERE codigo = 'SANCIONADO';
    SELECT id INTO v_id_cancelado FROM estados_inscripcion WHERE codigo = 'CANCELADO';
    SELECT id INTO v_id_baja FROM estados_inscripcion WHERE codigo = 'BAJA_AUTOMATICA';

    -- Validar si el DNI figura en blacklist
    SELECT EXISTS (
        SELECT 1 FROM blacklist WHERE dni_pasaporte = p_dni_pasaporte AND activo = TRUE
    ) INTO v_en_blacklist;

    -- Determinar estado que correspondería
    IF p_es_superadmin_override THEN
        PERFORM set_config('app.superadmin_override', 'true', true);
        v_estado_id := v_id_confirmado;
        v_estado_codigo := 'CONFIRMADO';
    ELSIF v_en_blacklist THEN
        PERFORM set_config('app.superadmin_override', 'false', true);
        v_estado_id := v_id_sancionado;
        v_estado_codigo := 'SANCIONADO';
    ELSE
        PERFORM set_config('app.superadmin_override', 'false', true);

        -- Bloqueo pesimista del evento para control estricto de concurrencia
        PERFORM 1 FROM eventos WHERE id = v_evento_id FOR UPDATE;

        SELECT COUNT(*) INTO v_count 
        FROM usuarios 
        WHERE estado_inscripcion_id = v_id_confirmado AND evento_id = v_evento_id;

        -- Cupo protegido protocolar: Autoridades (Rol 4) y Expositores (Rol 3) tienen reserva institucional
        IF p_rol_principal_id IN (3, 4) THEN
            v_estado_id := v_id_confirmado;
            v_estado_codigo := 'CONFIRMADO';
        ELSIF v_count < v_max_cupo THEN
            v_estado_id := v_id_confirmado;
            v_estado_codigo := 'CONFIRMADO';
        ELSE
            v_estado_id := v_id_espera;
            v_estado_codigo := 'LISTA_ESPERA';
        END IF;
    END IF;

    -- Verificar si el usuario ya existe en este evento específico
    SELECT id, estado_inscripcion_id INTO v_usuario_existente_id, v_estado_actual_id
    FROM usuarios
    WHERE dni_pasaporte = p_dni_pasaporte AND evento_id = v_evento_id;

    IF v_usuario_existente_id IS NOT NULL THEN
        -- Si estaba CANCELADO o BAJA_AUTOMATICA, se reactiva con sus nuevos datos y nuevo estado
        IF v_estado_actual_id IN (v_id_cancelado, v_id_baja) THEN
            UPDATE usuarios
            SET nombre = p_nombre,
                apellido = p_apellido,
                email = p_email,
                celular = p_celular,
                rol_principal_id = p_rol_principal_id,
                estado_inscripcion_id = v_estado_id,
                foto_url = COALESCE(p_foto_url, foto_url),
                foto_metadata = COALESCE(p_foto_metadata, foto_metadata),
                actualizado_en = NOW()
            WHERE id = v_usuario_existente_id
            RETURNING id INTO v_inserted_id;

            -- Registrar en auditoría la reactivación
            INSERT INTO logs_auditoria (evento, actor_usuario, usuario_afectado_id, detalles, timestamp)
            VALUES ('REINSCRIPCION_USUARIO_REACTIVADO', 'SISTEMA', v_inserted_id, 
                    json_build_object('dni', p_dni_pasaporte, 'evento_id', v_evento_id, 'nuevo_estado', v_estado_codigo)::jsonb, NOW());
        ELSE
            -- Ya existe activo en este evento
            RAISE EXCEPTION 'ERR_DNI_ALREADY_EXISTS: El DNI ya se encuentra registrado para este evento.'
                USING ERRCODE = '23505';
        END IF;
    ELSE
        -- Inserción limpia de nueva persona/inscripción en el evento
        INSERT INTO usuarios (
            dni_pasaporte, nombre, apellido, email, celular,
            rol_principal_id, estado_inscripcion_id, foto_url, foto_metadata, evento_id
        ) VALUES (
            p_dni_pasaporte, p_nombre, p_apellido, p_email, p_celular,
            p_rol_principal_id, v_estado_id, p_foto_url, p_foto_metadata, v_evento_id
        ) RETURNING id INTO v_inserted_id;
    END IF;

    -- Si el rol principal es 'Expositor', inicializar homologación si no existe
    IF EXISTS (SELECT 1 FROM roles WHERE id = p_rol_principal_id AND nombre = 'Expositor') THEN
        INSERT INTO homologaciones_expositores (usuario_id, estado_homologacion)
        VALUES (v_inserted_id, 'PENDIENTE')
        ON CONFLICT (usuario_id) DO NOTHING;
    END IF;

    RETURN QUERY SELECT v_inserted_id, v_estado_codigo;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 12. TRIGGER DE INTERCEPCIÓN PARA BLACKLIST (CON RESPETO A SUPERADMIN OVERRIDE)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_check_blacklist()
RETURNS TRIGGER AS $$
DECLARE
    v_id_sancionado INT;
BEGIN
    -- Si la sesión tiene superadmin_override activo en transacción, permitir
    IF current_setting('app.superadmin_override', true) = 'true' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (SELECT 1 FROM blacklist WHERE dni_pasaporte = NEW.dni_pasaporte AND activo = TRUE) THEN
        SELECT id INTO v_id_sancionado FROM estados_inscripcion WHERE codigo = 'SANCIONADO';
        NEW.estado_inscripcion_id := v_id_sancionado;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_intercept_blacklist ON usuarios;
CREATE TRIGGER trigger_intercept_blacklist
BEFORE INSERT ON usuarios
FOR EACH ROW
EXECUTE FUNCTION trg_check_blacklist();

-- ----------------------------------------------------------------------------
-- 13. PRIVILEGIOS DE APLICACIÓN
-- ----------------------------------------------------------------------------

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO congreso_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO congreso_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO congreso_app;
