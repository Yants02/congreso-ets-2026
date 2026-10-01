process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import { query } from '../src/lib/db';
import { signSessionToken } from '../src/lib/authService';

const PORT = 4002; // Puerto dedicado para esta prueba

function request(
  options: http.RequestOptions,
  postData?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 500, body: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, body: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runAdminCrudTests() {
  console.log('🧪 Iniciando suite de pruebas de CRUDs y Buscadores Backend...\n');

  const server = app.listen(PORT);
  let failed = 0;
  let passed = 0;

  function assert(name: string, condition: boolean, extraInfo?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}${extraInfo ? ` -> ${extraInfo}` : ''}`);
      failed++;
    }
  }

  // Generamos un token válido de Superadmin (jerarquía 5)
  const token = await signSessionToken({
    sub: 1,
    email: 'superadmin.congreso@bue.edu.ar',
    nombre: 'Super',
    apellido: 'Admin',
    rol_id: 1,
    rol_nombre: 'SUPERADMIN',
    jerarquia: 5,
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    // 1. Catálogos Consolidados
    const resCat = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/catalogos',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/catalogos entrega roles, estados, puntos, tipos y actividades',
      resCat.status === 200 &&
        resCat.body.roles &&
        resCat.body.estados &&
        resCat.body.puntos_acceso &&
        resCat.body.actividades,
      JSON.stringify(resCat.body)
    );

    // 2. Usuarios: Buscador con filtros
    const resUsers = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/usuarios?limit=5&q=a',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/usuarios ejecuta búsqueda con filtro q y paginación',
      resUsers.status === 200 && Array.isArray(resUsers.body.usuarios),
      JSON.stringify(resUsers.body)
    );

    // 3. Usuarios: CRUD (Alta, Consulta de detalle y Baja)
    const testDni = `CRUD_${Date.now().toString().slice(-6)}`;
    const resCreateUser = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/admin/usuarios',
        method: 'POST',
        headers: authHeaders,
      },
      {
        dni_pasaporte: testDni,
        nombre: 'Usuario',
        apellido: 'CrudTest',
        email: `crud_${testDni}@test.com`,
        celular: '+5491100000000',
        rol_principal_id: 1,
        es_superadmin_override: true,
      }
    );
    assert(
      'POST /api/admin/usuarios registra un nuevo inscripto por mostrador/admin',
      resCreateUser.status === 201 && resCreateUser.body.usuario?.id,
      JSON.stringify(resCreateUser.body)
    );

    const createdUserId = resCreateUser.body.usuario?.id;

    if (createdUserId) {
      const resDetail = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/admin/usuarios/${createdUserId}`,
        method: 'GET',
        headers: authHeaders,
      });
      assert(
        'GET /api/admin/usuarios/:id devuelve el detalle y perfil del inscripto',
        resDetail.status === 200 && resDetail.body.usuario?.dni_pasaporte === testDni,
        JSON.stringify(resDetail.body)
      );

      // Prueba de cambio de estado usando estado_id (como envía el frontend)
      const resPutEstadoId = await request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: `/api/admin/usuarios/${createdUserId}`,
          method: 'PUT',
          headers: authHeaders,
        },
        {
          estado_id: 2, // LISTA_ESPERA
        }
      );
      assert(
        'PUT /api/admin/usuarios/:id actualiza estado usando estado_id',
        resPutEstadoId.status === 200 && resPutEstadoId.body.ok === true,
        JSON.stringify(resPutEstadoId.body)
      );

      const resVerifyEstado1 = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/admin/usuarios/${createdUserId}`,
        method: 'GET',
        headers: authHeaders,
      });
      assert(
        'GET /api/admin/usuarios/:id confirma que el estado_id persistió en BD (LISTA_ESPERA)',
        resVerifyEstado1.body.usuario?.estado_codigo === 'LISTA_ESPERA' && resVerifyEstado1.body.usuario?.estado_id === 2,
        JSON.stringify(resVerifyEstado1.body.usuario)
      );

      // Prueba de cambio de estado usando estado_codigo
      const resPutEstadoCod = await request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: `/api/admin/usuarios/${createdUserId}`,
          method: 'PUT',
          headers: authHeaders,
        },
        {
          estado_codigo: 'CANCELADO',
        }
      );
      assert(
        'PUT /api/admin/usuarios/:id actualiza estado usando estado_codigo',
        resPutEstadoCod.status === 200 && resPutEstadoCod.body.ok === true,
        JSON.stringify(resPutEstadoCod.body)
      );

      const resVerifyEstado2 = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/admin/usuarios/${createdUserId}`,
        method: 'GET',
        headers: authHeaders,
      });
      assert(
        'GET /api/admin/usuarios/:id confirma que el estado_codigo persistió en BD (CANCELADO)',
        resVerifyEstado2.body.usuario?.estado_codigo === 'CANCELADO' && resVerifyEstado2.body.usuario?.estado_id === 4,
        JSON.stringify(resVerifyEstado2.body.usuario)
      );

      const resDeleteUser = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/admin/usuarios/${createdUserId}`,
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(
        'DELETE /api/admin/usuarios/:id elimina al usuario y asienta auditoría',
        resDeleteUser.status === 200 && resDeleteUser.body.ok === true,
        JSON.stringify(resDeleteUser.body)
      );
    }

    // 4. Actividades: Buscador y CRUD
    const resAct = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/actividades?q=Taller',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/actividades busca por texto en nombre y disertante',
      resAct.status === 200 && Array.isArray(resAct.body.actividades),
      JSON.stringify(resAct.body)
    );

    const resCreateAct = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/admin/actividades',
        method: 'POST',
        headers: authHeaders,
      },
      {
        evento_id: 1,
        nombre: `Taller Automatizado ${Date.now()}`,
        descripcion: 'Taller de prueba',
        tipo_acreditacion_id: 3,
        punto_acceso_id: 4,
        cupo_maximo: 25,
        horario_inicio: '2026-11-06T10:00:00.000Z',
        horario_fin: '2026-11-06T12:00:00.000Z',
        disertante_nombre: 'Ing. Test',
        activo: true,
      }
    );
    assert(
      'POST /api/admin/actividades crea actividad con validación de horarios',
      resCreateAct.status === 201 && resCreateAct.body.actividad?.id,
      JSON.stringify(resCreateAct.body)
    );

    const actId = resCreateAct.body.actividad?.id;
    if (actId) {
      const resDelAct = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/admin/actividades/${actId}`,
        method: 'DELETE',
        headers: authHeaders,
      });
      assert('DELETE /api/admin/actividades/:id elimina actividad', resDelAct.status === 200);
    }

    // 5. Puntos de Acceso
    const resPuntos = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/puntos-acceso?q=Puerta',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/puntos-acceso busca por ubicación y nombre',
      resPuntos.status === 200 && Array.isArray(resPuntos.body.puntos_acceso),
      JSON.stringify(resPuntos.body)
    );

    // 6. Operadores de Puerta
    const resOps = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/operadores?q=Operador',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/operadores busca operadores por nombre o correo',
      resOps.status === 200 && Array.isArray(resOps.body.operadores),
      JSON.stringify(resOps.body)
    );

    // 7. Catálogo de Materias Canónicas
    const resCatAct = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/catalogo-actividades',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/catalogo-actividades lista materias canónicas institucionales',
      resCatAct.status === 200 && Array.isArray(resCatAct.body.catalogo),
      JSON.stringify(resCatAct.body)
    );

    // 8. Lista Negra (Blacklist)
    const testBlacklistDni = `BL_${Date.now().toString().slice(-6)}`;
    const resBLCreate = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/admin/blacklist',
        method: 'POST',
        headers: authHeaders,
      },
      {
        dni_pasaporte: testBlacklistDni,
        motivo: 'Motivo de prueba automatizada de exclusión',
      }
    );
    assert(
      'POST /api/admin/blacklist agrega DNI a lista negra',
      resBLCreate.status === 201 && resBLCreate.body.registro?.dni_pasaporte === testBlacklistDni,
      JSON.stringify(resBLCreate.body)
    );

    const blId = resBLCreate.body.registro?.id;
    if (blId) {
      const resBLDel = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/admin/blacklist/${blId}`,
        method: 'DELETE',
        headers: authHeaders,
      });
      assert('DELETE /api/admin/blacklist/:id retira restricción', resBLDel.status === 200);
    }

    // 9. Acreditaciones
    const resAcred = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/acreditaciones?limit=5',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/acreditaciones busca movimientos y accesos con paginación',
      resAcred.status === 200 && Array.isArray(resAcred.body.acreditaciones),
      JSON.stringify(resAcred.body)
    );

    // 10. Certificados
    const resCert = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/certificados?limit=5',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/certificados busca certificados emitidos',
      resCert.status === 200 && Array.isArray(resCert.body.certificados),
      JSON.stringify(resCert.body)
    );

    // 11. Homologaciones
    const resHomol = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/homologaciones',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/homologaciones busca postulaciones de ponentes',
      resHomol.status === 200 && Array.isArray(resHomol.body.homologaciones),
      JSON.stringify(resHomol.body)
    );

    // 12. Eventos
    const resEv = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/eventos',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/eventos lista y busca ediciones con totales de inscriptos',
      resEv.status === 200 && Array.isArray(resEv.body.eventos),
      JSON.stringify(resEv.body)
    );

    // 13. Configuración
    const resConf = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/configuracion',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/configuracion lista parámetros del sistema',
      resConf.status === 200 && Array.isArray(resConf.body.configuracion),
      JSON.stringify(resConf.body)
    );

    // 14. Auditoría
    const resAud = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/auditoria?limit=5',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/auditoria busca registros forenses en bitácora inmutable',
      resAud.status === 200 && Array.isArray(resAud.body.logs),
      JSON.stringify(resAud.body)
    );

  } catch (err: any) {
    console.error('Error imprevisto durante pruebas:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n========================================');
  console.log(`Pruebas CRUD Pasadas: ${passed} | Fallidas: ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdminCrudTests();
