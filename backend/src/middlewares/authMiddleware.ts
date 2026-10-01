import { Request, Response, NextFunction } from 'express';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '../lib/authService';

export interface AuthenticatedRequest extends Request {
  operator?: SessionPayload;
}

/**
 * Middleware para extraer el operador de la sesión (cookie o header Bearer)
 */
export async function authenticateOperator(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Cookie congreso_session (parsed by cookie-parser or raw header)
    if (!token && req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
      token = req.cookies[SESSION_COOKIE_NAME];
    } else if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (token) {
      const payload = await verifySessionToken(token);
      if (payload) {
        req.operator = payload;
      }
    }

    next();
  } catch (error) {
    next();
  }
}

/**
 * Middleware para exigir jerarquía mínima
 * Jerarquías: 1: Asistente, 2: Expositor, 3: Operador, 4: Verificador/Admin, 5: Superadmin
 */
export function requireHierarchy(minHierarchy: number = 3) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.operator) {
      res.status(401).json({
        ok: false,
        error: 'ERR_UNAUTHORIZED',
        message: 'Sesión no iniciada o token inválido',
      });
      return;
    }

    if (req.operator.jerarquia < minHierarchy) {
      res.status(403).json({
        ok: false,
        error: 'ERR_FORBIDDEN',
        message: `Jerarquía insuficiente (${req.operator.jerarquia} < ${minHierarchy}) para acceder a este recurso`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware para exigir permiso explícito de módulo o jerarquía Superadmin (nivel 5)
 */
export function requirePermission(permission: string, minHierarchy: number = 3) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.operator) {
      res.status(401).json({
        ok: false,
        error: 'ERR_UNAUTHORIZED',
        message: 'Sesión no iniciada o token inválido',
      });
      return;
    }

    // Superadmin (nivel 5) tiene acceso irrestricto
    if (req.operator.jerarquia >= 5) {
      return next();
    }

    if (req.operator.jerarquia < minHierarchy) {
      res.status(403).json({
        ok: false,
        error: 'ERR_FORBIDDEN',
        message: `Jerarquía insuficiente (${req.operator.jerarquia} < ${minHierarchy}) para este módulo`,
      });
      return;
    }

    const permisos = req.operator.permisos || [];
    if (!permisos.includes(permission)) {
      res.status(403).json({
        ok: false,
        error: 'ERR_FORBIDDEN_MODULE',
        message: `Acceso denegado: El operador no tiene asignado el permiso para el módulo '${permission}'`,
      });
      return;
    }

    next();
  };
}

