export interface BackendThemeVars {
  // Fondos y Superficies
  '--admin-bg': string;
  '--admin-card-bg': string;
  '--admin-header-bg': string;
  '--admin-nav-bg': string;
  '--admin-drawer-bg': string;
  '--admin-card-hover': string;

  // Tipografía
  '--admin-text-main': string;
  '--admin-text-muted': string;
  '--admin-text-header': string;

  // Bordes
  '--admin-border': string;
  '--admin-border-subtle': string;

  // Tablas
  '--admin-table-header-bg': string;
  '--admin-table-row-hover': string;

  // Formularios e Inputs
  '--admin-input-bg': string;
  '--admin-input-border': string;
  '--admin-input-text': string;

  // Acentos y Botón Principal
  '--admin-accent': string;
  '--admin-accent-hover': string;
  '--admin-accent-text': string;

  // Botón Secundario / Cancelar
  '--admin-btn-secondary-bg': string;
  '--admin-btn-secondary-text': string;
  '--admin-btn-secondary-border': string;

  // Radio de Bordes (Border Radius) para Botones
  '--admin-btn-radius': string;

  // Acciones Críticas / Peligro (Eliminar, Sancionar, Rechazar)
  '--admin-danger-bg': string;
  '--admin-danger-text': string;

  // Acciones Positivas / Éxito (Aprobar, Certificar, Confirmar)
  '--admin-success-bg': string;
  '--admin-success-text': string;

  // Badges e Insignias de Estado
  '--admin-badge-bg': string;
  '--admin-badge-text': string;

  // Ventanas Emergentes y Modales
  '--admin-modal-bg': string;
  '--admin-modal-text': string;
}

export interface BackendTheme {
  id: string;
  name: string;
  category: 'caba' | 'basico' | 'pastel' | 'personalizado';
  desc: string;
  previewBg: string;
  previewTextColor: string;
  previewCardBg: string;
  previewAccent: string;
  cssVars: BackendThemeVars;
}

export const THEME_STORAGE_KEY = 'congreso_backend_theme';
export const CUSTOM_THEME_STORAGE_KEY = 'congreso_backend_custom_theme';

