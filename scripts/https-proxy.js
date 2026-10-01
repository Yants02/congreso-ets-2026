/**
 * Servidor Proxy Reverso HTTPS para Red Local y Auditorio
 * Congreso ETS 2026 - DETS GCABA
 *
 * Termina TLS de forma segura sobre la IP de red local (LAN) y transmite
 * las peticiones al servidor Next.js local (puerto 3000). Permite habilitar
 * el acceso a la cámara web (navigator.mediaDevices.getUserMedia) en
 * teléfonos y tablets de operadores en puerta.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { generateSSL, getLocalIpAddresses, KEY_PATH, CERT_PATH } = require('./generate-ssl');

const TARGET_PORT = parseInt(process.env.PORT || '3000', 10);
const TARGET_HOST = '127.0.0.1';
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);
const PID_FILE = path.join(__dirname, '..', '.https.pid');

// 1. Asegurar existencia de certificados
if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
  console.log('Certificados TLS no encontrados. Generando automáticamente...');
  generateSSL();
}

const httpsOptions = {
  key: fs.readFileSync(KEY_PATH),
  cert: fs.readFileSync(CERT_PATH),
};

// 2. Crear Servidor HTTPS
const server = https.createServer(httpsOptions, (req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-proto': 'https',
      'x-forwarded-port': String(HTTPS_PORT),
      'x-forwarded-for': req.socket.remoteAddress || '',
      host: req.headers.host || `localhost:${HTTPS_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Error al reenviar petición al backend Next.js:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        '502 Bad Gateway: El servidor central Next.js no responde en el puerto ' + TARGET_PORT
      );
    }
  });

  req.pipe(proxyReq, { end: true });
});

// 3. Manejo de WebSockets y actualizaciones de protocolo (HMR / Live Sync)
server.on('upgrade', (req, socket, head) => {
  const proxySocket = http.request({
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-proto': 'https',
    },
  });

  proxySocket.on('upgrade', (proxyRes, targetSocket) => {
    socket.write(
      `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        '\r\n\r\n'
    );
    targetSocket.pipe(socket);
    socket.pipe(targetSocket);
  });

  proxySocket.on('error', () => {
    socket.destroy();
  });

  proxySocket.end();
});

// Guardar PID
fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');

function cleanup() {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 4. Iniciar escucha
server.listen(HTTPS_PORT, '0.0.0.0', async () => {
  const ips = getLocalIpAddresses();
  const primaryLanIp = ips.find((ip) => ip !== '127.0.0.1' && !ip.startsWith('172.')) || ips[0];
  const operatorUrl = `https://${primaryLanIp}:${HTTPS_PORT}/pwa-operador`;
  const credencialUrl = `https://${primaryLanIp}:${HTTPS_PORT}/mi-credencial`;

  console.log('============================================================');
  console.log('  PROXY HTTPS ACTIVO PARA RED LOCAL / AUDITORIO (ETS 2026)');
  console.log('============================================================');
  console.log(`✓ Servidor HTTPS seguro escuchando en puerto ${HTTPS_PORT}`);
  console.log(`✓ Reenviando tráfico a Next.js en http://${TARGET_HOST}:${TARGET_PORT}`);
  console.log('\n📱 URL para Operadores de Acreditación en Puerta:');
  console.log(`   ${operatorUrl}\n`);
  console.log('📱 URL para Participantes (Mi Credencial PWA):');
  console.log(`   ${credencialUrl}\n`);

  try {
    const qrString = await QRCode.toString(operatorUrl, { type: 'terminal', small: true });
    console.log('Escaneá este código QR con el celular de puerta para abrir la PWA:');
    console.log(qrString);
  } catch (_) {}

  console.log('URLs locales disponibles en este equipo y red:');
  ips.forEach((ip) => {
    console.log(`  - https://${ip}:${HTTPS_PORT}/pwa-operador`);
  });
  console.log(`  - https://localhost:${HTTPS_PORT}/pwa-operador\n`);
  console.log('Presione Ctrl+C para detener el proxy.\n');
});
