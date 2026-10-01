/**
 * Generador de Certificados SSL/TLS Autofirmados para Red Local y Auditorio
 * Congreso ETS 2026 - DETS GCABA
 *
 * Genera certificados X.509 con Subject Alternative Names (SAN) para todas
 * las direcciones IP de red local (LAN) y nombres DNS de host, permitiendo
 * el uso seguro de la cámara web (getUserMedia) en smartphones de operadores.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CERTS_DIR = path.join(__dirname, '..', 'certs');
const KEY_PATH = path.join(CERTS_DIR, 'key.pem');
const CERT_PATH = path.join(CERTS_DIR, 'cert.pem');
const CSR_CONFIG_PATH = path.join(CERTS_DIR, 'openssl.cnf');

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const ips = new Set(['127.0.0.1']);

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' || net.family === 4) {
        ips.add(net.address);
      }
    }
  }

  return Array.from(ips);
}

function getOpensslBinary() {
  if (process.platform !== 'win32') return 'openssl';
  try {
    execSync('where openssl', { stdio: 'ignore' });
    return 'openssl';
  } catch (_) {}

  const gitPaths = [
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
    (process.env.LOCALAPPDATA || '') + '\\Programs\\Git\\usr\\bin\\openssl.exe',
  ];
  for (const p of gitPaths) {
    if (p && fs.existsSync(p)) return `"${p}"`;
  }
  return 'openssl';
}

function generateSSL() {
  console.log('============================================================');
  console.log('  GENERADOR DE CERTIFICADOS TLS/HTTPS - RED LOCAL AUDITORIO');
  console.log('============================================================');

  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }

  const localIps = getLocalIpAddresses();
  const hostname = os.hostname();

  console.log(`\nDetectando interfaces de red locales para Subject Alternative Names (SAN):`);
  localIps.forEach((ip) => console.log(`  - IP: ${ip}`));
  console.log(`  - Hostname: ${hostname}`);
  console.log(`  - DNS: localhost, congreso.local\n`);

  const sanList = [];
  sanList.push('DNS.1 = localhost');
  sanList.push('DNS.2 = *.localhost');
  sanList.push('DNS.3 = congreso.local');
  sanList.push(`DNS.4 = ${hostname}`);
  sanList.push(`DNS.5 = ${hostname}.local`);

  localIps.forEach((ip, index) => {
    sanList.push(`IP.${index + 1} = ${ip}`);
  });

  const opensslConfig = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = AR
ST = Ciudad Autonoma de Buenos Aires
L = Buenos Aires
O = GCABA - DETS
OU = Congreso ETS 2026 - Control de Accesos
CN = congreso.local

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:TRUE
keyUsage = digitalSignature, keyEncipherment, keyCertSign
extendedKeyUsage = serverAuth, clientAuth

[alt_names]
${sanList.join('\n')}
`;

  fs.writeFileSync(CSR_CONFIG_PATH, opensslConfig.trim(), 'utf8');

  console.log(
    'Generando clave privada RSA (2048 bits) y certificado X.509 (825 días de vigencia)...'
  );

  const opensslCmd = getOpensslBinary();

  try {
    execSync(
      `${opensslCmd} req -x509 -nodes -days 825 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -config "${CSR_CONFIG_PATH}"`,
      { stdio: 'inherit' }
    );

    console.log('\n✓ Certificados TLS generados exitosamente:');
    console.log(`  - Clave Privada: ${KEY_PATH}`);
    console.log(`  - Certificado:   ${CERT_PATH}`);
    console.log('\nLas siguientes direcciones están autorizadas en el certificado:');
    localIps.forEach((ip) => {
      console.log(`  🔒 https://${ip}:3443/pwa-operador`);
    });
    console.log(`  🔒 https://localhost:3443/pwa-operador\n`);
  } catch (err) {
    console.error('Error al ejecutar openssl:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  generateSSL();
}

module.exports = { generateSSL, getLocalIpAddresses, KEY_PATH, CERT_PATH };
