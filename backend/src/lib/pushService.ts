import webpush from 'web-push';
import { query } from './db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  urgente?: boolean;
  data?: Record<string, unknown>;
}

export interface BroadcastFilterOptions {
  rol_id?: number | null;
  solo_acreditados?: boolean;
  urgente?: boolean;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedVapidKeys: VapidKeys | null = null;
let vapidConfigured = false;

/**
 * Obtiene o genera las claves VAPID para Web Push persistiendo en la base de datos
 */
export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedVapidKeys) {
    return cachedVapidKeys;
  }

  // 1. Verificar variables de entorno
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cachedVapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
    initWebPush(cachedVapidKeys);
    return cachedVapidKeys;
  }

  // 2. Verificar en configuraciones_sistema
  try {
    const res = await query(`SELECT valor FROM configuraciones_sistema WHERE clave = 'vapid_keys'`);
    if (res.rows.length > 0 && res.rows[0].valor?.publicKey && res.rows[0].valor?.privateKey) {
      cachedVapidKeys = res.rows[0].valor as VapidKeys;
      initWebPush(cachedVapidKeys);
      return cachedVapidKeys;
    }
  } catch (err) {
    console.warn('No se pudo consultar configuraciones_sistema para vapid_keys:', err);
  }

  // 3. Generar nuevas claves VAPID persistentes
  const generated = webpush.generateVAPIDKeys();
  const keys: VapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };

  try {
    await query(
      `INSERT INTO configuraciones_sistema (clave, valor) 
       VALUES ('vapid_keys', $1) 
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [JSON.stringify(keys)]
    );
  } catch (err) {
    console.warn('Aviso: no se pudo guardar vapid_keys en configuraciones_sistema:', err);
  }

  cachedVapidKeys = keys;
  initWebPush(cachedVapidKeys);
  return cachedVapidKeys;
}

function initWebPush(keys: VapidKeys) {
  if (vapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT || 'mailto:congreso-ets2026@buenosaires.gob.ar';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  vapidConfigured = true;
}

/**
 * Devuelve la clave pública VAPID para el navegador
 */
export async function getVapidPublicKey(): Promise<string> {
  const keys = await getVapidKeys();
  return keys.publicKey;
}

/**
 * Guarda o actualiza una suscripción Push en la base de datos
 */
export async function savePushSubscription(params: {
  endpoint: string;
  p256dh: string;
  auth: string;
  usuario_id?: string | null;
  user_agent?: string | null;
}) {
  const { endpoint, p256dh, auth, usuario_id, user_agent } = params;

  await query(
    `INSERT INTO suscripciones_push (usuario_id, endpoint, p256dh, auth, user_agent, actualizado_en)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (endpoint) 
     DO UPDATE SET 
       usuario_id = COALESCE(EXCLUDED.usuario_id, suscripciones_push.usuario_id),
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = COALESCE(EXCLUDED.user_agent, suscripciones_push.user_agent),
       actualizado_en = NOW()`,
    [usuario_id || null, endpoint, p256dh, auth, user_agent || null]
  );

  return { success: true };
}

/**
 * Elimina una suscripción Push por su endpoint
 */
export async function removePushSubscription(endpoint: string) {
  await query(`DELETE FROM suscripciones_push WHERE endpoint = $1`, [endpoint]);
  return { success: true };
}

/**
 * Envía una notificación a un suscriptor individual, eliminándolo si caducó
 */
export async function sendToSubscription(
  sub: { id?: number; endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
  urgente: boolean = false
): Promise<boolean> {
  try {
    const sendOptions: any = {
      TTL: urgente ? 60 * 60 : 60 * 60 * 24, // 1 hora si es urgente, 24 horas si es regular
      urgency: urgente ? 'high' : 'normal',
    };
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      payloadStr,
      sendOptions
    );
    return true;
  } catch (error: any) {
    // Si la suscripción expiró o ya no es válida (404 o 410 Gone), eliminarla
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await removePushSubscription(sub.endpoint).catch(() => {});
    }
    return false;
  }
}

/**
 * Difunde una notificación a todas o un subconjunto segmentado de suscripciones
 */
export async function broadcastPushNotification(
  payload: PushPayload,
  filter?: BroadcastFilterOptions
) {
  await getVapidKeys(); // Garantiza configuración VAPID
  const esUrgente = Boolean(payload.urgente || filter?.urgente);

  const payloadStr = JSON.stringify({
    title: payload.title || 'Congreso ETS 2026',
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    url: payload.url || '/',
    tag: payload.tag || (esUrgente ? 'alerta-urgente' : 'congreso-anuncio'),
    urgente: esUrgente,
    data: payload.data || {},
  });

  let querySql = `SELECT DISTINCT sp.id, sp.endpoint, sp.p256dh, sp.auth FROM suscripciones_push sp`;
  const joins: string[] = [];
  const where: string[] = ['sp.usuario_id IS NOT NULL'];
  const params: any[] = [];

  if (filter?.solo_acreditados) {
    joins.push(
      `JOIN acreditaciones a ON a.usuario_id = sp.usuario_id AND a.tipo_movimiento = 'INGRESO'`
    );
  }

  if (filter?.rol_id) {
    joins.push(`JOIN usuarios u ON sp.usuario_id = u.id`);
    params.push(filter.rol_id);
    where.push(`(u.rol_principal_id = $${params.length} OR EXISTS (
      SELECT 1 FROM usuario_roles_adicionales ura WHERE ura.usuario_id = u.id AND ura.rol_id = $${params.length}
    ))`);
  }

  if (joins.length > 0) {
    querySql += ' ' + joins.join(' ');
  }
  if (where.length > 0) {
    querySql += ' WHERE ' + where.join(' AND ');
  }

  const res = await query(querySql, params);
  const subs = res.rows;

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      const ok = await sendToSubscription(s, payloadStr, esUrgente);
      if (ok) sent++;
      else failed++;
    })
  );

  return {
    total: subs.length,
    sent,
    failed,
    segmento: filter?.solo_acreditados
      ? 'SOLO_ACREDITADOS'
      : filter?.rol_id
        ? `ROL_${filter.rol_id}`
        : 'TODOS',
    urgente: esUrgente,
  };
}

/**
 * Envía una notificación a un usuario específico por su UUID
 */
export async function sendPushNotificationToUser(usuario_id: string, payload: PushPayload) {
  await getVapidKeys();
  const payloadStr = JSON.stringify({
    title: payload.title || 'Congreso ETS 2026',
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    url: payload.url || '/mi-credencial',
    tag: payload.tag || 'congreso-usuario',
    data: payload.data || {},
  });

  const res = await query(
    `SELECT id, endpoint, p256dh, auth FROM suscripciones_push WHERE usuario_id = $1`,
    [usuario_id]
  );
  const subs = res.rows;

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      const ok = await sendToSubscription(s, payloadStr);
      if (ok) sent++;
      else failed++;
    })
  );

  return {
    total: subs.length,
    sent,
    failed,
  };
}
