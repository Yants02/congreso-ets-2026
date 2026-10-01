'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { ConfiguracionEntity } from './types';
import AdminThemeEditor from './AdminThemeEditor';
import AdminFrontendThemeEditor from './AdminFrontendThemeEditor';
import AdminJournalingView from './AdminJournalingView';

interface Props {
  onNotice: (msg: string) => void;
}

interface RolItem {
  id: number;
  nombre: string;
  descripcion: string;
  jerarquia: number;
  permisos?: string[];
}

interface TipoAcredItem {
  id: number;
  codigo: string;
  descripcion: string;
  requiere_actividad: boolean;
}

interface CategoriaItem {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

interface BackupItem {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  esManual: boolean;
  totalRegistros?: number;
  separacion_modulos?: {
    usuarios: { archivo: string; tablas: string[]; total_registros: number };
    configuracion: { archivo: string; tablas: string[]; total_registros: number };
    operacion: { archivo: string; tablas: string[]; total_registros: number };
  };
}

interface SmtpAccountForm {
  id: string;
  nombre: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  from: string;
  activo: boolean;
}

interface MailConfigForm {
  cuenta_principal: SmtpAccountForm;
  cuenta_secundaria?: SmtpAccountForm;
  sandbox_mode: boolean;
  notificar_inscripcion: boolean;
  notificar_espera: boolean;
  notificar_48hs: boolean;
  notificar_certificados: boolean;
}

export interface MailTemplateConfigForm {
  header: {
    activo: boolean;
    modo: 'imagen' | 'texto' | 'mixto';
    imagen_url?: string;
    titulo_texto?: string;
    subtitulo_texto?: string;
    fondo_color?: string;
    texto_color?: string;
    altura_px?: number;
  };
  footer: {
    activo: boolean;
    modo: 'imagen' | 'texto' | 'mixto';
    imagen_url?: string;
    linea1: string;
    linea2: string;
    enlace_privacidad_url?: string;
    enlace_contacto_url?: string;
    fondo_color?: string;
    texto_color?: string;
  };
  estilos: {
    color_primario: string;
    color_secundario: string;
    color_boton: string;
    color_texto_boton: string;
    color_fondo_general: string;
    fuente_familia: string;
  };
}

interface PushStats {
  total_dispositivos: number;
  usuarios_vinculados: number;
  desglose_roles: Array<{ rol: string; total: string | number }>;
  vapid_public_key: string;
}

export default function AdminConfiguracionView({ onNotice }: Props) {
  const [tab, setTab] = useState<'parametros' | 'roles' | 'tipos' | 'categorias' | 'backups' | 'correo' | 'push' | 'temas' | 'temas-frontend' | 'journaling'>('parametros');
  const [loading, setLoading] = useState(false);

  // Correo SMTP
  const [mailConfig, setMailConfig] = useState<MailConfigForm>({
    cuenta_principal: {
      id: 'principal',
      nombre: 'Cuenta Principal – QRs y Avisos',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      password: '',
      from: 'Congreso ETS 2026 <no-reply.dets@bue.edu.ar>',
      activo: true,
    },
    cuenta_secundaria: {
      id: 'secundaria',
      nombre: 'Cuenta Secundaria – Avisos Masivos',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      password: '',
      from: 'Avisos Congreso <avisos.dets@bue.edu.ar>',
      activo: false,
    },
    sandbox_mode: true,
    notificar_inscripcion: true,
    notificar_espera: true,
    notificar_48hs: true,
    notificar_certificados: true,
  });
  const [activeMailSubtab, setActiveMailSubtab] = useState<'principal' | 'secundaria' | 'plantilla'>('principal');
  const [showMailPassword, setShowMailPassword] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isTestingMail, setIsTestingMail] = useState(false);
  const [testMailResult, setTestMailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingMail, setIsSavingMail] = useState(false);

  // Plantilla de Correo (Header & Footer)
  const [mailTemplate, setMailTemplate] = useState<MailTemplateConfigForm>({
    header: {
      activo: true,
      modo: 'imagen',
      imagen_url: '',
      titulo_texto: '1er Congreso de Educación Técnica Superior',
      subtitulo_texto: 'DETS · Ministerio de Educación GCABA',
      fondo_color: '#003865',
      texto_color: '#ffffff',
      altura_px: 120,
    },
    footer: {
      activo: true,
      modo: 'mixto',
      imagen_url: '',
      linea1: 'Dirección de Educación Técnica Superior · Ministerio de Educación GCABA',
      linea2: 'Sede: Galván 3710, Auditorio Polo Saavedra, CABA · 6 de Noviembre de 2026',
      enlace_privacidad_url: '',
      enlace_contacto_url: '',
      fondo_color: '#f8fafc',
      texto_color: '#64748b',
    },
    estilos: {
      color_primario: '#005691',
      color_secundario: '#f39c12',
      color_boton: '#005691',
      color_texto_boton: '#ffffff',
      color_fondo_general: '#f4f7f9',
      fuente_familia: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
  });
  const [isSavingMailTemplate, setIsSavingMailTemplate] = useState(false);
  const [previewSampleType, setPreviewSampleType] = useState<'inscripcion' | 'espera' | 'certificado'>('inscripcion');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Push Notifications
  const [pushStats, setPushStats] = useState<PushStats | null>(null);
  const [pushForm, setPushForm] = useState({
    title: '',
    body: '',
    url: '/',
    urgente: false,
    rol_id: null as number | null,
    solo_acreditados: false,
  });
  const [isBroadcastingPush, setIsBroadcastingPush] = useState(false);
  const [pushBroadcastResult, setPushBroadcastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [isRegeneratingVapid, setIsRegeneratingVapid] = useState(false);


  // Parámetros
  const [configs, setConfigs] = useState<ConfiguracionEntity[]>([]);
  const [isEditParamOpen, setIsEditParamOpen] = useState(false);
  const [currentParam, setCurrentParam] = useState<ConfiguracionEntity | null>(null);
  const [rawJson, setRawJson] = useState('');

  // Roles
  const [roles, setRoles] = useState<RolItem[]>([]);
  const [isRolModalOpen, setIsRolModalOpen] = useState(false);
  const [currentRol, setCurrentRol] = useState<RolItem | null>(null);
  const [rolForm, setRolForm] = useState<{ nombre: string; descripcion: string; jerarquia: number; permisos: string[] }>({
    nombre: '',
    descripcion: '',
    jerarquia: 1,
    permisos: [],
  });

  // Tipos Acreditación
  const [tiposAcred, setTiposAcred] = useState<TipoAcredItem[]>([]);
  const [isTipoModalOpen, setIsTipoModalOpen] = useState(false);
  const [tipoForm, setTipoForm] = useState({ codigo: '', descripcion: '', requiere_actividad: false });

  // Categorías Temáticas
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ nombre: '', descripcion: '' });

  // Copias de Seguridad (Backups)
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [restoreMode, setRestoreMode] = useState<'completo' | 'operacion' | 'configuracion' | 'usuarios'>('completo');
  const [isRestoring, setIsRestoring] = useState(false);

  // Dumps de Base de Datos (.SQL)
  const [backupSubtab, setBackupSubtab] = useState<'integrales' | 'dumps'>('integrales');
  const [sqlDumps, setSqlDumps] = useState<Array<{ filename: string; sizeBytes: number; createdAt: string; tipo: string }>>([]);
  const [isCreatingDump, setIsCreatingDump] = useState(false);
  const [dumpTipoSelect, setDumpTipoSelect] = useState<'completo' | 'operacion' | 'configuracion' | 'usuarios'>('completo');

