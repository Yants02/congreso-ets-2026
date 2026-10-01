process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import { signSessionToken } from '../src/lib/authService';

const PORT = 4003;

function request(
  options: http.RequestOptions,
  postData?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 500, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, headers: res.headers, body: data });
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

async function runPackagesTests() {
  console.log('🧪 Iniciando verificación integral de los 3 Paquetes (Encuestas, Reportes, Cron)...\n');

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
    // PAQUETE 1: Encuestas
    console.log('📋 --- Verificando Paquete 1: Encuestas de Satisfacción ---');
    const resEncActiva = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/encuestas/activa',
      method: 'GET',
    });
    assert(
      'GET /api/encuestas/activa retorna encuesta obligatoria con 4 preguntas',
      resEncActiva.status === 200 &&
        resEncActiva.body.encuesta &&
        resEncActiva.body.encuesta.preguntas.length >= 4,
      JSON.stringify(resEncActiva.body)
    );

    const resEncMetricas = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/encuestas/metricas',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/encuestas/metricas devuelve promedio general y breakdown',
      resEncMetricas.status === 200 && resEncMetricas.body.ok === true,
      JSON.stringify(resEncMetricas.body)
    );

    // PAQUETE 2: Reportes y Exportaciones
    console.log('\n📊 --- Verificando Paquete 2: Motor de Exportación de Reportes ---');
    const resPadron = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/reportes/padron.csv',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/reportes/padron.csv genera CSV con UTF-8 BOM',
      resPadron.status === 200 &&
        typeof resPadron.body === 'string' &&
        resPadron.body.startsWith('\uFEFF"ID"'),
      `Status: ${resPadron.status}`
    );

    const resAccesos = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/reportes/accesos.csv',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/reportes/accesos.csv genera CSV de movimientos de molinetes',
      resAccesos.status === 200 &&
        typeof resAccesos.body === 'string' &&
        resAccesos.body.startsWith('\uFEFF"ID Movimiento"'),
      `Status: ${resAccesos.status}`
    );

    const resFirmas = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/reportes/actividades/1/firmas.csv',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/reportes/actividades/1/firmas.csv genera planilla con sala y horario',
      resFirmas.status === 200 &&
        typeof resFirmas.body === 'string' &&
        resFirmas.body.includes('PLANILLA DE FIRMAS Y ASISTENCIA'),
      `Status: ${resFirmas.status}`
    );

    const resZip = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/reportes/certificados.zip',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/reportes/certificados.zip genera streaming ZIP binario',
      resZip.status === 200 && resZip.headers['content-type'] === 'application/zip',
      `Status: ${resZip.status}, Content-Type: ${resZip.headers['content-type']}`
    );

    // PAQUETE 3: Cron y Automatización
    console.log('\n⏱️ --- Verificando Paquete 3: Planificador Autónomo (Cron Scheduler) ---');
    const resCronStatus = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/cron/scheduler-status',
      method: 'GET',
      headers: authHeaders,
    });
    assert(
      'GET /api/admin/cron/scheduler-status entrega telemetría de daemon residente',
      resCronStatus.status === 200 &&
        resCronStatus.body.status &&
        resCronStatus.body.status.intervalMinutes > 0,
      JSON.stringify(resCronStatus.body)
    );

    const resCronCycle = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/admin/cron',
        method: 'POST',
        headers: authHeaders,
      },
      { tipo: 'CICLO_COMPLETO' }
    );
    assert(
      'POST /api/admin/cron con tipo CICLO_COMPLETO ejecuta bajas y reconfirmaciones',
      resCronCycle.status === 200 &&
        resCronCycle.body.ok === true &&
        resCronCycle.body.resultado.success === true,
      JSON.stringify(resCronCycle.body)
    );
  } catch (err: any) {
    console.error('Error fatal durante la prueba:', err);
    failed++;
  } finally {
    server.close();
    console.log(`\n========================================`);
    console.log(`Pruebas Paquetes 1, 2 y 3 Pasadas: ${passed} | Fallidas: ${failed}`);
    console.log(`========================================\n`);
    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runPackagesTests();
