import { Request, Response, NextFunction } from 'express';
import { query } from '../lib/db';

export type JournalingLevel = 'DISABLED' | 'ERRORS_ONLY' | 'VERBOSE_ALL';

let cachedLevel: JournalingLevel = 'ERRORS_ONLY';
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 10000; // Refrescar configuración cada 10 segundos

/**
 * Obtiene el nivel actual de journaling desde la base de datos (con caché en memoria)
 */
export async function getJournalingLevel(): Promise<JournalingLevel> {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL_MS) {
    return cachedLevel;
  }

  try {
    const res = await query(
      `SELECT valor FROM configuraciones_sistema WHERE clave = 'JOURNALING_DEBUG_MODE' LIMIT 1`
    );
    if (res.rows.length > 0) {
      let val = res.rows[0].valor;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch (_) {}
      }
      if (val === 'DISABLED' || val === 'ERRORS_ONLY' || val === 'VERBOSE_ALL') {
        cachedLevel = val;
      }
    }
    lastCacheUpdate = now;
  } catch (err) {
    // Si falla la BD, mantener el nivel en caché para no degradar el servicio
  }

  return cachedLevel;
}

/**
 * Fuerza la actualización inmediata del nivel en caché (útil cuando se guarda desde el panel)
 */
export function setCachedJournalingLevel(level: JournalingLevel) {
  cachedLevel = level;
  lastCacheUpdate = Date.now();
}

/**
 * Middleware Express para registrar las peticiones según el nivel de Journaling activo
 */
export function journalingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startHrTime = process.hrtime();
  const ruta = req.originalUrl || req.url;

  // Ignorar peticiones a archivos estáticos del navegador o health checks repetitivos para no saturar
  if (
    ruta.startsWith('/_next') ||
    ruta.endsWith('.ico') ||
    ruta.endsWith('.png') ||
    ruta.endsWith('.svg') ||
    ruta.endsWith('.css') ||
    ruta.endsWith('.js')
  ) {
    return next();
  }

  // Interceptar la finalización de la respuesta
  res.on('finish', async () => {
    try {
      const level = await getJournalingLevel();
      if (level === 'DISABLED') return;

      const statusCode = res.statusCode;
      const isError = statusCode >= 400;

      // Si es ERRORS_ONLY y la respuesta fue exitosa (2xx/3xx), no guardamos
      if (level === 'ERRORS_ONLY' && !isError) return;

      const elapsedHrTime = process.hrtime(startHrTime);
      const duracionMs = Number((elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2));

      const metodo = req.method;
      const ipOrigen = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;
      const usuarioEmail = (req as any).operator?.email || null;

      // Limpiar datos sensibles de la petición
      let sanitizedBody: any = null;
      if (req.body && typeof req.body === 'object') {
        sanitizedBody = { ...req.body };
        if (sanitizedBody.password) sanitizedBody.password = '***REDACTED***';
        if (sanitizedBody.clave) sanitizedBody.clave = '***REDACTED***';
        if (sanitizedBody.token) sanitizedBody.token = '***REDACTED***';
      }

      const headersToSave: Record<string, string> = {};
      if (req.headers['user-agent']) headersToSave['user-agent'] = String(req.headers['user-agent']);
      if (req.headers['referer']) headersToSave['referer'] = String(req.headers['referer']);
      if (req.headers['origin']) headersToSave['origin'] = String(req.headers['origin']);

      const nivelRegistro = isError ? (statusCode >= 500 ? 'CRITICAL' : 'WARN') : 'INFO';

      await query(
        `INSERT INTO logs_journaling (
          nivel, metodo, ruta, status_code, duracion_ms, ip_origen, usuario_email, request_headers, request_body, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          nivelRegistro,
          metodo,
          ruta,
          statusCode,
          duracionMs,
          ipOrigen ? String(ipOrigen).slice(0, 45) : null,
          usuarioEmail,
          JSON.stringify(headersToSave),
          sanitizedBody ? JSON.stringify(sanitizedBody) : null,
        ]
      ).catch(() => {});
    } catch (_) {
      // El logger nunca debe arrojar excepciones que interrumpan el flujo HTTP
    }
  });

  next();
}
