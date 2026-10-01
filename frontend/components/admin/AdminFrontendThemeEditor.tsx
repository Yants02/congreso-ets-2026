'use client';

import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import {
  FrontendTheme,
  FrontendThemeVars,
  FRONTEND_THEMES,
  FRONTEND_THEME_STORAGE_KEY,
  FRONTEND_CUSTOM_THEME_STORAGE_KEY,
} from './frontendThemes';
import { calculateContrastRatio } from './colorContrast';

interface Props {
  onNotice: (msg: string) => void;
}

interface TargetVariable {
  key: keyof FrontendThemeVars;
  label: string;
  desc: string;
}

export default function AdminFrontendThemeEditor({ onNotice }: Props) {
  const [currentThemeId, setCurrentThemeId] = useState<string>('caba-oficial');
  const [customVars, setCustomVars] = useState<FrontendThemeVars | null>(null);
  const [activeSubtab, setActiveSubtab] = useState<'editor' | 'selector'>('editor');
  const [activeView, setActiveView] = useState<'home' | 'participa' | 'credencial' | 'recursos'>('home');
  const [editorMode, setEditorMode] = useState<'rapido' | 'avanzado'>('rapido');

  // Elemento activo seleccionado para inspección / corrección
  const [selectedTarget, setSelectedTarget] = useState<{
    elementName: string;
    description: string;
    variables: TargetVariable[];
  } | null>({
    elementName: 'Sección Hero Principal',
    description: 'Bloque superior del portal donde se presenta el congreso, logotipo, fecha y botón de inscripción.',
    variables: [
      {
        key: '--frontend-hero-bg',
        label: 'Color de Fondo Hero',
        desc: 'Fondo del bloque principal de bienvenida',
      },
      {
        key: '--frontend-hero-text',
        label: 'Color de Texto Hero',
        desc: 'Tipografía de títulos en el Hero',
      },
      {
        key: '--frontend-btn-cta-bg',
        label: 'Fondo Botón "Inscribirse"',
        desc: 'Botón de llamada a la acción principal',
      },
      {
        key: '--frontend-btn-cta-text',
        label: 'Texto Botón "Inscribirse"',
        desc: 'Color de la tipografía del botón',
      },
    ],
  });

  const [highlightedKey, setHighlightedKey] = useState<keyof FrontendThemeVars | null>('--frontend-hero-bg');
  const controlsRef = useRef<HTMLDivElement>(null);

  // Cargar estado inicial desde localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(FRONTEND_THEME_STORAGE_KEY) || 'caba-oficial';
      setCurrentThemeId(savedTheme);

      const savedCustom = localStorage.getItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY);
      if (savedCustom) {
        try {
          setCustomVars(JSON.parse(savedCustom));
        } catch {
          // Si el JSON estaba corrupto, inicializar con el tema base
        }
      }
    }
  }, []);

  // Obtener el tema actualmente efectivo
  function getEffectiveVars(): FrontendThemeVars {
    if (currentThemeId === 'personalizado' && customVars) {
      return customVars;
    }
    const baseTheme = FRONTEND_THEMES.find((t) => t.id === currentThemeId) || FRONTEND_THEMES[0];
    return baseTheme.cssVars;
  }

  // Aplicar un tema predeterminado
  function handleSelectPredefined(theme: FrontendTheme) {
    setCurrentThemeId(theme.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FRONTEND_THEME_STORAGE_KEY, theme.id);
      window.dispatchEvent(
        new CustomEvent('frontend-theme-changed', {
          detail: { themeId: theme.id, customVars: null },
        })
      );
      onNotice(`Tema de Frontend "${theme.name}" aplicado correctamente al portal.`);
    }
  }

  // Modificar una variable en el editor
  function handleColorChange(key: keyof FrontendThemeVars, val: string) {
    const current = customVars || { ...getEffectiveVars() };
    const updated: FrontendThemeVars = {
      ...current,
      [key]: val,
    };

    // Sincronizar compatibilidad de tokens base de Tailwind
    if (key === '--frontend-hero-bg') {
      updated['--color-azul-oscuro'] = val;
    }
    if (key === '--frontend-btn-cta-bg') {
      updated['--color-amarillo'] = val;
    }
    if (key === '--frontend-card-bg') {
      updated['--color-blanco'] = val;
    }
    if (key === '--background') {
      updated['--frontend-sobre-bg'] = val;
    }

    setCustomVars(updated);
    setCurrentThemeId('personalizado');

    if (typeof window !== 'undefined') {
      localStorage.setItem(FRONTEND_THEME_STORAGE_KEY, 'personalizado');
      localStorage.setItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('frontend-theme-changed', {
          detail: { themeId: 'personalizado', customVars: updated },
        })
      );
    }
  }

  // Al hacer clic sobre cualquier elemento a corregir
  function selectTarget(
    e: React.MouseEvent,
    elementName: string,
    description: string,
    variables: TargetVariable[]
  ) {
    e.stopPropagation();
    setSelectedTarget({
      elementName,
      description,
      variables,
    });
    if (variables.length > 0) {
      setHighlightedKey(variables[0].key);
    }
    setActiveSubtab('editor');
  }

  // Restablecer el editor a una plantilla
  function handleResetTo(baseThemeId: string) {
    const baseTheme = FRONTEND_THEMES.find((t) => t.id === baseThemeId) || FRONTEND_THEMES[0];
    setCustomVars({ ...baseTheme.cssVars });
    setCurrentThemeId(baseTheme.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FRONTEND_THEME_STORAGE_KEY, baseTheme.id);
      localStorage.removeItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent('frontend-theme-changed', {
          detail: { themeId: baseTheme.id, customVars: null },
        })
      );
      onNotice(`Editor de Frontend reiniciado al tema base "${baseTheme.name}".`);
    }
  }

  // Exportar tema a JSON
  function handleExportJson() {
    const data = JSON.stringify(getEffectiveVars(), null, 2);
    navigator.clipboard.writeText(data);
    Swal.fire({
      icon: 'success',
      title: 'Copiado al Portapapeles',
      text: 'La definición del tema de Frontend en formato JSON ha sido copiada.',
      confirmButtonColor: '#005691',
    });
  }

  // Importar tema desde JSON
  async function handleImportJson() {
    const { value: text } = await Swal.fire({
      title: 'Importar Paleta Frontend JSON',
      input: 'textarea',
      inputPlaceholder: 'Pega aquí el JSON exportado de una paleta...',
      showCancelButton: true,
      confirmButtonText: 'Aplicar Tema',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#005691',
    });

    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && (parsed['--frontend-hero-bg'] || parsed['--color-azul-oscuro'])) {
          setCustomVars(parsed);
          setCurrentThemeId('personalizado');
          localStorage.setItem(FRONTEND_THEME_STORAGE_KEY, 'personalizado');
          localStorage.setItem(FRONTEND_CUSTOM_THEME_STORAGE_KEY, JSON.stringify(parsed));
          window.dispatchEvent(
            new CustomEvent('frontend-theme-changed', {
              detail: { themeId: 'personalizado', customVars: parsed },
            })
          );
          onNotice('Tema de Frontend importado y aplicado con éxito.');
        } else {
          throw new Error('Formato no válido');
        }
      } catch {
        Swal.fire({
          icon: 'error',
          title: 'JSON Inválido',
          text: 'El texto ingresado no contiene una estructura de tema válida.',
          confirmButtonColor: '#005691',
        });
      }
    }
  }

  // Guardar como Tema Predeterminado Global en PostgreSQL
  async function handleSaveAsGlobalDefault() {
    const activeTheme = FRONTEND_THEMES.find((t) => t.id === currentThemeId);
    const themeName =
      currentThemeId === 'personalizado'
        ? 'Personalizado (Inspector en Vivo)'
        : activeTheme?.name || currentThemeId;

    const confirmResult = await Swal.fire({
      title: '¿Fijar como Tema Oficial del Portal Público?',
      html: `Estás a punto de establecer <b>${themeName}</b> como el tema predeterminado para <b>todos los visitantes y usuarios</b> del portal del congreso.<br/><br/><span class="text-xs text-gray-500">Se guardará de forma persistente en PostgreSQL (<code>configuraciones_sistema</code>).</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Fijar como Default Global',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
    });

    if (!confirmResult.isConfirmed) return;

    try {
      const payload = {
        themeId: currentThemeId,
        themeName,
        customVars: currentThemeId === 'personalizado' ? getEffectiveVars() : null,
      };

      const res = await fetch('/api/admin/configuracion/tema-frontend-default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Tema de Frontend Fijado',
          text: data.mensaje || 'Tema predeterminado del Frontend actualizado correctamente.',
          confirmButtonColor: '#005691',
        });
        onNotice(`Tema oficial del Frontend fijado: "${themeName}".`);
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: data.message || 'Error al persistir en la base de datos.',
          confirmButtonColor: '#dc2626',
        });
      }
    } catch {
      await Swal.fire({
        icon: 'error',
        title: 'Error de Red',
        text: 'No se pudo comunicar con el servidor.',
        confirmButtonColor: '#dc2626',
      });
    }
  }

  const effectiveVars = getEffectiveVars();

  return (
    <div className="space-y-6">
      {/* TARJETA PRINCIPAL DEL EDITOR */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        {/* Cabecera con Título y Navegación de Subpestañas */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌐</span>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">
                Editor y Personalizador Integral de Temas del Frontend
              </h3>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-extrabold rounded-full uppercase">
                Todos los Elementos del Portal
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Controla y personaliza cada sección y componente visible de la plataforma pública (Header, Hero, Notificaciones Push, Sobre el Congreso, Tarjetas formativas, Programa con filtros, Formulario de vacantes y Footer).
            </p>
          </div>

          {/* Subpestañas */}
          <div className="flex bg-gray-100 p-1 rounded-xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveSubtab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubtab === 'editor'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>✏️</span>
              <span>Inspector en Vivo (10 Módulos)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubtab('selector')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubtab === 'selector'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>🖼️</span>
              <span>Paletas Predefinidas</span>
            </button>
          </div>
        </div>

        {/* SUBTAB 1: EDITOR DE ELEMENTOS CON INSPECTOR CLIC-TO-EDIT */}
        {activeSubtab === 'editor' && (
          <div className="space-y-6">
            {/* Barra de Acciones del Editor */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Partir de plantilla:</span>
                <select
                  onChange={(e) => handleResetTo(e.target.value)}
                  value={currentThemeId === 'personalizado' ? '' : currentThemeId}
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white font-medium cursor-pointer"
                >
                  <option value="" disabled>
                    (Personalizado en edición)
                  </option>
                  {FRONTEND_THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAsGlobalDefault}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition hover:shadow"
                  title="Fijar este tema como predeterminado para todos los visitantes en PostgreSQL"
                >
                  <span>💾</span>
                  <span>Fijar como Default Global</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                  title="Copiar configuración en JSON"
                >
                  <span>📋</span>
                  <span>Exportar JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleImportJson}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                  title="Pegar configuración en JSON"
                >
                  <span>📥</span>
                  <span>Importar JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleResetTo('caba-oficial')}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                  title="Restablecer tema a CABA Oficial"
                >
                  <span>↺</span>
                  <span>Restablecer</span>
                </button>
              </div>
            </div>

            {/* SECCIÓN INTERACTIVA CLIC & EDIT: PANTALLA VISUAL + PANEL DE VALORES A CORREGIR */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* LADO IZQUIERDO: LIENZO DE SIMULACIÓN INTEGRAL DEL PORTAL PÚBLICO */}
              <div className="xl:col-span-7 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <span>👆</span>
                    <span>Selecciona la vista a inspeccionar y haz clic en sus elementos:</span>
                  </span>
                  <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveView('home')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeView === 'home'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🏠 Home
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('participa')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeView === 'participa'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📝 Inscripción / Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('credencial')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeView === 'credencial'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🪪 Mi Credencial & QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('recursos')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeView === 'recursos'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📚 Recursos y FAQs
                    </button>
                  </div>
                </div>

                {/* Lienzo del Portal */}
                <div
                  className="p-4 rounded-2xl border-2 border-gray-200 space-y-4 shadow-sm relative group bg-slate-100 overflow-hidden"
                  style={{ backgroundColor: effectiveVars['--background'] }}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono opacity-70">
                    <span className="font-semibold">
                      {activeView === 'home' && '🌐 Vista 1: Página Principal (Home)'}
                      {activeView === 'participa' && '📝 Vista 2: Inscripción y Acceso (/participa & /login)'}
                      {activeView === 'credencial' && '🪪 Vista 3: Portal del Participante (/mi-credencial)'}
                      {activeView === 'recursos' && '📚 Vista 4: Centro de Recursos y FAQs (/materiales & FAQs)'}
                    </span>
                    <span className="bg-black/10 px-2 py-0.5 rounded text-[10px]">Fondo: --background</span>
                  </div>

                  {/* 1. HEADER PÚBLICO MOCK INTERACTIVO (Común a todas las vistas) */}
                  <div
                    onClick={(e) =>
                      selectTarget(
                        e,
                        'Barra de Navegación Superior (Header)',
                        'Barra superior fija del portal público donde figura el logo institucional, los enlaces de secciones y el botón Ingresar.',
                        [
                          { key: '--frontend-header-bg', label: 'Fondo del Header', desc: 'Color de fondo de la barra de navegación' },
                          { key: '--frontend-header-text', label: 'Texto de Enlaces', desc: 'Color de los links del menú' },
                          { key: '--frontend-header-border', label: 'Borde Divisorio', desc: 'Línea de contorno inferior' },
                          { key: '--frontend-header-link-hover', label: 'Color Hover Enlaces', desc: 'Color al posar el cursor sobre enlaces' },
                        ]
                      )
                    }
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      selectedTarget?.elementName.includes('Header')
                        ? 'ring-2 ring-blue-500 border-blue-500 shadow-md'
                        : 'hover:border-blue-400 bg-white border-gray-200'
                    }`}
                    style={{
                      backgroundColor: effectiveVars['--frontend-header-bg'],
                      borderColor: effectiveVars['--frontend-header-border'],
                      color: effectiveVars['--frontend-header-text'],
                    }}
                    title="Clic para corregir la Barra de Navegación Superior (Header)"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs">🏛️ Congreso ETS 2026</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-4 text-xs font-bold">
                      <span className="cursor-pointer hover:opacity-75">Inicio</span>
                      <span className="cursor-pointer hover:opacity-75">El Congreso</span>
                      <span className="cursor-pointer hover:opacity-75">Programa</span>
                      <span className="cursor-pointer hover:opacity-75">Participa</span>
                    </div>

                    <div
                      className="px-3 py-1 rounded-md text-xs font-bold shadow-xs cursor-pointer"
                      style={{
                        backgroundColor: effectiveVars['--frontend-btn-cta-bg'],
                        color: effectiveVars['--frontend-btn-cta-text'],
                      }}
                    >
                      Ingresar
                    </div>
                  </div>

                  {/* VISTA 1: HOME COMPLETA */}
                  {activeView === 'home' && (
                    <div className="space-y-4">
                      {/* HERO PRINCIPAL */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Sección Hero Principal',
                            'Bloque superior de bienvenida con título, fecha, auditorio y el botón principal "Inscribirse".',
                            [
                              { key: '--frontend-hero-bg', label: 'Color de Fondo Hero', desc: 'Superficie de fondo del Hero' },
                              { key: '--frontend-hero-text', label: 'Texto Principal Hero', desc: 'Color de los títulos y textos de apertura' },
                              { key: '--frontend-hero-subtitle', label: 'Subtítulo y Fecha', desc: 'Color de la leyenda de auditorio y fecha' },
                              { key: '--frontend-btn-cta-bg', label: 'Fondo Botón "Inscribirse"', desc: 'Color del botón principal de acción' },
                              { key: '--frontend-btn-cta-text', label: 'Texto del Botón', desc: 'Color de la tipografía del botón' },
                              { key: '--frontend-btn-cta-hover', label: 'Color Hover Botón', desc: 'Color al posar el cursor' },
                              { key: '--frontend-btn-radius', label: 'Radio de Borde (Botones)', desc: 'Curvatura de las esquinas de los botones (ej: 0px, 6px, 12px, 9999px)' },
                            ]
                          )
                        }
                        className={`p-6 rounded-xl border transition-all cursor-pointer text-center space-y-3 ${
                          selectedTarget?.elementName.includes('Hero')
                            ? 'ring-2 ring-amber-500 border-amber-500 shadow-md'
                            : 'hover:border-amber-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-hero-bg'],
                          color: effectiveVars['--frontend-hero-text'],
                        }}
                        title="Clic para corregir la Sección Hero Principal"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 block">
                          1° Congreso · Educación Técnica Superior
                        </span>
                        <h4 className="text-xl font-black tracking-tight">
                          Educación Técnica Superior · DETS 2026
                        </h4>
                        <p className="text-xs max-w-md mx-auto" style={{ color: effectiveVars['--frontend-hero-subtitle'] }}>
                          6 de noviembre · Auditorio Polo Saavedra 5085 · Buenos Aires
                        </p>

                        <button
                          type="button"
                          className="px-8 py-2 text-xs font-extrabold shadow-md uppercase tracking-wider transition cursor-pointer"
                          style={{
                            backgroundColor: effectiveVars['--frontend-btn-cta-bg'],
                            color: effectiveVars['--frontend-btn-cta-text'],
                            borderRadius: effectiveVars['--frontend-btn-radius'] || '6px',
                          }}
                        >
                          Inscribirse
                        </button>
                      </div>

                      {/* BANNER NOTIFICACIONES PUSH */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Banner de Notificaciones Push PWA',
                            'Caja flotante en el portal que invita al asistente a habilitar alertas en vivo en su teléfono u ordenador.',
                            [
                              { key: '--frontend-banner-push-bg', label: 'Fondo del Banner Push', desc: 'Color de fondo del contenedor de aviso' },
                              { key: '--frontend-banner-push-text', label: 'Texto del Banner', desc: 'Tipografía de la invitación' },
                              { key: '--frontend-banner-push-border', label: 'Borde del Banner', desc: 'Línea de contorno' },
                              { key: '--frontend-btn-radius', label: 'Radio de Borde (Botones)', desc: 'Curvatura de las esquinas de los botones' },
                            ]
                          )
                        }
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          selectedTarget?.elementName.includes('Banner')
                            ? 'ring-2 ring-blue-500 border-blue-500 shadow-md'
                            : 'hover:border-blue-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-banner-push-bg'],
                          borderColor: effectiveVars['--frontend-banner-push-border'],
                          color: effectiveVars['--frontend-banner-push-text'],
                        }}
                        title="Clic para corregir el Banner de Notificaciones Push"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔔</span>
                          <div className="text-xs">
                            <span className="font-bold block">Avisos en Vivo del Congreso ETS 2026</span>
                            <span className="opacity-80 text-[10px]">Activa notificaciones oficiales para recibir alertas de salas.</span>
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 text-[10px] font-bold shadow-xs"
                          style={{
                            backgroundColor: effectiveVars['--frontend-btn-cta-bg'],
                            color: effectiveVars['--frontend-btn-cta-text'],
                            borderRadius: effectiveVars['--frontend-btn-radius'] || '6px',
                          }}
                        >
                          Activar
                        </span>
                      </div>

                      {/* SECCIÓN SOBRE EL CONGRESO */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Sección Sobre el Congreso',
                            'Área descriptiva e institucional con párrafos y objetivos formativos del congreso.',
                            [
                              { key: '--frontend-sobre-bg', label: 'Fondo de la Sección', desc: 'Color de la superficie' },
                              { key: '--frontend-sobre-title', label: 'Título de la Sección', desc: 'Color del encabezado principal' },
                              { key: '--frontend-sobre-text', label: 'Párrafos Informativos', desc: 'Color del texto explicativo' },
                            ]
                          )
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                          selectedTarget?.elementName.includes('Sobre')
                            ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md'
                            : 'hover:border-indigo-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-sobre-bg'],
                          borderColor: effectiveVars['--frontend-card-border'],
                        }}
                        title="Clic para corregir la Sección Sobre el Congreso"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: effectiveVars['--color-azul-claro'] }}>
                          El Congreso
                        </span>
                        <h5 className="font-bold text-sm" style={{ color: effectiveVars['--frontend-sobre-title'] }}>
                          Un espacio para compartir y construir el saber técnico
                        </h5>
                        <p className="text-xs leading-relaxed" style={{ color: effectiveVars['--frontend-sobre-text'] }}>
                          Espacio destinado a visibilizar y compartir experiencias de enseñanza, prácticas profesionalizantes y proyectos reales desarrollados en los IFTS.
                        </p>
                      </div>

                      {/* TARJETAS DE ACTIVIDADES / MÓDULOS */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Tarjetas de Actividades y Módulos Formativos',
                            'Tarjetas que exhiben los talleres, conferencias, información del cronograma y stands permanentes.',
                            [
                              { key: '--frontend-card-bg', label: 'Fondo de Tarjetas', desc: 'Superficie de las tarjetas' },
                              { key: '--frontend-card-border', label: 'Borde de Tarjetas', desc: 'Línea delimitadora de las tarjetas' },
                              { key: '--frontend-card-title', label: 'Título de Tarjeta', desc: 'Color del nombre del módulo' },
                              { key: '--frontend-card-text', label: 'Texto Descriptivo', desc: 'Color del resumen de contenido' },
                              { key: '--frontend-card-link', label: 'Enlace "Saber más"', desc: 'Color de la llamada interactiva' },
                            ]
                          )
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                          selectedTarget?.elementName.includes('Tarjetas')
                            ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md'
                            : 'hover:border-emerald-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-card-bg'],
                          borderColor: effectiveVars['--frontend-card-border'],
                        }}
                        title="Clic para corregir las Tarjetas del Portal"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: effectiveVars['--color-azul-claro'] + '20',
                                color: effectiveVars['--color-azul-claro'],
                              }}
                            >
                              Aula Abierta
                            </span>
                            <h5 className="font-bold text-sm mt-1" style={{ color: effectiveVars['--frontend-card-title'] }}>
                              Demostraciones Técnicas y Prácticas Profesionalizantes
                            </h5>
                          </div>
                          <span className="text-[11px] font-mono opacity-60">Sala Magna</span>
                        </div>

                        <p className="text-xs line-clamp-2" style={{ color: effectiveVars['--frontend-card-text'] }}>
                          Espacio institucional para exhibir experiencias, desarrollos aplicados y resoluciones formativas de los estudiantes.
                        </p>

                        <div className="pt-2 flex justify-between items-center text-xs font-bold">
                          <span
                            className="cursor-pointer hover:underline"
                            style={{ color: effectiveVars['--frontend-card-link'] }}
                          >
                            Saber más &rarr;
                          </span>
                          <span className="text-[10px] opacity-60 font-normal">Cupos disponibles: 80</span>
                        </div>
                      </div>

                      {/* PROGRAMA Y FILTROS */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Programa y Grilla de Cronograma',
                            'Selector de filtros temáticos (Institucional, Masterclass, Talleres) y tarjetas del cronograma de charlas.',
                            [
                              { key: '--frontend-filter-active-bg', label: 'Filtro Activo (Fondo)', desc: 'Botón de filtro seleccionado' },
                              { key: '--frontend-filter-active-text', label: 'Filtro Activo (Texto)', desc: 'Letra del botón activo' },
                              { key: '--frontend-filter-inactive-bg', label: 'Filtro Inactivo (Fondo)', desc: 'Botones no seleccionados' },
                              { key: '--frontend-filter-inactive-text', label: 'Filtro Inactivo (Texto)', desc: 'Letra de botones no seleccionados' },
                              { key: '--frontend-activity-card-border', label: 'Borde de Tarjeta de Charla', desc: 'Contorno de fila del cronograma' },
                            ]
                          )
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                          selectedTarget?.elementName.includes('Programa')
                            ? 'ring-2 ring-cyan-500 border-cyan-500 shadow-md'
                            : 'hover:border-cyan-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-card-bg'],
                          borderColor: effectiveVars['--frontend-card-border'],
                        }}
                        title="Clic para corregir el Programa y Cronograma"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-800">Cronograma Oficial:</span>
                          <div className="flex gap-1 text-[10px] font-bold">
                            <span
                              className="px-2 py-0.5 rounded shadow-xs"
                              style={{
                                backgroundColor: effectiveVars['--frontend-filter-active-bg'],
                                color: effectiveVars['--frontend-filter-active-text'],
                              }}
                            >
                              Todos
                            </span>
                            <span
                              className="px-2 py-0.5 rounded border"
                              style={{
                                backgroundColor: effectiveVars['--frontend-filter-inactive-bg'],
                                color: effectiveVars['--frontend-filter-inactive-text'],
                                borderColor: effectiveVars['--frontend-card-border'],
                              }}
                            >
                              Masterclass
                            </span>
                            <span
                              className="px-2 py-0.5 rounded border"
                              style={{
                                backgroundColor: effectiveVars['--frontend-filter-inactive-bg'],
                                color: effectiveVars['--frontend-filter-inactive-text'],
                                borderColor: effectiveVars['--frontend-card-border'],
                              }}
                            >
                              Talleres
                            </span>
                          </div>
                        </div>

                        <div
                          className="p-2.5 rounded-lg border text-xs flex justify-between items-center"
                          style={{
                            backgroundColor: effectiveVars['--frontend-activity-card-bg'],
                            borderColor: effectiveVars['--frontend-activity-card-border'],
                          }}
                        >
                          <div>
                            <span className="font-bold text-[11px] block">09:00 - Apertura Institucional DETS</span>
                            <span className="text-[10px] opacity-75">Auditorio Polo Saavedra · Aforo completo</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Confirmado
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VISTA 2: INSCRIPCIÓN Y ACCESO (/participa & /login) */}
                  {activeView === 'participa' && (
                    <div className="space-y-4">
                      {/* TITULAR Y VACANTES */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Cabecera de Inscripción y Cupos',
                            'Encabezado de la página de registro donde se informa la disponibilidad de cupos y requisitos.',
                            [
                              { key: '--frontend-sobre-title', label: 'Título de Inscripción', desc: 'Color del título principal' },
                              { key: '--frontend-sobre-text', label: 'Texto de Indicaciones', desc: 'Instrucciones para registrarse' },
                              { key: '--frontend-filter-active-bg', label: 'Insignia de Cupos', desc: 'Color del indicador de vacantes' },
                            ]
                          )
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                          selectedTarget?.elementName.includes('Cabecera de Inscripción')
                            ? 'ring-2 ring-blue-500 border-blue-500 shadow-md'
                            : 'hover:border-blue-400 bg-white'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-card-bg'],
                          borderColor: effectiveVars['--frontend-card-border'],
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="text-base font-extrabold" style={{ color: effectiveVars['--frontend-sobre-title'] }}>
                            Inscripción Oficial al Congreso
                          </h4>
                          <span
                            className="px-2.5 py-0.5 text-[10px] font-bold rounded-full text-white"
                            style={{ backgroundColor: effectiveVars['--frontend-filter-active-bg'] }}
                          >
                            Cupos Abiertos
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: effectiveVars['--frontend-sobre-text'] }}>
                          Completa el formulario para reservar tu lugar. Recibirás tu credencial digital y QR oficial de acreditación.
                        </p>
                      </div>

                      {/* FORMULARIO DE DATOS */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Formularios de Inscripción e Inputs',
                            'Campos donde los participantes ingresan DNI, nombres, correo institucional y eligen su rol.',
                            [
                              { key: '--frontend-form-bg', label: 'Fondo del Formulario', desc: 'Contenedor del formulario' },
                              { key: '--frontend-form-border', label: 'Borde del Formulario', desc: 'Línea de contorno' },
                              { key: '--frontend-input-bg', label: 'Fondo de Inputs', desc: 'Interior de cajas de texto y selects' },
                              { key: '--frontend-input-border', label: 'Borde de Inputs', desc: 'Línea de contorno de cajas' },
                              { key: '--frontend-input-text', label: 'Texto de Inputs', desc: 'Color de texto escrito' },
                              { key: '--frontend-btn-cta-bg', label: 'Fondo Botón Enviar', desc: 'Botón Confirmar Inscripción' },
                              { key: '--frontend-btn-cta-text', label: 'Texto Botón Enviar', desc: 'Color de texto en botón' },
                            ]
                          )
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                          selectedTarget?.elementName.includes('Formularios')
                            ? 'ring-2 ring-orange-500 border-orange-500 shadow-md'
                            : 'hover:border-orange-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-form-bg'],
                          borderColor: effectiveVars['--frontend-form-border'],
                        }}
                        title="Clic para corregir los Formularios e Inputs"
                      >
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div className="space-y-1">
                            <span className="font-bold opacity-80 text-[11px] block">Documento (DNI/Pasaporte):</span>
                            <input
                              type="text"
                              readOnly
                              value="12.345.678"
                              className="w-full p-2 text-xs rounded-lg border outline-none cursor-pointer"
                              style={{
                                backgroundColor: effectiveVars['--frontend-input-bg'],
                                borderColor: effectiveVars['--frontend-input-border'],
                                color: effectiveVars['--frontend-input-text'],
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="font-bold opacity-80 text-[11px] block">Nombre y Apellido:</span>
                            <input
                              type="text"
                              readOnly
                              value="María Elena Walsh"
                              className="w-full p-2 text-xs rounded-lg border outline-none cursor-pointer"
                              style={{
                                backgroundColor: effectiveVars['--frontend-input-bg'],
                                borderColor: effectiveVars['--frontend-input-border'],
                                color: effectiveVars['--frontend-input-text'],
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="font-bold opacity-80 text-[11px] block">Correo Electrónico:</span>
                            <input
                              type="text"
                              readOnly
                              value="mwalsh@bue.edu.ar"
                              className="w-full p-2 text-xs rounded-lg border outline-none cursor-pointer"
                              style={{
                                backgroundColor: effectiveVars['--frontend-input-bg'],
                                borderColor: effectiveVars['--frontend-input-border'],
                                color: effectiveVars['--frontend-input-text'],
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="font-bold opacity-80 text-[11px] block">Rol Institucional:</span>
                            <select
                              disabled
                              className="w-full p-2 text-xs rounded-lg border outline-none cursor-pointer"
                              style={{
                                backgroundColor: effectiveVars['--frontend-input-bg'],
                                borderColor: effectiveVars['--frontend-input-border'],
                                color: effectiveVars['--frontend-input-text'],
                              }}
                            >
                              <option>Docente / Expositor</option>
                              <option>Estudiante IFTS</option>
                              <option>Público General</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            className="w-full py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider shadow-sm cursor-pointer"
                            style={{
                              backgroundColor: effectiveVars['--frontend-btn-cta-bg'],
                              color: effectiveVars['--frontend-btn-cta-text'],
                            }}
                          >
                            Confirmar Mi Registro &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VISTA 3: MI CREDENCIAL & QR DIGITAL (/mi-credencial) */}
                  {activeView === 'credencial' && (
                    <div className="space-y-4">
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Credencial Digital y QR Criptográfico',
                            'Pase oficial del congresista con código QR HMAC, datos verificados, rol institucional y botón de descarga de diploma.',
                            [
                              { key: '--frontend-credencial-card-bg', label: 'Fondo de la Credencial', desc: 'Superficie de la tarjeta de identificación' },
                              { key: '--frontend-credencial-border', label: 'Borde de la Credencial', desc: 'Contorno de la credencial oficial' },
                              { key: '--frontend-credencial-header-bg', label: 'Encabezado de Credencial', desc: 'Banda superior con escudo y fecha' },
                              { key: '--frontend-credencial-header-text', label: 'Texto del Encabezado', desc: 'Tipografía de la banda superior' },
                              { key: '--frontend-credencial-badge-bg', label: 'Badge de Rol / Asistente', desc: 'Fondo de la insignia del rol' },
                              { key: '--frontend-credencial-badge-text', label: 'Texto de Badge', desc: 'Color de la letra del rol' },
                              { key: '--frontend-credencial-btn-diploma-bg', label: 'Botón Certificado / Diploma', desc: 'Botón para descargar certificado en PDF' },
                              { key: '--frontend-credencial-btn-diploma-text', label: 'Texto de Botón Diploma', desc: 'Letra del botón de certificado' },
                            ]
                          )
                        }
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-4 max-w-sm mx-auto shadow-md ${
                          selectedTarget?.elementName.includes('Credencial')
                            ? 'ring-2 ring-blue-500 border-blue-500'
                            : 'hover:border-blue-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-credencial-card-bg'],
                          borderColor: effectiveVars['--frontend-credencial-border'],
                        }}
                        title="Clic para corregir la Credencial Digital y QR"
                      >
                        {/* HEADER DE LA CREDENCIAL */}
                        <div
                          className="p-3 rounded-xl flex items-center justify-between"
                          style={{
                            backgroundColor: effectiveVars['--frontend-credencial-header-bg'],
                            color: effectiveVars['--frontend-credencial-header-text'],
                          }}
                        >
                          <div>
                            <span className="font-extrabold text-xs block">1° CONGRESO ETS 2026</span>
                            <span className="text-[10px] opacity-80">DETS · Ministerio de Educación</span>
                          </div>
                          <span className="text-xl">🏛️</span>
                        </div>

                        {/* CUERPO CON QR SIMULADO */}
                        <div className="text-center space-y-2 py-1">
                          <div className="w-28 h-28 mx-auto bg-gray-900 rounded-lg p-2 flex items-center justify-center text-white text-[10px] font-mono shadow-inner">
                            [ QR SEGURO HMAC ]
                          </div>
                          <div>
                            <h4 className="text-sm font-black" style={{ color: effectiveVars['--foreground'] }}>
                              ING. CARLOS PÉREZ
                            </h4>
                            <span className="text-[11px] opacity-75 font-mono">DNI: 30.123.456</span>
                          </div>
                          <div>
                            <span
                              className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block"
                              style={{
                                backgroundColor: effectiveVars['--frontend-credencial-badge-bg'],
                                color: effectiveVars['--frontend-credencial-badge-text'],
                              }}
                            >
                              Expositor / Panelista
                            </span>
                          </div>
                        </div>

                        {/* BOTÓN DESCARGA DIPLOMA */}
                        <button
                          type="button"
                          className="w-full py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          style={{
                            backgroundColor: effectiveVars['--frontend-credencial-btn-diploma-bg'],
                            color: effectiveVars['--frontend-credencial-btn-diploma-text'],
                          }}
                        >
                          <span>🎓</span>
                          <span>Descargar Certificado A4</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* VISTA 4: RECURSOS Y FAQS (/materiales & FAQs) */}
                  {activeView === 'recursos' && (
                    <div className="space-y-4">
                      {/* TARJETA DE RECURSO / MATERIAL */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Centro de Recursos y Materiales',
                            'Tarjetas donde los asistentes descargan flyers, presentaciones, papers académicos y normativas.',
                            [
                              { key: '--frontend-materiales-card-bg', label: 'Fondo de Tarjeta de Material', desc: 'Superficie de la tarjeta de recurso' },
                              { key: '--frontend-materiales-card-border', label: 'Borde de Tarjeta', desc: 'Contorno de la tarjeta' },
                              { key: '--frontend-materiales-tag-bg', label: 'Fondo Etiqueta Tipo', desc: 'Insignia de PDF/Video/Presentación' },
                              { key: '--frontend-materiales-tag-text', label: 'Texto Etiqueta Tipo', desc: 'Letra de la insignia' },
                              { key: '--frontend-card-title', label: 'Título del Documento', desc: 'Nombre del archivo o ponencia' },
                              { key: '--frontend-card-link', label: 'Enlace Descarga', desc: 'Llamada de descarga' },
                            ]
                          )
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                          selectedTarget?.elementName.includes('Recursos')
                            ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md'
                            : 'hover:border-emerald-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-materiales-card-bg'],
                          borderColor: effectiveVars['--frontend-materiales-card-border'],
                        }}
                        title="Clic para corregir el Centro de Recursos"
                      >
                        <div className="flex justify-between items-center">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider"
                            style={{
                              backgroundColor: effectiveVars['--frontend-materiales-tag-bg'],
                              color: effectiveVars['--frontend-materiales-tag-text'],
                            }}
                          >
                            DOCUMENTO PDF
                          </span>
                          <span className="text-[10px] opacity-60">2.4 MB</span>
                        </div>
                        <h5 className="font-bold text-xs" style={{ color: effectiveVars['--frontend-card-title'] }}>
                          Guía Curricular de Prácticas Profesionalizantes IFTS 2026
                        </h5>
                        <div className="flex justify-between items-center text-xs font-bold pt-1">
                          <span className="cursor-pointer hover:underline" style={{ color: effectiveVars['--frontend-card-link'] }}>
                            Descargar Material &darr;
                          </span>
                          <span className="text-[10px] opacity-60 font-normal">DETS · GCABA</span>
                        </div>
                      </div>

                      {/* ACORDEÓN PREGUNTAS FRECUENTES (FAQ) */}
                      <div
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Preguntas Frecuentes y Acordeón FAQ',
                            'Módulos desplegables con dudas comunes sobre acreditación, transporte, sedes y emisión de diplomas.',
                            [
                              { key: '--frontend-faq-card-bg', label: 'Fondo de la Caja FAQ', desc: 'Superficie del contenedor de preguntas' },
                              { key: '--frontend-faq-card-border', label: 'Borde de la Caja FAQ', desc: 'Línea delimitadora del acordeón' },
                              { key: '--frontend-faq-question-text', label: 'Color de la Pregunta', desc: 'Tipografía del encabezado consultivo' },
                              { key: '--frontend-faq-answer-text', label: 'Color de la Respuesta', desc: 'Tipografía de la explicación desglosada' },
                            ]
                          )
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                          selectedTarget?.elementName.includes('Preguntas Frecuentes')
                            ? 'ring-2 ring-cyan-500 border-cyan-500 shadow-md'
                            : 'hover:border-cyan-400'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--frontend-faq-card-bg'],
                          borderColor: effectiveVars['--frontend-faq-card-border'],
                        }}
                        title="Clic para corregir las Preguntas Frecuentes (FAQ)"
                      >
                        <div className="flex justify-between items-center border-b pb-1.5" style={{ borderColor: effectiveVars['--frontend-faq-card-border'] }}>
                          <h5 className="font-bold text-xs" style={{ color: effectiveVars['--frontend-faq-question-text'] }}>
                            ¿Cómo obtengo mi certificado de asistencia oficial?
                          </h5>
                          <span className="text-xs">▼</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: effectiveVars['--frontend-faq-answer-text'] }}>
                          Al finalizar la jornada y validar tu acreditación presencial por QR, se habilitará la descarga automática de tu diploma con firma digital verificable.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 8. FOOTER PÚBLICO MOCK INTERACTIVO (Común a todas las vistas) */}
                  <div
                    onClick={(e) =>
                      selectTarget(
                        e,
                        'Pie de Página (Footer)',
                        'Zona inferior del portal con enlaces institucionales, logos de organismos y créditos legales.',
                        [
                          { key: '--frontend-footer-bg', label: 'Fondo del Footer', desc: 'Color de fondo del pie de página' },
                          { key: '--frontend-footer-text', label: 'Texto del Footer', desc: 'Color de tipografía y créditos' },
                          { key: '--frontend-footer-border', label: 'Borde Divisorio', desc: 'Línea divisoria superior' },
                        ]
                      )
                    }
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center text-xs ${
                      selectedTarget?.elementName.includes('Footer')
                        ? 'ring-2 ring-purple-500 border-purple-500 shadow-md'
                        : 'hover:border-purple-400'
                    }`}
                    style={{
                      backgroundColor: effectiveVars['--frontend-footer-bg'],
                      borderColor: effectiveVars['--frontend-footer-border'],
                      color: effectiveVars['--frontend-footer-text'],
                    }}
                    title="Clic para corregir el Pie de Página (Footer)"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold block">Ministerio de Educación · GCABA</span>
                      <span className="text-[10px] opacity-75 block">congreso.dets@bue.edu.ar</span>
                    </div>
                    <span className="text-[10px] opacity-60">© 2026 DETS · IFTS N° 4</span>
                  </div>
                </div>
              </div>

              {/* LADO DERECHO: PANEL DE CONFIGURACIÓN Y PALETA DE COLORES */}
              <div ref={controlsRef} className="xl:col-span-5 space-y-4">
                {/* Selector de Modo: Rápido vs Avanzado */}
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-xs font-bold text-gray-700 pl-1 flex items-center gap-1.5">
                    <span>🎛️</span>
                    <span>Modo de Edición:</span>
                  </span>
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEditorMode('rapido')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        editorMode === 'rapido'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ⚡ Rápido (4 Claves)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('avanzado')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        editorMode === 'avanzado'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🔬 Quirúrgico
                    </button>
                  </div>
                </div>

                {/* CONTENIDO SEGÚN MODO */}
                {editorMode === 'rapido' ? (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-blue-200 space-y-4">
                    <div className="border-b border-gray-200 pb-2.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        Personalización Armónica Rápida
                      </span>
                      <h4 className="text-sm font-extrabold text-gray-900 mt-1">
                        4 Colores Maestros del Portal
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Modifica los 4 pilares visuales. El sistema armonizará automáticamente todas las pantallas, tarjetas y botones.
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      {/* 1. Primario Institucional */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label className="font-bold text-gray-900">🏛️ Color Primario Institucional</label>
                          <span className="font-mono text-[11px] text-gray-500">{effectiveVars['--frontend-hero-bg']}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Afecta al Hero principal, encabezado de credencial y pie de página.</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={effectiveVars['--frontend-hero-bg']}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange('--frontend-hero-bg', val);
                              handleColorChange('--frontend-credencial-header-bg', val);
                              handleColorChange('--frontend-materiales-tag-bg', val);
                              handleColorChange('--frontend-filter-active-bg', val);
                            }}
                            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0 shrink-0"
                          />
                          <input
                            type="text"
                            value={effectiveVars['--frontend-hero-bg']}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange('--frontend-hero-bg', val);
                              handleColorChange('--frontend-credencial-header-bg', val);
                              handleColorChange('--frontend-materiales-tag-bg', val);
                              handleColorChange('--frontend-filter-active-bg', val);
                            }}
                            className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-lg uppercase"
                          />
                        </div>
                      </div>

                      {/* 2. Fondo General */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label className="font-bold text-gray-900">🖼️ Fondo General del Portal</label>
                          <span className="font-mono text-[11px] text-gray-500">{effectiveVars['--background']}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Superficie base de todas las pantallas públicas.</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={effectiveVars['--background']}
                            onChange={(e) => handleColorChange('--background', e.target.value)}
                            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0 shrink-0"
                          />
                          <input
                            type="text"
                            value={effectiveVars['--background']}
                            onChange={(e) => handleColorChange('--background', e.target.value)}
                            className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-lg uppercase"
                          />
                        </div>
                      </div>

                      {/* 3. Acento / Botones CTA */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label className="font-bold text-gray-900">⚡ Acento / Botón Inscribirse</label>
                          <span className="font-mono text-[11px] text-gray-500">{effectiveVars['--frontend-btn-cta-bg']}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Llamadas a la acción principales, botón de registro y diplomas.</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={effectiveVars['--frontend-btn-cta-bg']}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange('--frontend-btn-cta-bg', val);
                              handleColorChange('--frontend-credencial-btn-diploma-bg', val);
                            }}
                            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0 shrink-0"
                          />
                          <input
                            type="text"
                            value={effectiveVars['--frontend-btn-cta-bg']}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange('--frontend-btn-cta-bg', val);
                              handleColorChange('--frontend-credencial-btn-diploma-bg', val);
                            }}
                            className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-lg uppercase"
                          />
                        </div>
                      </div>

                      {/* 4. Color de Texto y Contraste */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label className="font-bold text-gray-900">✍️ Texto Principal</label>
                          <span className="font-mono text-[11px] text-gray-500">{effectiveVars['--foreground']}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Tipografía de lectura en páginas y títulos.</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={effectiveVars['--foreground']}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange('--foreground', val);
                              handleColorChange('--frontend-header-text', val);
                              handleColorChange('--frontend-card-title', val);
                            }}
                            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0 shrink-0"
                          />
                          <input
                            type="text"
                            value={effectiveVars['--foreground']}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleColorChange('--foreground', val);
                              handleColorChange('--frontend-header-text', val);
                              handleColorChange('--frontend-card-title', val);
                            }}
                            className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-lg uppercase"
                          />
                        </div>
                      </div>

                      {/* 5. Curvatura de Botones y Esquinas */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label className="font-bold text-gray-900">🔘 Curvatura de Botones (Radius)</label>
                          <span className="font-mono text-[11px] text-gray-500">{effectiveVars['--frontend-btn-radius'] || '6px'}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Estilo de bordes de todos los botones y llamadas a la acción del portal.</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { val: '0px', label: '0px (Recto)' },
                            { val: '4px', label: '4px (Leve)' },
                            { val: '6px', label: '6px (Estándar)' },
                            { val: '12px', label: '12px (Curvo)' },
                            { val: '9999px', label: 'Píldora' },
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => handleColorChange('--frontend-btn-radius', preset.val)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded border cursor-pointer transition ${
                                (effectiveVars['--frontend-btn-radius'] || '6px') === preset.val
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={effectiveVars['--frontend-btn-radius'] || '6px'}
                            onChange={(e) => handleColorChange('--frontend-btn-radius', e.target.value)}
                            className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-lg text-center font-bold"
                            placeholder="ej: 6px, 8px, 9999px"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedTarget ? (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                    <div className="border-b border-gray-200 pb-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Elemento Seleccionado
                      </span>
                      <h4 className="text-base font-bold text-gray-900 mt-1.5">
                        {selectedTarget.elementName}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedTarget.description}</p>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                      {selectedTarget.variables.map((v) => {
                        const currentColor = effectiveVars[v.key] || '#000000';
                        const isHighlighted = highlightedKey === v.key;

                        return (
                          <div
                            key={v.key}
                            className={`p-3 rounded-xl border transition-all ${
                              isHighlighted
                                ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-400/20'
                                : 'bg-white/60 border-gray-200 hover:bg-white'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <label className="text-xs font-bold text-gray-800 block">
                                  {v.label}
                                </label>
                                <span className="text-[11px] text-gray-400 font-mono block">
                                  {v.key}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 border text-gray-600">
                                {currentColor}
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-500 mb-2.5">{v.desc}</p>

                            {/* Validación de Accesibilidad WCAG (Contraste Texto vs Fondo) */}
                            {(() => {
                              // Detectar par texto/fondo si aplica
                              let contrastTarget = '';
                              let isFg = false;
                              if (v.key.includes('text') || v.key.includes('title') || v.key.includes('question') || v.key.includes('answer')) {
                                isFg = true;
                                if (v.key.includes('hero')) contrastTarget = effectiveVars['--frontend-hero-bg'];
                                else if (v.key.includes('header')) contrastTarget = effectiveVars['--frontend-header-bg'];
                                else if (v.key.includes('btn-cta')) contrastTarget = effectiveVars['--frontend-btn-cta-bg'];
                                else if (v.key.includes('card')) contrastTarget = effectiveVars['--frontend-card-bg'];
                                else if (v.key.includes('input')) contrastTarget = effectiveVars['--frontend-input-bg'];
                                else if (v.key.includes('banner')) contrastTarget = effectiveVars['--frontend-banner-push-bg'];
                                else if (v.key.includes('credencial-header')) contrastTarget = effectiveVars['--frontend-credencial-header-bg'];
                                else if (v.key.includes('credencial-badge')) contrastTarget = effectiveVars['--frontend-credencial-badge-bg'];
                                else if (v.key.includes('diploma')) contrastTarget = effectiveVars['--frontend-credencial-btn-diploma-bg'];
                                else if (v.key.includes('footer')) contrastTarget = effectiveVars['--frontend-footer-bg'];
                                else contrastTarget = effectiveVars['--background'];
                              }

                              if (isFg && contrastTarget && currentColor.startsWith('#') && contrastTarget.startsWith('#')) {
                                const contrast = calculateContrastRatio(currentColor, contrastTarget);
                                if (contrast) {
                                  return (
                                    <div className="mb-2.5 flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg border bg-gray-50">
                                      <span className="text-gray-600 font-medium">Contraste WCAG:</span>
                                      <span
                                        className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                                          contrast.isAccessible
                                            ? contrast.score === 'AAA'
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                        }`}
                                      >
                                        {contrast.message}
                                      </span>
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()}

                            {/* Input diferenciado si es radio de borde vs color */}
                            {v.key.includes('radius') ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {[
                                    { val: '0px', label: '0px (Recto)' },
                                    { val: '4px', label: '4px (Leve)' },
                                    { val: '6px', label: '6px (Estándar)' },
                                    { val: '12px', label: '12px (Curvo)' },
                                    { val: '9999px', label: 'Píldora' },
                                  ].map((preset) => (
                                    <button
                                      key={preset.val}
                                      type="button"
                                      onClick={() => handleColorChange(v.key, preset.val)}
                                      className={`px-2 py-1 text-[11px] font-semibold rounded border cursor-pointer transition ${
                                        currentColor === preset.val
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                      }`}
                                    >
                                      {preset.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={currentColor}
                                    onChange={(e) => handleColorChange(v.key, e.target.value)}
                                    className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-lg text-center font-bold"
                                    placeholder="ej: 6px, 8px, 9999px"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                {/* Input Color Picker Nativo */}
                                <input
                                  type="color"
                                  value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#1D3343'}
                                  onChange={(e) => handleColorChange(v.key, e.target.value)}
                                  className="w-10 h-10 p-0 border border-gray-300 rounded-lg cursor-pointer shrink-0"
                                />

                                {/* Input Text Hex Manual */}
                                <input
                                  type="text"
                                  value={currentColor}
                                  onChange={(e) => handleColorChange(v.key, e.target.value)}
                                  className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-lg uppercase"
                                  placeholder="#000000"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-400">
                    <p className="text-sm font-semibold">
                      Haz clic en cualquier área del Portal a la izquierda para inspeccionar y ajustar sus colores.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: CATÁLOGO DE PALETAS PREDEFINIDAS */}
        {activeSubtab === 'selector' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <span>🏛️</span>
                <span>Paletas Oficiales y Temas Sugeridos para el Portal</span>
              </h4>
              <p className="text-xs text-gray-600">
                Selecciona una de las combinaciones prediseñadas para aplicarla de inmediato al portal público.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FRONTEND_THEMES.map((theme) => {
                const isSelected = currentThemeId === theme.id;
                return (
                  <div
                    key={theme.id}
                    onClick={() => handleSelectPredefined(theme)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/30 shadow-md ring-2 ring-blue-400/20'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-xs bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-gray-900">{theme.name}</span>
                        {isSelected && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-full">
                            Activo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{theme.desc}</p>
                    </div>

                    {/* Muestrario de Colores */}
                    <div
                      className="p-3 rounded-lg border text-xs space-y-2"
                      style={{
                        backgroundColor: theme.previewBg,
                        borderColor: theme.cssVars['--frontend-card-border'],
                        color: theme.previewTextColor,
                      }}
                    >
                      <div
                        className="p-2 rounded text-center text-xs font-bold"
                        style={{
                          backgroundColor: theme.cssVars['--frontend-hero-bg'],
                          color: theme.cssVars['--frontend-hero-text'],
                        }}
                      >
                        Hero Preview
                      </div>
                      <div className="flex justify-between items-center text-[11px] px-1 font-semibold">
                        <span>Tarjeta Contenido</span>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            backgroundColor: theme.previewAccent,
                            color: theme.cssVars['--frontend-btn-cta-text'],
                          }}
                        >
                          CTA
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
