export interface FrontendThemeVars {
  // 1. Colores Base Institucionales CABA & Globales
  '--color-azul-oscuro': string; // Header, Hero bg, Footer bg, títulos primarios
  '--color-azul-claro': string;  // Subtítulos destacados, badges, enlaces
  '--color-amarillo': string;    // Botón principal CTA (Inscribirse), acentos
  '--color-blanco': string;      // Fondo de tarjetas, superficies y texto sobre oscuro
  '--background': string;        // Fondo global de la página
  '--foreground': string;        // Color de texto general

  // 2. Barra de Navegación Superior (Header)
  '--frontend-header-bg': string;
  '--frontend-header-text': string;
  '--frontend-header-border': string;
  '--frontend-header-link-hover': string;

  // 3. Sección Hero de Bienvenida
  '--frontend-hero-bg': string;
  '--frontend-hero-text': string;
  '--frontend-hero-subtitle': string;
  '--frontend-hero-badge': string;

  // 4. Botón de Llamada a la Acción (CTA "Inscribirse" / "Ingresar")
  '--frontend-btn-cta-bg': string;
  '--frontend-btn-cta-text': string;
  '--frontend-btn-cta-hover': string;
  '--frontend-btn-radius': string;

  // 5. Banner de Notificaciones Push
  '--frontend-banner-push-bg': string;
  '--frontend-banner-push-text': string;
  '--frontend-banner-push-border': string;

  // 6. Sección "Sobre el Congreso"
  '--frontend-sobre-bg': string;
  '--frontend-sobre-title': string;
  '--frontend-sobre-text': string;

  // 7. Tarjetas de Actividades y Módulos Formativos (Aula Abierta, Stands, etc.)
  '--frontend-card-bg': string;
  '--frontend-card-border': string;
  '--frontend-card-title': string;
  '--frontend-card-text': string;
  '--frontend-card-link': string;

  // 8. Cronograma y Grilla de Actividades (Programa)
  '--frontend-programa-bg': string;
  '--frontend-filter-active-bg': string;
  '--frontend-filter-active-text': string;
  '--frontend-filter-inactive-bg': string;
  '--frontend-filter-inactive-text': string;
  '--frontend-activity-card-bg': string;
  '--frontend-activity-card-border': string;

  // 9. Formularios e Inputs (Inscripción y Búsqueda)
  '--frontend-form-bg': string;
  '--frontend-form-border': string;
  '--frontend-input-bg': string;
  '--frontend-input-border': string;
  '--frontend-input-text': string;

  // 10. Credencial Digital y QR Criptográfico
  '--frontend-credencial-card-bg': string;
  '--frontend-credencial-border': string;
  '--frontend-credencial-header-bg': string;
  '--frontend-credencial-header-text': string;
  '--frontend-credencial-badge-bg': string;
  '--frontend-credencial-badge-text': string;
  '--frontend-credencial-btn-diploma-bg': string;
  '--frontend-credencial-btn-diploma-text': string;

  // 11. Centro de Recursos y Materiales
  '--frontend-materiales-card-bg': string;
  '--frontend-materiales-card-border': string;
  '--frontend-materiales-tag-bg': string;
  '--frontend-materiales-tag-text': string;

  // 12. Preguntas Frecuentes y Acordeón FAQ
  '--frontend-faq-card-bg': string;
  '--frontend-faq-card-border': string;
  '--frontend-faq-question-text': string;
  '--frontend-faq-answer-text': string;

  // 13. Pie de Página (Footer Institucional)
  '--frontend-footer-bg': string;
  '--frontend-footer-text': string;
  '--frontend-footer-border': string;
}

export interface FrontendTheme {
  id: string;
  name: string;
  category: 'caba' | 'moderno' | 'oscuro' | 'pastel' | 'personalizado';
  desc: string;
  previewBg: string;
  previewTextColor: string;
  previewCardBg: string;
  previewAccent: string;
  cssVars: FrontendThemeVars;
}

