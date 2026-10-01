'use client';

import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function SweetAlertProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Interceptar e instrumentar Swal.fire globalmente para estandarizar duración de avisos:
      // - Operación Exitosa ('success'): 3 segundos (3000 ms) y desaparece
      // - Operación No Exitosa ('error', 'warning', 'info' u otros): 6 segundos (6000 ms) y desaparece
      const originalFire = Swal.fire.bind(Swal);

      // Wrapper tipado compatible
      (Swal as any).fire = function (...args: any[]) {
        if (args.length === 0) {
          return originalFire();
        }

        // Si se llama con firma posicional: Swal.fire(title, html/text, icon)
        if (typeof args[0] === 'string') {
          const title = args[0];
          const text = args[1] || '';
          const icon = args[2];
          const isSuccess = icon === 'success';
          const timerDuration = isSuccess ? 3000 : 6000;

          return originalFire({
            title,
            text,
            icon,
            timer: timerDuration,
            timerProgressBar: true,
            confirmButtonColor: isSuccess ? '#005691' : '#d33',
            confirmButtonText: 'Aceptar',
          });
        }

        // Si se llama con objeto de opciones: Swal.fire({ ... })
        if (typeof args[0] === 'object' && args[0] !== null) {
          const opts = { ...args[0] };

          // Si es un diálogo de confirmación interactivo (tiene showCancelButton: true), no forzamos timer para no cerrar la pregunta
          const isConfirmation = Boolean(opts.showCancelButton || opts.showDenyButton);

          if (!isConfirmation) {
            const isSuccess = opts.icon === 'success';
            const defaultTimer = isSuccess ? 3000 : 6000;

            // Si el timer no está configurado explícitamente a false o null, aplicar regla institucional:
            // Éxito: 3 segundos | No éxito: 6 segundos
            opts.timer = defaultTimer;
            opts.timerProgressBar = true;
          }

          return originalFire(opts);
        }

        return originalFire(...args);
      };

      // 2. Interceptar alert nativo para que siempre se renderice como SweetAlert2 institucional
      window.alert = (message?: any) => {
        const text = typeof message === 'string' ? message : JSON.stringify(message);
        const isError = text.toLowerCase().includes('error') || text.toLowerCase().includes('rechazó') || text.toLowerCase().includes('fallo');
        const isWarning = text.toLowerCase().includes('advertencia') || text.toLowerCase().includes('atención') || text.toLowerCase().includes('conflicto');
        const isSuccess = text.toLowerCase().includes('éxito') || text.toLowerCase().includes('exitosamente') || text.toLowerCase().includes('correcto');

        Swal.fire({
          title: isError ? 'Error en la Operación' : isWarning ? 'Atención' : isSuccess ? 'Operación Exitosa' : 'Notificación Oficial',
          text,
          icon: isError ? 'error' : isWarning ? 'warning' : isSuccess ? 'success' : 'info',
          confirmButtonColor: '#005691',
          confirmButtonText: 'Entendido',
        });
      };
    }
  }, []);

  return null;
}