export const BACKEND_THEMES: BackendTheme[] = [
  {
    id: 'caba-institucional',
    name: 'CABA Institucional (Frontend Oficial)',
    category: 'caba',
    desc: 'Paleta oficial del Gobierno de la Ciudad: Blanco (#FCFCFC), Azul Oscuro (#1D3343), Azul Claro (#035C80) y Amarillo GCABA (#FFCD02)',
    previewBg: '#f8fafc',
    previewTextColor: '#1D3343',
    previewCardBg: '#FCFCFC',
    previewAccent: '#FFCD02',
    cssVars: {
      '--admin-bg': '#f3f4f6',
      '--admin-card-bg': '#FCFCFC',
      '--admin-header-bg': '#1D3343',
      '--admin-nav-bg': '#ffffff',
      '--admin-drawer-bg': '#1D3343',
      '--admin-card-hover': '#f8fafc',

      '--admin-text-main': '#1D3343',
      '--admin-text-muted': '#035C80',
      '--admin-text-header': '#FCFCFC',

      '--admin-border': '#cbd5e1',
      '--admin-border-subtle': '#e2e8f0',

      '--admin-table-header-bg': '#1D3343',
      '--admin-table-row-hover': '#f1f5f9',

      '--admin-input-bg': '#FCFCFC',
      '--admin-input-border': '#94a3b8',
      '--admin-input-text': '#1D3343',

      '--admin-accent': '#FFCD02',
      '--admin-accent-hover': '#e6b800',
      '--admin-accent-text': '#1D3343',

      '--admin-btn-secondary-bg': '#e2e8f0',
      '--admin-btn-secondary-text': '#1D3343',
      '--admin-btn-secondary-border': '#cbd5e1',
      '--admin-btn-radius': '8px',

      '--admin-danger-bg': '#dc2626',
      '--admin-danger-text': '#ffffff',

      '--admin-success-bg': '#16a34a',
      '--admin-success-text': '#ffffff',

      '--admin-badge-bg': '#035C80',
      '--admin-badge-text': '#ffffff',

      '--admin-modal-bg': '#FCFCFC',
      '--admin-modal-text': '#1D3343',
    },
  },
  {
    id: 'claro',
    name: 'Claro Institucional',
    category: 'basico',
    desc: 'Esquema blanco luminoso con escala de grises pulcra y acento institucional',
    previewBg: '#f8fafc',
    previewTextColor: '#0f172a',
    previewCardBg: '#ffffff',
    previewAccent: '#005691',
    cssVars: {
      '--admin-bg': '#f8fafc',
      '--admin-card-bg': '#ffffff',
      '--admin-header-bg': '#ffffff',
      '--admin-nav-bg': '#ffffff',
      '--admin-drawer-bg': '#ffffff',
      '--admin-card-hover': '#f1f5f9',

      '--admin-text-main': '#0f172a',
      '--admin-text-muted': '#64748b',
      '--admin-text-header': '#0f172a',

      '--admin-border': '#e2e8f0',
      '--admin-border-subtle': '#f1f5f9',

      '--admin-table-header-bg': '#f8fafc',
      '--admin-table-row-hover': '#f8fafc',

      '--admin-input-bg': '#ffffff',
      '--admin-input-border': '#cbd5e1',
      '--admin-input-text': '#0f172a',

      '--admin-accent': '#005691',
      '--admin-accent-hover': '#00416d',
      '--admin-accent-text': '#ffffff',

      '--admin-btn-secondary-bg': '#f1f5f9',
      '--admin-btn-secondary-text': '#334155',
      '--admin-btn-secondary-border': '#cbd5e1',
      '--admin-btn-radius': '8px',

      '--admin-danger-bg': '#ef4444',
      '--admin-danger-text': '#ffffff',

      '--admin-success-bg': '#10b981',
      '--admin-success-text': '#ffffff',

      '--admin-badge-bg': '#e0f2fe',
      '--admin-badge-text': '#0369a1',

      '--admin-modal-bg': '#ffffff',
      '--admin-modal-text': '#0f172a',
    },
  },
  {
    id: 'oscuro',
    name: 'Oscuro Profundo',
    category: 'basico',
    desc: 'Modo nocturno carbón pizarra con tipografía clara de alto contraste',
    previewBg: '#0f172a',
    previewTextColor: '#f8fafc',
    previewCardBg: '#1e293b',
    previewAccent: '#38bdf8',
    cssVars: {
      '--admin-bg': '#0b1120',
      '--admin-card-bg': '#1e293b',
      '--admin-header-bg': '#0f172a',
      '--admin-nav-bg': '#1e293b',
      '--admin-drawer-bg': '#0f172a',
      '--admin-card-hover': '#334155',

      '--admin-text-main': '#f8fafc',
      '--admin-text-muted': '#94a3b8',
      '--admin-text-header': '#f8fafc',

      '--admin-border': '#334155',
      '--admin-border-subtle': '#1e293b',

      '--admin-table-header-bg': '#0f172a',
      '--admin-table-row-hover': '#334155',

      '--admin-input-bg': '#0f172a',
      '--admin-input-border': '#475569',
      '--admin-input-text': '#f8fafc',

      '--admin-accent': '#38bdf8',
      '--admin-accent-hover': '#0284c7',
      '--admin-accent-text': '#0f172a',

      '--admin-btn-secondary-bg': '#334155',
      '--admin-btn-secondary-text': '#f8fafc',
      '--admin-btn-secondary-border': '#475569',
      '--admin-btn-radius': '8px',

      '--admin-danger-bg': '#f87171',
      '--admin-danger-text': '#450a0a',

      '--admin-success-bg': '#34d399',
      '--admin-success-text': '#022c22',

      '--admin-badge-bg': '#1e3a8a',
      '--admin-badge-text': '#93c5fd',

      '--admin-modal-bg': '#1e293b',
      '--admin-modal-text': '#f8fafc',
    },
  },
  {
    id: 'menta-pastel',
    name: 'Menta & Salvia Pastel',
    category: 'pastel',
    desc: 'Fondo menta suave con tipografía verde bosque oscuro de alto contraste',
    previewBg: '#e8f5e9',
    previewTextColor: '#14532d',
    previewCardBg: '#ffffff',
    previewAccent: '#059669',
    cssVars: {
      '--admin-bg': '#e8f5e9',
      '--admin-card-bg': '#ffffff',
      '--admin-header-bg': '#f0fdf4',
      '--admin-nav-bg': '#ffffff',
      '--admin-drawer-bg': '#f0fdf4',
      '--admin-card-hover': '#f0fdf4',

      '--admin-text-main': '#14532d',
      '--admin-text-muted': '#166534',
      '--admin-text-header': '#14532d',

      '--admin-border': '#bbf7d0',
      '--admin-border-subtle': '#dcfce7',

      '--admin-table-header-bg': '#f0fdf4',
      '--admin-table-row-hover': '#f0fdf4',

      '--admin-input-bg': '#ffffff',
      '--admin-input-border': '#86efac',
      '--admin-input-text': '#14532d',

      '--admin-accent': '#059669',
      '--admin-accent-hover': '#047857',
      '--admin-accent-text': '#ffffff',

      '--admin-btn-secondary-bg': '#dcfce7',
      '--admin-btn-secondary-text': '#166534',
      '--admin-btn-secondary-border': '#bbf7d0',
      '--admin-btn-radius': '10px',

      '--admin-danger-bg': '#dc2626',
      '--admin-danger-text': '#ffffff',

      '--admin-success-bg': '#059669',
      '--admin-success-text': '#ffffff',

      '--admin-badge-bg': '#bbf7d0',
      '--admin-badge-text': '#14532d',

      '--admin-modal-bg': '#ffffff',
      '--admin-modal-text': '#14532d',
    },
  },
  {
    id: 'cielo-pastel',
    name: 'Cielo & Zafiro Pastel',
    category: 'pastel',
    desc: 'Fondo celeste pastel aireado con tipografía azul marino intenso',
    previewBg: '#e0f2fe',
    previewTextColor: '#0c4a6e',
    previewCardBg: '#ffffff',
    previewAccent: '#0284c7',
    cssVars: {
      '--admin-bg': '#e0f2fe',
      '--admin-card-bg': '#ffffff',
      '--admin-header-bg': '#f0f9ff',
      '--admin-nav-bg': '#ffffff',
      '--admin-drawer-bg': '#f0f9ff',
      '--admin-card-hover': '#f0f9ff',

      '--admin-text-main': '#0c4a6e',
      '--admin-text-muted': '#0369a1',
      '--admin-text-header': '#0c4a6e',

      '--admin-border': '#bae6fd',
      '--admin-border-subtle': '#e0f2fe',

      '--admin-table-header-bg': '#f0f9ff',
      '--admin-table-row-hover': '#f0f9ff',

      '--admin-input-bg': '#ffffff',
      '--admin-input-border': '#7dd3fc',
      '--admin-input-text': '#0c4a6e',

      '--admin-accent': '#0284c7',
      '--admin-accent-hover': '#0369a1',
      '--admin-accent-text': '#ffffff',

      '--admin-btn-secondary-bg': '#e0f2fe',
      '--admin-btn-secondary-text': '#0369a1',
      '--admin-btn-secondary-border': '#bae6fd',
      '--admin-btn-radius': '10px',

      '--admin-danger-bg': '#e11d48',
      '--admin-danger-text': '#ffffff',

      '--admin-success-bg': '#0284c7',
      '--admin-success-text': '#ffffff',

      '--admin-badge-bg': '#bae6fd',
      '--admin-badge-text': '#0369a1',

      '--admin-modal-bg': '#ffffff',
      '--admin-modal-text': '#0c4a6e',
    },
  },
  {
    id: 'lavanda-pastel',
    name: 'Lavanda & Ciruela Pastel',
    category: 'pastel',
    desc: 'Fondo lila pastel relajante con tipografía ciruela púrpura profundo',
    previewBg: '#f3e8ff',
    previewTextColor: '#3b0764',
    previewCardBg: '#ffffff',
    previewAccent: '#9333ea',
    cssVars: {
      '--admin-bg': '#f3e8ff',
      '--admin-card-bg': '#ffffff',
      '--admin-header-bg': '#faf5ff',
      '--admin-nav-bg': '#ffffff',
      '--admin-drawer-bg': '#faf5ff',
      '--admin-card-hover': '#faf5ff',

      '--admin-text-main': '#3b0764',
      '--admin-text-muted': '#6b21a8',
      '--admin-text-header': '#3b0764',

      '--admin-border': '#e9d5ff',
      '--admin-border-subtle': '#f3e8ff',

      '--admin-table-header-bg': '#faf5ff',
      '--admin-table-row-hover': '#faf5ff',

      '--admin-input-bg': '#ffffff',
      '--admin-input-border': '#d8b4fe',
      '--admin-input-text': '#3b0764',

      '--admin-accent': '#9333ea',
      '--admin-accent-hover': '#7e22ce',
      '--admin-accent-text': '#ffffff',

      '--admin-btn-secondary-bg': '#f3e8ff',
      '--admin-btn-secondary-text': '#6b21a8',
      '--admin-btn-secondary-border': '#e9d5ff',
      '--admin-btn-radius': '12px',

      '--admin-danger-bg': '#be123c',
      '--admin-danger-text': '#ffffff',

      '--admin-success-bg': '#9333ea',
      '--admin-success-text': '#ffffff',

      '--admin-badge-bg': '#e9d5ff',
      '--admin-badge-text': '#581c87',

      '--admin-modal-bg': '#ffffff',
      '--admin-modal-text': '#3b0764',
    },
  },
  {
    id: 'durazno-pastel',
    name: 'Durazno & Café Pastel',
    category: 'pastel',
    desc: 'Fondo durazno cálido con tipografía tierra y chocolate oscuro de óptima lectura',
    previewBg: '#ffedd5',
    previewTextColor: '#431407',
    previewCardBg: '#ffffff',
    previewAccent: '#ea580c',
    cssVars: {
      '--admin-bg': '#ffedd5',
      '--admin-card-bg': '#ffffff',
      '--admin-header-bg': '#fff7ed',
      '--admin-nav-bg': '#ffffff',
      '--admin-drawer-bg': '#fff7ed',
      '--admin-card-hover': '#fff7ed',

      '--admin-text-main': '#431407',
      '--admin-text-muted': '#9a3412',
      '--admin-text-header': '#431407',

      '--admin-border': '#fed7aa',
      '--admin-border-subtle': '#ffedd5',

      '--admin-table-header-bg': '#fff7ed',
      '--admin-table-row-hover': '#fff7ed',

      '--admin-input-bg': '#ffffff',
      '--admin-input-border': '#fdba74',
      '--admin-input-text': '#431407',

      '--admin-accent': '#ea580c',
      '--admin-accent-hover': '#c2410c',
      '--admin-accent-text': '#ffffff',

      '--admin-btn-secondary-bg': '#ffedd5',
      '--admin-btn-secondary-text': '#9a3412',
      '--admin-btn-secondary-border': '#fed7aa',
      '--admin-btn-radius': '8px',

      '--admin-danger-bg': '#c2410c',
      '--admin-danger-text': '#ffffff',

      '--admin-success-bg': '#ea580c',
      '--admin-success-text': '#ffffff',

      '--admin-badge-bg': '#fed7aa',
      '--admin-badge-text': '#7c2d12',

      '--admin-modal-bg': '#ffffff',
      '--admin-modal-text': '#431407',
    },
  },
];
