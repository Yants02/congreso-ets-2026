process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import { query } from '../src/lib/db';
import { decryptQRPayload } from '../src/lib/cryptoQR';

const PORT = 4002;

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

async function runCriticalFlowTests() {
  console.log('================================================================');
  console.log('🧪 SUITE DE PRUEBAS AUTOMÁTICAS DE FLUJOS CRÍTICOS (CONGRESO ETS 2026)');
  console.log('================================================================\n');

  const server = app.listen(PORT);
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, extraInfo?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}${extraInfo ? ` -> ${extraInfo}` : ''}`);
      failed++;
    }
  }

  // DNI aleatorio único para asegurar idempotencia y limpieza de prueba
  const testDni = `99${Math.floor(100000 + Math.random() * 900000)}`;
  const testEmail = `test.e2e.${testDni}@congreso.buenosaires.gob.ar`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: INSCRIPCIÓN COMPLETA DE UN ASISTENTE
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Inscripción completa de un asistente ---');
    const regPayload = {
      dni_pasaporte: testDni,
      nombre: 'Prueba Automatizada',
      apellido: 'Robot Acreditador',
      email: testEmail,
      celular: '1144556677',
      rol_principal_id: 1, // Participante General
      roles_adicionales_ids: [],
      consentimiento_datos: true,
    };

    const regRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/registro',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      regPayload
    );

    assert(
      'Inscripción de asistente responde status 201',
      regRes.status === 201,
      `Status recibido: ${regRes.status}, body: ${JSON.stringify(regRes.body)}`
    );
    assert(
      'Respuesta de inscripción contiene usuario_id y estado válido',
      Boolean(regRes.body?.usuario_id && (regRes.body?.estado === 'CONFIRMADO' || regRes.body?.estado === 'LISTA_ESPERA')),
      `Body: ${JSON.stringify(regRes.body)}`
    );

    const usuarioId = regRes.body?.usuario_id;

    // Asegurar que el usuario esté confirmado en BD para continuar con credencial y acceso
    await query(
      `UPDATE usuarios 
       SET estado_inscripcion_id = (SELECT id FROM estados_inscripcion WHERE codigo = 'CONFIRMADO')
       WHERE id = $1`,
      [usuarioId]
    );

    // -------------------------------------------------------------------------
    // TEST 2: GENERACIÓN Y LECTURA DEL QR CON FIRMA VÁLIDA
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Generación y lectura de QR con firma válida ---');
    const credRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/credencial?dni=${testDni}`,
      method: 'GET',
    });

    assert(
      'Consulta de credencial PWA responde status 200',
      credRes.status === 200,
      `Status: ${credRes.status}`
    );
    assert(
      'Credencial contiene qr_token criptográfico no vacío',
      Boolean(credRes.body?.qr_token && credRes.body.qr_token.length > 20),
      `Token: ${credRes.body?.qr_token}`
    );

    const qrToken = credRes.body?.qr_token;
    let decryptedPayload: any = null;
    let qrValido = false;

    try {
      decryptedPayload = decryptQRPayload(qrToken);
      qrValido = Boolean(
        decryptedPayload &&
        decryptedPayload.u === usuarioId &&
        decryptedPayload.d === testDni &&
        typeof decryptedPayload.t === 'number'
      );
    } catch (err: any) {
      qrValido = false;
    }

    assert(
      'Descifrado criptográfico del token QR verifica integridad, usuario y DNI exacto',
      qrValido,
      `Payload descifrado: ${JSON.stringify(decryptedPayload)}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: ACREDITACIÓN DE OPERADOR Y EMISIÓN DE CERTIFICADO
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Acreditación de operador y emisión de certificado ---');
    
    // Obtener punto de acceso y tipo de acreditación válidos
    const paRes = await query(`SELECT id FROM puntos_acceso WHERE activo = TRUE LIMIT 1`);
    const taRes = await query(`SELECT id FROM tipos_acreditacion WHERE codigo = 'GENERAL' OR codigo = 'INGRESO' LIMIT 1`);
    const opRes = await query(`SELECT id FROM operadores WHERE activo = TRUE LIMIT 1`);

    const puntoAccesoId = paRes.rows[0]?.id || 1;
    const tipoAcreditacionId = taRes.rows[0]?.id || 1;
    const operadorId = opRes.rows[0]?.id || 1;

    // 3.1 Acreditación de ingreso en sede con el token QR
    const acredRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/operator/acreditar',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        qr_token: qrToken,
        punto_acceso_id: puntoAccesoId,
        tipo_acreditacion_id: tipoAcreditacionId,
        operador_id: operadorId,
      }
    );

    assert(
      'Acreditación de ingreso mediante QR responde status 200',
      acredRes.status === 200,
      `Status: ${acredRes.status}, body: ${JSON.stringify(acredRes.body)}`
    );
    assert(
      'Acreditación confirma tipo INGRESO y asigna credencial válida',
      acredRes.body?.tipo_movimiento === 'INGRESO' && acredRes.body?.success === true,
      `Body: ${JSON.stringify(acredRes.body)}`
    );

    // 3.2 Emisión y consulta del certificado oficial del participante acreditado
    const certRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/certificados?dni=${testDni}`,
      method: 'GET',
    });

    assert(
      'Consulta/Emisión de certificado oficial responde status 200',
      certRes.status === 200,
      `Status: ${certRes.status}, body: ${JSON.stringify(certRes.body)}`
    );

    const certData = certRes.body?.certificado;
    assert(
      'Certificado generado contiene código oficial (ETS26-...) y horas cátedra reglamentarias',
      Boolean(certData?.codigo_verificacion && certData?.horas_catedra >= 16),
      `Certificado: ${JSON.stringify(certData)}`
    );

    // 3.3 Validación pública del certificado emitido
    if (certData?.codigo_verificacion) {
      const valRes = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/certificados/validar/${certData.codigo_verificacion}`,
        method: 'GET',
      });

      assert(
        'Validador público de autenticidad verifica certificado como AUTÉNTICO Y REGISTRADO',
        valRes.status === 200 && valRes.body?.valido === true && valRes.body?.acreditacion_verificada === true,
        `Respuesta validación: ${JSON.stringify(valRes.body)}`
      );
    }

  } catch (err: any) {
    console.error('💥 Excepción no controlada durante las pruebas:', err);
    failed++;
  } finally {
    // Limpieza de datos de prueba
    try {
      await query(`DELETE FROM certificados WHERE usuario_id IN (SELECT id FROM usuarios WHERE dni_pasaporte = $1)`, [testDni]);
      await query(`DELETE FROM acreditaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE dni_pasaporte = $1)`, [testDni]);
      await query(`DELETE FROM usuarios WHERE dni_pasaporte = $1`, [testDni]);
    } catch (_) {}

    server.close(() => {
      console.log('\n================================================================');
      console.log(`📊 RESULTADO FINAL: ${passed} pruebas exitosas, ${failed} fallidas.`);
      console.log('================================================================');
      process.exit(failed > 0 ? 1 : 0);
    });
  }
}

runCriticalFlowTests();
