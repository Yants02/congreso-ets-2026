/**
 * Human-like End-to-End Automated User & Admin Flow Simulation
 * Tests every UI endpoint, form inputs, modals, CRUD operations,
 * error boundaries and database mutations across the entire system.
 */

const BASE_FRONTEND = 'http://127.0.0.1:3000';
const BASE_BACKEND = 'http://127.0.0.1:4000';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details: string) {
  const status = passed ? 'PASS' : 'FAIL';
  results.push({ step, status, details });
  console.log(`[${status}] ${step} -> ${details}`);
}

async function runSimulation() {
  console.log('========================================================================');
  console.log('🤖 INICIANDO SIMULACIÓN DE PRUEBAS HUMANAS E2E - CONGRESO ETS 2026');
  console.log('========================================================================\n');

  let sessionCookie = '';

  // ---------------------------------------------------------------------------
  // 1. LANDING & PÁGINAS PÚBLICAS
  // ---------------------------------------------------------------------------
  try {
    const resHome = await fetch(`${BASE_FRONTEND}/`);
    record('1.1 Navegación a Home (/)', resHome.ok, `HTTP ${resHome.status}`);
  } catch (err: any) {
    record('1.1 Navegación a Home (/)', false, err.message);
  }

  try {
    const resParticipa = await fetch(`${BASE_FRONTEND}/participa`);
    record('1.2 Navegación a Formulario de Inscripción (/participa)', resParticipa.ok, `HTTP ${resParticipa.status}`);
  } catch (err: any) {
    record('1.2 Navegación a Formulario de Inscripción (/participa)', false, err.message);
  }

  try {
    const resLogin = await fetch(`${BASE_FRONTEND}/login`);
    record('1.3 Navegación a Login Administrativo (/login)', resLogin.ok, `HTTP ${resLogin.status}`);
  } catch (err: any) {
    record('1.3 Navegación a Login Administrativo (/login)', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 2. FORMULARIO DE REGISTRO / PARTICIPACIÓN
  // ---------------------------------------------------------------------------
  try {
    // 2.1 Carga de roles y vacantes
    const resRoles = await fetch(`${BASE_FRONTEND}/api/registro/roles`);
    const dataRoles = await resRoles.json();
    record('2.1 Carga de Roles para Asistentes', resRoles.ok && dataRoles.roles?.length > 0, `Total roles: ${dataRoles.roles?.length}`);

    const resVac = await fetch(`${BASE_FRONTEND}/api/vacantes`);
    const dataVac = await resVac.json();
    record('2.2 Consulta de Vacantes y Aforos', resVac.ok && dataVac.cupo_maximo > 0, `Cupos libres: ${dataVac.cupos_disponibles}/${dataVac.cupo_maximo}`);

    // 2.2 Simular envío de formulario con validaciones humanas
    // Test A: DNI inválido
    const resBadDni = await fetch(`${BASE_FRONTEND}/api/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dni_pasaporte: '12', // muy corto
        nombre: 'Juan',
        apellido: 'Perez',
        email: 'juan@test.com',
        celular: '1122334455',
        rol_principal_id: 1,
        consentimiento_datos: true,
      }),
    });
    record('2.3 Validación formulario: Rechazo de DNI inválido', !resBadDni.ok, `HTTP ${resBadDni.status}`);

    // Test B: Inscripción exitosa válida
    const uniqueDni = `99${Date.now().toString().slice(-6)}`;
    const testEmail = `humano.${uniqueDni}@congreso.test`;
    const resRegOk = await fetch(`${BASE_FRONTEND}/api/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dni_pasaporte: uniqueDni,
        nombre: 'Estudiante',
        apellido: 'Simulado',
        email: testEmail,
        celular: '1198765432',
        rol_principal_id: 2,
        roles_adicionales_ids: [],
        consentimiento_datos: true,
      }),
    });
    const regData = await resRegOk.json();
    record(
      '2.4 Registro de Participante válido',
      resRegOk.ok && (regData.ok || regData.success),
      `Estado: ${regData.estado} - QR Token generado: ${Boolean(regData.qr_token)}`
    );

    // Test C: Consulta de identificacion del participante recién registrado
    const resCred = await fetch(`${BASE_FRONTEND}/api/identificacion/${uniqueDni}`);
    const credData = await resCred.json();
    record(
      '2.5 Consulta de Identificación Digital',
      resCred.ok && credData.usuario?.dni_pasaporte === uniqueDni,
      `Nombre en identificacion: ${credData.usuario?.nombre} ${credData.usuario?.apellido}`
    );

  } catch (err: any) {
    record('2. Registro de Participación', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 3. AUTENTICACIÓN ADMINISTRATIVA (LOGIN)
  // ---------------------------------------------------------------------------
  let authToken = '';

  try {
    const resAuth = await fetch(`${BASE_FRONTEND}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin.congreso@bue.edu.ar',
        password: 'SuperAdmin2026!',
        recordar: true,
      }),
    });

    const authData = await resAuth.json();
    const rawCookies = resAuth.headers.get('set-cookie') || '';
    sessionCookie = rawCookies.split(';')[0]; // Capturar cookie de sesión HTTP-Only
    authToken = authData.token || '';

    record(
      '3.1 Login Superadmin (Centro de Control)',
      resAuth.ok && authData.ok === true,
      `Operador: ${authData.operador?.nombre} (Jerarquía ${authData.operador?.jerarquia})`
    );

    // 3.2 Verificar sesión (/api/admin/auth/me)
    const resMe = await fetch(`${BASE_FRONTEND}/api/admin/auth/me`, {
      headers: {
        Cookie: sessionCookie,
        Authorization: `Bearer ${authToken}`,
      },
    });
    const meData = await resMe.json();
    record(
      '3.2 Verificación de Sesión Activa (/api/admin/auth/me)',
      resMe.ok && meData.operador?.email === 'superadmin.congreso@bue.edu.ar',
      `Autenticado como: ${meData.operador?.email}`
    );

  } catch (err: any) {
    record('3. Autenticación Administrativa', false, err.message);
  }

  const adminHeaders = {
    'Content-Type': 'application/json',
    Cookie: sessionCookie,
    Authorization: `Bearer ${authToken}`,
  };

  // ---------------------------------------------------------------------------
  // 4. TABLERO GERENCIAL & CATÁLOGOS CONSOLIDADOS
  // ---------------------------------------------------------------------------
  try {
    const resDash = await fetch(`${BASE_FRONTEND}/api/admin/dashboard/gerencial`, { headers: adminHeaders });
    const dashData = await resDash.json();
    record('4.1 Métricas Tablero 360°', resDash.ok, `Confirmados: ${dashData.resumen?.confirmados}, Recintos: ${dashData.puntos_acceso?.length}`);

    const resCat = await fetch(`${BASE_FRONTEND}/api/admin/catalogos`, { headers: adminHeaders });
    const catData = await resCat.json();
    record(
      '4.2 Carga de Catálogos Consolidados',
      resCat.ok && Array.isArray(catData.roles),
      `Roles: ${catData.roles?.length}, Estados: ${catData.estados?.length}, Recintos: ${catData.puntos?.length}`
    );
  } catch (err: any) {
    record('4. Tablero y Catálogos', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 5. EDICIONES & EVENTOS (Verificar no reaparición del bug de actualizado_en)
  // ---------------------------------------------------------------------------
  try {
    // 5.1 Listar eventos
    const resEvList = await fetch(`${BASE_FRONTEND}/api/admin/eventos`, { headers: adminHeaders });
    const evListData = await resEvList.json();
    record('5.1 Listar Ediciones de Eventos', resEvList.ok && evListData.eventos?.length > 0, `Total eventos: ${evListData.eventos?.length}`);

    // 5.2 Crear nuevo evento
    const testEvCode = `ETS-SIM-${Date.now().toString().slice(-4)}`;
    const resCreateEv = await fetch(`${BASE_FRONTEND}/api/admin/eventos`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        codigo: testEvCode,
        nombre: 'Jornada Tecnológica de Innovación',
        anio: 2026,
        fecha_inicio: '2026-11-10T09:00:00.000Z',
        fecha_fin: '2026-11-10T18:00:00.000Z',
        cupo_maximo: 350,
        activo: true,
      }),
    });
    const evCreated = await resCreateEv.json();
    record('5.2 Crear Evento Modal Form', resCreateEv.ok && evCreated.ok === true, `Evento ID: ${evCreated.evento?.id} - Código: ${evCreated.evento?.codigo}`);

    if (evCreated.evento?.id) {
      const evId = evCreated.evento.id;

      // 5.3 Editar / Actualizar Evento (AQUÍ DABA EL ERROR PREVIO)
      const resUpdEv = await fetch(`${BASE_FRONTEND}/api/admin/eventos/${evId}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          nombre: 'Jornada Tecnológica de Innovación (Actualizada)',
          cupo_maximo: 450,
        }),
      });
      const evUpdated = await resUpdEv.json();
      record(
        '5.3 Editar y Guardar Evento (comprobación actualizado_en)',
        resUpdEv.ok && evUpdated.ok === true && evUpdated.evento?.actualizado_en !== undefined,
        `Respuesta HTTP: ${resUpdEv.status} - Guardado limpio sin error de columna`
      );

      // 5.4 Eliminar evento de prueba
      const resDelEv = await fetch(`${BASE_FRONTEND}/api/admin/eventos/${evId}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      record('5.4 Eliminar Evento de prueba', resDelEv.ok, `HTTP ${resDelEv.status}`);
    }
  } catch (err: any) {
    record('5. Módulo Ediciones & Eventos', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 6. RECINTOS Y PUNTOS DE ACCESO (Verificar capacidad_maxima)
  // ---------------------------------------------------------------------------
  try {
    // 6.1 Listar puntos de acceso
    const resPuntos = await fetch(`${BASE_FRONTEND}/api/admin/puntos-acceso`, { headers: adminHeaders });
    const puntosData = await resPuntos.json();
    const listaPuntos = puntosData.puntos_acceso || puntosData.puntos || [];
    record('6.1 Listar Recintos y Puertas', resPuntos.ok && listaPuntos.length > 0, `Total recintos: ${listaPuntos.length}`);

    // 6.2 Crear nuevo recinto
    const resCreatePunto = await fetch(`${BASE_FRONTEND}/api/admin/puntos-acceso`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        nombre: `Sala de Realidad Aumentada ${Date.now().toString().slice(-4)}`,
        ubicacion_fisica: 'Tercer Piso - Ala Norte',
        tipo_punto: 'AULA_SALON',
        capacidad_maxima: 45,
        evento_id: 1,
        activo: true,
      }),
    });
    const puntoCreated = await resCreatePunto.json();
    const puntoObj = puntoCreated.punto_acceso || puntoCreated.punto;
    record(
      '6.2 Crear Recinto con capacidad_maxima',
      resCreatePunto.ok && puntoCreated.ok === true,
      `Punto ID: ${puntoObj?.id} - Capacidad: ${puntoObj?.capacidad_maxima}`
    );

    if (puntoObj?.id) {
      const puntoId = puntoObj.id;

      // 6.3 Modificar aforo del recinto
      const resUpdPunto = await fetch(`${BASE_FRONTEND}/api/admin/puntos-acceso/${puntoId}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          capacidad_maxima: 55,
          ubicacion_fisica: 'Tercer Piso - Ala Norte (Remodelada)',
        }),
      });
      const puntoUpdated = await resUpdPunto.json();
      const puntoUpdObj = puntoUpdated.punto_acceso || puntoUpdated.punto;
      record(
        '6.3 Actualizar aforo del recinto',
        resUpdPunto.ok && puntoUpdated.ok === true && puntoUpdObj?.capacidad_maxima === 55,
        `Nuevo aforo verificado: ${puntoUpdObj?.capacidad_maxima}`
      );

      // 6.4 Eliminar o desactivar recinto de prueba
      const resDelPunto = await fetch(`${BASE_FRONTEND}/api/admin/puntos-acceso/${puntoId}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      record('6.4 Eliminar Recinto de prueba', resDelPunto.ok, `HTTP ${resDelPunto.status}`);
    }
  } catch (err: any) {
    record('6. Módulo Recintos y Puntos de Acceso', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 7. CRONOGRAMA & GESTIÓN DE ACTIVIDADES
  // ---------------------------------------------------------------------------
  try {
    const resAct = await fetch(`${BASE_FRONTEND}/api/admin/actividades`, { headers: adminHeaders });
    const actData = await resAct.json();
    record('7.1 Listar Cronograma de Actividades', resAct.ok && Array.isArray(actData.actividades), `Actividades: ${actData.actividades?.length}`);

    // Crear actividad
    const resCreateAct = await fetch(`${BASE_FRONTEND}/api/admin/actividades`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        evento_id: 1,
        nombre: `Taller Práctico de Microcontroladores ${Date.now().toString().slice(-4)}`,
        descripcion: 'Simulación interactiva de laboratorio',
        tipo_acreditacion_id: 3,
        punto_acceso_id: 4,
        cupo_maximo: 30,
        horario_inicio: '2026-11-06T15:00:00.000Z',
        horario_fin: '2026-11-06T16:30:00.000Z',
        disertante_nombre: 'Ing. Simulado Antigravity',
      }),
    });
    const actCreated = await resCreateAct.json();
    record('7.2 Crear Actividad en Sala con Cupo', resCreateAct.ok && actCreated.ok === true, `Actividad ID: ${actCreated.actividad?.id}`);

    if (actCreated.actividad?.id) {
      const actId = actCreated.actividad.id;
      // Actualizar actividad
      const resUpdAct = await fetch(`${BASE_FRONTEND}/api/admin/actividades/${actId}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          cupo_maximo: 35,
        }),
      });
      record('7.3 Modificar Cupo de Actividad', resUpdAct.ok, `HTTP ${resUpdAct.status}`);

      // Eliminar actividad
      const resDelAct = await fetch(`${BASE_FRONTEND}/api/admin/actividades/${actId}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      record('7.4 Eliminar Actividad de prueba', resDelAct.ok, `HTTP ${resDelAct.status}`);
    }
  } catch (err: any) {
    record('7. Módulo Actividades', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 8. GESTIÓN DE PARTICIPANTES & AUDITORÍA
  // ---------------------------------------------------------------------------
  try {
    const resUsers = await fetch(`${BASE_FRONTEND}/api/admin/usuarios?limit=10`, { headers: adminHeaders });
    const usersData = await resUsers.json();
    record('8.1 Búsqueda y Paginación de Participantes', resUsers.ok && Array.isArray(usersData.usuarios), `Total listados: ${usersData.usuarios?.length}`);

    const resAudit = await fetch(`${BASE_FRONTEND}/api/admin/auditoria?limit=5`, { headers: adminHeaders });
    const auditData = await resAudit.json();
    record('8.2 Consulta de Bitácora Forense de Auditoría', resAudit.ok && Array.isArray(auditData.logs), `Últimos logs recuperados: ${auditData.logs?.length}`);
  } catch (err: any) {
    record('8. Participantes y Auditoría', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n========================================================================');
  console.log(`📊 REPORTE DE RESULTADOS DE PRUEBAS HUMANAS E2E:`);
  console.log(`Total de pruebas ejecutadas: ${total}`);
  console.log(`Superadas con éxito:       ${passed}`);
  console.log(`Fallidas con incidencias:  ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSimulation();
