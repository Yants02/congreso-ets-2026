import { Router, Request, Response } from 'express';
import { getVapidPublicKey, savePushSubscription, removePushSubscription, sendToSubscription } from '../lib/pushService';
import { pushSubscriptionSchema } from '../lib/schemas';
import { query } from '../lib/db';

const router = Router();

/**
 * GET /api/push/public-key y /api/push/vapid-key
 * Devuelve la clave pública VAPID para suscripción en el navegador
 */
router.get(['/public-key', '/vapid-key'], async (_req: Request, res: Response): Promise<void> => {
  try {
    const publicKey = await getVapidPublicKey();
    res.json({ ok: true, publicKey });
  } catch (error: any) {
    console.error('Error al obtener clave pública VAPID:', error);
    res.status(500).json({ ok: false, error: 'ERR_VAPID_KEY', message: error.message });
  }
});

/**
 * POST /api/push/subscribe
 * Registra una suscripción Web Push en la base de datos exclusivamente para participantes registrados
 */
router.post('/subscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = pushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'ERR_VALIDATION',
        details: parsed.error.format(),
      });
      return;
    }

    const { endpoint, keys, usuario_id } = parsed.data;

    if (!usuario_id) {
      res.status(403).json({
        ok: false,
        error: 'ERR_REGISTRATION_REQUIRED',
        message: 'Las notificaciones push solo pueden activarse para participantes registrados en el congreso.',
      });
      return;
    }

    // Validar existencia del usuario en la base de datos
    const userCheck = await query(
      `SELECT u.id, u.nombre, u.apellido, ei.codigo AS estado_codigo
       FROM usuarios u
       JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
       WHERE u.id = $1`,
      [usuario_id]
    );

    if (userCheck.rowCount === 0) {
      res.status(404).json({
        ok: false,
        error: 'ERR_USER_NOT_FOUND',
        message: 'No se encontró un participante registrado con el identificador provisto.',
      });
      return;
    }

    const userAgent = req.headers['user-agent'] || null;

    await savePushSubscription({
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      usuario_id,
      user_agent: userAgent,
    });

    // Enviar notificación push de confirmación inmediata al dispositivo del usuario
    const welcomePayload = JSON.stringify({
      title: '🔔 ¡Notificaciones Oficiales Activadas!',
      body: 'Recibirás avisos en tiempo real sobre cambios de sala, horarios y reconfirmaciones del Congreso ETS 2026.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      url: '/mi-credencial',
      tag: 'bienvenida-push',
      urgente: false,
    });

    sendToSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, welcomePayload).catch(
      (err) => console.warn('Aviso push inicial no enviado (puede completarse en segundo plano):', err)
    );

    res.json({ ok: true, mensaje: 'Dispositivo suscrito exitosamente a notificaciones oficiales.' });
  } catch (error: any) {
    console.error('Error al registrar suscripción push:', error);
    res.status(500).json({ ok: false, error: 'ERR_PUSH_SUBSCRIBE', message: error.message });
  }
});

/**
 * POST /api/push/unsubscribe
 * Cancela una suscripción Web Push
 */
router.post('/unsubscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const { endpoint } = req.body;
    if (!endpoint || typeof endpoint !== 'string') {
      res.status(400).json({ ok: false, error: 'ERR_ENDPOINT_REQUIRED' });
      return;
    }

    await removePushSubscription(endpoint);
    res.json({ ok: true, mensaje: 'Suscripción dada de baja correctamente.' });
  } catch (error: any) {
    console.error('Error al dar de baja suscripción push:', error);
    res.status(500).json({ ok: false, error: 'ERR_PUSH_UNSUBSCRIBE', message: error.message });
  }
});

export default router;
