import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../lib/db';
import { encryptQRPayload } from '../lib/cryptoQR';
import { dniSchema } from '../lib/schemas';
import QRCode from 'qrcode';

const router = Router();

// Rate limiter para proteger la consulta pública de credenciales contra enumeración masiva de DNIs
const credencialLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // Ventana de 5 minutos
  max: process.env.NODE_ENV === 'test' ? 1000 : 60, // Máximo 60 consultas cada 5 minutos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'ERR_RATE_LIMIT_EXCEEDED',
    message: 'Has realizado demasiadas consultas de credencial en un período corto. Por favor, aguarda unos minutos.',
  },
});

/**
 * GET /api/credencial
 * Consulta los datos oficiales de la credencial PWA y genera el token QR cifrado
 */
router.get('/', credencialLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const dniParam = req.query.dni as string | undefined;

    if (!dniParam) {
      res.status(400).json({ error: 'ERR_MISSING_DNI', message: 'Se requiere el parámetro ?dni' });
      return;
    }

    const parsedDni = dniSchema.safeParse(dniParam.trim());
    if (!parsedDni.success) {
      res.status(400).json({
        error: 'ERR_INVALID_DNI',
        message: 'El DNI o Pasaporte debe tener entre 5 y 25 caracteres alfanuméricos.',
      });
      return;
    }

    const dni = parsedDni.data;

    const dbRes = await query(
      `SELECT u.id, u.dni_pasaporte, u.nombre, u.apellido, u.foto_url,
              r.nombre AS rol_nombre,
              ei.codigo AS estado_codigo, ei.nombre AS estado_nombre, ei.permite_ingreso,
              h.estado_homologacion,
              COALESCE(
                (SELECT json_agg(r2.nombre)
                 FROM usuario_roles_adicionales ura
                 JOIN roles r2 ON ura.rol_id = r2.id
                 WHERE ura.usuario_id = u.id),
                '[]'::json
              ) AS roles_adicionales,
              EXISTS (
                SELECT 1 FROM acreditaciones a 
                WHERE a.usuario_id = u.id AND a.tipo_movimiento = 'INGRESO'
              ) AS acreditado,
              (
                SELECT c.codigo_verificacion 
                FROM certificados c 
                WHERE c.usuario_id = u.id 
                ORDER BY c.emitido_en DESC 
                LIMIT 1
              ) AS certificado_codigo
       FROM usuarios u
       JOIN roles r ON u.rol_principal_id = r.id
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       LEFT JOIN homologaciones_expositores h ON h.usuario_id = u.id
       WHERE u.dni_pasaporte = $1`,
      [dni]
    );

    if (dbRes.rowCount === 0) {
      res.status(404).json({
        error: 'ERR_NOT_FOUND',
        message: 'No se encontró ninguna inscripción asociada al DNI o Pasaporte ingresado.',
      });
      return;
    }

    const u = dbRes.rows[0];

    if (u.estado_codigo === 'SANCIONADO') {
      res.status(403).json({
        error: 'ERR_SANCIONADO',
        message: 'Acceso retenido. Su inscripción se encuentra en categoría "Sancionado" por observación disciplinaria en el padrón de seguridad.',
        usuario: {
          id: u.id,
          dni_pasaporte: u.dni_pasaporte,
          nombre: u.nombre,
          apellido: u.apellido,
          rol_nombre: u.rol_nombre,
          roles_adicionales: u.roles_adicionales || [],
          foto_url: u.foto_url,
          estado_codigo: u.estado_codigo,
          estado_nombre: u.estado_nombre,
        },
      });
      return;
    }

    if (u.estado_codigo !== 'CONFIRMADO') {
      res.status(403).json({
        error: 'ERR_ESTADO_NO_CONFIRMADO',
        message: `Tu inscripción está en estado "${u.estado_nombre}". La credencial digital se emite exclusivamente para vacantes confirmadas.`,
        usuario: {
          id: u.id,
          dni_pasaporte: u.dni_pasaporte,
          nombre: u.nombre,
          apellido: u.apellido,
          rol_nombre: u.rol_nombre,
          roles_adicionales: u.roles_adicionales || [],
          foto_url: u.foto_url,
          estado_codigo: u.estado_codigo,
          estado_nombre: u.estado_nombre,
        },
      });
      return;
    }

    const qrToken = encryptQRPayload({
      u: u.id,
      d: u.dni_pasaporte,
      t: Date.now(),
    });

    let qrImageDataUrl: string | undefined;
    if (req.query.include_image === 'true') {
      qrImageDataUrl = await QRCode.toDataURL(qrToken, {
        margin: 2,
        width: 300,
        color: { dark: '#002B49', light: '#FFFFFF' },
      });
    }

    res.json({
      success: true,
      usuario: {
        id: u.id,
        dni_pasaporte: u.dni_pasaporte,
        nombre: u.nombre,
        apellido: u.apellido,
        rol_nombre: u.rol_nombre,
        roles_adicionales: u.roles_adicionales || [],
        foto_url: u.foto_url,
        estado_codigo: u.estado_codigo,
        estado_nombre: u.estado_nombre,
        homologacion_estado: u.estado_homologacion || null,
        acreditado: Boolean(u.acreditado),
        certificado_codigo: u.certificado_codigo || null,
      },
      qr_token: qrToken,
      qr_image: qrImageDataUrl,
    });
  } catch (error: any) {
    console.error('Error en GET /api/credencial:', error);
    res.status(500).json({ error: 'ERR_SERVER', message: 'Error interno al consultar credencial.' });
  }
});

export default router;
