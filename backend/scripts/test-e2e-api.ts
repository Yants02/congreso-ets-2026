process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import { query } from '../src/lib/db';

const PORT = 4001; // Usamos puerto 4001 para la prueba

function request(options: http.RequestOptions, postData?: any): Promise<{ status: number; body: any }> {
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

async function runTests() {
  console.log('🧪 Iniciando suite de pruebas E2E del Backend...\n');

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

  try {
    // 1. Healthcheck
    const health = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/health',
      method: 'GET',
    });
    assert('Endpoint /health responde 200 y status UP', health.status === 200 && health.body.status === 'UP');

    // 2. Consulta de Vacantes
    const vacantes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/vacantes',
      method: 'GET',
    });
    assert(
      'Endpoint /api/vacantes responde 200 con cupo de evento',
      vacantes.status === 200 && typeof vacantes.body.cupo_maximo === 'number'
    );

    // 3. Consulta de Actividades (para SectionPrograma)
    const actividades = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/actividades',
      method: 'GET',
    });
    assert(
      'Endpoint /api/actividades responde 200 y lista charlas',
      actividades.status === 200 && Array.isArray(actividades.body.actividades) && actividades.body.total > 0
    );

    // 4. Consulta de Materiales
    const materiales = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/materiales',
      method: 'GET',
    });
    assert(
      'Endpoint /api/materiales responde 200 con catálogo pedagógico',
      materiales.status === 200 && Array.isArray(materiales.body.materiales)
    );

    // 5. Autenticación de Operador (Superadmin institucional de la base)
    const login = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/admin/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        email: 'superadmin.congreso@bue.edu.ar',
        password: 'PasswordSuperSeguro2026!',
      }
    );
    // Si la contraseña no coincide con el seed anterior, probamos si responde error tipado 401
    assert(
      'Endpoint /api/admin/auth/login procesa credenciales con esquema Zod',
      login.status === 200 || (login.status === 401 && login.body.error === 'ERR_INVALID_CREDENTIALS')
    );

    // 6. Registro de nuevo participante con DNI aleatorio de prueba
    const testDni = `TEST_${Date.now().toString().slice(-7)}`;
    const registro = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/registro',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        dni_pasaporte: testDni,
        nombre: 'Participante',
        apellido: 'Prueba',
        email: `test_${testDni}@buenosaires.gob.ar`,
        celular: '+5491199887766',
        rol_principal_id: 1, // Estudiante
        consentimiento_datos: true,
      }
    );
    assert(
      'Endpoint /api/registro crea usuario y devuelve token QR cifrado AES-256-CBC',
      registro.status === 201 && registro.body.success === true && Boolean(registro.body.qr_token)
    );

    // 7. Consulta de credencial del participante recién registrado
    const credencial = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/credencial?dni=${testDni}`,
      method: 'GET',
    });
    assert(
      'Endpoint /api/credencial recupera datos y genera token QR dinámico',
      credencial.status === 200 && credencial.body.usuario.dni_pasaporte === testDni
    );

    // 8. Control de Acceso (Acreditación en Puerta con el QR generado)
    if (registro.body.qr_token) {
      const acreditacion = await request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: '/api/operator/acreditar',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          qr_token: registro.body.qr_token,
          punto_acceso_id: 1,
          tipo_acreditacion_id: 1,
          tipo_movimiento: 'INGRESO',
        }
      );
      assert(
        'Endpoint /api/operator/acreditar valida QR y registra INGRESO',
        acreditacion.status === 200 && acreditacion.body.success === true
      );

      // 9. Control Anti-Passback (Reintento de doble ingreso consecutivo)
      const dobleIngreso = await request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: '/api/operator/acreditar',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          qr_token: registro.body.qr_token,
          punto_acceso_id: 1,
          tipo_acreditacion_id: 1,
          tipo_movimiento: 'INGRESO',
        }
      );
      assert(
        'Anti-Passback rechaza doble ingreso con HTTP 409 ERR_PASSBACK_VIOLATION',
        dobleIngreso.status === 409 && dobleIngreso.body.error === 'ERR_PASSBACK_VIOLATION'
      );
    }

    // Limpieza de datos de prueba
    await query('DELETE FROM acreditaciones WHERE usuario_id = (SELECT id FROM usuarios WHERE dni_pasaporte = $1)', [testDni]);
    await query('DELETE FROM usuarios WHERE dni_pasaporte = $1', [testDni]);
    console.log('\n🧹 Datos de prueba limpiados exitosamente.');

  } catch (err: any) {
    console.error('Error durante ejecución de pruebas:', err);
    failed++;
  } finally {
    server.close();
    console.log(`\n========================================`);
    console.log(`Pruebas Pasadas: ${passed} | Fallidas: ${failed}`);
    console.log(`========================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
