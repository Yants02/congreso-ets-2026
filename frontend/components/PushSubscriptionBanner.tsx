'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

interface Props {
  usuarioId?: string;
}

export default function PushSubscriptionBanner({ usuarioId }: Props) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  async function checkExistingSubscription() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setIsSubscribed(true);
        }
      }
    } catch {
      // Ignorar
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkExistingSubscription();
    }
  }, []);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function handleSubscribe() {
    if (!isSupported) {
      await Swal.fire({
        title: 'Navegador no compatible',
        text: 'Tu navegador no soporta notificaciones push en segundo plano.',
        icon: 'warning',
        confirmButtonColor: '#005691',
      });
      return;
    }

    setLoading(true);
    setStatusNotice(null);

    try {
      // 1. Obtener o validar que el usuario esté registrado
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

      // Si aún no está identificado, solicitar el DNI del participante registrado
      if (!targetUsuarioId) {
        setLoading(false);
        const { value: dniInput, isDismissed } = await Swal.fire({
          title: 'Participante Registrado',
          text: 'Las notificaciones oficiales solo están disponibles para participantes registrados en el Congreso ETS 2026. Por favor ingresa tu DNI para vincular tu dispositivo:',
          input: 'text',
          inputPlaceholder: 'Ingresa tu DNI o Pasaporte...',
          showCancelButton: true,
          confirmButtonText: 'Verificar y Activar',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#005691',
          inputValidator: (val) => {
            if (!val || val.trim().length < 5) {
              return 'Por favor ingresa un número de DNI válido.';
            }
            return null;
          },
        });

        if (isDismissed || !dniInput) {
          return;
        }

        setLoading(true);
        // Validar DNI en la base de datos
        const userRes = await fetch(`/api/credencial/${encodeURIComponent(dniInput.trim())}`);
        if (!userRes.ok) {
          setLoading(false);
          await Swal.fire({
            icon: 'error',
            title: 'Participante no encontrado',
            text: 'No se encontró ningún participante registrado con el DNI ingresado. Recuerda inscribirte previamente en el congreso para recibir avisos.',
            confirmButtonColor: '#005691',
          });
          return;
        }

        const userData = await userRes.json();
        if (!userData.ok || !userData.usuario?.id) {
          setLoading(false);
          await Swal.fire({
            icon: 'error',
            title: 'Participante no válido',
            text: 'Los datos del participante no pudieron ser validados.',
            confirmButtonColor: '#005691',
          });
          return;
        }

        targetUsuarioId = userData.usuario.id;
      }

      // 2. Verificar si ya fue denegado previamente por el navegador
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setStatusNotice('Permiso bloqueado en el navegador. Haz clic en el candado 🔒 de la barra de direcciones para habilitarlo.');
        setLoading(false);
        Swal.fire({
          icon: 'warning',
          title: 'Notificaciones Bloqueadas',
          html: `
            <div style="text-align: left; font-size: 14px; line-height: 1.6;">
              <p>Tu navegador tiene bloqueados los permisos de notificación para este sitio.</p>
              <p><strong>Para activarlos:</strong></p>
              <ol style="margin-left: 20px;">
                <li>Haz clic en el ícono de <strong>candado o ajustes 🔒</strong> a la izquierda de la barra de direcciones (URL).</li>
                <li>Busca la opción <strong>Notificaciones</strong> o <strong>Permisos del sitio</strong>.</li>
                <li>Cámbialo a <strong>Permitir</strong> y recarga la página.</li>
              </ol>
            </div>
          `,
          confirmButtonColor: '#005691',
          confirmButtonText: 'Entendido',
        });
        return;
      }

      // 3. Solicitar permiso al usuario
      const perm = await Notification.requestPermission();

      if (perm !== 'granted') {
        setStatusNotice('No se concedieron permisos de notificación. Puedes habilitarlos desde el candado 🔒 del navegador.');
        setLoading(false);
        return;
      }

      // 4. Obtener clave pública VAPID
      const keyRes = await fetch('/api/push/public-key');
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData.publicKey) {
        throw new Error('No se pudo obtener la clave VAPID del servidor');
      }

      // 5. Registrar Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 6. Suscribir al PushManager
      const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 7. Enviar al backend vinculando al participante registrado
      const subJson = subscription.toJSON();
      const sendRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
          usuario_id: targetUsuarioId,
        }),
      });

      if (sendRes.ok) {
        setIsSubscribed(true);
        setStatusNotice('✅ ¡Notificaciones del Congreso activadas exitosamente!');
        Swal.fire({
          icon: 'success',
          title: '¡Notificaciones Activadas!',
          text: 'Tu dispositivo recibirá alertas oficiales en tiempo real sobre cambios de sala, cronograma y avisos del Congreso ETS 2026.',
          timer: 3500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      } else {
        const errData = await sendRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Hubo un error al registrar la suscripción en el servidor.');
      }
    } catch (err: any) {
      console.error('Error suscribiendo a push:', err);
      setStatusNotice(err.message || 'Error al activar notificaciones');
      Swal.fire({
        icon: 'error',
        title: 'No se pudo activar las notificaciones',
        text: err.message || 'Ocurrió un error al registrar la suscripción en el dispositivo.',
        confirmButtonColor: '#005691',
      });
    } finally {
      setLoading(false);
    }
  }

  if (!isSupported || isSubscribed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 rounded-xl shadow-md my-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-blue-700/50">
      <div className="flex items-center gap-3">
        <span className="text-2xl animate-bounce">🔔</span>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-200">
            Avisos en Vivo del Congreso ETS 2026
          </h4>
          <p className="text-xs text-blue-100">
            Activa las notificaciones oficiales para recibir alertas de cambios de sala, horarios e inicio de charlas en tu dispositivo.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? '⏳ Activando...' : 'Activar Notificaciones'}
        </button>
      </div>

      {statusNotice && (
        <div className="w-full text-xs text-amber-200 font-semibold mt-1">
          {statusNotice}
        </div>
      )}
    </div>
  );
}
