'use client';

import { useEffect, useState } from 'react';
import {
  FrontendThemeVars,
  FRONTEND_THEMES,
  FRONTEND_THEME_STORAGE_KEY,
  FRONTEND_CUSTOM_THEME_STORAGE_KEY,
} from './admin/frontendThemes';

const FRONTEND_THEME_SYNC_KEY = 'congreso_frontend_theme_synced_at';

export default function FrontendThemeProvider() {
  const [updateNotice, setUpdateNotice] = useState<{
    themeName: string;
    serverPayload: any;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function applyFrontendVars(vars: FrontendThemeVars) {
      const root = document.documentElement;
      Object.entries(vars).forEach(([key, val]) => {
        if (key.startsWith('--') && typeof val === 'string') {
          root.style.setProperty(key, val);
        }
      });
    }

    async function loadAndApplyFrontendTheme() {
      const localThemeId = localStorage.getItem(FRONTEND_THEME_STORAGE_KEY);
      const localCustom = localStorage.getItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY);
      const lastSyncedAt = localStorage.getItem(FRONTEND_THEME_SYNC_KEY);

      // 1. Aplicar inmediatamente lo local para evitar parpadeos visuales (FOUC)
      if (localThemeId) {
        if (localThemeId === 'personalizado' && localCustom) {
          try {
            applyFrontendVars(JSON.parse(localCustom));
          } catch {
            applyFrontendVars(FRONTEND_THEMES[0].cssVars);
          }
        } else {
          const match = FRONTEND_THEMES.find((t) => t.id === localThemeId);
          applyFrontendVars(match ? match.cssVars : FRONTEND_THEMES[0].cssVars);
        }
      } else {
        applyFrontendVars(FRONTEND_THEMES[0].cssVars);
      }

      // 2. Consultar el tema oficial predeterminado en PostgreSQL
      try {
        const res = await fetch('/api/admin/configuracion/tema-frontend-default');
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.defaultTheme) {
            const server = data.defaultTheme;
            const serverDate = server.actualizado_en || '';

            // Si el usuario no tenía tema local configurado, aplicar directamente el oficial del servidor
            if (!localThemeId) {
              localStorage.setItem(FRONTEND_THEME_STORAGE_KEY, server.themeId);
              if (serverDate) localStorage.setItem(FRONTEND_THEME_SYNC_KEY, serverDate);
              if (server.themeId === 'personalizado' && server.customVars) {
                localStorage.setItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY, JSON.stringify(server.customVars));
                applyFrontendVars(server.customVars);
              } else {
                const match = FRONTEND_THEMES.find((t) => t.id === server.themeId);
                if (match) applyFrontendVars(match.cssVars);
              }
              return;
            }

            // Si el usuario ya tiene tema local, comprobar si el servidor tiene una versión más nueva
            if (serverDate && serverDate !== lastSyncedAt) {
              // Si su tema local difiere del tema oficial nuevo, avisar con toast sutil
              const isDifferentTheme = localThemeId !== server.themeId || localThemeId === 'personalizado';
              if (isDifferentTheme) {
                setUpdateNotice({
                  themeName: server.themeName || server.themeId,
                  serverPayload: server,
                });
              } else {
                // Si es el mismo tema, actualizar el timestamp silenciosamente
                localStorage.setItem(FRONTEND_THEME_SYNC_KEY, serverDate);
              }
            }
          }
        }
      } catch {
        // Modo offline o sin conexión: mantiene el tema local
      }
    }

    loadAndApplyFrontendTheme();

    // 3. Escuchar evento dinámico de cambio en tiempo real (por ejemplo desde el panel de control)
    function onFrontendThemeChange(e: any) {
      if (e.detail) {
        if (e.detail.customVars) {
          applyFrontendVars(e.detail.customVars);
        } else if (e.detail.themeId) {
          const match = FRONTEND_THEMES.find((t) => t.id === e.detail.themeId);
          if (match) {
            applyFrontendVars(match.cssVars);
          }
        }
      }
    }

    window.addEventListener('frontend-theme-changed', onFrontendThemeChange);
    return () => window.removeEventListener('frontend-theme-changed', onFrontendThemeChange);
  }, []);

  function applyServerUpdate() {
    if (!updateNotice) return;
    const { serverPayload } = updateNotice;
    localStorage.setItem(FRONTEND_THEME_STORAGE_KEY, serverPayload.themeId);
    if (serverPayload.actualizado_en) {
      localStorage.setItem(FRONTEND_THEME_SYNC_KEY, serverPayload.actualizado_en);
    }

    const root = document.documentElement;
    if (serverPayload.themeId === 'personalizado' && serverPayload.customVars) {
      localStorage.setItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY, JSON.stringify(serverPayload.customVars));
      Object.entries(serverPayload.customVars).forEach(([k, v]) => {
        if (typeof v === 'string') root.style.setProperty(k, v);
      });
    } else {
      localStorage.removeItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY);
      const match = FRONTEND_THEMES.find((t) => t.id === serverPayload.themeId) || FRONTEND_THEMES[0];
      Object.entries(match.cssVars).forEach(([k, v]) => {
        if (typeof v === 'string') root.style.setProperty(k, v);
      });
    }
    setUpdateNotice(null);
  }

  function dismissUpdate() {
    if (updateNotice?.serverPayload?.actualizado_en) {
      // Ignorar esta versión guardando la fecha para no volver a insistir
      localStorage.setItem(FRONTEND_THEME_SYNC_KEY, updateNotice.serverPayload.actualizado_en);
    }
    setUpdateNotice(null);
  }

  if (!updateNotice) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-blue-200 shadow-xl rounded-2xl p-4 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-2.5">
        <span className="text-xl">🎨</span>
        <div className="text-xs">
          <p className="font-bold text-gray-900">
            Nuevo tema oficial disponible
          </p>
          <p className="text-gray-500 mt-0.5">
            El congreso actualizó el diseño oficial a <strong>&quot;{updateNotice.themeName}&quot;</strong>.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
        <button
          type="button"
          onClick={dismissUpdate}
          className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
        >
          Mantener actual
        </button>
        <button
          type="button"
          onClick={applyServerUpdate}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition"
        >
          Actualizar ahora
        </button>
      </div>
    </div>
  );
}
