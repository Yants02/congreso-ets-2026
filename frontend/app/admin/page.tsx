'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

// Tipos
import { OperadorSession, CatalogosConsolidados } from '@/components/admin/types';

// Vistas de Entidades (CRUDs)
import AdminUsuariosView from '@/components/admin/AdminUsuariosView';
import AdminActividadesView from '@/components/admin/AdminActividadesView';
import AdminPuntosAccesoView from '@/components/admin/AdminPuntosAccesoView';
import AdminOperadoresView from '@/components/admin/AdminOperadoresView';
import AdminCatalogoMateriasView from '@/components/admin/AdminCatalogoMateriasView';
import AdminBlacklistView from '@/components/admin/AdminBlacklistView';
import AdminAcreditacionesView from '@/components/admin/AdminAcreditacionesView';
import AdminCertificadosView from '@/components/admin/AdminCertificadosView';
import AdminHomologacionesView from '@/components/admin/AdminHomologacionesView';
import AdminEventosView from '@/components/admin/AdminEventosView';
import AdminConfiguracionView from '@/components/admin/AdminConfiguracionView';
import AdminAuditoriaView from '@/components/admin/AdminAuditoriaView';
import AdminCronView from '@/components/admin/AdminCronView';
import AdminEncuestasView from '@/components/admin/AdminEncuestasView';
import AdminPresentadoresView from '@/components/admin/AdminPresentadoresView';
import AdminEstadisticasDesglosadasView from '@/components/admin/AdminEstadisticasDesglosadasView';
import AdminManualesView from '@/components/admin/AdminManualesView';
import AdminIdentificacionEditorView from '@/components/admin/AdminIdentificacionEditorView';
import AdminFrontendCmsView from '@/components/admin/AdminFrontendCmsView';
import {
  BACKEND_THEMES,
  THEME_STORAGE_KEY,
  CUSTOM_THEME_STORAGE_KEY,
  BackendThemeVars,
} from '@/components/admin/adminThemes';
import { useOfflineAcreditacion } from '@/hooks/useOfflineAcreditacion';
import { OfflineSyncManagerModal } from '@/components/OfflineSyncManagerModal';

type TabKey =
  | 'dashboard'
  | 'usuarios'
  | 'actividades'
  | 'puntos'
  | 'operadores'
  | 'catalogo'
  | 'blacklist'
  | 'acreditaciones'
  | 'certificados'
  | 'encuestas'
  | 'homologaciones'
  | 'eventos'
  | 'configuracion'
  | 'auditoria'
  | 'cron'
  | 'presentadores'
  | 'estadisticas_5ejes'
  | 'manuales'
  | 'identificacion_editor'
  | 'frontend_cms';

interface ResumenDashboard {
  cupo_maximo: number;
  confirmados: number;
  cupos_disponibles: number;
  lista_espera: number;
  sancionados: number;
  bajas_automaticas: number;
  cancelados: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [operador, setOperador] = useState<OperadorSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Historial interno de pestañas para retornos seguros dentro del panel
  const [tabHistory, setTabHistory] = useState<TabKey[]>(['dashboard']);

  // Catálogos globales consolidados
  const [catalogos, setCatalogos] = useState<CatalogosConsolidados | null>(null);

  // Datos de Métricas del Dashboard 360
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [rolesDist, setRolesDist] = useState<any[]>([]);
  const [puntosAcceso, setPuntosAcceso] = useState<any[]>([]);
  const [ultimosIngresos, setUltimosIngresos] = useState<any[]>([]);

