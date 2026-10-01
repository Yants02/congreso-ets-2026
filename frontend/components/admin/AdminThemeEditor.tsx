'use client';

import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import {
  BackendTheme,
  BackendThemeVars,
  BACKEND_THEMES,
  THEME_STORAGE_KEY,
  CUSTOM_THEME_STORAGE_KEY,
} from './adminThemes';
import { calculateContrastRatio } from './colorContrast';

interface Props {
  onNotice: (msg: string) => void;
}

interface TargetVariable {
  key: keyof BackendThemeVars;
  label: string;
  desc: string;
}

export default function AdminThemeEditor({ onNotice }: Props) {
  const [currentThemeId, setCurrentThemeId] = useState<string>('claro');
  const [customVars, setCustomVars] = useState<BackendThemeVars | null>(null);
  const [activeSubtab, setActiveSubtab] = useState<'editor' | 'selector'>('editor');

  // Elemento activo seleccionado para inspección / corrección
  const [selectedTarget, setSelectedTarget] = useState<{
    elementName: string;
    description: string;
    variables: TargetVariable[];
  } | null>({
    elementName: 'Fondo General de Pantalla',
    description: 'Espacio global donde se apoyan todos los módulos y paneles del backend.',
    variables: [
      {
        key: '--admin-bg',
        label: 'Color de Fondo Global',
        desc: 'Fondo perimetral del sistema',
      },
      {
        key: '--admin-text-main',
        label: 'Color de Texto Principal',
        desc: 'Tipografía primaria contrastante',
      },
    ],
  });

  const [highlightedKey, setHighlightedKey] = useState<keyof BackendThemeVars | null>('--admin-bg');
  const controlsRef = useRef<HTMLDivElement>(null);

  // Cargar estado inicial desde localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'claro';
      setCurrentThemeId(savedTheme);

      const savedCustom = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
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
  function getEffectiveVars(): BackendThemeVars {
    if (currentThemeId === 'personalizado' && customVars) {
      return customVars;
    }
    const baseTheme = BACKEND_THEMES.find((t) => t.id === currentThemeId) || BACKEND_THEMES[0];
    return baseTheme.cssVars;
  }

  // Aplicar un tema predeterminado
  function handleSelectPredefined(theme: BackendTheme) {
    setCurrentThemeId(theme.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
      window.dispatchEvent(
        new CustomEvent('backend-theme-changed', {
          detail: { themeId: theme.id, customVars: null },
        })
      );
      onNotice(`Tema "${theme.name}" aplicado correctamente al panel administrativo.`);
    }
  }

  // Modificar una variable en el editor
  function handleColorChange(key: keyof BackendThemeVars, val: string) {
    const current = customVars || { ...getEffectiveVars() };
    const updated: BackendThemeVars = {
      ...current,
      [key]: val,
    };
    setCustomVars(updated);
    setCurrentThemeId('personalizado');

    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, 'personalizado');
      localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('backend-theme-changed', {
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
    const baseTheme = BACKEND_THEMES.find((t) => t.id === baseThemeId) || BACKEND_THEMES[0];
    setCustomVars({ ...baseTheme.cssVars });
    setCurrentThemeId(baseTheme.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, baseTheme.id);
      localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent('backend-theme-changed', {
          detail: { themeId: baseTheme.id, customVars: null },
        })
      );
      onNotice(`Editor reiniciado al tema base "${baseTheme.name}".`);
    }
  }

  // Exportar tema a JSON
  function handleExportJson() {
    const data = JSON.stringify(getEffectiveVars(), null, 2);
    navigator.clipboard.writeText(data);
    Swal.fire({
      icon: 'success',
      title: 'Copiado al Portapapeles',
      text: 'La definición del tema en formato JSON ha sido copiada. Puedes guardarla o compartirla con otros operadores.',
      confirmButtonColor: '#005691',
    });
  }

  // Importar tema desde JSON
  async function handleImportJson() {
    const { value: text } = await Swal.fire({
      title: 'Importar Paleta JSON',
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
        if (typeof parsed === 'object' && parsed['--admin-bg']) {
          setCustomVars(parsed);
          setCurrentThemeId('personalizado');
          localStorage.setItem(THEME_STORAGE_KEY, 'personalizado');
          localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(parsed));
          window.dispatchEvent(
            new CustomEvent('backend-theme-changed', {
              detail: { themeId: 'personalizado', customVars: parsed },
            })
          );
          onNotice('Tema personalizado importado y aplicado con éxito.');
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

  // Guardar como Tema Predeterminado Global en Base de Datos PostgreSQL
  async function handleSaveAsGlobalDefault() {
    const activeTheme = BACKEND_THEMES.find((t) => t.id === currentThemeId);
    const themeName =
      currentThemeId === 'personalizado'
        ? 'Personalizado (Inspector en Vivo)'
        : activeTheme?.name || currentThemeId;

    const confirmResult = await Swal.fire({
      title: '¿Fijar como Tema Oficial por Defecto?',
      html: `Estás a punto de establecer <b>${themeName}</b> como el tema predeterminado para <b>todos los operadores</b> del sistema.<br/><br/><span class="text-xs text-gray-500">Se guardará de forma persistente en PostgreSQL (<code>configuraciones_sistema</code>).</span>`,
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

      const res = await fetch('/api/admin/configuracion/tema-default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Tema Oficial Fijado',
          text: data.mensaje || 'Tema predeterminado global actualizado correctamente.',
          confirmButtonColor: '#005691',
        });
        onNotice(`Tema oficial del sistema fijado: "${themeName}".`);
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
        title: 'Error de Conexión',
        text: 'No se pudo conectar con el servidor para guardar el tema predeterminado.',
        confirmButtonColor: '#dc2626',
      });
    }
  }

  const effectiveVars = getEffectiveVars();

  return (
    <div className="space-y-6">
      {/* TARJETA PRINCIPAL CON ENCABEZADO Y TABS DEL EDITOR */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎨</span>
              <h3 className="text-base font-bold text-gray-900">
                Personalización & Editor Integral de Temas del Backend
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Haz clic directamente sobre cualquier componente en la pantalla interactiva o utiliza los controles para inspeccionar y cambiar sus valores exactos.
            </p>
          </div>

          {/* Sub-navegación: Clic & Corrección vs Paletas Predefinidas */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveSubtab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubtab === 'editor'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>🎯</span>
              <span>Clic & Corrección en Vivo</span>
              {currentThemeId === 'personalizado' && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>
            <button
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
                  {BACKEND_THEMES.map((t) => (
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
                  title="Fijar este tema como predeterminado para todos los operadores en PostgreSQL"
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
                  onClick={() => handleResetTo('claro')}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                  title="Restablecer tema a Claro Institucional"
                >
                  <span>↺</span>
                  <span>Restablecer</span>
                </button>
              </div>
            </div>

            {/* SECCIÓN INTERACTIVA CLIC & EDIT: PANTALLA VISUAL + PANEL DE VALORES A CORREGIR */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* LADO IZQUIERDO: PANTALLA INTERACTIVA (HAZ CLIC EN EL ELEMENTO A CORREGIR) */}
              <div className="xl:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <span>👆</span>
                    <span>Haz clic sobre el elemento que deseas corregir:</span>
                  </span>
                  <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                    Interactiva en tiempo real
                  </span>
                </div>

                {/* Lienzo de Simulación de Pantalla Completa */}
                <div
                  onClick={(e) =>
                    selectTarget(
                      e,
                      'Fondo General de Pantalla',
                      'Superficie perimetral del sistema sobre la que se apoyan todos los módulos y tarjetas.',
                      [
                        { key: '--admin-bg', label: 'Color de Fondo General', desc: 'Fondo del contenedor principal' },
                        { key: '--admin-text-main', label: 'Texto Global', desc: 'Color base de tipografía' },
                      ]
                    )
                  }
                  className={`p-5 rounded-2xl border-2 transition-all duration-200 space-y-4 cursor-pointer relative group ${
                    selectedTarget?.elementName === 'Fondo General de Pantalla'
                      ? 'ring-4 ring-blue-500/40 border-blue-500 shadow-md'
                      : 'border-dashed border-gray-300 hover:border-blue-400 shadow-xs'
                  }`}
                  style={{
                    backgroundColor: effectiveVars['--admin-bg'],
                    color: effectiveVars['--admin-text-main'],
                  }}
                  title="Haz clic para corregir el Fondo General de Pantalla"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono opacity-60">
                    <span>🖥️ Vista Previa del Backend (Haz clic en cualquier área)</span>
                    <span className="bg-black/10 px-2 py-0.5 rounded text-[10px]">--admin-bg</span>
                  </div>

                  {/* HEADER MOCK INTERACTIVO */}
                  <div
                    onClick={(e) =>
                      selectTarget(
                        e,
                        'Encabezado / Barra Superior (Header)',
                        'Barra superior donde reside el logo del congreso, menú de usuario y navegación.',
                        [
                          { key: '--admin-header-bg', label: 'Fondo del Encabezado', desc: 'Color de la barra superior' },
                          { key: '--admin-text-header', label: 'Texto del Encabezado', desc: 'Títulos y textos en la barra' },
                          { key: '--admin-border', label: 'Borde Divisorio', desc: 'Línea de separación inferior' },
                        ]
                      )
                    }
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      selectedTarget?.elementName.includes('Encabezado')
                        ? 'ring-2 ring-amber-500 border-amber-500 shadow-md'
                        : 'hover:border-amber-400'
                    }`}
                    style={{
                      backgroundColor: effectiveVars['--admin-header-bg'],
                      borderColor: effectiveVars['--admin-border'],
                      color: effectiveVars['--admin-text-header'],
                    }}
                    title="Clic para corregir la Barra Superior / Header"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="font-bold text-xs">Congreso ETS 2026 · Panel Institucional</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* BOTÓN DE ACENTO INTERACTIVO */}
                      <span
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Botón de Acción Principal (Acento)',
                            'Botones primarios para guardar, confirmar, enviar o realizar acciones principales.',
                            [
                              { key: '--admin-accent', label: 'Color del Botón', desc: 'Fondo del botón de acento' },
                              { key: '--admin-accent-text', label: 'Texto del Botón', desc: 'Tipografía sobre el botón' },
                              { key: '--admin-accent-hover', label: 'Color al Pasar el Mouse', desc: 'Hover del botón' },
                              { key: '--admin-btn-radius', label: 'Radio de Borde (Esquinas)', desc: 'Curvatura de los botones (ej: 0px, 6px, 8px, 14px, 9999px)' },
                            ]
                          )
                        }
                        className={`px-3 py-1 text-xs font-bold transition shadow-xs cursor-pointer ${
                          selectedTarget?.elementName.includes('Botón')
                            ? 'ring-2 ring-emerald-500 shadow-md'
                            : 'hover:opacity-90'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--admin-accent'],
                          color: effectiveVars['--admin-accent-text'],
                          borderRadius: effectiveVars['--admin-btn-radius'] || '8px',
                        }}
                        title="Clic para corregir Botones de Acento"
                      >
                        ⚡ Botón de Acción
                      </span>
                    </div>
                  </div>

                  {/* TARJETA / CARD MOCK INTERACTIVA */}
                  <div
                    onClick={(e) =>
                      selectTarget(
                        e,
                        'Tarjeta o Panel de Módulo (Card)',
                        'Contenedor blanco o gris donde se presentan formularios, filtros y tablas de cada sección.',
                        [
                          { key: '--admin-card-bg', label: 'Fondo de la Tarjeta', desc: 'Fondo de contenedores y paneles' },
                          { key: '--admin-text-main', label: 'Texto Principal', desc: 'Títulos y datos clave de la tarjeta' },
                          { key: '--admin-text-muted', label: 'Texto Secundario', desc: 'Subtítulos e información atenuada' },
                          { key: '--admin-border', label: 'Borde de Tarjeta', desc: 'Línea de contorno de tarjeta' },
                        ]
                      )
                    }
                    className={`p-4 rounded-xl border shadow-xs space-y-3 transition-all cursor-pointer ${
                      selectedTarget?.elementName.includes('Tarjeta')
                        ? 'ring-2 ring-blue-500 border-blue-500 shadow-md'
                        : 'hover:border-blue-400'
                    }`}
                    style={{
                      backgroundColor: effectiveVars['--admin-card-bg'],
                      borderColor: effectiveVars['--admin-border'],
                      color: effectiveVars['--admin-text-main'],
                    }}
                    title="Clic para corregir Tarjetas y Paneles (Cards)"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h6
                          onClick={(e) =>
                            selectTarget(
                              e,
                              'Títulos y Texto Principal',
                              'Tipografía utilizada para encabezados, nombres y datos de mayor relevancia.',
                              [
                                { key: '--admin-text-main', label: 'Texto Principal', desc: 'Color para títulos y celdas' },
                              ]
                            )
                          }
                          className="font-bold text-xs cursor-pointer hover:underline"
                          style={{ color: effectiveVars['--admin-text-main'] }}
                        >
                          📋 Tarjeta de Registro de Participantes
                        </h6>
                        <p
                          onClick={(e) =>
                            selectTarget(
                              e,
                              'Texto Secundario / Atenuado (Muted)',
                              'Tipografía secundaria para leyendas, descripciones de ayuda y etiquetas secundarias.',
                              [
                                { key: '--admin-text-muted', label: 'Texto Atenuado (Muted)', desc: 'Color de subtítulos y notas' },
                              ]
                            )
                          }
                          className="text-[11px] cursor-pointer hover:underline"
                          style={{ color: effectiveVars['--admin-text-muted'] }}
                        >
                          Gestión administrativa de vacantes y accesos en vivo
                        </p>
                      </div>

                      <span
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Bordes y Separadores',
                            'Líneas delimitadoras de paneles, divisores y contornos de tabla.',
                            [
                              { key: '--admin-border', label: 'Color de Bordes', desc: 'Línea perimetral de elementos' },
                            ]
                          )
                        }
                        className="px-2 py-0.5 rounded text-[10px] border cursor-pointer hover:bg-black/5"
                        style={{ borderColor: effectiveVars['--admin-border'] }}
                      >
                        Borde: {effectiveVars['--admin-border']}
                      </span>
                    </div>

                    {/* CAJA DE TEXTO / INPUT MOCK INTERACTIVO */}
                    <div
                      onClick={(e) =>
                        selectTarget(
                          e,
                          'Cajas de Entrada de Datos (Inputs y Selects)',
                          'Campos de búsqueda, formularios de alta, edición y filtros desplegables.',
                          [
                            { key: '--admin-input-bg', label: 'Fondo del Input', desc: 'Color de fondo interno' },
                            { key: '--admin-input-text', label: 'Texto Escrito', desc: 'Color de la tipografía ingresada' },
                            { key: '--admin-input-border', label: 'Borde del Input', desc: 'Línea de contorno de la caja' },
                          ]
                        )
                      }
                      className={`flex gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                        selectedTarget?.elementName.includes('Cajas')
                          ? 'ring-2 ring-purple-500 border-purple-500'
                          : 'hover:border-purple-400'
                      }`}
                      title="Clic para corregir Cajas de Texto (Inputs)"
                    >
                      <input
                        type="text"
                        readOnly
                        value="Buscar por DNI, Apellido o Correo..."
                        className="flex-1 p-2 text-xs rounded-lg border outline-none font-sans cursor-pointer"
                        style={{
                          backgroundColor: effectiveVars['--admin-input-bg'],
                          color: effectiveVars['--admin-input-text'],
                          borderColor: effectiveVars['--admin-input-border'],
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Botón de Acción Principal (Acento)',
                            'Botones primarios para guardar, confirmar, enviar o realizar acciones principales.',
                            [
                              { key: '--admin-accent', label: 'Color del Botón', desc: 'Fondo del botón de acento' },
                              { key: '--admin-accent-text', label: 'Texto del Botón', desc: 'Tipografía sobre el botón' },
                              { key: '--admin-accent-hover', label: 'Color al Pasar el Mouse', desc: 'Hover del botón' },
                              { key: '--admin-btn-radius', label: 'Radio de Borde (Esquinas)', desc: 'Curvatura de los botones (ej: 0px, 6px, 8px, 14px, 9999px)' },
                            ]
                          )
                        }
                        className="px-3 py-1.5 text-xs font-bold shadow-2xs cursor-pointer hover:opacity-90"
                        style={{
                          backgroundColor: effectiveVars['--admin-accent'],
                          color: effectiveVars['--admin-accent-text'],
                          borderRadius: effectiveVars['--admin-btn-radius'] || '8px',
                        }}
                      >
                        Filtrar
                      </button>
                    </div>

                    {/* TABLA DE DATOS MOCK INTERACTIVA */}
                    <div
                      onClick={(e) =>
                        selectTarget(
                          e,
                          'Tablas de Datos (Cabecera y Celdas)',
                          'Listados principales de participantes, auditorías, actividades y configuraciones.',
                          [
                            { key: '--admin-table-header-bg', label: 'Cabecera de Tabla (Thead)', desc: 'Fondo de la fila de títulos' },
                            { key: '--admin-text-muted', label: 'Texto de Cabecera', desc: 'Tipografía de las columnas' },
                            { key: '--admin-table-row-hover', label: 'Fila al Pasar el Mouse (Hover)', desc: 'Color al apoyar el cursor' },
                            { key: '--admin-text-main', label: 'Texto de Celda', desc: 'Tipografía del registro' },
                            { key: '--admin-border', label: 'Líneas Divisoras', desc: 'Bordes entre filas' },
                          ]
                        )
                      }
                      className={`overflow-hidden rounded-lg border transition-all cursor-pointer ${
                        selectedTarget?.elementName.includes('Tablas')
                          ? 'ring-2 ring-indigo-500 border-indigo-500'
                          : 'hover:border-indigo-400'
                      }`}
                      style={{ borderColor: effectiveVars['--admin-border'] }}
                      title="Clic para corregir Tablas de Datos"
                    >
                      <table className="w-full text-left text-xs">
                        <thead
                          style={{
                            backgroundColor: effectiveVars['--admin-table-header-bg'],
                            color: effectiveVars['--admin-text-muted'],
                          }}
                        >
                          <tr>
                            <th className="p-2.5">Participante</th>
                            <th className="p-2.5">Rol / Rol Asignado</th>
                            <th className="p-2.5 text-right">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            className="border-t"
                            style={{
                              borderColor: effectiveVars['--admin-border'],
                              color: effectiveVars['--admin-text-main'],
                            }}
                          >
                            <td className="p-2.5 font-semibold">García, Alejandro</td>
                            <td className="p-2.5">Docente / Expositor</td>
                            <td className="p-2.5 text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Confirmado
                              </span>
                            </td>
                          </tr>
                          <tr
                            className="border-t"
                            style={{
                              backgroundColor: effectiveVars['--admin-table-row-hover'],
                              borderColor: effectiveVars['--admin-border'],
                              color: effectiveVars['--admin-text-main'],
                            }}
                          >
                            <td className="p-2.5 font-semibold">Pérez, María Elena</td>
                            <td className="p-2.5">Estudiante Invitado</td>
                            <td className="p-2.5 text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                Acreditado
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* BOTONERA DE ACCIONES COMPLEMENTARIAS */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderColor: effectiveVars['--admin-border'] }}>
                      {/* BOTÓN SECUNDARIO */}
                      <button
                        type="button"
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Botón Secundario (Cancelar / Volver)',
                            'Botones neutros utilizados para cancelar modales, retroceder o restablecer filtros.',
                            [
                              { key: '--admin-btn-secondary-bg', label: 'Fondo Botón Secundario', desc: 'Color neutro de fondo' },
                              { key: '--admin-btn-secondary-text', label: 'Texto Botón Secundario', desc: 'Color de la tipografía' },
                              { key: '--admin-btn-secondary-border', label: 'Borde Botón Secundario', desc: 'Línea de contorno' },
                            ]
                          )
                        }
                        className={`px-2.5 py-1 text-xs font-semibold border transition shadow-2xs cursor-pointer ${
                          selectedTarget?.elementName.includes('Secundario') ? 'ring-2 ring-gray-400' : 'hover:opacity-90'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--admin-btn-secondary-bg'],
                          color: effectiveVars['--admin-btn-secondary-text'],
                          borderColor: effectiveVars['--admin-btn-secondary-border'],
                          borderRadius: effectiveVars['--admin-btn-radius'] || '8px',
                        }}
                      >
                        ↩ Cancelar / Volver
                      </button>

                      {/* BOTÓN ÉXITO */}
                      <button
                        type="button"
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Botón de Éxito (Aprobar / Confirmar)',
                            'Acciones positivas como aprobar evaluaciones, emitir certificados o confirmar cupos.',
                            [
                              { key: '--admin-success-bg', label: 'Fondo Botón Éxito', desc: 'Verde institucional o tono positivo' },
                              { key: '--admin-success-text', label: 'Texto Botón Éxito', desc: 'Tipografía sobre el botón de éxito' },
                            ]
                          )
                        }
                        className={`px-2.5 py-1 text-xs font-semibold transition shadow-2xs cursor-pointer ${
                          selectedTarget?.elementName.includes('Éxito') ? 'ring-2 ring-emerald-400' : 'hover:opacity-90'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--admin-success-bg'],
                          color: effectiveVars['--admin-success-text'],
                          borderRadius: effectiveVars['--admin-btn-radius'] || '8px',
                        }}
                      >
                        ✓ Aprobar / Emitir
                      </button>

                      {/* BOTÓN PELIGRO */}
                      <button
                        type="button"
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Botón Crítico / Peligro (Eliminar / Sancionar)',
                            'Acciones destructivas o irreversibles como dar de baja registros o bloquear usuarios.',
                            [
                              { key: '--admin-danger-bg', label: 'Fondo Botón Peligro', desc: 'Rojo de advertencia o tono crítico' },
                              { key: '--admin-danger-text', label: 'Texto Botón Peligro', desc: 'Tipografía sobre botón de peligro' },
                            ]
                          )
                        }
                        className={`px-2.5 py-1 text-xs font-semibold transition shadow-2xs cursor-pointer ${
                          selectedTarget?.elementName.includes('Peligro') ? 'ring-2 ring-red-400' : 'hover:opacity-90'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--admin-danger-bg'],
                          color: effectiveVars['--admin-danger-text'],
                          borderRadius: effectiveVars['--admin-btn-radius'] || '8px',
                        }}
                      >
                        ✕ Eliminar / Sancionar
                      </button>

                      {/* BADGE DE ESTADO */}
                      <span
                        onClick={(e) =>
                          selectTarget(
                            e,
                            'Insignias y Badges de Estado',
                            'Etiquetas compactas para roles, estados de acreditación y verificaciones.',
                            [
                              { key: '--admin-badge-bg', label: 'Fondo del Badge', desc: 'Color de la píldora informativa' },
                              { key: '--admin-badge-text', label: 'Texto del Badge', desc: 'Tipografía sobre la insignia' },
                            ]
                          )
                        }
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition cursor-pointer ${
                          selectedTarget?.elementName.includes('Insignias') ? 'ring-2 ring-blue-400' : 'hover:opacity-90'
                        }`}
                        style={{
                          backgroundColor: effectiveVars['--admin-badge-bg'],
                          color: effectiveVars['--admin-badge-text'],
                        }}
                      >
                        ★ Badge Estado Oficial
                      </span>
                    </div>

                    {/* VENTANA MODAL / DIÁLOGO EMERGENTE MOCK */}
                    <div
                      onClick={(e) =>
                        selectTarget(
                          e,
                          'Ventana Modal / Cuadro de Diálogo Emergente',
                          'Ventanas flotantes para confirmaciones, edición rápida o carga de datos adicionales.',
                          [
                            { key: '--admin-modal-bg', label: 'Fondo del Modal', desc: 'Superficie de la ventana emergente' },
                            { key: '--admin-modal-text', label: 'Texto del Modal', desc: 'Tipografía interna del diálogo' },
                            { key: '--admin-border', label: 'Borde Perimetral', desc: 'Contorno de la ventana flotante' },
                          ]
                        )
                      }
                      className={`p-3 rounded-xl border shadow-md space-y-2 transition-all cursor-pointer ${
                        selectedTarget?.elementName.includes('Modal')
                          ? 'ring-2 ring-amber-500 border-amber-500'
                          : 'hover:border-amber-400'
                      }`}
                      style={{
                        backgroundColor: effectiveVars['--admin-modal-bg'],
                        borderColor: effectiveVars['--admin-border'],
                        color: effectiveVars['--admin-modal-text'],
                      }}
                      title="Clic para corregir Ventanas Modales"
                    >
                      <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: effectiveVars['--admin-border'] }}>
                        <span className="font-bold text-xs">💬 Vista Previa: Diálogo / Ventana Modal</span>
                        <span className="text-xs opacity-60">✕</span>
                      </div>
                      <p className="text-[11px] opacity-80">
                        Los diálogos emergentes y formularios superpuestos adoptarán este fondo y color de texto.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* LADO DERECHO: PANEL DE INSPECCIÓN Y VALORES A CORREGIR */}
              <div className="xl:col-span-5 space-y-4" ref={controlsRef}>
                {selectedTarget ? (
                  <div className="p-5 rounded-2xl border-2 border-blue-500 bg-blue-50/20 shadow-sm space-y-4">
                    <div className="border-b border-blue-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-extrabold uppercase tracking-wider">
                          Elemento Seleccionado
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-gray-900 mt-1">
                        {selectedTarget.elementName}
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                        {selectedTarget.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                        ⚙️ Valores que debes cambiar para este elemento:
                      </span>

                      <div className="space-y-2.5">
                        {selectedTarget.variables.map((v) => {
                          const isHigh = highlightedKey === v.key;
                          return (
                            <div
                              key={v.key}
                              onClick={() => setHighlightedKey(v.key)}
                              className={`p-3 rounded-xl border transition-all ${
                                isHigh
                                  ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div>
                                  <span className="font-bold text-xs text-gray-900 block">
                                    {v.label}
                                  </span>
                                  <span className="text-[10px] text-gray-500 block">{v.desc}</span>
                                </div>
                                <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {v.key}
                                </span>
                              </div>

                              {/* Validación de Accesibilidad WCAG (Contraste Texto vs Fondo del Backend) */}
                              {(() => {
                                const currentColor = effectiveVars[v.key] || '#000000';
                                let contrastBg = '';
                                const isTextVar = v.key.includes('text');

                                if (isTextVar) {
                                  if (v.key === '--admin-text-header') contrastBg = effectiveVars['--admin-header-bg'];
                                  else if (v.key === '--admin-accent-text') contrastBg = effectiveVars['--admin-accent'];
                                  else if (v.key === '--admin-input-text') contrastBg = effectiveVars['--admin-input-bg'];
                                  else if (v.key === '--admin-btn-secondary-text') contrastBg = effectiveVars['--admin-btn-secondary-bg'];
                                  else if (v.key === '--admin-danger-text') contrastBg = effectiveVars['--admin-danger-bg'];
                                  else if (v.key === '--admin-success-text') contrastBg = effectiveVars['--admin-success-bg'];
                                  else if (v.key === '--admin-badge-text') contrastBg = effectiveVars['--admin-badge-bg'];
                                  else if (v.key === '--admin-modal-text') contrastBg = effectiveVars['--admin-modal-bg'];
                                  else contrastBg = effectiveVars['--admin-card-bg'] || effectiveVars['--admin-bg'];
                                }

                                if (isTextVar && contrastBg && currentColor.startsWith('#') && contrastBg.startsWith('#')) {
                                  const contrast = calculateContrastRatio(currentColor, contrastBg);
                                  if (contrast) {
                                    return (
                                      <div className="mb-2 flex items-center justify-between text-[11px] px-2 py-0.5 rounded border bg-gray-50">
                                        <span className="text-gray-500 font-medium">Contraste WCAG:</span>
                                        <span
                                          className={`font-bold px-1.5 py-0.2 rounded-full text-[10px] ${
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

                              {/* Control diferenciado si es radio de borde vs color */}
                              {v.key.includes('radius') ? (
                                <div className="space-y-2 pt-1 border-t border-gray-100">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {[
                                      { val: '0px', label: '0px (Recto)' },
                                      { val: '4px', label: '4px (Leve)' },
                                      { val: '8px', label: '8px (Normal)' },
                                      { val: '14px', label: '14px (Curvo)' },
                                      { val: '9999px', label: 'Píldora' },
                                    ].map((preset) => (
                                      <button
                                        key={preset.val}
                                        type="button"
                                        onClick={() => handleColorChange(v.key, preset.val)}
                                        className={`px-2 py-1 text-[11px] font-semibold rounded border cursor-pointer transition ${
                                          effectiveVars[v.key] === preset.val
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
                                      value={effectiveVars[v.key] || '8px'}
                                      onChange={(e) => handleColorChange(v.key, e.target.value)}
                                      className="flex-1 p-1.5 text-xs font-mono border border-gray-300 rounded text-center font-bold"
                                      placeholder="ej: 8px, 1rem, 9999px"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleColorChange(v.key, effectiveVars[v.key] || '8px')}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer"
                                    >
                                      En vivo ✓
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                  <input
                                    type="color"
                                    value={effectiveVars[v.key]}
                                    onChange={(e) => handleColorChange(v.key, e.target.value)}
                                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0 bg-transparent shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={effectiveVars[v.key]}
                                    onChange={(e) => handleColorChange(v.key, e.target.value)}
                                    className="flex-1 p-1.5 text-xs font-mono border border-gray-300 rounded text-center uppercase font-bold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleColorChange(v.key, effectiveVars[v.key])}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer"
                                    title="Aplicado en vivo"
                                  >
                                    En vivo ✓
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-gray-300 text-center space-y-2 bg-gray-50">
                    <span className="text-3xl">🎯</span>
                    <h5 className="font-bold text-sm text-gray-800">Ningún elemento seleccionado</h5>
                    <p className="text-xs text-gray-500">
                      Haz clic sobre cualquier caja, tabla, botón, fondo o encabezado de la pantalla interactiva a la izquierda para ver y cambiar sus valores exactos.
                    </p>
                  </div>
                )}

                {/* Resumen Completo de Variables Disponibles */}
                <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center justify-between">
                    <span>📚 Índice Rápido de Variables</span>
                    <span className="text-[10px] font-normal text-gray-400">24 Variables Clave</span>
                  </h5>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {(Object.keys(effectiveVars) as Array<keyof BackendThemeVars>).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSelectedTarget({
                            elementName: k,
                            description: `Variable CSS directa del sistema para tematización de interfaz.`,
                            variables: [{ key: k, label: k, desc: 'Ajuste directo' }],
                          });
                          setHighlightedKey(k);
                        }}
                        className={`text-left p-1.5 rounded text-[11px] font-mono border truncate transition cursor-pointer flex items-center gap-1.5 ${
                          highlightedKey === k
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                          style={{ backgroundColor: effectiveVars[k] }}
                        />
                        <span className="truncate">{k.replace('--admin-', '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: PALETAS PREDEFINIDAS */}
        {activeSubtab === 'selector' && (
          <div className="space-y-6">
            {/* Barra de Acciones / Guardado Global en Paletas */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2">
                <span className="text-base">🌐</span>
                <div>
                  <span className="text-xs font-bold text-emerald-950">Tema actualmente activo: </span>
                  <span className="text-xs font-extrabold text-emerald-800">
                    {BACKEND_THEMES.find((t) => t.id === currentThemeId)?.name || currentThemeId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveAsGlobalDefault}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition hover:shadow"
                title="Fijar este tema como predeterminado para todos los operadores en PostgreSQL"
              >
                <span>💾</span>
                <span>Fijar tema activo como Default Global</span>
              </button>
            </div>

            {/* SECCIÓN ESPECIAL: PALETA INSTITUCIONAL GCABA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <span>🏛️</span>
                  <span>Paleta Oficial CABA (Lineamientos del Frontend)</span>
                </h4>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Estilo GCABA
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {BACKEND_THEMES.filter((t) => t.category === 'caba').map((theme) => {
                  const isSelected = currentThemeId === theme.id;
                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleSelectPredefined(theme)}
                      className={`p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between gap-5 ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/20 shadow-md ring-2 ring-amber-400/30'
                          : 'border-gray-200 hover:border-amber-300 hover:shadow-xs bg-white'
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-gray-900">{theme.name}</span>
                          {isSelected && (
                            <span className="px-2.5 py-0.5 bg-amber-500 text-gray-900 text-[10px] font-black uppercase tracking-wider rounded-full">
                              ✓ Activo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{theme.desc}</p>
                        
                        {/* Muestrario de Tonos CABA */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                          <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1D3343' }}></span>
                            Azul Oscuro #1D3343
                          </span>
                          <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#035C80' }}></span>
                            Azul Claro #035C80
                          </span>
                          <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFCD02' }}></span>
                            Amarillo GCABA #FFCD02
                          </span>
                          <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: '#FCFCFC' }}></span>
                            Blanco #FCFCFC
                          </span>
                        </div>
                      </div>

                      {/* Preview Miniatura CABA */}
                      <div
                        className="w-full md:w-64 p-3.5 rounded-xl border text-xs space-y-2 shrink-0 shadow-2xs admin-preview-box"
                        style={{
                          backgroundColor: theme.previewBg,
                          borderColor: theme.cssVars['--admin-border'],
                          color: theme.previewTextColor,
                        }}
                      >
                        <div
                          className="p-2 rounded-lg flex items-center justify-between font-bold text-[11px]"
                          style={{
                            backgroundColor: theme.cssVars['--admin-header-bg'],
                            color: theme.cssVars['--admin-text-header'],
                          }}
                        >
                          <span>Header CABA</span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-extrabold"
                            style={{
                              backgroundColor: theme.previewAccent,
                              color: '#1D3343',
                            }}
                          >
                            Ingresar
                          </span>
                        </div>
                        <div
                          className="p-2.5 rounded shadow-2xs border text-[11px] font-semibold"
                          style={{
                            backgroundColor: theme.previewCardBg,
                            borderColor: theme.cssVars['--admin-border'],
                            color: theme.previewTextColor,
                          }}
                        >
                          Módulo con estilos alineados al Frontend oficial
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN A: BÁSICOS */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <span>🌓</span>
                <span>Modos Fundamentales</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BACKEND_THEMES.filter((t) => t.category === 'basico').map((theme) => {
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
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900">{theme.name}</span>
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-full">
                                Activo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{theme.desc}</p>
                        </div>
                        <span className="text-xl shrink-0">{theme.id === 'oscuro' ? '🌙' : '☀️'}</span>
                      </div>

                      {/* Preview Mini */}
                      <div
                        className="p-3.5 rounded-lg border text-xs space-y-2 admin-preview-box"
                        style={{
                          backgroundColor: theme.previewBg,
                          borderColor: theme.cssVars['--admin-border'],
                          color: theme.previewTextColor,
                        }}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span>Ventana Previa</span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: theme.previewAccent,
                              color: theme.cssVars['--admin-accent-text'],
                            }}
                          >
                            Acción
                          </span>
                        </div>
                        <div
                          className="p-2.5 rounded shadow-2xs border text-[11px] font-semibold"
                          style={{
                            backgroundColor: theme.previewCardBg,
                            borderColor: theme.cssVars['--admin-border'],
                            color: theme.previewTextColor,
                          }}
                        >
                          Texto institucional legible
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN B: PASTEL HIGH-CONTRAST */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <span>🧁</span>
                  <span>Paletas Pasteles Claras con Alto Contraste Tipográfico</span>
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fondos suaves con colores pasteles claros y tipografía densa en alto contraste WCAG AAA para largas jornadas de gestión.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {BACKEND_THEMES.filter((t) => t.category === 'pastel').map((theme) => {
                  const isSelected = currentThemeId === theme.id;
                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleSelectPredefined(theme)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/30 shadow-md ring-2 ring-blue-400/20'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-xs bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-gray-900">{theme.name}</span>
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-extrabold uppercase rounded-full">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{theme.desc}</p>
                      </div>

                      {/* Muestra Pastel */}
                      <div
                        className="p-3 rounded-lg border text-xs space-y-2 admin-preview-box"
                        style={{
                          backgroundColor: theme.previewBg,
                          borderColor: theme.cssVars['--admin-border'],
                          color: theme.previewTextColor,
                        }}
                      >
                        <div className="flex items-center justify-between font-bold text-[10px]">
                          <span>Fondo Pastel</span>
                          <span
                            className="w-3.5 h-3.5 rounded-full shadow-2xs shrink-0"
                            style={{ backgroundColor: theme.previewAccent }}
                          />
                        </div>
                        <div
                          className="p-2 rounded bg-white border text-[11px] font-bold"
                          style={{
                            borderColor: theme.cssVars['--admin-border'],
                            color: theme.previewTextColor,
                          }}
                        >
                          Tipografía Contrastante
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
