'use client';

import React from 'react';
import Swal from 'sweetalert2';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationToggleProps {
  usuarioId?: string | null;
  compact?: boolean;
}

export default function PushNotificationToggle({
  usuarioId,
  compact = false,
}: PushNotificationToggleProps) {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications(usuarioId);

  if (!isSupported) {
    return null; // Ocultar si el navegador no soporta Push
  }

  const handleToggle = async () => {
    if (isLoading) return;

    if (isSubscribed) {
      const result = await Swal.fire({
        title: '¿Desactivar notificaciones?',
        text: 'Dejarás de recibir avisos de cambios de sala, horarios y reconfirmaciones.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#005691',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, desactivar',
        cancelButtonText: 'Cancelar',
      });

      if (result.isConfirmed) {
        try {
          await unsubscribe();
          Swal.fire({
            icon: 'info',
            title: 'Notificaciones desactivadas',
            text: 'Puedes volver a activarlas en cualquier momento.',
            timer: 2000,
            showConfirmButton: false,
          });
        } catch (err: any) {
          Swal.fire('Error', err.message || 'No se pudo desactivar', 'error');
        }
      }
    } else {
      if (permission === 'denied') {
        Swal.fire({
          icon: 'warning',
          title: 'Permiso denegado',
          text: 'Has bloqueado las notificaciones en este navegador. Habilítalas desde la configuración del sitio o navegador.',
          confirmButtonColor: '#005691',
        });
        return;
      }

      try {
        await subscribe();
        Swal.fire({
          icon: 'success',
          title: '¡Avisos activados!',
          text: 'Recibirás notificaciones oficiales en tiempo real sobre el Congreso ETS 2026.',
          timer: 2500,
          showConfirmButton: false,
        });
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo activar',
          text: err.message || 'Ocurrió un inconveniente al activar los avisos',
          confirmButtonColor: '#005691',
        });
      }
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`btn btn-sm d-flex align-items-center gap-1 ${
          isSubscribed ? 'btn-outline-success' : 'btn-outline-secondary'
        }`}
        title={isSubscribed ? 'Notificaciones push activas' : 'Activar notificaciones push'}
      >
        <i
          className={`bx ${
            isLoading
              ? 'bx-loader-alt bx-spin'
              : isSubscribed
                ? 'bxs-bell-ring text-success'
                : 'bx-bell'
          }`}
        ></i>
        <span className="small">{isSubscribed ? 'Avisos Activos' : 'Activar Avisos'}</span>
      </button>
    );
  }

  return (
    <div className="card shadow-sm border-0 mb-3 bg-light">
      <div className="card-body p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <div
            className={`rounded-circle p-2 d-flex align-items-center justify-content-center ${
              isSubscribed ? 'bg-success text-white' : 'bg-primary text-white'
            }`}
            style={{ width: '40px', height: '40px' }}
          >
            <i className={`bx ${isSubscribed ? 'bxs-bell-ring' : 'bx-bell'} fs-4`}></i>
          </div>
          <div>
            <div className="fw-bold small text-dark">
              {isSubscribed ? 'Notificaciones Oficiales Activas' : 'Recibir Avisos en Vivo'}
            </div>
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
              {isSubscribed
                ? 'Este dispositivo está registrado para alertas y cambios de cronograma.'
                : 'Mantente al tanto de llamados a sala, anuncios de oradores y novedades.'}
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`btn btn-sm ${isSubscribed ? 'btn-outline-danger' : 'btn-primary'}`}
            style={{ minWidth: '120px' }}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" />
                Cargando...
              </>
            ) : isSubscribed ? (
              'Desactivar'
            ) : (
              'Activar Avisos'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