export const FRONTEND_THEME_STORAGE_KEY = 'congreso_frontend_theme';
export const FRONTEND_CUSTOM_THEME_STORAGE_KEY = 'congreso_frontend_custom_theme';

export const FRONTEND_THEMES: FrontendTheme[] = [
  {
    id: 'caba-oficial',
    name: 'CABA Oficial GCABA (Predeterminado)',
    category: 'caba',
    desc: 'Paleta oficial del Gobierno de la Ciudad: Blanco (#FCFCFC), Azul Oscuro (#1D3343), Azul Claro (#035C80) y Amarillo GCABA (#FFCD02)',
    previewBg: '#FCFCFC',
    previewTextColor: '#1D3343',
    previewCardBg: '#FFFFFF',
    previewAccent: '#FFCD02',
    cssVars: {
      '--color-azul-oscuro': '#1D3343',
      '--color-azul-claro': '#035C80',
      '--color-amarillo': '#FFCD02',
      '--color-blanco': '#FCFCFC',
      '--background': '#FCFCFC',
      '--foreground': '#1D3343',

      '--frontend-header-bg': '#FFFFFF',
      '--frontend-header-text': '#1D3343',
      '--frontend-header-border': '#E2E8F0',
      '--frontend-header-link-hover': '#FFCD02',

      '--frontend-hero-bg': '#1D3343',
      '--frontend-hero-text': '#FFFFFF',
      '--frontend-hero-subtitle': '#E2E8F0',
      '--frontend-hero-badge': '#035C80',

      '--frontend-btn-cta-bg': '#FFCD02',
      '--frontend-btn-cta-text': '#1D3343',
      '--frontend-btn-cta-hover': '#e6b800',
      '--frontend-btn-radius': '6px',

      '--frontend-banner-push-bg': '#1e3a8a',
      '--frontend-banner-push-text': '#FFFFFF',
      '--frontend-banner-push-border': '#3b82f6',

      '--frontend-sobre-bg': '#FCFCFC',
      '--frontend-sobre-title': '#1D3343',
      '--frontend-sobre-text': '#334155',

      '--frontend-card-bg': '#FFFFFF',
      '--frontend-card-border': '#E2E8F0',
      '--frontend-card-title': '#1D3343',
      '--frontend-card-text': '#4B5563',
      '--frontend-card-link': '#035C80',

      '--frontend-programa-bg': '#FFFFFF',
      '--frontend-filter-active-bg': '#1D3343',
      '--frontend-filter-active-text': '#FFFFFF',
      '--frontend-filter-inactive-bg': '#FFFFFF',
      '--frontend-filter-inactive-text': '#1D3343',
      '--frontend-activity-card-bg': '#FFFFFF',
      '--frontend-activity-card-border': '#CBD5E1',

      '--frontend-form-bg': '#FFFFFF',
      '--frontend-form-border': '#E2E8F0',
      '--frontend-input-bg': '#FFFFFF',
      '--frontend-input-border': '#CBD5E1',
      '--frontend-input-text': '#1D3343',

      '--frontend-credencial-card-bg': '#FFFFFF',
      '--frontend-credencial-border': '#CBD5E1',
      '--frontend-credencial-header-bg': '#1D3343',
      '--frontend-credencial-header-text': '#FFFFFF',
      '--frontend-credencial-badge-bg': '#035C80',
      '--frontend-credencial-badge-text': '#FFFFFF',
      '--frontend-credencial-btn-diploma-bg': '#10B981',
      '--frontend-credencial-btn-diploma-text': '#FFFFFF',

      '--frontend-materiales-card-bg': '#FFFFFF',
      '--frontend-materiales-card-border': '#CBD5E1',
      '--frontend-materiales-tag-bg': '#1D3343',
      '--frontend-materiales-tag-text': '#FFFFFF',

      '--frontend-faq-card-bg': '#FFFFFF',
      '--frontend-faq-card-border': '#E2E8F0',
      '--frontend-faq-question-text': '#035C80',
      '--frontend-faq-answer-text': '#4B5563',

      '--frontend-footer-bg': '#1D3343',
      '--frontend-footer-text': '#FCFCFC',
      '--frontend-footer-border': '#334155',
    },
  },
  {
    id: 'azul-tecnologico',
    name: 'Azul Tecnológico & Cobalto',
    category: 'moderno',
    desc: 'Esquema moderno con azul cobalto vibrante, toques cian y tarjetas de alto contraste',
    previewBg: '#F8FAFC',
    previewTextColor: '#0F172A',
    previewCardBg: '#FFFFFF',
    previewAccent: '#0284C7',
    cssVars: {
      '--color-azul-oscuro': '#0C4A6E',
      '--color-azul-claro': '#0284C7',
      '--color-amarillo': '#38BDF8',
      '--color-blanco': '#FFFFFF',
      '--background': '#F8FAFC',
      '--foreground': '#0F172A',

      '--frontend-header-bg': '#FFFFFF',
      '--frontend-header-text': '#0C4A6E',
      '--frontend-header-border': '#BAE6FD',
      '--frontend-header-link-hover': '#0284C7',

      '--frontend-hero-bg': '#0C4A6E',
      '--frontend-hero-text': '#FFFFFF',
      '--frontend-hero-subtitle': '#E0F2FE',
      '--frontend-hero-badge': '#0284C7',

      '--frontend-btn-cta-bg': '#0284C7',
      '--frontend-btn-cta-text': '#FFFFFF',
      '--frontend-btn-cta-hover': '#0369A1',
      '--frontend-btn-radius': '8px',

      '--frontend-banner-push-bg': '#0369a1',
      '--frontend-banner-push-text': '#FFFFFF',
      '--frontend-banner-push-border': '#38bdf8',

      '--frontend-sobre-bg': '#F8FAFC',
      '--frontend-sobre-title': '#0C4A6E',
      '--frontend-sobre-text': '#334155',

      '--frontend-card-bg': '#FFFFFF',
      '--frontend-card-border': '#BAE6FD',
      '--frontend-card-title': '#0C4A6E',
      '--frontend-card-text': '#334155',
      '--frontend-card-link': '#0284C7',

      '--frontend-programa-bg': '#FFFFFF',
      '--frontend-filter-active-bg': '#0C4A6E',
      '--frontend-filter-active-text': '#FFFFFF',
      '--frontend-filter-inactive-bg': '#FFFFFF',
      '--frontend-filter-inactive-text': '#0C4A6E',
      '--frontend-activity-card-bg': '#FFFFFF',
      '--frontend-activity-card-border': '#BAE6FD',

      '--frontend-form-bg': '#FFFFFF',
      '--frontend-form-border': '#BAE6FD',
      '--frontend-input-bg': '#FFFFFF',
      '--frontend-input-border': '#BAE6FD',
      '--frontend-input-text': '#0F172A',

      '--frontend-credencial-card-bg': '#FFFFFF',
      '--frontend-credencial-border': '#BAE6FD',
      '--frontend-credencial-header-bg': '#0C4A6E',
      '--frontend-credencial-header-text': '#FFFFFF',
      '--frontend-credencial-badge-bg': '#0284C7',
      '--frontend-credencial-badge-text': '#FFFFFF',
      '--frontend-credencial-btn-diploma-bg': '#0284C7',
      '--frontend-credencial-btn-diploma-text': '#FFFFFF',

      '--frontend-materiales-card-bg': '#FFFFFF',
      '--frontend-materiales-card-border': '#BAE6FD',
      '--frontend-materiales-tag-bg': '#0C4A6E',
      '--frontend-materiales-tag-text': '#FFFFFF',

      '--frontend-faq-card-bg': '#FFFFFF',
      '--frontend-faq-card-border': '#BAE6FD',
      '--frontend-faq-question-text': '#0284C7',
      '--frontend-faq-answer-text': '#334155',

      '--frontend-footer-bg': '#082F49',
      '--frontend-footer-text': '#F0F9FF',
      '--frontend-footer-border': '#0C4A6E',
    },
  },
  {
    id: 'esmeralda-academico',
    name: 'Esmeralda Académico & Verde Bosque',
    category: 'moderno',
    desc: 'Inspirado en campus y laboratorios de innovación con verdes profundos y acentos lima energéticos',
    previewBg: '#F0FDF4',
    previewTextColor: '#064E3B',
    previewCardBg: '#FFFFFF',
    previewAccent: '#10B981',
    cssVars: {
      '--color-azul-oscuro': '#064E3B',
      '--color-azul-claro': '#059669',
      '--color-amarillo': '#84CC16',
      '--color-blanco': '#FFFFFF',
      '--background': '#F0FDF4',
      '--foreground': '#064E3B',

      '--frontend-header-bg': '#FFFFFF',
      '--frontend-header-text': '#064E3B',
      '--frontend-header-border': '#A7F3D0',
      '--frontend-header-link-hover': '#10B981',

      '--frontend-hero-bg': '#064E3B',
      '--frontend-hero-text': '#FFFFFF',
      '--frontend-hero-subtitle': '#D1FAE5',
      '--frontend-hero-badge': '#059669',

      '--frontend-btn-cta-bg': '#10B981',
      '--frontend-btn-cta-text': '#FFFFFF',
      '--frontend-btn-cta-hover': '#059669',
      '--frontend-btn-radius': '10px',

      '--frontend-banner-push-bg': '#065f46',
      '--frontend-banner-push-text': '#FFFFFF',
      '--frontend-banner-push-border': '#34d399',

      '--frontend-sobre-bg': '#F0FDF4',
      '--frontend-sobre-title': '#064E3B',
      '--frontend-sobre-text': '#1f2937',

      '--frontend-card-bg': '#FFFFFF',
      '--frontend-card-border': '#A7F3D0',
      '--frontend-card-title': '#064E3B',
      '--frontend-card-text': '#374151',
      '--frontend-card-link': '#059669',

      '--frontend-programa-bg': '#FFFFFF',
      '--frontend-filter-active-bg': '#064E3B',
      '--frontend-filter-active-text': '#FFFFFF',
      '--frontend-filter-inactive-bg': '#FFFFFF',
      '--frontend-filter-inactive-text': '#064E3B',
      '--frontend-activity-card-bg': '#FFFFFF',
      '--frontend-activity-card-border': '#A7F3D0',

      '--frontend-form-bg': '#FFFFFF',
      '--frontend-form-border': '#A7F3D0',
      '--frontend-input-bg': '#FFFFFF',
      '--frontend-input-border': '#A7F3D0',
      '--frontend-input-text': '#064E3B',

      '--frontend-credencial-card-bg': '#FFFFFF',
      '--frontend-credencial-border': '#A7F3D0',
      '--frontend-credencial-header-bg': '#064E3B',
      '--frontend-credencial-header-text': '#FFFFFF',
      '--frontend-credencial-badge-bg': '#059669',
      '--frontend-credencial-badge-text': '#FFFFFF',
      '--frontend-credencial-btn-diploma-bg': '#10B981',
      '--frontend-credencial-btn-diploma-text': '#FFFFFF',

      '--frontend-materiales-card-bg': '#FFFFFF',
      '--frontend-materiales-card-border': '#A7F3D0',
      '--frontend-materiales-tag-bg': '#064E3B',
      '--frontend-materiales-tag-text': '#FFFFFF',

      '--frontend-faq-card-bg': '#FFFFFF',
      '--frontend-faq-card-border': '#A7F3D0',
      '--frontend-faq-question-text': '#059669',
      '--frontend-faq-answer-text': '#374151',

      '--frontend-footer-bg': '#022C22',
      '--frontend-footer-text': '#ECFDF5',
      '--frontend-footer-border': '#064E3B',
    },
  },
  {
    id: 'noche-dark',
    name: 'Modo Noche Profundo (Dark Mode)',
    category: 'oscuro',
    desc: 'Tema oscuro integral de alto confort visual para eventos nocturnos o pantallas OLED',
    previewBg: '#0F172A',
    previewTextColor: '#F8FAFC',
    previewCardBg: '#1E293B',
    previewAccent: '#38BDF8',
    cssVars: {
      '--color-azul-oscuro': '#0F172A',
      '--color-azul-claro': '#38BDF8',
      '--color-amarillo': '#FACC15',
      '--color-blanco': '#1E293B',
      '--background': '#0B1120',
      '--foreground': '#F8FAFC',

      '--frontend-header-bg': '#0F172A',
      '--frontend-header-text': '#F8FAFC',
      '--frontend-header-border': '#334155',
      '--frontend-header-link-hover': '#38BDF8',

      '--frontend-hero-bg': '#0F172A',
      '--frontend-hero-text': '#FFFFFF',
      '--frontend-hero-subtitle': '#94A3B8',
      '--frontend-hero-badge': '#1E293B',

      '--frontend-btn-cta-bg': '#38BDF8',
      '--frontend-btn-cta-text': '#0F172A',
      '--frontend-btn-cta-hover': '#0284C7',
      '--frontend-btn-radius': '12px',

      '--frontend-banner-push-bg': '#1e293b',
      '--frontend-banner-push-text': '#F8FAFC',
      '--frontend-banner-push-border': '#38bdf8',

      '--frontend-sobre-bg': '#0B1120',
      '--frontend-sobre-title': '#F8FAFC',
      '--frontend-sobre-text': '#94A3B8',

      '--frontend-card-bg': '#1E293B',
      '--frontend-card-border': '#334155',
      '--frontend-card-title': '#F8FAFC',
      '--frontend-card-text': '#94A3B8',
      '--frontend-card-link': '#38BDF8',

      '--frontend-programa-bg': '#0F172A',
      '--frontend-filter-active-bg': '#38BDF8',
      '--frontend-filter-active-text': '#0F172A',
      '--frontend-filter-inactive-bg': '#1E293B',
      '--frontend-filter-inactive-text': '#F8FAFC',
      '--frontend-activity-card-bg': '#1E293B',
      '--frontend-activity-card-border': '#334155',

      '--frontend-form-bg': '#1E293B',
      '--frontend-form-border': '#334155',
      '--frontend-input-bg': '#0F172A',
      '--frontend-input-border': '#475569',
      '--frontend-input-text': '#F8FAFC',

      '--frontend-credencial-card-bg': '#1E293B',
      '--frontend-credencial-border': '#334155',
      '--frontend-credencial-header-bg': '#0F172A',
      '--frontend-credencial-header-text': '#F8FAFC',
      '--frontend-credencial-badge-bg': '#38BDF8',
      '--frontend-credencial-badge-text': '#0F172A',
      '--frontend-credencial-btn-diploma-bg': '#38BDF8',
      '--frontend-credencial-btn-diploma-text': '#0F172A',

      '--frontend-materiales-card-bg': '#1E293B',
      '--frontend-materiales-card-border': '#334155',
      '--frontend-materiales-tag-bg': '#38BDF8',
      '--frontend-materiales-tag-text': '#0F172A',

      '--frontend-faq-card-bg': '#1E293B',
      '--frontend-faq-card-border': '#334155',
      '--frontend-faq-question-text': '#38BDF8',
      '--frontend-faq-answer-text': '#94A3B8',

      '--frontend-footer-bg': '#020617',
      '--frontend-footer-text': '#E2E8F0',
      '--frontend-footer-border': '#1E293B',
    },
  },
  {
    id: 'calido-durazno',
    name: 'Cálido Durazno & Terracota',
    category: 'pastel',
    desc: 'Colores cálidos, orgánicos y amigables con tipografía cacao y acento terracota',
    previewBg: '#FFF7ED',
    previewTextColor: '#431407',
    previewCardBg: '#FFFFFF',
    previewAccent: '#EA580C',
    cssVars: {
      '--color-azul-oscuro': '#431407',
      '--color-azul-claro': '#C2410C',
      '--color-amarillo': '#F59E0B',
      '--color-blanco': '#FFFFFF',
      '--background': '#FFF7ED',
      '--foreground': '#431407',

      '--frontend-header-bg': '#FFFFFF',
      '--frontend-header-text': '#431407',
      '--frontend-header-border': '#FED7AA',
      '--frontend-header-link-hover': '#EA580C',

      '--frontend-hero-bg': '#431407',
      '--frontend-hero-text': '#FFFFFF',
      '--frontend-hero-subtitle': '#FFEDD5',
      '--frontend-hero-badge': '#C2410C',

      '--frontend-btn-cta-bg': '#EA580C',
      '--frontend-btn-cta-text': '#FFFFFF',
      '--frontend-btn-cta-hover': '#C2410C',
      '--frontend-btn-radius': '8px',

      '--frontend-banner-push-bg': '#7c2d12',
      '--frontend-banner-push-text': '#FFFFFF',
      '--frontend-banner-push-border': '#fb923c',

      '--frontend-sobre-bg': '#FFF7ED',
      '--frontend-sobre-title': '#431407',
      '--frontend-sobre-text': '#78350f',

      '--frontend-card-bg': '#FFFFFF',
      '--frontend-card-border': '#FED7AA',
      '--frontend-card-title': '#431407',
      '--frontend-card-text': '#78350f',
      '--frontend-card-link': '#C2410C',

      '--frontend-programa-bg': '#FFFFFF',
      '--frontend-filter-active-bg': '#431407',
      '--frontend-filter-active-text': '#FFFFFF',
      '--frontend-filter-inactive-bg': '#FFFFFF',
      '--frontend-filter-inactive-text': '#431407',
      '--frontend-activity-card-bg': '#FFFFFF',
      '--frontend-activity-card-border': '#FED7AA',

      '--frontend-form-bg': '#FFFFFF',
      '--frontend-form-border': '#FED7AA',
      '--frontend-input-bg': '#FFFFFF',
      '--frontend-input-border': '#FED7AA',
      '--frontend-input-text': '#431407',

      '--frontend-credencial-card-bg': '#FFFFFF',
      '--frontend-credencial-border': '#FED7AA',
      '--frontend-credencial-header-bg': '#431407',
      '--frontend-credencial-header-text': '#FFFFFF',
      '--frontend-credencial-badge-bg': '#C2410C',
      '--frontend-credencial-badge-text': '#FFFFFF',
      '--frontend-credencial-btn-diploma-bg': '#EA580C',
      '--frontend-credencial-btn-diploma-text': '#FFFFFF',

      '--frontend-materiales-card-bg': '#FFFFFF',
      '--frontend-materiales-card-border': '#FED7AA',
      '--frontend-materiales-tag-bg': '#431407',
      '--frontend-materiales-tag-text': '#FFFFFF',

      '--frontend-faq-card-bg': '#FFFFFF',
      '--frontend-faq-card-border': '#FED7AA',
      '--frontend-faq-question-text': '#C2410C',
      '--frontend-faq-answer-text': '#78350f',

      '--frontend-footer-bg': '#2A0E05',
      '--frontend-footer-text': '#FFEDD5',
      '--frontend-footer-border': '#431407',
    },
  },
];
