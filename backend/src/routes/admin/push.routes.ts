import { Router, Response } from 'express';
import { query } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';
import { broadcastPushNotification, getVapidKeys, VapidKeys } from '../../lib/pushService';
import { pushBroadcastSchema } from '../../lib/schemas';
import webpush from 'web-push';

const router = Router();

/**
 * GET /api/admin/push/stats
 * Obtener estadísticas de dispositivos y suscriptores push
 */
router.get('/stats', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const totalSubsRes = await query(`SELECT COUNT(*) as total FROM suscripciones_push`);
    const vinculadosRes = await query(`SELECT COUNT(*) as total FROM suscripciones_push WHERE usuario_id IS NOT NULL`);
    const vapidKeys = await getVapidKeys();

    const rolesBreakdownRes = await query(`
      SELECT r.nombre as rol, COUNT(sp.id) as total
      FROM suscripciones_push sp
      JOIN usuarios u ON u.id = sp.usuario_id
      JOIN roles r ON r.id = u.rol_principal_id
      GROUP BY r.nombre
    `);

    res.json({
      ok: true,
      total_dispositivos: parseInt(totalSubsRes.rows[0].total, 10) || 0,
      usuarios_vinculados: parseInt(vinculadosRes.rows[0].total, 10) || 0,
      desglose_roles: rolesBreakdownRes.rows,
      vapid_public_key: vapidKeys.publicKey,
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas push:', error);
    res.status(500).json({ ok: false, error: 'ERR_PUSH_STATS', message: error.message });
  }
});

/**
 * POST /api/admin/push/broadcast
 * Emitir un aviso push masivo o segmentado
 */
router.post('/broadcast', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = pushBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'ERR_VALIDATION',
        details: parsed.error.format(),
      });
      return;
    }

    const { title, body, url, urgente, filtro } = parsed.data;

    const result = await broadcastPushNotification(
      {
        title,
        body,
        url,
        urgente,
      },
      {
        rol_id: filtro?.rol_id,
        solo_acreditados: filtro?.solo_acreditados,
        urgente,
      }
    );

    // Auditoría
    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('suscripciones_push', 'BROADCAST_PUSH', $1, $2)`,
      [
        req.operator?.email || 'ADMIN',
        JSON.stringify({ title, segmento: result.segmento, total: result.total, sent: result.sent, failed: result.failed }),
      ]
    ).catch(() => {});

    res.json({
      ok: true,
      mensaje: `Notificación push despachada a ${result.sent} dispositivo(s).`,
      detalle: result,
    });
  } catch (error: any) {
    console.error('Error enviando broadcast push:', error);
    res.status(500).json({ ok: false, error: 'ERR_PUSH_BROADCAST', message: error.message });
  }
});

/**
 * POST /api/admin/push/regenerate-keys
 * Regenerar par de claves VAPID (Superadmin)
 */
router.post('/regenerate-keys', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const newKeys = webpush.generateVAPIDKeys();
    const keysObj: VapidKeys = {
      publicKey: newKeys.publicKey,
      privateKey: newKeys.privateKey,
    };

    await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, actualizado_en)
       VALUES ('vapid_keys', $1, 'Par de claves VAPID para Web Push Notifications', 'GENERAL', NOW())
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()`,
      [JSON.stringify(keysObj)]
    );

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'REGENERATE_VAPID_KEYS', $1, $2)`,
      [req.operator?.email || 'SUPERADMIN', JSON.stringify({ action: 'regenerate_keys' })]
    ).catch(() => {});

    res.json({
      ok: true,
      mensaje: 'Claves VAPID regeneradas exitosamente en la base de datos.',
      publicKey: newKeys.publicKey,
    });
  } catch (error: any) {
    console.error('Error regenerando claves VAPID:', error);
    res.status(500).json({ ok: false, error: 'ERR_REGENERATE_VAPID', message: error.message });
  }
});

export default router;
