import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const DEFAULT_KEY_HEX = 'e4b7c1a89f2d3e4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY || DEFAULT_KEY_HEX;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error(
      'La clave criptográfica ENCRYPTION_KEY debe ser de exactamente 32 bytes (64 caracteres hexadecimales).'
    );
  }
  return keyBuffer;
}

export interface QRPayload {
  u: string; // usuario_id (UUID v4)
  d: string; // dni_pasaporte
  t: number; // timestamp_emision (milisegundos)
}

/**
 * Cifra el payload del usuario en un token seguro AES-256-CBC
 * Formato resultante: "iv_hex.encrypted_payload_base64url"
 */
export function encryptQRPayload(payload: QRPayload): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encryptedBuf = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);

  const base64url = encryptedBuf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${iv.toString('hex')}.${base64url}`;
}

/**
 * Descifra el token QR extrayendo el payload original
 * Valida formato y autenticidad del token
 */
export function decryptQRPayload(token: string): QRPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('ERR_INVALID_QR_FORMAT');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('ERR_INVALID_QR_FORMAT');
  }

  const [ivHex, base64url] = parts;
  if (!ivHex || !base64url || ivHex.length !== 32) {
    throw new Error('ERR_INVALID_QR_FORMAT');
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    const decryptedBuf = Buffer.concat([
      decipher.update(Buffer.from(base64, 'base64')),
      decipher.final(),
    ]);

    const parsed = JSON.parse(decryptedBuf.toString('utf8')) as QRPayload;
    if (!parsed.u || !parsed.d || !parsed.t) {
      throw new Error('ERR_INVALID_QR_PAYLOAD');
    }

    return parsed;
  } catch (err: any) {
    if (err.message === 'ERR_INVALID_QR_PAYLOAD') throw err;
    throw new Error('ERR_INVALID_QR_FORMAT');
  }
}
