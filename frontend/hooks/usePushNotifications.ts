'use client';

import { useState, useEffect, useCallback } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(usuarioId?: string | null) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Comprobar soporte y estado de suscripción inicial
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (!supported) {
      setIsLoading(false);
      return;
    }

    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(!!subscription);
      })
      .catch((err) => {
        console.warn('Error al verificar suscripción push:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Suscribirse a las notificaciones Push
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      throw new Error('Las notificaciones push no están soportadas en este navegador');
    }

    setIsLoading(true);
    try {
      // 1. Solicitar permiso al usuario
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        throw new Error('El permiso para notificaciones fue denegado');
      }

      // 2. Obtener clave pública VAPID
      const keyRes = await fetch('/api/push/vapid-key');
      if (!keyRes.ok) {
        throw new Error('Servicio de notificaciones Push no configurado');
      }
      const { publicKey, error } = await keyRes.json();
      if (!publicKey) {
        throw new Error(error || 'No se pudo obtener la clave pública VAPID');
      }

      // 3. Suscribir con el PushManager del Service Worker
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any,
        });
      }

      // 4. Determinar el usuario registrado
      let targetUsuarioId = usuarioId;
      if (!targetUsuarioId && typeof window !== 'undefined') {
        const cached = localStorage.getItem('ets2026_credencial_cache');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.usuario?.id) {
              targetUsuarioId = parsed.usuario.id;
            }
          } catch (_) {}
        }
      }

      if (!targetUsuarioId) {
        throw new Error('Las notificaciones push solo pueden activarse para participantes registrados.');
      }

      // 5. Enviar suscripción al backend
      const subJson = subscription.toJSON();
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
          usuario_id: targetUsuarioId,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.message || 'Error al persistir la suscripción push');
      }

      setIsSubscribed(true);
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, usuarioId]);

  // Cancelar suscripción
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Informar al backend
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }

      setIsSubscribed(false);
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