  // Notificación flotante de feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Menú desplegable táctil ultra-compacto para móviles
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);

  useEffect(() => {
    if (actionNotice) {
      const isError =
        actionNotice.toLowerCase().includes('error') ||
        actionNotice.toLowerCase().includes('falló') ||
        actionNotice.toLowerCase().includes('rechazó');
      const timerDuration = isError ? 6000 : 3000;
      const timeout = setTimeout(() => {
        setActionNotice(null);
      }, timerDuration);
      return () => clearTimeout(timeout);
    }
  }, [actionNotice]);

  // Tema visual exclusivo del Backend (predefinidos o personalizados)
  const [backendThemeId, setBackendThemeId] = useState<string>('claro');
  const [customThemeVars, setCustomThemeVars] = useState<BackendThemeVars | null>(null);

  // Monitoreo de contingencia y sincronización Offline (IndexedDB -> PostgreSQL)
  const { isOnline, pendingCount, syncAcreditaciones } = useOfflineAcreditacion();
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);

  useEffect(() => {
    async function applySavedTheme() {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      const syncKey = 'congreso_backend_theme_synced_at';
      const lastSyncedAt = localStorage.getItem(syncKey);

      if (saved) {
        setBackendThemeId(saved);
        if (saved === 'personalizado') {
          const savedCustom = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
          if (savedCustom) {
            try {
              setCustomThemeVars(JSON.parse(savedCustom));
            } catch {
              // Ignorar JSON inválido
            }
          }
        }
      }

      // Consultar el tema default global fijado en PostgreSQL por el Superadmin
      try {
        const res = await fetch('/api/admin/configuracion/tema-default');
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.defaultTheme) {
            const server = data.defaultTheme;
            const serverDate = server.actualizado_en || '';

            if (!saved) {
              setBackendThemeId(server.themeId);
              if (server.themeId === 'personalizado' && server.customVars) {
                setCustomThemeVars(server.customVars);
              }
              localStorage.setItem(THEME_STORAGE_KEY, server.themeId);
              if (serverDate) localStorage.setItem(syncKey, serverDate);
              if (server.customVars) {
                localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(server.customVars));
              }
              return;
            }

            // Si hay tema local pero en el servidor se fijó una nueva versión global
            if (serverDate && serverDate !== lastSyncedAt) {
              const isDifferent = saved !== server.themeId || saved === 'personalizado';
              if (isDifferent) {
                setActionNotice(`📢 Hay un nuevo tema oficial fijado ("${server.themeName || server.themeId}"). Puedes aplicarlo desde Parámetros del Sistema.`);
                localStorage.setItem(syncKey, serverDate);
              }
            }
            return;
          }
        }
      } catch {
        // Fallback a tema inicial
      }
      if (!saved) setBackendThemeId('caba-institucional');
    }
    applySavedTheme();

    function onThemeChange(e: any) {
      if (e.detail && e.detail.themeId) {
        setBackendThemeId(e.detail.themeId);
        if (e.detail.customVars) {
          setCustomThemeVars(e.detail.customVars);
        } else if (e.detail.themeId !== 'personalizado') {
          setCustomThemeVars(null);
        }
      }
    }
    window.addEventListener('backend-theme-changed', onThemeChange);
    return () => window.removeEventListener('backend-theme-changed', onThemeChange);
  }, []);

  // Cerrar menú con tecla Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsMenuOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sincronizar pestaña activa con URL y gestionar historial del navegador (popstate)
  useEffect(() => {
    // 1. Verificar parámetro ?tab= en la URL al cargar
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab') as TabKey;
    if (tabFromUrl && tabFromUrl !== 'dashboard') {
      setActiveTab(tabFromUrl);
      setTabHistory(['dashboard', tabFromUrl]);
      window.history.replaceState({ tab: tabFromUrl }, '', window.location.href);
    } else {
      window.history.replaceState({ tab: 'dashboard' }, '', '/admin');
    }

    // 2. Manejar eventos Atrás / Adelante del navegador para no abandonar al usuario
    function handlePopState(e: PopStateEvent) {
      if (e.state && e.state.tab) {
        setActiveTab(e.state.tab as TabKey);
        setTabHistory((prev) => {
          if (prev.length > 1 && prev[prev.length - 1] !== e.state.tab) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const currentParam = urlParams.get('tab') as TabKey;
        if (currentParam) {
          setActiveTab(currentParam);
        } else {
          // Si retrocedió a la raíz de /admin, mantener en el Tablero 360° sin salir del panel
          setActiveTab('dashboard');
          window.history.replaceState({ tab: 'dashboard' }, '', '/admin');
        }
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigateToTab(tab: TabKey, replace = false) {
    if (tab === activeTab) return;

    // Verificar si el usuario tiene permiso para acceder a esta pestaña
    const targetMeta = navGroups.flatMap((g) => g.tabs).find((t) => t.key === tab);
    if (targetMeta && !isTabAllowed(targetMeta.key, targetMeta.minJerarquia)) {
      setActionNotice(`⛔ Acceso restringido: Tu rol no posee permisos habilitados para el módulo "${targetMeta.label}".`);
      return;
    }

    setActiveTab(tab);
    setTabHistory((prev) => [...prev, tab]);
    const url = tab === 'dashboard' ? '/admin' : `/admin?tab=${tab}`;
    if (replace) {
      window.history.replaceState({ tab }, '', url);
    } else {
      window.history.pushState({ tab }, '', url);
    }
  }

  async function handleGoBack() {
    if (tabHistory.length > 1) {
      const newHistory = [...tabHistory];
      newHistory.pop(); // remover pestaña actual
      const previousTab = newHistory[newHistory.length - 1] || 'dashboard';
      setTabHistory(newHistory);
      setActiveTab(previousTab);
      const url = previousTab === 'dashboard' ? '/admin' : `/admin?tab=${previousTab}`;
      window.history.pushState({ tab: previousTab }, '', url);
    } else if (activeTab !== 'dashboard') {
      navigateToTab('dashboard');
    } else {
      const result = await Swal.fire({
        title: '¿Deseas salir del Panel?',
        text: 'Volverás al portal público del Congreso. Tu sesión continuará activa.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, volver al portal',
        cancelButtonText: 'Permanecer aquí',
        confirmButtonColor: '#005691',
        cancelButtonColor: '#6c757d',
      });
      if (result.isConfirmed) {
        router.push('/');
      }
    }
  }

  async function loadDashboardData() {
    try {
      const token = localStorage.getItem('congreso_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
      const res = await fetch('/api/admin/dashboard/gerencial', { headers });
      if (res.ok) {
        const data = await res.json();
        setResumen(data.resumen);
        setRolesDist(data.distribucion_roles || []);
        setPuntosAcceso(data.puntos_acceso || []);
        setUltimosIngresos(data.ultimos_ingresos || []);
      }
    } catch (err) {
      console.error('Error cargando métricas:', err);
    }
  }

  // Validar sesión y cargar catálogos
  useEffect(() => {
    async function init() {
      try {
        const token = localStorage.getItem('congreso_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
        const resAuth = await fetch('/api/admin/auth/me', { headers });
        if (!resAuth.ok) {
          window.location.href = '/login';
          return;
        }
        const dataAuth = await resAuth.json();
        setOperador(dataAuth.operador);

        // Cargar Catálogos Consolidados
        const resCat = await fetch('/api/admin/catalogos', { headers });
        if (resCat.ok) {
          const dataCat = await resCat.json();
          setCatalogos(dataCat);
        }

        // Cargar Dashboard Inicial
        loadDashboardData();
      } catch {
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    localStorage.removeItem('congreso_token');
    localStorage.removeItem('congreso_user');
    window.location.href = '/login';
  }

  // Grupos de Navegación del Menú Hamburguesa con Restricción por Categoría/Jerarquía
  const navGroups = [
    {
      label: 'OPERACIONES & ASISTENCIA',
      icon: '⚙️',
      tabs: [
        { key: 'dashboard', label: 'Tablero 360°', shortLabel: 'Tablero', icon: '📊', desc: 'Métricas de aforo y resumen ejecutivo', minJerarquia: 3 },
        { key: 'estadisticas_5ejes', label: 'Estadísticas (5 Ejes)', shortLabel: 'Estadísticas', icon: '📈', desc: 'Métricas analíticas independientes por ítem', minJerarquia: 3 },
        { key: 'usuarios', label: `Participantes (${resumen?.confirmados || 0})`, shortLabel: 'Participantes', icon: '👥', desc: 'CRUD inscriptos, roles y lista de espera', minJerarquia: 3 },
        { key: 'acreditaciones', label: 'Control de Accesos en Vivo', shortLabel: 'Accesos', icon: '🎟️', desc: 'Scans, auditoría de molinetes y anulaciones', minJerarquia: 3 },
      ],
    },
    {
      label: 'GESTIÓN ACADÉMICA',
      icon: '📚',
      tabs: [
        { key: 'actividades', label: 'Actividades & Cronograma', shortLabel: 'Actividades', icon: '📅', desc: 'Charlas, talleres, recintos y horarios', minJerarquia: 4 },
        { key: 'presentadores', label: 'Presentadores & Ponentes', shortLabel: 'Ponentes', icon: '🎤', desc: 'Gestión independiente de disertantes y ponencias', minJerarquia: 4 },
        { key: 'catalogo', label: 'Materias Canónicas', shortLabel: 'Materias', icon: '📋', desc: 'Áreas temáticas y créditos institucionales', minJerarquia: 4 },
        { key: 'homologaciones', label: 'Homologación de Ponentes', shortLabel: 'Homologación', icon: '🎖️', desc: 'Validación y dictamen de expositores', minJerarquia: 4 },
        { key: 'certificados', label: 'Certificados Oficiales', shortLabel: 'Certificados', icon: '🎓', desc: 'Buscador, validación y emisión de diplomas', minJerarquia: 4 },
        { key: 'encuestas', label: 'Encuestas de Calidad', shortLabel: 'Encuestas', icon: '📋', desc: 'Métricas de satisfacción docente y feedback', minJerarquia: 4 },
        { key: 'manuales', label: 'Manuales del Sistema', shortLabel: 'MANUALES', icon: '📖', desc: 'Manuales oficiales y exportación a PDF', minJerarquia: 3 },
      ],
    },
    {
      label: 'INFRAESTRUCTURA Y SEDE',
      icon: '🏢',
      tabs: [
        { key: 'puntos', label: 'Recintos & Salas', shortLabel: 'Recintos', icon: '🏢', desc: 'Espacios físicos, aforos y molinetes', minJerarquia: 4 },
        { key: 'eventos', label: 'Ediciones & Eventos', shortLabel: 'Eventos', icon: '🏛️', desc: 'Aforos anuales y calendario oficial', minJerarquia: 4 },
      ],
    },
    {
      label: 'SEGURIDAD & ADMINISTRACIÓN',
      icon: '🛡️',
      tabs: [
        { key: 'operadores', label: 'Operadores del Sistema', shortLabel: 'Operadores', icon: '🛡️', desc: 'Cuentas de control y niveles de jerarquía', minJerarquia: 5 },
        { key: 'blacklist', label: 'Lista Negra de Exclusiones', shortLabel: 'Lista Negra', icon: '🚫', desc: 'Restricciones disciplinarias de DNI', minJerarquia: 5 },
        { key: 'auditoria', label: 'Bitácora Forense de Auditoría', shortLabel: 'Auditoría', icon: '📜', desc: 'Trazabilidad inmutable de todas las acciones', minJerarquia: 5 },
        { key: 'configuracion', label: 'Parámetros del Sistema', shortLabel: 'Configuración', icon: '⚙️', desc: 'Reglas de negocio y variables operativas', minJerarquia: 5 },
        { key: 'frontend_cms', label: 'CMS Frontend (Tarjetas)', shortLabel: 'CMS Frontend', icon: '🎴', desc: 'Editor de tarjetas y contenidos del portal web', minJerarquia: 3 },
        { key: 'identificacion_editor', label: 'Editor de Identificaciones', shortLabel: 'Identificaciones', icon: '🎨', desc: 'Diseñador WYSIWYG de plantillas móviles', minJerarquia: 3 },
        { key: 'cron', label: 'Procesos Asíncronos (Cron)', shortLabel: 'Cron', icon: '⏱️', desc: 'Bajas automáticas y reasignación FIFO 48hs', minJerarquia: 5 },
      ],
    },
  ];

  const userJerarquia = operador?.jerarquia || 0;
  const userPermisos = operador?.permisos || [];

  // Función para determinar si una pestaña está permitida para el operador actual
  function isTabAllowed(tabKey: string, minJerarquia: number) {
    if (userJerarquia < minJerarquia) return false;
    // Superadmin (nivel 5) tiene acceso irrestricto
    if (userJerarquia >= 5) return true;
    // Si la jerarquía es suficiente, verificar si tiene el permiso explícito habilitado
    return userPermisos.includes(tabKey);
  }

  // Identificar etiqueta de la pestaña activa
  const activeTabMeta = navGroups
    .flatMap((g) => g.tabs)
    .find((t) => t.key === activeTab) || {
    key: 'dashboard',
    label: 'Tablero 360°',
    shortLabel: 'Tablero',
    icon: '📊',
    desc: 'Métricas de aforo y resumen ejecutivo',
    minJerarquia: 3,
  };

  // Identificar etiqueta de la pestaña anterior para el botón de retorno
  const previousTabKey = tabHistory.length > 1 ? tabHistory[tabHistory.length - 2] : 'dashboard';
  const previousTabMeta = navGroups
    .flatMap((g) => g.tabs)
    .find((t) => t.key === previousTabKey) || {
    key: 'dashboard',
    label: 'Tablero 360°',
    shortLabel: 'Tablero',
    icon: '📊',
    desc: 'Métricas de aforo y resumen ejecutivo',
    minJerarquia: 3,
  };

  // Pestañas visibles según jerarquía y permisos asignados divididas en dos filas equilibradas
  const visibleTabs = navGroups
    .flatMap((g) => g.tabs)
    .filter((tab) => isTabAllowed(tab.key, tab.minJerarquia));

  const shouldSplitRows = visibleTabs.length > 6;
  const splitIndex = shouldSplitRows ? Math.ceil(visibleTabs.length / 2) : visibleTabs.length;
  const row1Tabs = visibleTabs.slice(0, splitIndex);
  const row2Tabs = shouldSplitRows ? visibleTabs.slice(splitIndex) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-700 font-semibold text-sm">Iniciando Centro de Control Administrativo...</p>
        </div>
      </div>
    );
  }

  const baseTheme = BACKEND_THEMES.find((t) => t.id === backendThemeId) || BACKEND_THEMES[0];
  const effectiveThemeVars: BackendThemeVars =
    backendThemeId === 'personalizado' && customThemeVars ? customThemeVars : baseTheme.cssVars;

  return (
    <div
      className="admin-root min-h-screen flex flex-col font-sans transition-colors duration-200"
      style={{
        backgroundColor: effectiveThemeVars['--admin-bg'],
        color: effectiveThemeVars['--admin-text-main'],
        ...(effectiveThemeVars as any),
      }}
    >
      {/* HEADER SUPERIOR */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="w-[95%] max-w-[95%] mx-auto flex justify-between items-center h-14 py-1.5">
          {/* LADO IZQUIERDO: BRANDING + RETORNO + BREADCRUMB */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigateToTab('dashboard')}
              className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
              title="Ir al Tablero Principal del Administrador"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 group-hover:ring-emerald-200 transition"></span>
              <div className="hidden sm:block">
                <span className="font-extrabold text-gray-900 text-sm leading-tight tracking-tight block">
                  Congreso ETS 2026
                </span>
                <span className="text-[10px] font-medium text-gray-500 block">
                  Panel Institucional · GCABA
                </span>
              </div>
            </button>

            <span className="text-gray-300 text-base hidden md:inline">|</span>

            {/* BOTÓN DE RETORNO INTELIGENTE A LA PÁGINA ANTERIOR */}
            {activeTab !== 'dashboard' && (
              <button
                onClick={handleGoBack}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-md text-[11px] font-bold transition shadow-2xs cursor-pointer group"
                title={`Volver a ${previousTabMeta.label}`}
              >
                <span className="group-hover:-translate-x-0.5 transition-transform font-extrabold text-xs">←</span>
                <span>Volver</span>
                <span className="text-blue-500 font-normal hidden xl:inline">a {previousTabMeta.shortLabel || previousTabMeta.label}</span>
              </button>
            )}

            {/* Píldora de sección activa */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full text-slate-800 text-[11px] font-semibold">
              <span>{activeTabMeta.icon}</span>
              <span className="truncate max-w-[140px] sm:max-w-none">{activeTabMeta.label}</span>
            </div>
          </div>

          {/* LADO DERECHO: ACCIONES + BOTÓN HAMBURGUESA EN ESQUINA SUPERIOR DERECHA */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Información del Operador (oculto en pantallas muy pequeñas) */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-gray-800">
                {operador?.nombre} {operador?.apellido}
              </span>
              <span className="text-[11px] text-blue-700 font-medium">
                {operador?.rol_nombre || operador?.rol || 'Administrador'} · Nivel {operador?.jerarquia}
              </span>
            </div>

            {/* INDICADOR Y MONITOR DE CONTINGENCIA OFFLINE */}
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md border transition cursor-pointer ${
                pendingCount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : isOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
              }`}
              title="Monitoreo de Sincronización Offline (IndexedDB ➔ PostgreSQL)"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  pendingCount > 0
                    ? 'bg-amber-500 animate-pulse'
                    : isOnline
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
                }`}
              ></span>
              <span className="hidden sm:inline">
                {pendingCount > 0
                  ? `Sinc: ${pendingCount} pend.`
                  : isOnline
                  ? 'Sync OK'
                  : 'Offline'}
              </span>
            </button>

            {/* Enlace seguro a Ver Portal (en nueva pestaña para preservar la sesión administrativa) */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition cursor-pointer"
              title="Abrir el portal público en una nueva pestaña sin cerrar el panel administrativo"
            >
              🌐 Portal ↗
            </a>

            {/* BOTÓN HAMBURGUESA DE OPERACIONES */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Abrir menú de operaciones"
              aria-expanded={isMenuOpen}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isMenuOpen
                  ? 'bg-blue-700 text-white ring-2 ring-blue-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <div className="w-4 h-3 flex flex-col justify-between items-center">
                <span
                  className={`h-0.5 w-4 bg-white rounded-full transition-transform duration-200 ${
                    isMenuOpen ? 'rotate-45 translate-y-1' : ''
                  }`}
                ></span>
                <span
                  className={`h-0.5 w-4 bg-white rounded-full transition-opacity duration-200 ${
                    isMenuOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                ></span>
                <span
                  className={`h-0.5 w-4 bg-white rounded-full transition-transform duration-200 ${
                    isMenuOpen ? '-rotate-45 -translate-y-1' : ''
                  }`}
                ></span>
              </div>
              <span className="hidden sm:inline text-xs">Menú Completo</span>
            </button>
          </div>
        </div>
      </header>

      {/* BARRA DE ACCESO DIRECTO A CRUDS (SELECTOR EN MÓVILES, 2 FILAS EN ESCRITORIO) */}
      <nav className="bg-white border-b border-gray-200 sticky top-14 z-30 shadow-xs py-1 px-2 sm:py-1 sm:px-2">
        <div className="w-[99%] max-w-[99%] mx-auto flex flex-col gap-1">
          {/* VISTA MÓVIL (< sm): BOTÓN DESPLEGABLE DE 28PX CON MENÚ DE OPCIONES DE 21PX */}
          <div className="flex sm:hidden items-center gap-1.5 w-full relative">
            {activeTab !== 'dashboard' && (
              <button
                onClick={handleGoBack}
                className="whitespace-nowrap flex items-center justify-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition shrink-0 cursor-pointer shadow-2xs h-7"
                title={`Volver a ${previousTabMeta.label}`}
              >
                <span>←</span>
                <span>Volver</span>
              </button>
            )}
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                id="admin-module-selector-mobile-trigger"
                onClick={() => setIsMobileSelectorOpen(!isMobileSelectorOpen)}
                className="w-full h-7 flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold rounded-lg pl-2.5 pr-2 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span>{activeTabMeta.icon}</span>
                  <span>{activeTabMeta.label}</span>
                </span>
                <span className="text-slate-400 text-xs ml-1 flex-shrink-0">
                  {isMobileSelectorOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* LISTA DESPLEGADA DE OPCIONES: CADA FILA DE 21PX DE ALTURA */}
              {isMobileSelectorOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/20"
                    onClick={() => setIsMobileSelectorOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[75vh] overflow-y-auto divide-y divide-gray-100 p-1">
                    {navGroups.map((group) => {
                      const availableInGroup = group.tabs.filter((t) => isTabAllowed(t.key, t.minJerarquia));
                      if (availableInGroup.length === 0) return null;
                      return (
                        <div key={group.label} className="py-1">
                          <div className="px-2 py-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                            {group.label}
                          </div>
                          {availableInGroup.map((tab) => {
                            const isCurrent = activeTab === tab.key;
                            return (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                  navigateToTab(tab.key as TabKey);
                                  setIsMobileSelectorOpen(false);
                                }}
                                className={`w-full h-[25px] flex items-center gap-2 px-2.5 rounded-md text-[11px] font-medium transition cursor-pointer text-left truncate ${
                                  isCurrent
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'text-gray-700 hover:bg-slate-100'
                                }`}
                              >
                                <span className="text-xs leading-none shrink-0">{tab.icon}</span>
                                <span className="truncate leading-none">{tab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* VISTA ESCRITORIO (>= sm): 2 FILAS DE BOTONES EQUILIBRADAS */}
          <div className="hidden sm:flex flex-col gap-1 w-full">
            {/* Fila 1 de CRUDs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none w-full">
              {activeTab !== 'dashboard' && (
                <button
                  onClick={handleGoBack}
                  className="whitespace-nowrap flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition flex-shrink-0 cursor-pointer shadow-2xs mr-0.5"
                  title={`Volver a ${previousTabMeta.label}`}
                >
                  <span>←</span>
                  <span>Volver</span>
                </button>
              )}
              <div className="flex items-center gap-1 flex-1 w-full justify-between min-w-0">
                {row1Tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => navigateToTab(tab.key as TabKey)}
                      title={tab.label}
                      className={`whitespace-nowrap flex items-center justify-center gap-1 flex-1 min-w-0 px-2 py-0.5 rounded text-[11px] 2xl:text-xs transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-bold border border-blue-700'
                          : 'bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-800 border border-gray-200'
                      }`}
                    >
                      <span className="text-[11px] flex-shrink-0">{tab.icon}</span>
                      <span className="truncate font-medium">{tab.shortLabel || tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fila 2 de CRUDs */}
            {row2Tabs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none w-full">
                <div className="flex items-center gap-1 flex-1 w-full justify-between min-w-0">
                  {row2Tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => navigateToTab(tab.key as TabKey)}
                        title={tab.label}
                        className={`whitespace-nowrap flex items-center justify-center gap-1 flex-1 min-w-0 px-2 py-0.5 rounded text-[11px] 2xl:text-xs transition cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs font-bold border border-blue-700'
                            : 'bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-800 border border-gray-200'
                        }`}
                      >
                        <span className="text-[11px] flex-shrink-0">{tab.icon}</span>
                        <span className="truncate font-medium">{tab.shortLabel || tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* DRAWER / MENÚ HAMBURGUESA LATERAL (COMPACTO Y ÁGIL) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop con desenfoque suave */}
          <div
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          ></div>

          {/* Panel Lateral Desplegable Compacto */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-sm bg-white shadow-2xl flex flex-col border-l border-gray-200 transform transition-transform ease-out duration-300">
              {/* Header del Menú Compacto */}
              <div className="p-3.5 border-b border-gray-100 bg-gradient-to-r from-blue-700 to-blue-800 text-white flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">🎛️</span>
                    <h2 className="text-sm font-bold">Módulos & Operaciones</h2>
                  </div>
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    {operador?.nombre} {operador?.apellido} ({operador?.rol_nombre || 'Nivel ' + operador?.jerarquia})
                  </p>
                </div>

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 rounded-md bg-blue-800/60 hover:bg-blue-900 text-white font-bold transition text-xs cursor-pointer"
                  aria-label="Cerrar menú"
                >
                  ✕
                </button>
              </div>

              {/* Lista de Grupos e Ítems Compactos */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 divide-y divide-gray-100">
                {navGroups.map((group, idx) => {
                  const visibleTabs = group.tabs.filter((tab) => isTabAllowed(tab.key, tab.minJerarquia));
                  if (visibleTabs.length === 0) return null;
                  return (
                    <div key={idx} className={idx > 0 ? 'pt-2.5' : ''}>
                      <div className="flex items-center gap-1 px-1.5 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>{group.icon}</span>
                        <span>{group.label}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-0.5">
                        {visibleTabs.map((tab) => {
                          const isActive = activeTab === tab.key;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => {
                                navigateToTab(tab.key as TabKey);
                                setIsMenuOpen(false);
                              }}
                              className={`w-full text-left py-1 px-2 rounded-md transition flex items-center gap-2 cursor-pointer ${
                                isActive
                                  ? 'bg-blue-50 border border-blue-200 text-blue-900 shadow-xs'
                                  : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <span className="text-sm flex-shrink-0">{tab.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs truncate ${isActive ? 'text-blue-700 font-bold' : 'text-gray-900 font-medium'}`}>
                                    {tab.label}
                                  </span>
                                  {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 ml-1"></span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 truncate leading-tight mt-0.5">{tab.desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer del Menú Compacto */}
              <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex-1 text-center py-1.5 px-2.5 border border-gray-300 rounded-md text-[11px] font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                  title="Abrir el portal público en una nueva pestaña sin cerrar tu sesión administrativa"
                >
                  🌐 Ver Portal ↗
                </a>
                <button
                  onClick={handleLogout}
                  className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                  title="Cerrar sesión de operador"
                >
                  <span>🚪</span>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER DE NOTIFICACIÓN TEMPORAL (95% ANCHO) */}
      {actionNotice && (
        <div className="w-[95%] max-w-[95%] mx-auto mt-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm flex justify-between items-center shadow-xs">
            <span className="font-semibold">✅ {actionNotice}</span>
            <button
              onClick={() => setActionNotice(null)}
              className="font-bold text-emerald-700 hover:text-emerald-900 text-xs ml-4"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL ADAPTIVE & RESPONSIVE (95% ANCHO) */}
      <main className="w-[95%] max-w-[95%] mx-auto py-6 flex-1">
        {/* BARRA SUPERIOR DE RETORNO Y BREADCRUMB DEL MÓDULO */}
        {activeTab !== 'dashboard' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleGoBack}
                className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition cursor-pointer group"
                title={`Regresar a ${previousTabMeta.label}`}
              >
                <span className="group-hover:-translate-x-0.5 transition-transform font-bold">←</span>
                <span>Volver</span>
                <span className="text-gray-400 font-normal">|</span>
                <span className="text-gray-600 font-medium">{previousTabMeta.label}</span>
              </button>
              <span className="text-gray-300 hidden sm:inline">/</span>
              <span className="font-bold text-gray-800 hidden sm:flex items-center gap-1">
                <span>{activeTabMeta.icon}</span>
                <span>{activeTabMeta.label}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateToTab('dashboard')}
                className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                title="Ir directamente al Tablero 360°"
              >
                <span>📊</span>
                <span>Ir al Tablero 360°</span>
              </button>
              <span className="text-gray-200 hidden md:inline">|</span>
              <span className="text-[11px] text-gray-400 hidden md:inline">
                Navegación protegida: volver no cierra tu sesión
              </span>
            </div>
          </div>
        )}

        {operador && !isTabAllowed(activeTabMeta.key, activeTabMeta.minJerarquia || 3) ? (
          <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-xs text-center max-w-xl mx-auto my-12">
            <div className="text-5xl mb-4">⛔</div>
            <h2 className="text-xl font-bold text-gray-900">Acceso Restringido al Módulo</h2>
            <p className="text-sm text-gray-600 mt-2">
              {userJerarquia < (activeTabMeta.minJerarquia || 3) ? (
                <>
                  El módulo <strong>{activeTabMeta.label}</strong> requiere una jerarquía{' '}
                  <span className="font-bold text-red-600">Nivel {activeTabMeta.minJerarquia}</span>.
                </>
              ) : (
                <>
                  Tu categoría cuenta con la jerarquía requerida, pero tu usuario no tiene asignado el permiso para el módulo{' '}
                  <strong className="text-red-700">{activeTabMeta.label}</strong>.
                </>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Tu categoría actual es: <strong className="text-gray-700">{operador.rol}</strong> (Nivel {userJerarquia}).
            </p>
            <button
              onClick={() => navigateToTab('dashboard')}
              className="mt-6 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition cursor-pointer"
            >
              Volver al Tablero Principal
            </button>
          </div>
        ) : (
          <>
        {/* 1. DASHBOARD 360 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
              <div className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Cupo Máximo</span>
                <p className="text-xl sm:text-3xl font-extrabold text-gray-900 mt-1 sm:mt-2">{resumen?.cupo_maximo || 400}</p>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate mt-0.5">Aforo nominal</span>
              </div>

              <div className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-green-500 flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-green-600 uppercase tracking-wider truncate">Confirmados</span>
                <p className="text-xl sm:text-3xl font-extrabold text-green-700 mt-1 sm:mt-2">{resumen?.confirmados || 0}</p>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate mt-0.5">Vacantes asignadas</span>
              </div>

              <div className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-blue-500 flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider truncate">Disponibles</span>
                <p className="text-xl sm:text-3xl font-extrabold text-blue-700 mt-1 sm:mt-2">{resumen?.cupos_disponibles || 0}</p>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate mt-0.5">Lugares libres</span>
              </div>

              <div className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-amber-500 flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider truncate">Lista de Espera</span>
                <p className="text-xl sm:text-3xl font-extrabold text-amber-700 mt-1 sm:mt-2">{resumen?.lista_espera || 0}</p>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate mt-0.5">Aspirantes (FIFO)</span>
              </div>

              <div className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-rose-500 flex flex-col justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-rose-600 uppercase tracking-wider truncate">Sancionados</span>
                <p className="text-xl sm:text-3xl font-extrabold text-rose-700 mt-1 sm:mt-2">{resumen?.sancionados || 0}</p>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate mt-0.5">Lista Negra</span>
              </div>
            </div>

            {/* PANEL PRINCIPAL: ACCESO DIRECTO A CRUDS DE TODAS LAS ENTIDADES */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                    <span>🎛️</span>
                    <span>Gestión Operativa de Entidades del Sistema (CRUDs)</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Acceso directo para altas, bajas, modificaciones, filtros y búsquedas de todas las entidades del congreso
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg self-start sm:self-auto">
                  13 Módulos de Gestión Activos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {[
                  { key: 'usuarios', icon: '👥', title: 'Participantes', desc: 'Inscriptos, roles, estados y promociones', tag: `${resumen?.confirmados || 0} activos`, color: 'hover:border-blue-300' },
                  { key: 'actividades', icon: '📅', title: 'Actividades & Salas', desc: 'Charlas, talleres, oradores y cupos', tag: 'Cronograma', color: 'hover:border-indigo-300' },
                  { key: 'acreditaciones', icon: '🎟️', title: 'Control de Accesos', desc: 'Auditoría en vivo de molinetes y scans', tag: 'Molinetes', color: 'hover:border-emerald-300' },
                  { key: 'certificados', icon: '🎓', title: 'Certificados Oficiales', desc: 'Emisión, validador QR y descarga ZIP', tag: 'Diplomas', color: 'hover:border-amber-300' },
                  { key: 'encuestas', icon: '📋', title: 'Encuestas & Calidad', desc: 'Gestión de encuestas, preguntas y métricas', tag: 'Evaluación', color: 'hover:border-purple-300' },
                  { key: 'puntos', icon: '🚪', title: 'Puntos de Acceso', desc: 'Puertas de ingreso, egreso y capacidades', tag: 'Sede Saavedra', color: 'hover:border-teal-300' },
                  { key: 'operadores', icon: '🛡️', title: 'Operadores del Sistema', desc: 'Cuentas de acreditación y jerarquías', tag: 'Seguridad', color: 'hover:border-cyan-300' },
                  { key: 'catalogo', icon: '📋', title: 'Materias Canónicas', desc: 'Áreas temáticas, códigos y créditos', tag: 'DETS Oficial', color: 'hover:border-sky-300' },
                  { key: 'homologaciones', icon: '🎤', title: 'Homologación Ponentes', desc: 'Validación académica y dictámenes', tag: 'Tribunal', color: 'hover:border-rose-300' },
                  { key: 'eventos', icon: '🏛️', title: 'Ediciones & Eventos', desc: 'Configuración anual de aforos y sedes', tag: 'ETS 2026', color: 'hover:border-violet-300' },
                  { key: 'blacklist', icon: '🚫', title: 'Lista Negra (Exclusiones)', desc: 'Restricciones disciplinarias por DNI', tag: 'Admisión', color: 'hover:border-red-300' },
                  { key: 'configuracion', icon: '⚙️', title: 'Parámetros del Sistema', desc: 'Reglas de negocio, cupos y roles', tag: 'Variables', color: 'hover:border-slate-400' },
                  { key: 'identificacion_editor', icon: '🎨', title: 'Editor de Identificaciones', desc: 'Diseñador WYSIWYG Drag&Drop', tag: 'UI/UX', color: 'hover:border-pink-300' },
                  { key: 'auditoria', icon: '📜', title: 'Bitácora Forense', desc: 'Trazabilidad inmutable de todas las acciones', tag: 'Logs Audit', color: 'hover:border-yellow-300' },
                  { key: 'cron', icon: '⏱️', title: 'Planificador Asíncrono', desc: 'Daemon de bajas 48hs y ascensos FIFO', tag: 'Segundo Plano', color: 'hover:border-blue-400' },
                ].map((item) => (
                  <div
                    key={item.key}
                    onClick={() => navigateToTab(item.key as TabKey)}
                    className={`p-3.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition cursor-pointer flex flex-col justify-between group shadow-2xs ${item.color}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-2xl group-hover:scale-110 transition-transform">{item.icon}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600">
                          {item.tag}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900 mt-2 group-hover:text-blue-700 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:text-blue-800">
                      <span>Abrir Gestión / CRUD</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="font-bold text-gray-900 mb-4">Composición por Roles Institucionales</h3>
                <div className="space-y-3">
                  {rolesDist.map((r, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm font-medium text-gray-700">{r.nombre}</span>
                      <span className="px-2.5 py-1 text-xs font-bold bg-gray-100 text-gray-800 rounded-full">
                        {r.cantidad} inscriptos
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="font-bold text-gray-900 mb-4">Puntos de Acceso Físicos</h3>
                <div className="space-y-3">
                  {puntosAcceso.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{p.nombre}</div>
                        <div className="text-xs text-gray-400">{p.ubicacion_fisica}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          Cap: {p.capacidad_maxima}
                        </span>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {p.ingresos || 0} ingresos / {p.egresos || 0} egresos
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Últimos Movimientos Acreditados en Puerta</h3>
                <button
                  onClick={() => navigateToTab('acreditaciones')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Ver Registro Completo →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5">Hora</th>
                      <th className="px-4 py-2.5">Movimiento</th>
                      <th className="px-4 py-2.5">Asistente</th>
                      <th className="px-4 py-2.5">DNI</th>
                      <th className="px-4 py-2.5">Rol</th>
                      <th className="px-4 py-2.5">Puerta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ultimosIngresos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                          Aún no se registran movimientos en puerta.
                        </td>
                      </tr>
                    ) : (
                      ultimosIngresos.map((mov, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs">
                            {new Date(mov.timestamp_acreditacion).toLocaleTimeString('es-AR')}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded ${
                                mov.tipo_movimiento === 'INGRESO'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {mov.tipo_movimiento}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-medium">{mov.nombre} {mov.apellido}</td>
                          <td className="px-4 py-2 text-gray-500 font-mono text-xs">{mov.dni_pasaporte}</td>
                          <td className="px-4 py-2 text-xs">{mov.rol}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{mov.punto_acceso}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. CRUD USUARIOS */}
        {activeTab === 'usuarios' && (
          <AdminUsuariosView catalogos={catalogos} onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 3. CRUD ACTIVIDADES */}
        {activeTab === 'actividades' && (
          <AdminActividadesView catalogos={catalogos} onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 4. CRUD PUNTOS DE ACCESO */}
        {activeTab === 'puntos' && (
          <AdminPuntosAccesoView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 5. CRUD OPERADORES */}
        {activeTab === 'operadores' && (
          <AdminOperadoresView catalogos={catalogos} onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 6. CRUD CATÁLOGO DE MATERIAS */}
        {activeTab === 'catalogo' && (
          <AdminCatalogoMateriasView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 7. CRUD BLACKLIST */}
        {activeTab === 'blacklist' && (
          <AdminBlacklistView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 8. AUDITORÍA DE ACREDITACIONES EN VIVO */}
        {activeTab === 'acreditaciones' && (
          <AdminAcreditacionesView catalogos={catalogos} onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 9. CERTIFICADOS EMITIDOS */}
        {activeTab === 'certificados' && (
          <AdminCertificadosView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 9.B ENCUESTAS DE CALIDAD Y SATISFACCIÓN */}
        {activeTab === 'encuestas' && <AdminEncuestasView />}

        {/* 10. HOMOLOGACIONES DE PONENTES */}
        {activeTab === 'homologaciones' && (
          <AdminHomologacionesView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 11. EDICIONES Y EVENTOS */}
        {activeTab === 'eventos' && (
          <AdminEventosView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 12. CONFIGURACIÓN DEL SISTEMA */}
        {activeTab === 'configuracion' && (
          <AdminConfiguracionView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 13. AUDITORÍA FORENSE INMUTABLE */}
        {activeTab === 'auditoria' && <AdminAuditoriaView />}

        {/* 14. CRON JOBS */}
        {activeTab === 'cron' && (
          <AdminCronView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 15. ESTADÍSTICAS ANALÍTICAS DESGLOSADAS (5 EJES) */}
        {activeTab === 'estadisticas_5ejes' && <AdminEstadisticasDesglosadasView />}

        {/* 16. GESTIÓN INDEPENDIENTE DE PRESENTADORES */}
        {activeTab === 'presentadores' && (
          <AdminPresentadoresView catalogos={catalogos} onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 17. MANUALES OFICIALES DEL SISTEMA Y DESCARGA PDF */}
        {activeTab === 'manuales' && <AdminManualesView />}

        {/* 18. EDITOR WYSIWYG IDENTIFICACIONES */}
        {activeTab === 'identificacion_editor' && (
          <AdminIdentificacionEditorView onNotice={(msg) => setActionNotice(msg)} />
        )}

        {/* 19. CMS FRONTEND (TARJETAS Y MODALIDADES) */}
        {activeTab === 'frontend_cms' && (
          <AdminFrontendCmsView onNotice={(msg) => setActionNotice(msg)} />
        )}
          </>
        )}
      </main>

      {/* MODAL DE GESTIÓN Y MONITOREO DE CONTINGENCIA OFFLINE (IndexedDB ➔ PostgreSQL) */}
      <OfflineSyncManagerModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </div>
  );
}
