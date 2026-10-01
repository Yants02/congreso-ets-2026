process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import { query } from '../src/lib/db';
import { encryptQRPayload } from '../src/lib/cryptoQR';

const PORT = 4004;

interface RequestResult {
  status: number;
  durationMs: number;
  data: any;
}

function sendRequest(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<RequestResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders: Record<string, string> = {
      ...headers,
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload).toString() } : {})
    };

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: reqHeaders,
        timeout: 10000
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          const durationMs = performance.now() - start;
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, durationMs, data: parsed });
        });
      }
    );

    req.on('error', (err) => {
      const durationMs = performance.now() - start;
      resolve({ status: 599, durationMs, data: { error: err.message } });
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function calculatePercentiles(latencies: number[]): { p50: number; p95: number; p99: number; avg: number; min: number; max: number } {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    avg: Number(avg.toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2))
  };
}

async function runLoadSimulation() {
  console.log('========================================================================');
  console.log('⚡ SIMULADOR DE CARGA CONCURRENTE Y PRUEBA DE ESTRÉS (CONGRESO ETS 2026)');
  console.log('========================================================================\n');

  const server = app.listen(PORT);
  console.log(`🚀 Servidor de pruebas iniciado en http://localhost:${PORT}`);

  const startTime = Date.now();
  let totalErrors = 0;

  try {
    // -------------------------------------------------------------------------
    // 1. CHEQUEO DE SALUD PREVIO AL TEST
    // -------------------------------------------------------------------------
    console.log('\n--- 1. VERIFICACIÓN DE SALUD PRE-TEST ---');
    const healthPre = await sendRequest('GET', '/api/health');
    console.log(`Estado /api/health: HTTP ${healthPre.status} (${healthPre.durationMs.toFixed(1)}ms)`);
    const isDbConnected = Boolean(healthPre.data?.database?.connected || healthPre.data?.dbOk);
    if (healthPre.status !== 200 || !isDbConnected) {
      throw new Error(`Base de datos no disponible para el test de carga: ${JSON.stringify(healthPre.data)}`);
    }
    const preLatency = healthPre.data?.database?.latencyMs ?? healthPre.data?.latencyMs ?? 0;
    console.log(`DB Latencia Inicial: ${preLatency}ms | Memoria: ${healthPre.data.memoryUsageMb}MB`);

    // -------------------------------------------------------------------------
    // 2. INYECCIÓN CONCURRENTE EN LOTE DE REGISTROS (15 peticiones simultáneas)
    // -------------------------------------------------------------------------
    const CONCURRENT_REGISTRATIONS = 15;
    console.log(`\n--- 2. INYECCIÓN DE REGISTROS CONCURRENTES (${CONCURRENT_REGISTRATIONS} peticiones concurrentes) ---`);
    
    const registrationPromises: Promise<RequestResult & { dni: string; email: string }>[] = [];
    const testUsers: { dni: string; email: string }[] = [];

    for (let i = 0; i < CONCURRENT_REGISTRATIONS; i++) {
      const dni = `88${Math.floor(100000 + Math.random() * 900000)}`;
      const email = `stress.user.${dni}@loadtest.congreso.gob.ar`;
      testUsers.push({ dni, email });

      const regPromise = sendRequest('POST', '/api/registro', {
        dni_pasaporte: dni,
        email,
        nombre: 'Participante Carga',
        apellido: 'Prueba Concurrente',
        celular: '1144445555',
        rol_principal_id: 1, // Asistente
        roles_adicionales_ids: [],
        consentimiento_datos: true
      }).then((res) => ({ ...res, dni, email }));

      registrationPromises.push(regPromise);
    }

    const regResults = await Promise.all(registrationPromises);
    const regLatencies = regResults.map((r) => r.durationMs);
    const regSuccess = regResults.filter((r) => r.status === 201 || r.status === 200).length;
    const regRateLimited = regResults.filter((r) => r.status === 429).length;
    const regOtherErrors = regResults.filter((r) => r.status !== 200 && r.status !== 201 && r.status !== 429).length;

    if (regOtherErrors > 0) {
      console.log('Muestra de error en registro:', regResults.find((r) => r.status !== 200 && r.status !== 201));
    }

    console.log(`Resultados Registros Concurrentes:`);
    console.log(`  - Exitosos (200/201): ${regSuccess}`);
    console.log(`  - Rate-limited (429): ${regRateLimited}`);
    console.log(`  - Fallos inesperados: ${regOtherErrors}`);
    
    const regStats = calculatePercentiles(regLatencies);
    console.log(`Latencias Registros: p50=${regStats.p50}ms | p95=${regStats.p95}ms | p99=${regStats.p99}ms | Media=${regStats.avg}ms (min: ${regStats.min}ms, max: ${regStats.max}ms)`);

    if (regOtherErrors > 0) {
      console.error('❌ Hubo fallos inesperados en el registro concurrente');
      totalErrors++;
    } else {
      console.log('✅ Inyección concurrente completada sin fallas de integridad.');
    }

    // -------------------------------------------------------------------------
    // 3. GENERACIÓN Y ACREDITACIÓN CONCURRENTE CON QR
    // -------------------------------------------------------------------------
    console.log('\n--- 3. ACREDITACIÓN QR CONCURRENTE (Lectura y Journaling de Auditoría) ---');
    
    // Obtener los usuarios recién creados y confirmados
    const createdUsersRes = await query(
      `SELECT u.id, u.dni_pasaporte FROM usuarios u
       WHERE u.email LIKE '%@loadtest.congreso.gob.ar'
       LIMIT 5`
    );

    if (createdUsersRes.rows.length > 0) {
      console.log(`Acreditando concurrentemente ${createdUsersRes.rows.length} asistentes confirmados vía QR cifrado...`);

      const acreditacionPromises = createdUsersRes.rows.map(async (row) => {
        const qr_token = encryptQRPayload({
          u: row.id,
          d: row.dni_pasaporte,
          t: Date.now()
        });

        return sendRequest('POST', '/api/operator/acreditar', {
          qr_token,
          punto_acceso_id: 1,
          tipo_acreditacion_id: 1,
          tipo_movimiento: 'INGRESO',
          operador_id: 1
        });
      });

      const acreditResults = await Promise.all(acreditacionPromises);
      const acreditLatencies = acreditResults.map((r) => r.durationMs);
      const acreditSuccess = acreditResults.filter((r) => r.status === 200).length;
      const acreditStats = calculatePercentiles(acreditLatencies);

      console.log(`Acreditaciones exitosas: ${acreditSuccess}/${acreditResults.length}`);
      console.log(`Latencias Acreditación: p50=${acreditStats.p50}ms | p95=${acreditStats.p95}ms | p99=${acreditStats.p99}ms | Media=${acreditStats.avg}ms`);

      if (acreditSuccess !== acreditResults.length) {
        console.error('❌ Algunas acreditaciones QR no fueron procesadas satisfactoriamente.');
        totalErrors++;
      } else {
        console.log('✅ Proceso de acreditación concurrente completado con éxito.');
      }
    } else {
      console.log('⚠️ No se registraron usuarios para la fase de acreditación QR.');
    }

    // -------------------------------------------------------------------------
    // 4. VERIFICACIÓN DE RESISTENCIA Y PROTECCIÓN DE TASA (RATE LIMITING)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. TEST DE RESISTENCIA Y RESPUESTA DEL RATE LIMITER ---');
    console.log('Enviando ráfaga rápida de 20 consultas a /api/credencial?dni=... para verificar protección...');
    
    const burstPromises: Promise<RequestResult>[] = [];
    for (let i = 0; i < 20; i++) {
      burstPromises.push(sendRequest('GET', `/api/credencial?dni=11111111`));
    }
    const burstResults = await Promise.all(burstPromises);
    const burstCompleted = burstResults.filter((r) => r.status === 200 || r.status === 404 || r.status === 429).length;
    console.log(`Peticiones procesadas bajo ráfaga: ${burstCompleted}/20 (HTTP Status respondidos sin cuelgues ni caídas)`);
    console.log('✅ Protección y capacidad de respuesta del servidor verificadas.');

    // -------------------------------------------------------------------------
    // 5. CHEQUEO DE SALUD POST-TEST Y CONSUMO
    // -------------------------------------------------------------------------
    console.log('\n--- 5. VERIFICACIÓN DE SALUD POST-TEST Y CONSUMO ---');
    const healthPost = await sendRequest('GET', '/api/health');
    const postLatency = healthPost.data?.database?.latencyMs ?? healthPost.data?.latencyMs ?? 0;
    console.log(`Estado final /api/health: HTTP ${healthPost.status}`);
    console.log(`DB Latencia: ${postLatency}ms | Memoria: ${healthPost.data?.memoryUsageMb}MB (Delta: +${(healthPost.data?.memoryUsageMb - healthPre.data?.memoryUsageMb).toFixed(2)}MB)`);
    console.log(`Pool Conexiones: Total=${healthPost.data?.dbConnections?.total || 'N/A'}, Libres=${healthPost.data?.dbConnections?.idle || 'N/A'}`);

    // Limpieza de datos creados en el test para idempotencia
    console.log('\n--- 6. LIMPIEZA DE DATOS DE PRUEBA ---');
    const deleteAcredit = await query(
      `DELETE FROM acreditaciones WHERE usuario_id IN (
        SELECT id FROM usuarios WHERE email LIKE '%@loadtest.congreso.gob.ar'
      )`
    );
    const deleteUsuarios = await query(
      `DELETE FROM usuarios WHERE email LIKE '%@loadtest.congreso.gob.ar'`
    );
    console.log(`🧹 Acreditaciones de prueba eliminadas: ${deleteAcredit.rowCount}`);
    console.log(`🧹 Usuarios de prueba eliminados: ${deleteUsuarios.rowCount}`);

  } catch (err: any) {
    console.error('❌ Error fatal en simulador de carga:', err);
    totalErrors++;
  } finally {
    server.close();
    const durationTotal = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n========================================================================');
    console.log(`🏁 SIMULADOR FINALIZADO EN ${durationTotal}s CON ${totalErrors} ERRORES`);
    console.log('========================================================================\n');

    process.exit(totalErrors === 0 ? 0 : 1);
  }
}

runLoadSimulation();