  async function loadBackups() {
    try {
      const res = await fetch('/api/admin/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.error('Error cargando backups:', err);
    }
  }

  async function loadSqlDumps() {
    try {
      const res = await fetch('/api/admin/backups/dumps');
      if (res.ok) {
        const data = await res.json();
        setSqlDumps(data.dumps || []);
      }
    } catch (err) {
      console.error('Error cargando dumps SQL:', err);
    }
  }

  async function loadMailConfig() {
    try {
      const res = await fetch('/api/admin/configuracion/mail');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setMailConfig(data.settings);
        }
      }
    } catch (err) {
      console.error('Error cargando configuración de correo:', err);
    }
  }

  async function loadMailTemplate() {
    try {
      const res = await fetch('/api/admin/configuracion/mail/plantilla');
      if (res.ok) {
        const data = await res.json();
        if (data.plantilla) {
          setMailTemplate(data.plantilla);
        }
      }
    } catch (err) {
      console.error('Error cargando plantilla de correo:', err);
    }
  }

  async function loadMailTemplatePreview(customTpl?: MailTemplateConfigForm, sampleType?: 'inscripcion' | 'espera' | 'certificado') {
    setIsLoadingPreview(true);
    try {
      const res = await fetch('/api/admin/configuracion/mail/plantilla/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantilla: customTpl || mailTemplate,
          tipo_muestra: sampleType || previewSampleType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html || '');
      }
    } catch (err) {
      console.error('Error cargando previsualización de correo:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function handleSaveMailTemplate(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingMailTemplate(true);
    try {
      const res = await fetch('/api/admin/configuracion/mail/plantilla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailTemplate),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Plantilla Guardada',
          text: data.mensaje || 'Encabezado, pie y estilos de correo actualizados exitosamente.',
          timer: 2000,
          showConfirmButton: false,
        });
        loadMailTemplatePreview(mailTemplate);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al Guardar',
          text: data.message || 'No se pudo guardar la plantilla de correo.',
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Red',
        text: err.message || 'Fallo de conexión al guardar plantilla.',
      });
    } finally {
      setIsSavingMailTemplate(false);
    }
  }

  async function loadPushStats() {
    try {
      const res = await fetch('/api/admin/push/stats');
      if (res.ok) {
        const data = await res.json();
        setPushStats(data);
      }
    } catch (err) {
      console.error('Error cargando estadísticas push:', err);
    }
  }

  async function loadAllData() {
    setLoading(true);
    try {
      const [confRes, catRes] = await Promise.all([
        fetch('/api/admin/configuracion'),
        fetch('/api/admin/catalogos'),
        loadBackups(),
        loadSqlDumps(),
        loadMailConfig(),
        loadMailTemplate(),
        loadPushStats(),
      ]);
      loadMailTemplatePreview();

      if (confRes.ok) {
        const confData = await confRes.json();
        setConfigs(confData.configuracion || []);
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        setRoles(catData.roles || []);
        setTiposAcred(catData.tipos_acreditacion || []);
        setCategorias(catData.categorias_tematicas || []);
      }
    } catch (err) {
      console.error('Error cargando configuración:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  async function handleSaveMailConfig(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingMail(true);
    try {
      const res = await fetch('/api/admin/configuracion/mail', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Parámetros de cuentas de correo guardados exitosamente.');
        loadMailConfig();
      } else {
        await Swal.fire({
          title: 'Error al Guardar Correo',
          text: data.message || data.error || 'Error al guardar configuración de correo',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setIsSavingMail(false);
    }
  }

  async function handleTestMail() {
    setIsTestingMail(true);
    setTestMailResult(null);
    try {
      const currentAcc = activeMailSubtab === 'secundaria' && mailConfig.cuenta_secundaria
        ? mailConfig.cuenta_secundaria
        : mailConfig.cuenta_principal;

      // Validación preventiva: si no está en sandbox y no hay contraseña ingresada ni guardada
      const hasSavedPassword = Boolean((currentAcc as any).has_password);
      const hasInputPassword = Boolean(currentAcc.password && currentAcc.password.trim() !== '' && currentAcc.password !== '••••••••••••');

      if (!mailConfig.sandbox_mode && !hasSavedPassword && !hasInputPassword) {
        setTestMailResult({
          success: false,
          message: `Faltan credenciales: No se ha configurado una contraseña o token de aplicación para ${currentAcc.nombre}. Por favor escribe la contraseña en el formulario arriba o activa el "Modo Sandbox Institucional" para simular el envío.`,
        });
        setIsTestingMail(false);
        return;
      }

      const res = await fetch('/api/admin/configuracion/mail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: activeMailSubtab,
          testRecipient: testEmailRecipient.trim() || undefined,
          accountConfig: currentAcc,
          sandbox_mode: mailConfig.sandbox_mode,
        }),
      });
      const data = await res.json();
      setTestMailResult({
        success: Boolean(data.ok),
        message: data.mensaje || data.error || 'Resultado de la prueba',
      });
    } catch {
      setTestMailResult({
        success: false,
        message: 'Error de red al intentar verificar el servidor SMTP.',
      });
    } finally {
      setIsTestingMail(false);
    }
  }

  async function handleBroadcastPush(e: React.FormEvent) {
    e.preventDefault();
    if (!pushForm.title.trim() || !pushForm.body.trim()) {
      await Swal.fire({
        title: 'Campos Incompletos',
        text: 'Por favor completa el título y el mensaje del aviso push.',
        icon: 'warning',
        confirmButtonColor: '#005691',
      });
      return;
    }
    setIsBroadcastingPush(true);
    setPushBroadcastResult(null);
    try {
      const res = await fetch('/api/admin/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushForm.title,
          body: pushForm.body,
          url: pushForm.url,
          urgente: pushForm.urgente,
          filtro: {
            rol_id: pushForm.rol_id,
            solo_acreditados: pushForm.solo_acreditados,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(data.mensaje || 'Notificación push emitida exitosamente.');
        if (data.detalle) {
          setPushBroadcastResult(data.detalle);
        }
        setPushForm({
          title: '',
          body: '',
          url: '/',
          urgente: false,
          rol_id: null,
          solo_acreditados: false,
        });
        loadPushStats();
      } else {
        await Swal.fire({
          title: 'Error Push',
          text: data.message || data.error || 'Error al emitir notificación push.',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión al emitir notificación push.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setIsBroadcastingPush(false);
    }
  }

  async function handleRegenerateVapid() {
    const confirmRes = await Swal.fire({
      title: '¿Regenerar claves VAPID?',
      text: 'Los dispositivos ya suscritos deberán renovar su suscripción para recibir avisos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, regenerar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#005691',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) {
      return;
    }
    setIsRegeneratingVapid(true);
    try {
      const res = await fetch('/api/admin/push/regenerate-keys', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Claves VAPID regeneradas correctamente.');
        loadPushStats();
      } else {
        await Swal.fire({
          title: 'Error al Regenerar',
          text: data.message || 'Error regenerando claves.',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setIsRegeneratingVapid(false);
    }
  }

  async function handleCreateBackup() {
    setIsCreatingBackup(true);
    try {
      const res = await fetch('/api/admin/backups', { method: 'POST' });
      if (res.ok) {
        onNotice('✅ Copia de seguridad generada con éxito con segregación modular y dumps SQL.');
        await loadBackups();
      } else {
        const err = await res.json();
        await Swal.fire({
          title: 'Error en Backup',
          text: `Error generando backup: ${err.message || 'Error desconocido'}`,
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión al generar copia de seguridad.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function handleCreateSqlDump(tipo: 'completo' | 'operacion' | 'configuracion' | 'usuarios') {
    setIsCreatingDump(true);
    try {
      const res = await fetch('/api/admin/backups/dumps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      if (res.ok) {
        const data = await res.json();
        onNotice(`✅ Dump SQL (${tipo.toUpperCase()}) generado con éxito: ${data.dump.filename}`);
        await loadSqlDumps();
      } else {
        const err = await res.json();
        await Swal.fire({
          title: 'Error en Dump SQL',
          text: `Error generando dump SQL: ${err.message || 'Error desconocido'}`,
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión al generar dump SQL.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setIsCreatingDump(false);
    }
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return;
    const confirmRes = await Swal.fire({
      title: '¿Confirmar Restauración?',
      text: `¿Confirmas la restauración (${restoreMode.toUpperCase()}) desde ${restoreTarget.filename}? Esta acción modificará los datos de la base de datos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, restaurar base de datos',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) {
      return;
    }

    setIsRestoring(true);
    try {
      const res = await fetch(`/api/admin/backups/restaurar/${encodeURIComponent(restoreTarget.filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: restoreMode }),
      });

      if (res.ok) {
        const data = await res.json();
        await Swal.fire({
          title: 'Restauración Exitosa',
          text: `${data.resultado.totalRestaurados} registros restablecidos.`,
          icon: 'success',
          confirmButtonColor: '#005691',
        });
        onNotice(`✅ Restauración exitosa: ${data.resultado.totalRestaurados} registros restablecidos.`);
        setRestoreTarget(null);
        await loadAllData();
      } else {
        const err = await res.json();
        await Swal.fire({
          title: 'Fallo de Integridad',
          text: `Error en restauración: ${err.message || 'Fallo de integridad'}`,
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Red',
        text: 'Error de red al ejecutar la restauración.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setIsRestoring(false);
    }
  }

  // --- HANDLERS PARÁMETROS ---
  function handleEditParamClick(item: ConfiguracionEntity) {
    setCurrentParam(item);
    setRawJson(JSON.stringify(item.valor, null, 2));
    setIsEditParamOpen(true);
  }

  async function handleUpdateParam(e: React.FormEvent) {
    e.preventDefault();
    if (!currentParam) return;
    let parsedVal: any;
    try {
      parsedVal = JSON.parse(rawJson);
    } catch {
      await Swal.fire({
        title: 'JSON Inválido',
        text: 'El valor ingresado no es un formato JSON válido.',
        icon: 'warning',
        confirmButtonColor: '#005691',
      });
      return;
    }

    try {
      const res = await fetch('/api/admin/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave: currentParam.clave,
          valor: parsedVal,
          descripcion: currentParam.descripcion,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(`Parámetro "${currentParam.clave}" actualizado.`);
        setIsEditParamOpen(false);
        loadAllData();
      } else {
        await Swal.fire({
          title: 'Error al Actualizar',
          text: data.message || 'Error al actualizar',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  // --- HANDLERS ROLES ---
  async function handleSaveRol(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = currentRol ? `/api/admin/catalogos/roles/${currentRol.id}` : '/api/admin/catalogos/roles';
      const method = currentRol ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rolForm),
      });
      if (res.ok) {
        onNotice(currentRol ? 'Rol actualizado correctamente.' : 'Nuevo rol creado.');
        setIsRolModalOpen(false);
        setCurrentRol(null);
        setRolForm({ nombre: '', descripcion: '', jerarquia: 1, permisos: [] });
        loadAllData();
      } else {
        const d = await res.json();
        await Swal.fire({
          title: 'Error en Rol',
          text: d.message || 'Error al procesar rol',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleDeleteRol(id: number, nombre: string) {
    const confirmRes = await Swal.fire({
      title: '¿Eliminar rol?',
      text: `¿Seguro que deseas eliminar el rol "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/catalogos/roles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Rol eliminado correctamente.');
        loadAllData();
      } else {
        await Swal.fire({
          title: 'Error al Eliminar Rol',
          text: data.message || 'No se puede eliminar el rol.',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  // --- HANDLERS TIPOS ACREDITACIÓN ---
  async function handleSaveTipo(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/catalogos/tipos-acreditacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipoForm),
      });
      if (res.ok) {
        onNotice('Tipo de acreditación creado con éxito.');
        setIsTipoModalOpen(false);
        setTipoForm({ codigo: '', descripcion: '', requiere_actividad: false });
        loadAllData();
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Error al guardar tipo.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  // --- HANDLERS CATEGORÍAS TEMÁTICAS ---
  async function handleSaveCategoria(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/catalogos/categorias-tematicas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catForm),
      });
      if (res.ok) {
        onNotice('Categoría temática creada.');
        setIsCatModalOpen(false);
        setCatForm({ nombre: '', descripcion: '' });
        loadAllData();
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Error al guardar categoría.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Selector de Entidades en Configuración */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('parametros')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'parametros' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            ⚙️ Parámetros Globales ({configs.length})
          </button>
          <button
            onClick={() => setTab('roles')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'roles' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            👥 Roles Institucionales ({roles.length})
          </button>
          <button
            onClick={() => setTab('tipos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'tipos' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            🏷️ Tipos de Acreditación ({tiposAcred.length})
          </button>
          <button
            onClick={() => setTab('categorias')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'categorias' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            📚 Categorías Temáticas ({categorias.length})
          </button>
          <button
            onClick={() => setTab('backups')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'backups' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            💾 Copias de Seguridad ({backups.length})
          </button>
          <button
            onClick={() => setTab('correo')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'correo' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            📧 Cuentas de Correo (SMTP)
          </button>
          <button
            onClick={() => setTab('push')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tab === 'push' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            🔔 Notificaciones Push ({pushStats?.total_dispositivos || 0})
          </button>
          <button
            onClick={() => setTab('temas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tab === 'temas' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <span>🎨</span>
            <span>Temas del Backend</span>
          </button>
          <button
            onClick={() => setTab('temas-frontend')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tab === 'temas-frontend' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <span>🌐</span>
            <span>Temas del Frontend</span>
          </button>
          <button
            onClick={() => setTab('journaling')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tab === 'journaling' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <span>📝</span>
            <span>Journaling & Diagnóstico</span>
          </button>
        </div>

        <div className="flex gap-2">
          {tab === 'roles' && (
            <button
              onClick={() => {
                setCurrentRol(null);
                setRolForm({ nombre: '', descripcion: '', jerarquia: 1, permisos: [] });
                setIsRolModalOpen(true);
              }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-xs"
            >
              ➕ Nuevo Rol
            </button>
          )}
          {tab === 'tipos' && (
            <button
              onClick={() => setIsTipoModalOpen(true)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-xs"
            >
              ➕ Nuevo Tipo
            </button>
          )}
          {tab === 'categorias' && (
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-xs"
            >
              ➕ Nueva Categoría
            </button>
          )}
          {tab === 'backups' && (
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              {isCreatingBackup ? '⏳ Generando Backup...' : '💾 Crear Backup Ahora'}
            </button>
          )}
          <button
            onClick={loadAllData}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
          >
            🔄 Recargar
          </button>
        </div>
      </div>

      {/* TAB 1: PARÁMETROS GLOBALES */}
      {tab === 'parametros' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Valor Estructurado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {configs.map((c) => (
                <tr key={c.clave} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-blue-700">{c.clave}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.descripcion}</td>
                  <td className="px-4 py-3 font-mono text-xs max-w-xs truncate">
                    {JSON.stringify(c.valor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEditParamClick(c)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                    >
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: ROLES INSTITUCIONALES */}
      {tab === 'roles' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nombre del Rol</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-center">Jerarquía</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-blue-700">#{r.id}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{r.nombre}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.descripcion || 'Sin descripción'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-xs rounded">
                      Nivel {r.jerarquia}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setCurrentRol(r);
                          setRolForm({
                            nombre: r.nombre,
                            descripcion: r.descripcion || '',
                            jerarquia: r.jerarquia,
                            permisos: Array.isArray(r.permisos) ? r.permisos : [],
                          });
                          setIsRolModalOpen(true);
                        }}
                        className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteRol(r.id, r.nombre)}
                        className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: TIPOS DE ACREDITACIÓN */}
      {tab === 'tipos' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-center">Requiere Actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tiposAcred.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-blue-700">#{t.id}</td>
                  <td className="px-4 py-3 font-mono font-bold text-xs">{t.codigo}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{t.descripcion}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                      t.requiere_actividad ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {t.requiere_actividad ? 'SÍ' : 'NO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: CATEGORÍAS TEMÁTICAS */}
      {tab === 'categorias' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-blue-700">#{c.id}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{c.nombre}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.descripcion || 'Sin descripción'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                      c.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {c.activo ? 'Vigente' : 'Inactiva'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA COPÍAS DE SEGURIDAD (BACKUPS) Y DUMPS SQL */}
      {tab === 'backups' && (
        <div className="space-y-4">
          {/* Sub-navegación entre Copias Integrales y Dumps SQL */}
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            <button
              onClick={() => setBackupSubtab('integrales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                backupSubtab === 'integrales'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              📦 Copias Integrales (.ZIP) ({backups.length})
            </button>
            <button
              onClick={() => setBackupSubtab('dumps')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                backupSubtab === 'dumps'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              🗄️ Dumps de Base de Datos (.SQL) ({sqlDumps.length})
            </button>
          </div>

          {backupSubtab === 'integrales' && (
            <>
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                    <span>🛡️</span> Resguardo Modular y Dumps Integrados (.ZIP)
                  </h4>
                  <p className="text-xs text-blue-800/90 mt-1 max-w-3xl">
                    Cada backup integral empaqueta los datos segregados en tres módulos (<span className="font-bold">Operación</span>, <span className="font-bold">Configuración</span> y <span className="font-bold">Usuarios</span>),
                    junto con el esquema DDL 3FN y los <span className="font-bold">Dumps SQL nativos de PostgreSQL</span> para recuperación ante desastres.
                  </p>
                </div>
                <button
                  onClick={handleCreateBackup}
                  disabled={isCreatingBackup}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm whitespace-nowrap"
                >
                  {isCreatingBackup ? '⏳ Generando...' : '💾 Crear Copia Manual'}
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">Archivo / Generación</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Tamaño</th>
                        <th className="px-4 py-3">Segregación Modular y Dumps</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {backups.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-xs">
                            No hay copias de seguridad registradas en el almacenamiento.
                          </td>
                        </tr>
                      ) : (
                        backups.map((b) => (
                          <tr key={b.filename} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs font-bold text-gray-900">{b.filename}</div>
                              <div className="text-[11px] text-gray-500">
                                {new Date(b.createdAt).toLocaleString('es-AR', {
                                  dateStyle: 'medium',
                                  timeStyle: 'medium',
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 text-xs font-bold rounded ${
                                  b.esManual ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {b.esManual ? 'MANUAL' : 'CRON AUTO'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">
                              {(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </td>
                            <td className="px-4 py-3">
                              {b.separacion_modulos ? (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded font-medium">
                                      👤 Usuarios: <strong>{b.separacion_modulos.usuarios.total_registros}</strong>
                                    </span>
                                    <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded font-medium">
                                      ⚙️ Config: <strong>{b.separacion_modulos.configuracion.total_registros}</strong>
                                    </span>
                                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-medium">
                                      ⚡ Operación: <strong>{b.separacion_modulos.operacion.total_registros}</strong>
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono">
                                    ✓ Incluye dumps SQL: dump_completo.sql, dump_operacion.sql, dump_configuracion.sql, dump_usuarios.sql
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Archivo consolidado estándar</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <a
                                  href={`/api/admin/backups/descargar/${encodeURIComponent(b.filename)}`}
                                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-xs font-bold transition flex items-center gap-1"
                                  download
                                >
                                  📥 Descargar .ZIP
                                </a>
                                <button
                                  onClick={() => {
                                    setRestoreTarget(b);
                                    setRestoreMode('completo');
                                  }}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition"
                                >
                                  🔄 Restaurar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* SUBTAB DUMPS SQL DE BASE DE DATOS */}
          {backupSubtab === 'dumps' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <span>🗄️</span> Dumps Nativos PostgreSQL (`pg_dump`)
                  </h4>
                  <p className="text-xs text-emerald-800/90 mt-1 max-w-3xl">
                    Genera scripts SQL directamente con el motor <span className="font-mono font-bold">pg_dump</span>.
                    Permite exportar la base de datos completa o aislar solo la <span className="font-bold">operación</span>, <span className="font-bold">configuración</span> o <span className="font-bold">usuarios</span> en formato SQL listo para ser restaurado mediante <span className="font-mono">psql</span>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={dumpTipoSelect}
                    onChange={(e) => setDumpTipoSelect(e.target.value as any)}
                    className="p-1.5 text-xs border rounded-lg bg-white font-medium text-gray-800"
                  >
                    <option value="completo">🗄️ Base Completa (Schema + Datos)</option>
                    <option value="operacion">⚡ Solo Operación (Acreditaciones, Asistencias)</option>
                    <option value="configuracion">⚙️ Solo Configuración (Eventos, Roles)</option>
                    <option value="usuarios">👤 Solo Usuarios (Padrón, Operadores)</option>
                  </select>
                  <button
                    onClick={() => handleCreateSqlDump(dumpTipoSelect)}
                    disabled={isCreatingDump}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm whitespace-nowrap flex items-center gap-1.5"
                  >
                    {isCreatingDump ? '⏳ Ejecutando pg_dump...' : '🗄️ Generar Dump SQL'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">Archivo Dump (.SQL)</th>
                        <th className="px-4 py-3">Alcance Modular</th>
                        <th className="px-4 py-3">Tamaño</th>
                        <th className="px-4 py-3">Fecha de Creación</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sqlDumps.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-xs">
                            No hay dumps SQL generados en el directorio de resguardo.
                          </td>
                        </tr>
                      ) : (
                        sqlDumps.map((d) => (
                          <tr key={d.filename} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                <span>📄</span> {d.filename}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 text-xs font-bold rounded ${
                                  d.tipo === 'completo'
                                    ? 'bg-blue-100 text-blue-800'
                                    : d.tipo === 'operacion'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : d.tipo === 'configuracion'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {d.tipo.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">
                              {(d.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(d.createdAt).toLocaleString('es-AR', {
                                dateStyle: 'medium',
                                timeStyle: 'medium',
                              })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <a
                                href={`/api/admin/backups/dumps/descargar/${encodeURIComponent(d.filename)}`}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition inline-flex items-center gap-1"
                                download
                              >
                                📥 Descargar .SQL
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: CUENTAS DE CORREO SMTP (QRs, AVISOS Y DIPLOMAS) */}
      {tab === 'correo' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <span>📧</span>
                  <span>Configuración de Cuentas de Correo SMTP</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Parámetros de conexión y credenciales para el despacho automático de Códigos QR, avisos de lista de espera, reconfirmaciones de 48hs y diplomas oficiales.
                </p>
              </div>

              {/* Selector de Cuentas y Plantilla */}
              <div className="flex flex-wrap items-center bg-gray-100 p-1 rounded-lg gap-1">
                <button
                  type="button"
                  onClick={() => setActiveMailSubtab('principal')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    activeMailSubtab === 'principal' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📬 Cuenta Principal (QRs)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMailSubtab('secundaria')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    activeMailSubtab === 'secundaria' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📨 Cuenta Secundaria (Avisos)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMailSubtab('plantilla');
                    loadMailTemplatePreview();
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    activeMailSubtab === 'plantilla' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🎨 Plantilla & Diseño (Header/Footer)
                </button>
              </div>
            </div>

            {activeMailSubtab !== 'plantilla' ? (
            <form onSubmit={handleSaveMailConfig} className="space-y-6">
              {/* Datos de la Cuenta Activa */}
              {activeMailSubtab === 'principal' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      Parámetros de la Cuenta Principal
                    </span>
                    <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                      Transaccional: QRs, Credenciales y Diplomas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Descriptivo</label>
                      <input
                        type="text"
                        value={mailConfig.cuenta_principal.nombre}
                        onChange={(e) =>
                          setMailConfig({
                            ...mailConfig,
                            cuenta_principal: { ...mailConfig.cuenta_principal, nombre: e.target.value },
                          })
                        }
                        className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre y Email Remitente (From)</label>
                      <input
                        type="text"
                        value={mailConfig.cuenta_principal.from}
                        onChange={(e) =>
                          setMailConfig({
                            ...mailConfig,
                            cuenta_principal: { ...mailConfig.cuenta_principal, from: e.target.value },
                          })
                        }
                        placeholder='Congreso ETS 2026 <no-reply.dets@bue.edu.ar>'
                        className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Servidor Host SMTP</label>
                      <input
                        type="text"
                        required
                        value={mailConfig.cuenta_principal.host}
                        onChange={(e) =>
                          setMailConfig({
                            ...mailConfig,
                            cuenta_principal: { ...mailConfig.cuenta_principal, host: e.target.value },
                          })
                        }
                        placeholder="smtp.gmail.com o smtp.office365.com"
                        className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Puerto</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          required
                          value={mailConfig.cuenta_principal.port}
                          onChange={(e) =>
                            setMailConfig({
                              ...mailConfig,
                              cuenta_principal: {
                                ...mailConfig.cuenta_principal,
                                port: parseInt(e.target.value, 10) || 587,
                                secure: parseInt(e.target.value, 10) === 465,
                              },
                            })
                          }
                          className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMailConfig({
                              ...mailConfig,
                              cuenta_principal: { ...mailConfig.cuenta_principal, port: 587, secure: false },
                            })
                          }
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded font-mono"
                        >
                          587
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMailConfig({
                              ...mailConfig,
                              cuenta_principal: { ...mailConfig.cuenta_principal, port: 465, secure: true },
                            })
                          }
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded font-mono"
                        >
                          465
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Usuario / Email de Conexión</label>
                      <input
                        type="text"
                        required
                        value={mailConfig.cuenta_principal.user}
                        onChange={(e) =>
                          setMailConfig({
                            ...mailConfig,
                            cuenta_principal: { ...mailConfig.cuenta_principal, user: e.target.value },
                          })
                        }
                        placeholder="usuario@institucion.edu.ar"
                        className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">Contraseña / Token de Aplicación</label>
                        {(mailConfig.cuenta_principal as any)?.has_password ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                            🔑 Contraseña configurada
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                            ⚠️ Sin contraseña
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showMailPassword ? 'text' : 'password'}
                          value={mailConfig.cuenta_principal.password || ''}
                          onChange={(e) =>
                            setMailConfig({
                              ...mailConfig,
                              cuenta_principal: { ...mailConfig.cuenta_principal, password: e.target.value },
                            })
                          }
                          placeholder={
                            (mailConfig.cuenta_principal as any)?.has_password
                              ? '•••••••••••• (dejar en blanco para conservar)'
                              : 'Ingresa la contraseña o token...'
                          }
                          className="w-full p-2.5 pr-10 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMailPassword(!showMailPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                        >
                          {showMailPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {mailConfig.cuenta_principal.host?.includes('gmail.com') && (
                        <p className="text-[11px] text-blue-700 mt-1 bg-blue-50/60 p-2 rounded border border-blue-100">
                          💡 <strong>Gmail / Google:</strong> Requiere obligatoriamente una <em>Contraseña de Aplicación</em> de 16 caracteres (generada en <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-bold">myaccount.google.com/apppasswords</a>). No uses tu contraseña personal habitual.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mailConfig.cuenta_principal.secure}
                        onChange={(e) =>
                          setMailConfig({
                            ...mailConfig,
                            cuenta_principal: { ...mailConfig.cuenta_principal, secure: e.target.checked },
                          })
                        }
                        className="rounded text-blue-600"
                      />
                      <span>Conexión Cifrada SSL/TLS nativa (requerido para puerto 465)</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                      Parámetros de la Cuenta Secundaria
                    </span>
                    <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-0.5 rounded-full border border-purple-200">
                      Avisos Masivos y Respaldo Institucional
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="secundaria_activa"
                      checked={Boolean(mailConfig.cuenta_secundaria?.activo)}
                      onChange={(e) =>
                        setMailConfig({
                          ...mailConfig,
                          cuenta_secundaria: {
                            ...(mailConfig.cuenta_secundaria || {
                              id: 'secundaria',
                              nombre: 'Cuenta Secundaria',
                              host: 'smtp.gmail.com',
                              port: 587,
                              secure: false,
                              user: '',
                              password: '',
                              from: 'Avisos Congreso <avisos.dets@bue.edu.ar>',
                              activo: false,
                            }),
                            activo: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-purple-600"
                    />
                    <label htmlFor="secundaria_activa" className="text-xs font-bold text-gray-800 cursor-pointer">
                      Habilitar cuenta secundaria para emisión de avisos y contingencia
                    </label>
                  </div>

                  {mailConfig.cuenta_secundaria && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Descriptivo</label>
                          <input
                            type="text"
                            value={mailConfig.cuenta_secundaria.nombre}
                            onChange={(e) =>
                              setMailConfig({
                                ...mailConfig,
                                cuenta_secundaria: { ...mailConfig.cuenta_secundaria!, nombre: e.target.value },
                              })
                            }
                            className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Remitente (From)</label>
                          <input
                            type="text"
                            value={mailConfig.cuenta_secundaria.from}
                            onChange={(e) =>
                              setMailConfig({
                                ...mailConfig,
                                cuenta_secundaria: { ...mailConfig.cuenta_secundaria!, from: e.target.value },
                              })
                            }
                            className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-gray-700 mb-1">Servidor Host SMTP</label>
                          <input
                            type="text"
                            value={mailConfig.cuenta_secundaria.host}
                            onChange={(e) =>
                              setMailConfig({
                                ...mailConfig,
                                cuenta_secundaria: { ...mailConfig.cuenta_secundaria!, host: e.target.value },
                              })
                            }
                            className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Puerto</label>
                          <input
                            type="number"
                            value={mailConfig.cuenta_secundaria.port}
                            onChange={(e) =>
                              setMailConfig({
                                ...mailConfig,
                                cuenta_secundaria: {
                                  ...mailConfig.cuenta_secundaria!,
                                  port: parseInt(e.target.value, 10) || 587,
                                },
                              })
                            }
                            className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Usuario SMTP</label>
                          <input
                            type="text"
                            value={mailConfig.cuenta_secundaria.user}
                            onChange={(e) =>
                              setMailConfig({
                                ...mailConfig,
                                cuenta_secundaria: { ...mailConfig.cuenta_secundaria!, user: e.target.value },
                              })
                            }
                            className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-gray-700">Contraseña / Clave de App</label>
                            {(mailConfig.cuenta_secundaria as any)?.has_password ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                                🔑 Contraseña configurada
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                                ⚠️ Sin contraseña
                              </span>
                            )}
                          </div>
                          <input
                            type="password"
                            value={mailConfig.cuenta_secundaria.password || ''}
                            onChange={(e) =>
                              setMailConfig({
                                ...mailConfig,
                                cuenta_secundaria: { ...mailConfig.cuenta_secundaria!, password: e.target.value },
                              })
                            }
                            placeholder={
                              (mailConfig.cuenta_secundaria as any)?.has_password
                                ? '•••••••••••• (dejar en blanco para conservar)'
                                : 'Ingresa la contraseña o token...'
                            }
                            className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Vinculación de Servicios Emisores */}
              <div className="border-t pt-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                  ⚙️ Vinculación de Servicios Emisores Automáticos
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mailConfig.notificar_inscripcion}
                      onChange={(e) => setMailConfig({ ...mailConfig, notificar_inscripcion: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-gray-900">🎟️ Inscripción Confirmada</div>
                      <div className="text-gray-500">Despacho automático de credencial oficial y QR cifrado.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mailConfig.notificar_espera}
                      onChange={(e) => setMailConfig({ ...mailConfig, notificar_espera: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-gray-900">⏳ Lista de Espera FIFO</div>
                      <div className="text-gray-500">Aviso de recepción y orden de turno en cola por aforo lleno.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mailConfig.notificar_48hs}
                      onChange={(e) => setMailConfig({ ...mailConfig, notificar_48hs: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-gray-900">⏰ Reconfirmación 48hs</div>
                      <div className="text-gray-500">Envío de enlaces y tokens de confirmación pre-evento.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mailConfig.notificar_certificados}
                      onChange={(e) => setMailConfig({ ...mailConfig, notificar_certificados: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-gray-900">🎓 Certificados y Diplomas</div>
                      <div className="text-gray-500">Envío de diploma en PDF y enlace criptográfico de validación.</div>
                    </div>
                  </label>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧪</span>
                    <div className="text-xs text-amber-900">
                      <strong className="font-bold">Modo Sandbox Institucional:</strong> Simula el despacho y audita los correos en la base de datos sin enviarlos a servidores externos cuando no se cuenta con credenciales activas.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mailConfig.sandbox_mode}
                    onChange={(e) => setMailConfig({ ...mailConfig, sandbox_mode: e.target.checked })}
                    className="rounded text-amber-600 ml-4"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingMail}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  {isSavingMail ? '⏳ Guardando...' : '💾 Guardar Parámetros de Correo'}
                </button>
              </div>
            </form>
            ) : (
              /* EDITOR VISUAL DE PLANTILLA INSTITUCIONAL DE CORREO */
              <div className="space-y-6">
                <form onSubmit={handleSaveMailTemplate} className="space-y-6">
                  {/* CONFIGURACIÓN DEL ENCABEZADO (HEADER) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🖼️</span>
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Encabezado del Correo (Header)</h4>
                          <p className="text-[11px] text-gray-500">Cabecera gráfica y membrete superior en todos los despachos oficiales.</p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mailTemplate.header.activo}
                          onChange={(e) =>
                            setMailTemplate({
                              ...mailTemplate,
                              header: { ...mailTemplate.header, activo: e.target.checked },
                            })
                          }
                          className="rounded text-purple-600"
                        />
                        <span>Mostrar Encabezado</span>
                      </label>
                    </div>

                    {mailTemplate.header.activo && (
                      <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Modo de Encabezado</label>
                            <select
                              value={mailTemplate.header.modo}
                              onChange={(e) =>
                                setMailTemplate({
                                  ...mailTemplate,
                                  header: { ...mailTemplate.header, modo: e.target.value as any },
                                })
                              }
                              className="w-full p-2 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                            >
                              <option value="imagen">🖼️ Imagen Oficial (Header.png GCABA / URL)</option>
                              <option value="texto">✍️ Banner Tipográfico (Título + Subtítulo)</option>
                              <option value="mixto">🔀 Mixto (Imagen Superior + Banda Institucional)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Color de Fondo</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={mailTemplate.header.fondo_color || '#003865'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    header: { ...mailTemplate.header, fondo_color: e.target.value },
                                  })
                                }
                                className="h-8 w-10 p-0.5 border rounded cursor-pointer"
                              />
                              <input
                                type="text"
                                value={mailTemplate.header.fondo_color || '#003865'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    header: { ...mailTemplate.header, fondo_color: e.target.value },
                                  })
                                }
                                className="w-full p-2 text-xs border rounded-lg font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Color de Texto</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={mailTemplate.header.texto_color || '#ffffff'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    header: { ...mailTemplate.header, texto_color: e.target.value },
                                  })
                                }
                                className="h-8 w-10 p-0.5 border rounded cursor-pointer"
                              />
                              <input
                                type="text"
                                value={mailTemplate.header.texto_color || '#ffffff'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    header: { ...mailTemplate.header, texto_color: e.target.value },
                                  })
                                }
                                className="w-full p-2 text-xs border rounded-lg font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {(mailTemplate.header.modo === 'imagen' || mailTemplate.header.modo === 'mixto') && (
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              URL Externa de Imagen (dejar en blanco para usar Header.png oficial de GCABA)
                            </label>
                            <input
                              type="text"
                              value={mailTemplate.header.imagen_url || ''}
                              onChange={(e) =>
                                setMailTemplate({
                                  ...mailTemplate,
                                  header: { ...mailTemplate.header, imagen_url: e.target.value },
                                })
                              }
                              placeholder="https://... o dejar vacío para cid:gcaba_mailing_header"
                              className="w-full p-2 text-xs border rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">
                              💡 Por defecto utiliza la imagen institucional embebida de <code className="bg-gray-100 px-1 rounded">backend/assets/mailing/Header.png</code>.
                            </p>
                          </div>
                        )}

                        {(mailTemplate.header.modo === 'texto' || mailTemplate.header.modo === 'mixto') && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Título Principal</label>
                              <input
                                type="text"
                                value={mailTemplate.header.titulo_texto || ''}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    header: { ...mailTemplate.header, titulo_texto: e.target.value },
                                  })
                                }
                                placeholder="1er Congreso de Educación Técnica Superior"
                                className="w-full p-2 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Subtítulo / Dependencia</label>
                              <input
                                type="text"
                                value={mailTemplate.header.subtitulo_texto || ''}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    header: { ...mailTemplate.header, subtitulo_texto: e.target.value },
                                  })
                                }
                                placeholder="DETS · Ministerio de Educación GCABA"
                                className="w-full p-2 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CONFIGURACIÓN DEL PIE (FOOTER) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🦶</span>
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Pie del Correo (Footer)</h4>
                          <p className="text-[11px] text-gray-500">Cierre institucional, domicilio de la sede, menciones de ley y enlaces oficiales.</p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mailTemplate.footer.activo}
                          onChange={(e) =>
                            setMailTemplate({
                              ...mailTemplate,
                              footer: { ...mailTemplate.footer, activo: e.target.checked },
                            })
                          }
                          className="rounded text-purple-600"
                        />
                        <span>Mostrar Pie</span>
                      </label>
                    </div>

                    {mailTemplate.footer.activo && (
                      <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Modo de Pie</label>
                            <select
                              value={mailTemplate.footer.modo}
                              onChange={(e) =>
                                setMailTemplate({
                                  ...mailTemplate,
                                  footer: { ...mailTemplate.footer, modo: e.target.value as any },
                                })
                              }
                              className="w-full p-2 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                            >
                              <option value="mixto">🔀 Mixto (Imagen de Gobierno + Texto y Sede)</option>
                              <option value="texto">✍️ Solo Texto (Sede e Información Legal)</option>
                              <option value="imagen">🖼️ Solo Imagen Institucional</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Color Fondo Pie</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={mailTemplate.footer.fondo_color || '#f8fafc'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    footer: { ...mailTemplate.footer, fondo_color: e.target.value },
                                  })
                                }
                                className="h-8 w-10 p-0.5 border rounded cursor-pointer"
                              />
                              <input
                                type="text"
                                value={mailTemplate.footer.fondo_color || '#f8fafc'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    footer: { ...mailTemplate.footer, fondo_color: e.target.value },
                                  })
                                }
                                className="w-full p-2 text-xs border rounded-lg font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Color Texto Pie</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={mailTemplate.footer.texto_color || '#64748b'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    footer: { ...mailTemplate.footer, texto_color: e.target.value },
                                  })
                                }
                                className="h-8 w-10 p-0.5 border rounded cursor-pointer"
                              />
                              <input
                                type="text"
                                value={mailTemplate.footer.texto_color || '#64748b'}
                                onChange={(e) =>
                                  setMailTemplate({
                                    ...mailTemplate,
                                    footer: { ...mailTemplate.footer, texto_color: e.target.value },
                                  })
                                }
                                className="w-full p-2 text-xs border rounded-lg font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {(mailTemplate.footer.modo === 'imagen' || mailTemplate.footer.modo === 'mixto') && (
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              URL Externa de Imagen Pie (dejar en blanco para usar Footer.png oficial GCABA)
                            </label>
                            <input
                              type="text"
                              value={mailTemplate.footer.imagen_url || ''}
                              onChange={(e) =>
                                setMailTemplate({
                                  ...mailTemplate,
                                  footer: { ...mailTemplate.footer, imagen_url: e.target.value },
                                })
                              }
                              placeholder="https://... o dejar vacío para cid:gcaba_mailing_footer"
                              className="w-full p-2 text-xs border rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                        )}

                        {(mailTemplate.footer.modo === 'texto' || mailTemplate.footer.modo === 'mixto') && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Línea 1 (Organismo Responsable)</label>
                                <input
                                  type="text"
                                  value={mailTemplate.footer.linea1}
                                  onChange={(e) =>
                                    setMailTemplate({
                                      ...mailTemplate,
                                      footer: { ...mailTemplate.footer, linea1: e.target.value },
                                    })
                                  }
                                  placeholder="Dirección de Educación Técnica Superior · Ministerio de Educación GCABA"
                                  className="w-full p-2 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Línea 2 (Sede y Fecha)</label>
                                <input
                                  type="text"
                                  value={mailTemplate.footer.linea2}
                                  onChange={(e) =>
                                    setMailTemplate({
                                      ...mailTemplate,
                                      footer: { ...mailTemplate.footer, linea2: e.target.value },
                                    })
                                  }
                                  placeholder="Sede: Galván 3710, Auditorio Polo Saavedra, CABA · 6 de Noviembre de 2026"
                                  className="w-full p-2 text-xs border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Enlace de Contacto (Opcional)</label>
                                <input
                                  type="text"
                                  value={mailTemplate.footer.enlace_contacto_url || ''}
                                  onChange={(e) =>
                                    setMailTemplate({
                                      ...mailTemplate,
                                      footer: { ...mailTemplate.footer, enlace_contacto_url: e.target.value },
                                    })
                                  }
                                  placeholder="mailto:congreso.ets2026@bue.edu.ar o https://..."
                                  className="w-full p-2 text-xs border rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Enlace de Privacidad / Términos (Opcional)</label>
                                <input
                                  type="text"
                                  value={mailTemplate.footer.enlace_privacidad_url || ''}
                                  onChange={(e) =>
                                    setMailTemplate({
                                      ...mailTemplate,
                                      footer: { ...mailTemplate.footer, enlace_privacidad_url: e.target.value },
                                    })
                                  }
                                  placeholder="https://buenosaires.gob.ar/terminos-y-condiciones"
                                  className="w-full p-2 text-xs border rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ESTILOS GLOBALES DEL CORREO */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <span className="text-lg">🎨</span>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Estilos y Colores Globales del Correo</h4>
                        <p className="text-[11px] text-gray-500">Paleta armónica aplicada a títulos, botones de acción y fondos de caja.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Color Primario (Títulos)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={mailTemplate.estilos.color_primario}
                            onChange={(e) =>
                              setMailTemplate({
                                ...mailTemplate,
                                estilos: { ...mailTemplate.estilos, color_primario: e.target.value },
                              })
                            }
                            className="h-8 w-10 p-0.5 border rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={mailTemplate.estilos.color_primario}
                            onChange={(e) =>
                              setMailTemplate({
                                ...mailTemplate,
                                estilos: { ...mailTemplate.estilos, color_primario: e.target.value },
                              })
                            }
                            className="w-full p-2 text-xs border rounded-lg font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Color Secundario (Bordes/Avisos)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={mailTemplate.estilos.color_secundario}
                            onChange={(e) =>
                              setMailTemplate({
                                ...mailTemplate,
                                estilos: { ...mailTemplate.estilos, color_secundario: e.target.value },
                              })
                            }
                            className="h-8 w-10 p-0.5 border rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={mailTemplate.estilos.color_secundario}
                            onChange={(e) =>
                              setMailTemplate({
                                ...mailTemplate,
                                estilos: { ...mailTemplate.estilos, color_secundario: e.target.value },
                              })
                            }
                            className="w-full p-2 text-xs border rounded-lg font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Color de Botón Principal</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={mailTemplate.estilos.color_boton}
                            onChange={(e) =>
                              setMailTemplate({
                                ...mailTemplate,
                                estilos: { ...mailTemplate.estilos, color_boton: e.target.value },
                              })
                            }
                            className="h-8 w-10 p-0.5 border rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={mailTemplate.estilos.color_boton}
                            onChange={(e) =>
                              setMailTemplate({
                                ...mailTemplate,
                                estilos: { ...mailTemplate.estilos, color_boton: e.target.value },
                              })
                            }
                            className="w-full p-2 text-xs border rounded-lg font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOTONES DE ACCIÓN DEL FORMULARIO DE PLANTILLA */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => loadMailTemplatePreview(mailTemplate)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    >
                      🔄 Actualizar Previsualización
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingMailTemplate}
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                    >
                      {isSavingMailTemplate ? '⏳ Guardando...' : '💾 Guardar Plantilla de Correo'}
                    </button>
                  </div>
                </form>

                {/* PREVISUALIZACIÓN EN VIVO (LIVE PREVIEW) */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                        <span>👁️</span>
                        <span>Previsualización en Tiempo Real de Correos</span>
                      </h4>
                      <p className="text-xs text-gray-500">Muestra el renderizado exacto del correo con encabezado y pie configurados.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">Ejemplo:</span>
                      <select
                        value={previewSampleType}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setPreviewSampleType(val);
                          loadMailTemplatePreview(mailTemplate, val);
                        }}
                        className="p-1.5 text-xs border rounded-lg bg-white font-bold text-gray-800 outline-none"
                      >
                        <option value="inscripcion">🎟️ Inscripción Confirmada</option>
                        <option value="espera">⏳ Lista de Espera FIFO</option>
                        <option value="certificado">🎓 Certificado Oficial</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-center p-4 bg-slate-200/70 rounded-xl overflow-hidden min-h-[350px] relative">
                    {isLoadingPreview ? (
                      <div className="flex items-center justify-center p-12 text-xs font-bold text-gray-600">
                        ⏳ Generando previsualización de correo...
                      </div>
                    ) : previewHtml ? (
                      <iframe
                        srcDoc={previewHtml}
                        title="Previsualización de Correo"
                        className="w-full max-w-[640px] h-[550px] bg-white rounded-lg shadow-md border border-gray-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center p-12 text-xs text-gray-500">
                        Haz clic en &quot;Actualizar Previsualización&quot; para cargar el correo modelo.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panel de Prueba de Conexión SMTP */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <span>🧪</span>
              <span>Comprobar Conexión SMTP y Enviar Correo de Prueba</span>
            </h4>
            <p className="text-xs text-gray-500">
              Verifica el handshake de autenticación con el servidor host y opcionalmente despacha un email institucional de prueba para validar que los buzones de destino lo reciban sin rechazos.
            </p>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700">Objetivo de prueba:</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold border border-blue-200">
                {activeMailSubtab === 'secundaria' ? 'Cuenta Secundaria' : 'Cuenta Principal'}
              </span>
              <span className="text-gray-300 hidden sm:inline">|</span>
              {mailConfig.sandbox_mode ? (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-bold border border-amber-200 flex items-center gap-1">
                  <span>🧪</span>
                  <span>Modo Sandbox (Simulado)</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-green-50 text-green-800 rounded font-bold border border-green-200 flex items-center gap-1">
                  <span>🌐</span>
                  <span>Servidor SMTP Real</span>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                type="email"
                placeholder="Ingresa un correo destinatario (ej. tu_email@bue.edu.ar)..."
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                className="w-full sm:w-80 p-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleTestMail}
                disabled={isTestingMail}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {isTestingMail ? '⏳ Conectando...' : '🚀 Probar Envío Inmediato'}
              </button>
            </div>

            {testMailResult && (
              <div
                className={`p-3.5 rounded-lg text-xs border ${
                  testMailResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span>{testMailResult.success ? '✅' : '❌'}</span>
                  <span>{testMailResult.success ? 'Prueba Exitosa' : 'Fallo de Conexión'}</span>
                </div>
                <div className="mt-1 font-mono text-[11px]">{testMailResult.message}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: NOTIFICACIONES WEB PUSH */}
      {tab === 'push' && (
        <div className="space-y-6">
          {/* Métricas de Dispositivos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dispositivos Suscritos</span>
              <p className="text-3xl font-extrabold text-blue-700 mt-2">{pushStats?.total_dispositivos || 0}</p>
              <span className="text-xs text-gray-500">Navegadores y teléfonos con push activo</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asistentes Vinculados</span>
              <p className="text-3xl font-extrabold text-emerald-700 mt-2">{pushStats?.usuarios_vinculados || 0}</p>
              <span className="text-xs text-gray-500">Suscripciones atadas a una credencial</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado de Claves VAPID</span>
              <p className="text-xs font-mono text-gray-800 mt-2 truncate bg-gray-50 p-1.5 rounded border">
                {pushStats?.vapid_public_key || 'Configurada'}
              </p>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-xs text-green-600 font-bold">● VAPID Activo</span>
                <button
                  type="button"
                  onClick={handleRegenerateVapid}
                  disabled={isRegeneratingVapid}
                  className="text-[11px] text-red-600 hover:text-red-800 font-bold hover:underline"
                >
                  {isRegeneratingVapid ? '⏳...' : 'Regenerar Claves'}
                </button>
              </div>
            </div>
          </div>

          {/* Formulario de Emisión de Notificación Push */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <span>🔔</span>
                <span>Despacho de Avisos Push en Tiempo Real</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Emite alertas instantáneas en los dispositivos móviles y navegadores de los participantes, incluso si la pestaña está cerrada (Service Worker).
              </p>
            </div>

            <form onSubmit={handleBroadcastPush} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Título de la Notificación</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Apertura oficial en 15 minutos en el Aula Magna"
                    value={pushForm.title}
                    onChange={(e) => setPushForm({ ...pushForm, title: e.target.value })}
                    className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Enlace de Destino al Tocar (URL)</label>
                  <input
                    type="text"
                    placeholder="/mi-credencial o /actividades"
                    value={pushForm.url}
                    onChange={(e) => setPushForm({ ...pushForm, url: e.target.value })}
                    className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Cuerpo del Mensaje</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Escribe el mensaje institucional que verán los asistentes en su pantalla de bloqueo o centro de notificaciones..."
                  value={pushForm.body}
                  onChange={(e) => setPushForm({ ...pushForm, body: e.target.value })}
                  className="w-full p-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Segmentación de Destinatarios */}
              <div className="p-4 bg-gray-50 border rounded-xl space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                  🎯 Segmentación de Destinatarios
                </span>

                <div className="flex flex-wrap gap-4 items-center text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800">
                    <input
                      type="radio"
                      name="pushSegment"
                      checked={!pushForm.solo_acreditados && pushForm.rol_id === null}
                      onChange={() => setPushForm({ ...pushForm, solo_acreditados: false, rol_id: null })}
                      className="text-blue-600"
                    />
                    <span>Todos los Dispositivos ({pushStats?.total_dispositivos || 0})</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800">
                    <input
                      type="radio"
                      name="pushSegment"
                      checked={pushForm.solo_acreditados}
                      onChange={() => setPushForm({ ...pushForm, solo_acreditados: true, rol_id: null })}
                      className="text-blue-600"
                    />
                    <span>🎟️ Solo Asistentes en Sala (Acreditados Hoy)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800">
                    <input
                      type="radio"
                      name="pushSegment"
                      checked={!pushForm.solo_acreditados && pushForm.rol_id !== null}
                      onChange={() => setPushForm({ ...pushForm, solo_acreditados: false, rol_id: 1 })}
                      className="text-blue-600"
                    />
                    <span>👥 Segmentar por Rol</span>
                  </label>
                </div>

                {!pushForm.solo_acreditados && pushForm.rol_id !== null && (
                  <div className="pt-2">
                    <select
                      value={pushForm.rol_id || 1}
                      onChange={(e) => setPushForm({ ...pushForm, rol_id: parseInt(e.target.value, 10) })}
                      className="p-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre} (Jerarquía {r.jerarquia})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-2 border-t flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pushUrgente"
                    checked={pushForm.urgente}
                    onChange={(e) => setPushForm({ ...pushForm, urgente: e.target.checked })}
                    className="rounded text-red-600"
                  />
                  <label htmlFor="pushUrgente" className="text-xs font-bold text-red-700 cursor-pointer flex items-center gap-1">
                    <span>🚨 Alerta de Prioridad Urgente</span>
                    <span className="text-gray-500 font-normal">(vibración prolongada y pantalla despierta)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isBroadcastingPush}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2"
                >
                  {isBroadcastingPush ? '⏳ Despachando...' : '🚀 Despachar Notificación Push'}
                </button>
              </div>
            </form>

            {pushBroadcastResult && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 mt-3 flex items-center justify-between">
                <span>
                  ✅ Broadcast completado: <strong>{pushBroadcastResult.sent}</strong> entregadas con éxito,{' '}
                  <strong>{pushBroadcastResult.failed}</strong> fallidas de un total de {pushBroadcastResult.total}.
                </span>
                <button
                  type="button"
                  onClick={() => setPushBroadcastResult(null)}
                  className="text-blue-700 hover:text-blue-900 font-bold ml-4"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: EDITOR Y SELECTOR DE TEMAS DEL BACKEND */}
      {tab === 'temas' && (
        <AdminThemeEditor onNotice={onNotice} />
      )}

      {/* TAB 9: EDITOR Y SELECTOR DE TEMAS DEL FRONTEND */}
      {tab === 'temas-frontend' && (
        <AdminFrontendThemeEditor onNotice={onNotice} />
      )}

      {/* TAB 10: JOURNALING & DIAGNÓSTICO DE ERRORES */}
      {tab === 'journaling' && (
        <AdminJournalingView onNotice={onNotice} />
      )}

      {/* MODAL MODIFICAR PARÁMETRO */}
      {isEditParamOpen && currentParam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">⚙️ Modificar Parámetro</h3>
            <form onSubmit={handleUpdateParam} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">Clave de Sistema</label>
                <input
                  type="text"
                  disabled
                  value={currentParam.clave}
                  className="w-full mt-1 p-2 text-sm border bg-gray-50 rounded-lg font-mono text-gray-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Descripción</label>
                <input
                  type="text"
                  value={currentParam.descripcion || ''}
                  onChange={(e) => setCurrentParam({ ...currentParam, descripcion: e.target.value })}
                  className="w-full mt-1 p-2 text-sm border rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Valor JSON (Estructurado)</label>
                <textarea
                  rows={6}
                  required
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  className="w-full mt-1 p-2 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditParamOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                >
                  Guardar Parámetro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR ROL */}
      {isRolModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              {currentRol ? '✏️ Editar Rol Institucional' : '➕ Nuevo Rol Institucional'}
            </h3>
            <form onSubmit={handleSaveRol} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">Nombre del Rol</label>
                <input
                  type="text"
                  required
                  value={rolForm.nombre}
                  onChange={(e) => setRolForm({ ...rolForm, nombre: e.target.value })}
                  placeholder="Ej: Becario, Jurado, Prensa..."
                  className="w-full mt-1 p-2 text-sm border rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Descripción</label>
                <input
                  type="text"
                  value={rolForm.descripcion}
                  onChange={(e) => setRolForm({ ...rolForm, descripcion: e.target.value })}
                  placeholder="Alcance pedagógico o institucional..."
                  className="w-full mt-1 p-2 text-sm border rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Jerarquía del Rol (Nivel 1 a 5)</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={rolForm.jerarquia}
                    onChange={(e) => {
                      const newJerarquia = Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1));
                      // Filtrar permisos existentes que ya no sean permitidos por la nueva jerarquía
                      const maxItems = [
                        { key: 'dashboard', min: 3 },
                        { key: 'estadisticas_5ejes', min: 3 },
                        { key: 'usuarios', min: 3 },
                        { key: 'acreditaciones', min: 3 },
                        { key: 'actividades', min: 4 },
                        { key: 'presentadores', min: 4 },
                        { key: 'catalogo', min: 4 },
                        { key: 'homologaciones', min: 4 },
                        { key: 'certificados', min: 4 },
                        { key: 'encuestas', min: 4 },
                        { key: 'manuales', min: 3 },
                        { key: 'puntos', min: 4 },
                        { key: 'eventos', min: 4 },
                        { key: 'operadores', min: 5 },
                        { key: 'blacklist', min: 5 },
                        { key: 'auditoria', min: 5 },
                        { key: 'configuracion', min: 5 },
                        { key: 'frontend_cms', min: 3 },
                        { key: 'cron', min: 5 },
                      ];
                      const filteredPermisos = rolForm.permisos.filter(
                        (p) => (maxItems.find((m) => m.key === p)?.min || 5) <= newJerarquia
                      );
                      setRolForm({ ...rolForm, jerarquia: newJerarquia, permisos: filteredPermisos });
                    }}
                    className="w-24 p-2 text-sm border rounded-lg font-bold text-center"
                  />
                  <div className="text-xs text-gray-500">
                    {rolForm.jerarquia <= 2 && 'Roles de Asistencia / Participantes (sin acceso administrativo a la botonera)'}
                    {rolForm.jerarquia === 3 && 'Operador General / Acreditador (Acceso a Operaciones y Manuales)'}
                    {rolForm.jerarquia === 4 && 'Gestor Académico / Supervisor de Recintos'}
                    {rolForm.jerarquia >= 5 && 'Administrador de Seguridad / Superadmin (Acceso Total)'}
                  </div>
                </div>
              </div>

              {/* MATRIZ DE PERMISOS GRANULARES DE ACCESO */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Permisos Granulares de Acceso (Botonera)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {rolForm.jerarquia >= 5
                        ? 'Los operadores de nivel 5 acceden a todas las opciones automáticamente.'
                        : 'Seleccioná qué módulos específicos estarán habilitados para este rol.'}
                    </p>
                  </div>

                  {rolForm.jerarquia < 5 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ALL_ACCESSIBLE = [
                            { key: 'dashboard', min: 3 },
                            { key: 'estadisticas_5ejes', min: 3 },
                            { key: 'usuarios', min: 3 },
                            { key: 'acreditaciones', min: 3 },
                            { key: 'actividades', min: 4 },
                            { key: 'presentadores', min: 4 },
                            { key: 'catalogo', min: 4 },
                            { key: 'homologaciones', min: 4 },
                            { key: 'certificados', min: 4 },
                            { key: 'encuestas', min: 4 },
                            { key: 'manuales', min: 3 },
                            { key: 'puntos', min: 4 },
                            { key: 'eventos', min: 4 },
                            { key: 'operadores', min: 5 },
                            { key: 'blacklist', min: 5 },
                            { key: 'auditoria', min: 5 },
                            { key: 'configuracion', min: 5 },
                            { key: 'frontend_cms', min: 3 },
                            { key: 'cron', min: 5 },
                          ]
                            .filter((m) => m.min <= rolForm.jerarquia)
                            .map((m) => m.key);
                          setRolForm({ ...rolForm, permisos: ALL_ACCESSIBLE });
                        }}
                        className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition cursor-pointer"
                      >
                        ✓ Marcar permitidos
                      </button>
                      <button
                        type="button"
                        onClick={() => setRolForm({ ...rolForm, permisos: [] })}
                        className="px-2 py-1 text-[11px] font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded transition cursor-pointer"
                      >
                        Desmarcar
                      </button>
                    </div>
                  )}
                </div>

                {/* GRUPOS DE CHECKBOXES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
                  {[
                    {
                      categoria: 'OPERACIONES & ASISTENCIA',
                      minGrupo: 3,
                      items: [
                        { key: 'dashboard', label: 'Tablero 360° (Métricas)', icon: '📊', min: 3 },
                        { key: 'estadisticas_5ejes', label: 'Estadísticas Analíticas (5 Ejes)', icon: '📈', min: 3 },
                        { key: 'usuarios', label: 'Gestión de Participantes (CRUD)', icon: '👥', min: 3 },
                        { key: 'acreditaciones', label: 'Control de Accesos en Vivo (Scans)', icon: '🎟️', min: 3 },
                      ],
                    },
                    {
                      categoria: 'GESTIÓN ACADÉMICA',
                      minGrupo: 4,
                      items: [
                        { key: 'actividades', label: 'Actividades & Cronograma', icon: '📅', min: 4 },
                        { key: 'presentadores', label: 'Presentadores & Ponentes', icon: '🎤', min: 4 },
                        { key: 'catalogo', label: 'Materias Canónicas y Áreas', icon: '📋', min: 4 },
                        { key: 'homologaciones', label: 'Homologación de Expositores', icon: '🎖️', min: 4 },
                        { key: 'certificados', label: 'Certificados Oficiales', icon: '🎓', min: 4 },
                        { key: 'encuestas', label: 'Encuestas de Calidad y Feedback', icon: '📋', min: 4 },
                        { key: 'manuales', label: 'Manuales Oficiales (Exportación PDF)', icon: '📖', min: 3 },
                      ],
                    },
                    {
                      categoria: 'INFRAESTRUCTURA & SEDE',
                      minGrupo: 4,
                      items: [
                        { key: 'puntos', label: 'Recintos, Salas & Puntos de Acceso', icon: '🏢', min: 4 },
                        { key: 'eventos', label: 'Ediciones & Eventos Oficiales', icon: '🏛️', min: 4 },
                        { key: 'frontend_cms', label: 'CMS Frontend (Tarjetas)', icon: '🎴', min: 3 },
                      ],
                    },
                    {
                      categoria: 'SEGURIDAD & ADMINISTRACIÓN',
                      minGrupo: 5,
                      items: [
                        { key: 'operadores', label: 'Operadores del Sistema', icon: '🛡️', min: 5 },
                        { key: 'blacklist', label: 'Lista Negra de Exclusiones', icon: '🚫', min: 5 },
                        { key: 'auditoria', label: 'Bitácora Forense de Auditoría', icon: '📜', min: 5 },
                        { key: 'configuracion', label: 'Parámetros del Sistema', icon: '⚙️', min: 5 },
                        { key: 'cron', label: 'Procesos Asíncronos (Cron Jobs)', icon: '⏱️', min: 5 },
                      ],
                    },
                  ].map((grupo) => (
                    <div
                      key={grupo.categoria}
                      className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700 uppercase tracking-wider border-b pb-1">
                        <span>{grupo.categoria}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Nivel {grupo.minGrupo}+</span>
                      </div>

                      <div className="space-y-1">
                        {grupo.items.map((item) => {
                          const isLevelAllowed = rolForm.jerarquia >= item.min;
                          const isChecked = rolForm.permisos.includes(item.key);

                          return (
                            <label
                              key={item.key}
                              className={`flex items-start gap-2 p-1.5 rounded-md transition text-xs select-none ${
                                !isLevelAllowed
                                  ? 'opacity-40 bg-slate-100 cursor-not-allowed text-slate-400'
                                  : isChecked
                                  ? 'bg-blue-50/70 border border-blue-200 text-blue-900 cursor-pointer font-medium'
                                  : 'hover:bg-slate-50 cursor-pointer text-slate-700'
                              }`}
                              title={
                                !isLevelAllowed
                                  ? `Inhabilitado: Requiere Nivel ${item.min} o superior (el rol actual tiene Nivel ${rolForm.jerarquia})`
                                  : undefined
                              }
                            >
                              <input
                                type="checkbox"
                                disabled={!isLevelAllowed}
                                checked={isChecked && isLevelAllowed}
                                onChange={(e) => {
                                  if (!isLevelAllowed) return;
                                  if (e.target.checked) {
                                    setRolForm({
                                      ...rolForm,
                                      permisos: [...rolForm.permisos, item.key],
                                    });
                                  } else {
                                    setRolForm({
                                      ...rolForm,
                                      permisos: rolForm.permisos.filter((p) => p !== item.key),
                                    });
                                  }
                                }}
                                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-40 shrink-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate flex items-center gap-1 text-[11px]">
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                  </span>
                                  {!isLevelAllowed && (
                                    <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 rounded shrink-0 border border-rose-200">
                                      Req. Nivel {item.min}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsRolModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
                >
                  Guardar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR TIPO ACREDITACIÓN */}
      {isTipoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">➕ Nuevo Tipo de Acreditación</h3>
            <form onSubmit={handleSaveTipo} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">Código</label>
                <input
                  type="text"
                  required
                  value={tipoForm.codigo}
                  onChange={(e) => setTipoForm({ ...tipoForm, codigo: e.target.value })}
                  placeholder="Ej: TALLER_ESPECIAL"
                  className="w-full mt-1 p-2 text-sm border rounded-lg uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Descripción</label>
                <input
                  type="text"
                  required
                  value={tipoForm.descripcion}
                  onChange={(e) => setTipoForm({ ...tipoForm, descripcion: e.target.value })}
                  placeholder="Ej: Acceso exclusivo a laboratorio"
                  className="w-full mt-1 p-2 text-sm border rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tipoForm.requiere_actividad}
                  onChange={(e) => setTipoForm({ ...tipoForm, requiere_actividad: e.target.checked })}
                />
                <span>Requiere estar asignado a una actividad específica</span>
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsTipoModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
                >
                  Guardar Tipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR CATEGORÍA TEMÁTICA */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">➕ Nueva Categoría Temática</h3>
            <form onSubmit={handleSaveCategoria} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">Nombre de la Categoría</label>
                <input
                  type="text"
                  required
                  value={catForm.nombre}
                  onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
                  placeholder="Ej: Inteligencia Artificial en Educación"
                  className="w-full mt-1 p-2 text-sm border rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Descripción</label>
                <input
                  type="text"
                  value={catForm.descripcion}
                  onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
                  placeholder="Alcance temático..."
                  className="w-full mt-1 p-2 text-sm border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESTAURAR BACKUP SELECTIVO */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>⚠️</span> Restaurar Copia de Seguridad
            </h3>
            <p className="text-xs text-gray-600">
              Vas a restaurar datos desde el archivo <strong className="font-mono text-blue-700">{restoreTarget.filename}</strong>.
              Selecciona el alcance modular de la restauración:
            </p>

            <div className="space-y-2 text-xs">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                restoreMode === 'completo' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="restoreMode"
                  value="completo"
                  checked={restoreMode === 'completo'}
                  onChange={() => setRestoreMode('completo')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-gray-900">Restauración Integral Completa</div>
                  <div className="text-gray-500">Restaura todas las tablas del sistema (Usuarios, Configuración y Operación).</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                restoreMode === 'operacion' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="restoreMode"
                  value="operacion"
                  checked={restoreMode === 'operacion'}
                  onChange={() => setRestoreMode('operacion')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-gray-900">Solo Datos de la Operación</div>
                  <div className="text-gray-500">Restablece acreditaciones, asistencias, inscripciones, certificados y encuestas sin tocar roles ni usuarios.</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                restoreMode === 'configuracion' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="restoreMode"
                  value="configuracion"
                  checked={restoreMode === 'configuracion'}
                  onChange={() => setRestoreMode('configuracion')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-gray-900">Solo Datos de Configuración</div>
                  <div className="text-gray-500">Restablece parámetros globales, eventos, actividades institucionales y preguntas de encuestas.</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                restoreMode === 'usuarios' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="restoreMode"
                  value="usuarios"
                  checked={restoreMode === 'usuarios'}
                  onChange={() => setRestoreMode('usuarios')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-gray-900">Solo Datos de Usuarios</div>
                  <div className="text-gray-500">Restablece padrón de inscriptos, operadores y listas de restricción.</div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                disabled={isRestoring}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
              >
                {isRestoring ? '⏳ Restaurando...' : 'Confirmar Restauración'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
