import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { query } from './db';

export interface SmtpAccountConfig {
  id: string; // 'principal' | 'secundaria'
  nombre: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  from: string;
  activo: boolean;
}

export interface MailTemplateConfig {
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

export const DEFAULT_MAIL_TEMPLATE: MailTemplateConfig = {
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
};

let cachedMailTemplate: MailTemplateConfig | null = null;

export async function getMailTemplate(): Promise<MailTemplateConfig> {
  if (cachedMailTemplate) return cachedMailTemplate;
  try {
    const res = await query(`SELECT valor FROM configuraciones_sistema WHERE clave = 'plantilla_correo_institucional' LIMIT 1`);
    if (res.rows.length > 0 && res.rows[0].valor) {
      const loaded: MailTemplateConfig = {
        ...DEFAULT_MAIL_TEMPLATE,
        ...res.rows[0].valor,
        header: { ...DEFAULT_MAIL_TEMPLATE.header, ...(res.rows[0].valor.header || {}) },
        footer: { ...DEFAULT_MAIL_TEMPLATE.footer, ...(res.rows[0].valor.footer || {}) },
        estilos: { ...DEFAULT_MAIL_TEMPLATE.estilos, ...(res.rows[0].valor.estilos || {}) },
      };
      cachedMailTemplate = loaded;
      return loaded;
    }
  } catch (err) {
    console.warn('Error cargando plantilla_correo_institucional de BD:', err);
  }
  return DEFAULT_MAIL_TEMPLATE;
}

export async function saveMailTemplate(tpl: MailTemplateConfig, actorUsuario: string = 'SUPERADMIN'): Promise<void> {
  cachedMailTemplate = null;
  await query(
    `INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, actualizado_en)
     VALUES ('plantilla_correo_institucional', $1, 'Plantilla de diseño institucional para correos electrónicos (Header, Footer, colores)', 'CORREO', NOW())
     ON CONFLICT (clave) DO UPDATE SET
       valor = EXCLUDED.valor,
       descripcion = EXCLUDED.descripcion,
       categoria = 'CORREO',
       actualizado_en = NOW()`,
    [JSON.stringify(tpl)]
  );

  await query(
    `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
     VALUES ('configuraciones_sistema', 'ACTUALIZAR_PLANTILLA_CORREO', $1, $2)`,
    [actorUsuario, JSON.stringify({ clave: 'plantilla_correo_institucional', updated: true })]
  ).catch(() => {});
}

export interface MailSettings {
  cuenta_principal: SmtpAccountConfig;
  cuenta_secundaria?: SmtpAccountConfig;
  sandbox_mode: boolean;
  notificar_inscripcion: boolean;
  notificar_espera: boolean;
  notificar_48hs: boolean;
  notificar_certificados: boolean;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  account?: 'principal' | 'secundaria';
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
    cid?: string;
  }>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

let cachedSettings: MailSettings | null = null;
let cachedTransporters: { [key: string]: any } = {};

/**
 * Obtiene la configuración de cuentas de correo desde la base de datos o defaults
 */
export async function getMailSettings(): Promise<MailSettings> {
  if (cachedSettings) return cachedSettings;

  try {
    const res = await query(`SELECT valor FROM configuraciones_sistema WHERE clave = 'cuentas_correo'`);
    if (res.rows.length > 0 && res.rows[0].valor?.cuenta_principal) {
      cachedSettings = res.rows[0].valor as MailSettings;
      return cachedSettings;
    }
  } catch (err) {
    console.warn('Error cargando configuraciones_sistema cuentas_correo:', err);
  }

  // Configuración por defecto basada en entorno o valores estándar GCABA
  const defaultSettings: MailSettings = {
    cuenta_principal: {
      id: 'principal',
      nombre: 'Cuenta Principal – QRs y Avisos Institucionales',
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      user: process.env.SMTP_USER || 'congreso.ets2026@bue.edu.ar',
      password: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || 'Congreso ETS 2026 – DETS GCABA <no-reply.dets@bue.edu.ar>',
      activo: true,
    },
    cuenta_secundaria: {
      id: 'secundaria',
      nombre: 'Cuenta Secundaria – Avisos Masivos y Respaldo',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'avisos.congreso@bue.edu.ar',
      password: '',
      from: 'Avisos Congreso ETS 2026 <avisos.dets@bue.edu.ar>',
      activo: false,
    },
    sandbox_mode: !process.env.SMTP_HOST || !process.env.SMTP_PASS,
    notificar_inscripcion: true,
    notificar_espera: true,
    notificar_48hs: true,
    notificar_certificados: true,
  };

  return defaultSettings;
}

/**
 * Guarda o actualiza la configuración de cuentas de correo
 */
export async function saveMailSettings(settings: MailSettings, actorUsuario: string = 'SUPERADMIN'): Promise<void> {
  // Invalidar caché
  cachedSettings = null;
  cachedTransporters = {};

  await query(
    `INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, actualizado_en)
     VALUES ('cuentas_correo', $1, 'Configuración de cuentas de correo SMTP para envío de QRs, diplomas y avisos', 'CORREO', NOW())
     ON CONFLICT (clave) DO UPDATE SET 
       valor = EXCLUDED.valor, 
       descripcion = EXCLUDED.descripcion, 
       categoria = 'CORREO',
       actualizado_en = NOW()`,
    [JSON.stringify(settings)]
  );

  await query(
    `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
     VALUES ('configuraciones_sistema', 'UPDATE_CONFIG_CORREO', $1, $2)`,
    [actorUsuario, JSON.stringify({ clave: 'cuentas_correo', updated: true })]
  ).catch(() => {});
}

/**
 * Inicializa o recupera un transportador Nodemailer
 */
async function getTransporter(accountType: 'principal' | 'secundaria' = 'principal'): Promise<{ transporter: any; from: string; isSandbox: boolean }> {
  const settings = await getMailSettings();
  const acc = accountType === 'secundaria' && settings.cuenta_secundaria?.activo
    ? settings.cuenta_secundaria
    : settings.cuenta_principal;

  const isSandbox = process.env.NODE_ENV === 'test' || settings.sandbox_mode || !acc.host || !acc.user || !acc.password;

  if (isSandbox) {
    return { transporter: null, from: acc.from, isSandbox: true };
  }

  const cacheKey = `${acc.host}:${acc.port}:${acc.user}`;
  if (cachedTransporters[cacheKey]) {
    return { transporter: cachedTransporters[cacheKey], from: acc.from, isSandbox: false };
  }

  try {
    const t = nodemailer.createTransport({
      host: acc.host,
      port: acc.port,
      secure: acc.secure,
      auth: {
        user: acc.user,
        pass: acc.password,
      },
    });

    cachedTransporters[cacheKey] = t;
    return { transporter: t, from: acc.from, isSandbox: false };
  } catch (err) {
    console.error('Error al inicializar transporte Nodemailer:', err);
    return { transporter: null, from: acc.from, isSandbox: true };
  }
}

/**
 * Enviar un correo electrónico a través de la cuenta configurada
 */
export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const { transporter, from, isSandbox } = await getTransporter(options.account || 'principal');

  // Resolver cabecera y pie oficiales si existen en assets
  const mailingHeaderPath = path.resolve(__dirname, '../../assets/mailing/Header.png');
  const mailingFooterPath = path.resolve(__dirname, '../../assets/mailing/Footer.png');

  const finalAttachments = [...(options.attachments || [])];
  if (fs.existsSync(mailingHeaderPath) && options.html.includes('cid:gcaba_mailing_header')) {
    finalAttachments.push({
      filename: 'Header_GCABA.png',
      path: mailingHeaderPath,
      cid: 'gcaba_mailing_header',
    });
  }
  if (fs.existsSync(mailingFooterPath) && options.html.includes('cid:gcaba_mailing_footer')) {
    finalAttachments.push({
      filename: 'Footer_GCABA.png',
      path: mailingFooterPath,
      cid: 'gcaba_mailing_footer',
    });
  }

  if (isSandbox || !transporter) {
    console.log(`[MAIL SANDBOX] Correo simulado a: ${options.to} | Asunto: "${options.subject}"`);
    const mockId = `sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('DESPACHO_CORREO_SANDBOX', 'SISTEMA_MAIL', $1, NOW())`,
      [JSON.stringify({ to: options.to, subject: options.subject, simulated: true, messageId: mockId })]
    ).catch(() => {});

    return {
      success: true,
      simulated: true,
      messageId: mockId,
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
      html: options.html,
      attachments: finalAttachments,
    });

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('DESPACHO_CORREO_EXITOSO', 'SISTEMA_MAIL', $1, NOW())`,
      [JSON.stringify({ to: options.to, subject: options.subject, messageId: info.messageId })]
    ).catch(() => {});

    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (error: any) {
    let friendlyError = error.message;
    if (
      error.message.includes('534') ||
      error.message.includes('Application-specific password required') ||
      error.message.includes('InvalidSecondFactor')
    ) {
      friendlyError =
        'Gmail rechazó la autenticación (534 5.7.9): Google exige una "Contraseña de Aplicación" de 16 caracteres (generada en https://myaccount.google.com/apppasswords con verificación en dos pasos activa). No use la contraseña habitual de la cuenta de Google.';
    } else if (error.code === 'EAUTH' || error.message.includes('535') || error.message.includes('BadCredentials')) {
      friendlyError =
        'Error de autenticación SMTP (535): Credenciales rechazadas por el servidor de correo. Verifique usuario y contraseña.';
    }

    console.error(`Error al despachar correo a ${options.to}:`, friendlyError);

    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('DESPACHO_CORREO_FALLIDO', 'SISTEMA_MAIL', $1, NOW())`,
      [JSON.stringify({ to: options.to, subject: options.subject, error: friendlyError, rawError: error.message })]
    ).catch(() => {});

    return {
      success: false,
      error: friendlyError,
    };
  }
}

/**
 * Prueba de conexión y envío inmediato con parámetros arbitrarios o guardados
 */
export async function verifySmtpConnection(
  account: SmtpAccountConfig,
  testRecipient?: string,
  sandboxMode?: boolean
): Promise<{ success: boolean; message: string; messageId?: string; simulated?: boolean }> {
  try {
    // 1. Si está activo el modo Sandbox institucional, simular el despacho sin fallar por credenciales externas
    if (sandboxMode) {
      const mockId = `<mock-test-${Date.now()}@congreso.ets2026.local>`;
      return {
        success: true,
        simulated: true,
        messageId: mockId,
        message: `[Modo Sandbox Activo] Handshake y despacho simulados correctamente hacia ${testRecipient || 'destinatario'}. No se contactó el servidor externo. Para envíos reales a buzones externos, desactive el Modo Sandbox e ingrese la contraseña/token de aplicación SMTP.`,
      };
    }

    // 2. Validaciones preventivas para evitar errores crípticos de Nodemailer como Missing credentials for PLAIN
    if (!account.host || account.host.trim() === '') {
      return {
        success: false,
        message: 'Falta el servidor Host SMTP (ej. smtp.gmail.com). Por favor complete este campo en el formulario.',
      };
    }

    if (!account.user || account.user.trim() === '') {
      return {
        success: false,
        message: 'Falta el usuario o correo remitente SMTP (ej. tu_cuenta@bue.edu.ar).',
      };
    }

    if (!account.password || account.password.trim() === '' || account.password === '••••••••••••') {
      return {
        success: false,
        message: 'Falta la contraseña o token de aplicación: No se ha configurado una clave SMTP para el usuario. Ingrese la contraseña en el campo correspondiente antes de probar la conexión real, o active el "Modo Sandbox Institucional" para simular envíos sin credenciales.',
      };
    }

    // 3. Crear transportador con Nodemailer para servidor real
    const t = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: {
        user: account.user,
        pass: account.password,
      },
      connectionTimeout: 10000,
    });

    // 4. Verificar handshake SMTP
    await t.verify();

    // 5. Si se proporcionó destinatario, enviar correo de prueba real
    if (testRecipient) {
      const html = await wrapInstitutionalTemplate(`
        <h2 style="color: #005691; margin-top: 0;">Prueba de Conexión SMTP Exitosa</h2>
        <p>Este es un correo de verificación generado por el <strong>Centro de Control del Congreso ETS 2026</strong>.</p>
        <div style="background-color: #f0f7ff; border: 1px solid #cce3f5; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Servidor Host:</strong> ${account.host}:${account.port}</p>
          <p style="margin: 4px 0;"><strong>Usuario:</strong> ${account.user}</p>
          <p style="margin: 4px 0;"><strong>Seguridad:</strong> ${account.secure ? 'SSL/TLS (465)' : 'STARTTLS (587)'}</p>
          <p style="margin: 4px 0;"><strong>Fecha y Hora:</strong> ${new Date().toLocaleString('es-AR')}</p>
        </div>
        <p style="color: #27ae60; font-weight: bold;">✅ La cuenta está correctamente vinculada para el envío de QRs, avisos 48hs y diplomas oficiales.</p>
      `);

      const info = await t.sendMail({
        from: account.from,
        to: testRecipient,
        subject: '🧪 Verificación de Conexión SMTP – Congreso ETS 2026',
        html,
      });

      return {
        success: true,
        message: `Conexión SMTP exitosa. Correo de prueba enviado a ${testRecipient}`,
        messageId: info.messageId,
      };
    }

    return {
      success: true,
      message: 'Conexión SMTP verificada y autenticada correctamente con el servidor.',
    };
  } catch (error: any) {
    let friendlyMessage = error.message;

    if (
      error.code === 'EAUTH' ||
      error.message.includes('535') ||
      error.message.includes('534') ||
      error.message.includes('Application-specific password required') ||
      error.message.includes('InvalidSecondFactor') ||
      error.message.includes('BadCredentials')
    ) {
      if (account.host.includes('gmail.com')) {
        friendlyMessage =
          'Error de autenticación en Gmail (534/535): Gmail requiere obligatoriamente una "Contraseña de Aplicación" de 16 caracteres generada desde https://myaccount.google.com/apppasswords (requiere tener verificación en dos pasos activa en la cuenta de Google). No use su contraseña normal.';
      } else {
        friendlyMessage = 'Error de autenticación (535): Usuario o contraseña rechazados por el servidor SMTP.';
      }
    } else if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
      friendlyMessage = `Tiempo de espera agotado al conectar con ${account.host}:${account.port}. Verifique el puerto y la conectividad.`;
    } else if (error.message.includes('Missing credentials for "PLAIN"')) {
      friendlyMessage = 'Falta la contraseña o token de aplicación SMTP para autenticar la cuenta.';
    }

    return {
      success: false,
      message: friendlyMessage,
    };
  }
}

/**
 * Plantilla HTML con diseño institucional configurable (Header, Footer, colores y membrete)
 */
export async function wrapInstitutionalTemplate(contentHtml: string, customTpl?: MailTemplateConfig): Promise<string> {
  const tpl = customTpl || await getMailTemplate();

  const primaryColor = tpl.estilos?.color_primario || '#005691';
  const secondaryColor = tpl.estilos?.color_secundario || '#f39c12';
  const btnColor = tpl.estilos?.color_boton || '#005691';
  const btnTextColor = tpl.estilos?.color_texto_boton || '#ffffff';
  const bgColor = tpl.estilos?.color_fondo_general || '#f4f7f9';
  const fontFamily = tpl.estilos?.fuente_familia || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  // Construcción del Encabezado (Header)
  let headerHtml = '';
  if (tpl.header?.activo) {
    if (tpl.header.modo === 'imagen') {
      const headerImgSrc = tpl.header.imagen_url && tpl.header.imagen_url.trim() !== ''
        ? tpl.header.imagen_url
        : 'cid:gcaba_mailing_header';
      headerHtml = `
        <div style="background-color: ${tpl.header.fondo_color || '#003865'}; text-align: center; line-height: 0;">
          <img src="${headerImgSrc}" alt="${tpl.header.titulo_texto || 'Congreso ETS 2026'}" style="width: 100%; max-width: 600px; height: auto; display: block;" />
        </div>
      `;
    } else if (tpl.header.modo === 'texto') {
      headerHtml = `
        <div class="header-custom" style="background: linear-gradient(135deg, ${tpl.header.fondo_color || '#003865'} 0%, ${primaryColor} 100%); padding: 28px 24px; text-align: center; color: ${tpl.header.texto_color || '#ffffff'}; border-bottom: 4px solid ${secondaryColor};">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${tpl.header.titulo_texto || '1er Congreso de Educación Técnica Superior'}</h1>
          ${tpl.header.subtitulo_texto ? `<p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">${tpl.header.subtitulo_texto}</p>` : ''}
        </div>
      `;
    } else {
      // Modo mixto
      const headerImgSrc = tpl.header.imagen_url && tpl.header.imagen_url.trim() !== ''
        ? tpl.header.imagen_url
        : 'cid:gcaba_mailing_header';
      headerHtml = `
        <div style="background-color: ${tpl.header.fondo_color || '#003865'}; text-align: center; line-height: 0;">
          <img src="${headerImgSrc}" alt="${tpl.header.titulo_texto || 'Congreso ETS 2026'}" style="width: 100%; max-width: 600px; height: auto; display: block;" />
        </div>
        <div style="background: ${primaryColor}; padding: 12px 20px; text-align: center; color: ${tpl.header.texto_color || '#ffffff'}; border-bottom: 3px solid ${secondaryColor};">
          <p style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">${tpl.header.subtitulo_texto || 'DETS · Ministerio de Educación GCABA'}</p>
        </div>
      `;
    }
  }

  // Construcción del Pie (Footer)
  let footerHtml = '';
  if (tpl.footer?.activo) {
    let footerImgHtml = '';
    if (tpl.footer.modo === 'imagen' || tpl.footer.modo === 'mixto') {
      const footerImgSrc = tpl.footer.imagen_url && tpl.footer.imagen_url.trim() !== ''
        ? tpl.footer.imagen_url
        : 'cid:gcaba_mailing_footer';
      footerImgHtml = `
        <div style="text-align: center; line-height: 0;">
          <img src="${footerImgSrc}" alt="Buenos Aires Ciudad - Ministerio de Educación" style="width: 100%; max-width: 600px; height: auto; display: block;" />
        </div>
      `;
    }

    let footerTextHtml = '';
    if (tpl.footer.modo === 'texto' || tpl.footer.modo === 'mixto') {
      footerTextHtml = `
        <div style="padding: 16px 20px; font-size: 12px; color: ${tpl.footer.texto_color || '#64748b'}; background-color: ${tpl.footer.fondo_color || '#f8fafc'}; text-align: center; border-top: 1px solid #e2e8f0;">
          ${tpl.footer.linea1 ? `<p style="margin: 2px 0;"><strong>${tpl.footer.linea1}</strong></p>` : ''}
          ${tpl.footer.linea2 ? `<p style="margin: 2px 0;">${tpl.footer.linea2}</p>` : ''}
          ${(tpl.footer.enlace_contacto_url || tpl.footer.enlace_privacidad_url) ? `
            <p style="margin: 8px 0 0; font-size: 11px;">
              ${tpl.footer.enlace_contacto_url ? `<a href="${tpl.footer.enlace_contacto_url}" style="color: ${primaryColor}; text-decoration: underline; margin: 0 6px;">Contacto Institucional</a>` : ''}
              ${tpl.footer.enlace_privacidad_url ? `<a href="${tpl.footer.enlace_privacidad_url}" style="color: ${primaryColor}; text-decoration: underline; margin: 0 6px;">Términos y Privacidad</a>` : ''}
            </p>
          ` : ''}
        </div>
      `;
    }

    footerHtml = `
      <div class="footer" style="padding: 0; overflow: hidden;">
        ${footerImgHtml}
        ${footerTextHtml}
      </div>
    `;
  }

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Congreso ETS 2026</title>
    <style>
      body { font-family: ${fontFamily}; background-color: ${bgColor}; margin: 0; padding: 20px; color: #2c3e50; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      .content { padding: 30px; line-height: 1.6; }
      .btn { display: inline-block; padding: 12px 24px; background-color: ${btnColor}; color: ${btnTextColor} !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; text-align: center; }
      .alert-box { background-color: #fff3cd; border-left: 4px solid ${secondaryColor}; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      ${headerHtml}
      <div class="content">
        ${contentHtml}
      </div>
      ${footerHtml}
    </div>
  </body>
  </html>
  `;
}

/**
 * 1. Correo de Bienvenida con Credencial y Código QR
 */
export async function sendWelcomeEmail(params: {
  to: string;
  nombre: string;
  apellido: string;
  dni: string;
  rol?: string;
  estado?: string;
}): Promise<SendResult> {
  const credencialUrl = `${APP_BASE_URL}/mi-credencial?dni=${encodeURIComponent(params.dni)}`;

  const html = await wrapInstitutionalTemplate(`
    <h2 style="color: #005691; margin-top: 0;">¡Inscripción Confirmada!</h2>
    <p>Estimado/a <strong>${params.nombre} ${params.apellido}</strong>,</p>
    <p>Nos complace confirmar su vacante en el <strong>1er Congreso de Educación Técnica Superior (ETS 2026)</strong>, que se llevará a cabo el <strong>viernes 6 de noviembre de 2026</strong> en el Auditorio Polo Saavedra.</p>
    
    <div style="background-color: #f0f7ff; border: 1px solid #cce3f5; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>DNI / Pasaporte:</strong> ${params.dni}</p>
      <p style="margin: 4px 0;"><strong>Rol Institucional:</strong> ${params.rol || 'Participante'}</p>
      <p style="margin: 4px 0;"><strong>Estado:</strong> <span style="color: #27ae60; font-weight: bold;">CONFIRMADO (Vacante Asegurada)</span></p>
    </div>

    <p>Su credencial digital oficial ya está generada y protegida con criptografía simétrica AES-256 para el control de acceso en puerta:</p>

    <div style="text-align: center;">
      <a href="${credencialUrl}" class="btn">Ver Mi Credencial y Código QR</a>
    </div>

    <div class="alert-box">
      <strong>Información para el Ingreso:</strong>
      <ul style="margin: 5px 0 0; padding-left: 20px;">
        <li>Deberá presentar su credencial en el teléfono móvil o impresa.</li>
        <li>Concurrir con su DNI físico original para validar su identidad en puerta.</li>
        <li>La acreditación general y café de bienvenida comenzará a las 08:30 hs.</li>
      </ul>
    </div>
  `);

  return sendEmail({
    to: params.to,
    subject: '¡Inscripción Confirmada! Credencial de Acceso – Congreso ETS 2026',
    html,
  });
}

/**
 * 2. Correo de Notificación de Lista de Espera (Agotado de cupo nominal)
 */
export async function sendWaitlistEmail(params: {
  to: string;
  nombre: string;
  apellido: string;
  dni: string;
  orden?: number;
}): Promise<SendResult> {
  const portalUrl = `${APP_BASE_URL}/`;

  const html = await wrapInstitutionalTemplate(`
    <h2 style="color: #d35400; margin-top: 0;">Inscripción en Lista de Espera</h2>
    <p>Estimado/a <strong>${params.nombre} ${params.apellido}</strong>,</p>
    <p>Le informamos que el cupo nominal inmediato para el <strong>1er Congreso ETS 2026</strong> ha alcanzado su capacidad máxima. Su solicitud ha quedado registrada en nuestra <strong>Lista de Espera por orden de llegada (FIFO)</strong>.</p>
    
    <div style="background-color: #fff9f2; border: 1px solid #f9e1cc; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>DNI / Pasaporte:</strong> ${params.dni}</p>
      <p style="margin: 4px 0;"><strong>Estado:</strong> <span style="color: #e67e22; font-weight: bold;">LISTA DE ESPERA</span></p>
      ${params.orden ? `<p style="margin: 4px 0;"><strong>Posición en Cola:</strong> N° ${params.orden}</p>` : ''}
    </div>

    <p>En caso de producirse bajas automáticas durante el proceso de reconfirmación de 48 horas, el sistema asignará las vacantes liberadas respetando el orden estricto de inscripción.</p>
    
    <p>Le notificaremos de inmediato a esta misma casilla si su vacante resulta promovida a <strong>CONFIRMADA</strong>.</p>

    <div style="text-align: center;">
      <a href="${portalUrl}" class="btn" style="background-color: #7f8c8d;">Consultar Estado en el Portal</a>
    </div>
  `);

  return sendEmail({
    to: params.to,
    subject: 'Inscripción en Lista de Espera – Congreso ETS 2026',
    html,
  });
}

/**
 * 3. Correo de Reconfirmación de Asistencia (48hs previas)
 */
export async function sendConfirmationRequestEmail(params: {
  to: string;
  nombre: string;
  apellido: string;
  token: string;
  horasVigencia?: number;
}): Promise<SendResult> {
  const confirmUrl = `${APP_BASE_URL}/confirmar-asistencia?token=${encodeURIComponent(params.token)}`;
  const horas = params.horasVigencia || 24;

  const html = await wrapInstitutionalTemplate(`
    <h2 style="color: #005691; margin-top: 0;">Reconfirmación de Asistencia Obligatoria</h2>
    <p>Estimado/a <strong>${params.nombre} ${params.apellido}</strong>,</p>
    <p>Faltan 48 horas para el inicio del <strong>1er Congreso de Educación Técnica Superior (ETS 2026)</strong>.</p>
    
    <div class="alert-box">
      <strong>ATENCIÓN: RECONFIRMACIÓN DE VACANTE</strong>
      <p style="margin: 5px 0 0;">Para garantizar el aprovechamiento del aforo y permitir el ingreso de colegas en lista de espera, <strong>debe confirmar su asistencia dentro de las próximas ${horas} horas</strong>.</p>
    </div>

    <div style="text-align: center;">
      <a href="${confirmUrl}" class="btn" style="background-color: #27ae60;">Confirmar Mi Asistencia Ahora</a>
    </div>

    <p style="font-size: 13px; color: #c0392b;"><strong>Aviso Importante:</strong> De no reconfirmar en el plazo estipulado, el sistema procederá a la baja automática de su vacante y su asignación al siguiente postulante en espera.</p>
  `);

  return sendEmail({
    to: params.to,
    subject: 'URGENTE: Reconfirmación de Asistencia (48hs previas) – Congreso ETS 2026',
    html,
  });
}

/**
 * 4. Correo de Promoción desde Lista de Espera a Confirmado
 */
export async function sendPromotionEmail(params: {
  to: string;
  nombre: string;
  apellido: string;
  dni: string;
}): Promise<SendResult> {
  const credencialUrl = `${APP_BASE_URL}/mi-credencial?dni=${encodeURIComponent(params.dni)}`;

  const html = await wrapInstitutionalTemplate(`
    <h2 style="color: #27ae60; margin-top: 0;">¡Buenas noticias! Vacante Asignada</h2>
    <p>Estimado/a <strong>${params.nombre} ${params.apellido}</strong>,</p>
    <p>Le informamos que se ha liberado una vacante y <strong>su inscripción al 1er Congreso ETS 2026 ha sido PROMOVIDA a estado CONFIRMADO</strong>.</p>
    
    <div style="background-color: #f0f7ff; border: 1px solid #cce3f5; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>DNI / Pasaporte:</strong> ${params.dni}</p>
      <p style="margin: 4px 0;"><strong>Estado Actual:</strong> <span style="color: #27ae60; font-weight: bold;">CONFIRMADO</span></p>
    </div>

    <p>Su credencial digital oficial ya está activa para el acceso al auditorio:</p>

    <div style="text-align: center;">
      <a href="${credencialUrl}" class="btn">Acceder a Mi Credencial</a>
    </div>

    <p>Nos vemos el viernes 6 de noviembre a las 08:30 hs en el Auditorio Polo Saavedra.</p>
  `);

  return sendEmail({
    to: params.to,
    subject: '¡Vacante Asignada! Su lugar ha sido confirmado – Congreso ETS 2026',
    html,
  });
}

/**
 * 5. Correo de Emisión y Envío de Certificado Oficial
 */
export async function sendCertificateEmail(params: {
  to: string;
  nombre: string;
  apellido: string;
  codigoVerificacion: string;
  horasCatedra?: number;
  pdfBuffer?: Buffer;
}): Promise<SendResult> {
  const certificadoUrl = `${APP_BASE_URL}/certificados?codigo=${encodeURIComponent(params.codigoVerificacion)}`;

  const html = await wrapInstitutionalTemplate(`
    <h2 style="color: #005691; margin-top: 0;">Certificado Oficial de Asistencia</h2>
    <p>Estimado/a <strong>${params.nombre} ${params.apellido}</strong>,</p>
    <p>Agradecemos su valiosa participación en el <strong>1er Congreso de Educación Técnica Superior (ETS 2026)</strong>.</p>
    
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Estado:</strong> <span style="color: #16a34a; font-weight: bold;">CERTIFICADO EMITIDO</span></p>
      <p style="margin: 4px 0;"><strong>Código de Validación Único:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${params.codigoVerificacion}</code></p>
      ${params.horasCatedra ? `<p style="margin: 4px 0;"><strong>Carga Horaria:</strong> ${params.horasCatedra} horas cátedra</p>` : ''}
    </div>

    <p>Puede visualizar y descargar su diploma en alta resolución directamente con el siguiente enlace:</p>

    <div style="text-align: center;">
      <a href="${certificadoUrl}" class="btn">Descargar Mi Certificado Oficial</a>
    </div>

    <p style="font-size: 13px; color: #64748b;">El certificado cuenta con firma digital y código de validación verificable públicamente por instituciones y organismos oficiales.</p>
  `);

  const attachments = params.pdfBuffer
    ? [{ filename: `Certificado_ETS2026_${params.codigoVerificacion}.pdf`, content: params.pdfBuffer, contentType: 'application/pdf' }]
    : undefined;

  return sendEmail({
    to: params.to,
    subject: 'Certificado Oficial de Asistencia – Congreso ETS 2026',
    html,
    attachments,
  });
}

/**
 * ============================================================================
 * COLA ASÍNCRONA RESILIENTE DE CORREOS CON REINTENTOS EXPONENCIALES
 * ============================================================================
 */
interface QueuedEmail {
  id: string;
  options: EmailOptions;
  retries: number;
  maxRetries: number;
  nextAttempt: number;
}

const emailQueue: QueuedEmail[] = [];
let isQueueWorkerRunning = false;

export function queueEmail(options: EmailOptions, maxRetries = 3): string {
  const jobId = `mail_job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  emailQueue.push({
    id: jobId,
    options,
    retries: 0,
    maxRetries,
    nextAttempt: Date.now(),
  });

  if (!isQueueWorkerRunning) {
    startEmailQueueWorker();
  }

  return jobId;
}

function startEmailQueueWorker() {
  if (isQueueWorkerRunning) return;
  isQueueWorkerRunning = true;

  const interval = setInterval(async () => {
    if (emailQueue.length === 0) {
      clearInterval(interval);
      isQueueWorkerRunning = false;
      return;
    }

    const now = Date.now();
    const readyIndex = emailQueue.findIndex((item) => item.nextAttempt <= now);
    if (readyIndex === -1) return;

    const [job] = emailQueue.splice(readyIndex, 1);

    try {
      const result = await sendEmail(job.options);
      if (!result.success) {
        throw new Error(result.error || 'Fallo desconocido en despacho');
      }
    } catch (err: any) {
      job.retries += 1;
      if (job.retries < job.maxRetries) {
        // Backoff exponencial: 5s, 20s, 60s
        const delayMs = Math.pow(job.retries, 2) * 5000;
        job.nextAttempt = Date.now() + delayMs;
        emailQueue.push(job);
        console.warn(`[MAIL QUEUE] Reintento ${job.retries}/${job.maxRetries} programado para ${job.options.to} en ${delayMs / 1000}s`);
      } else {
        console.error(`[MAIL QUEUE] Se agotaron los reintentos (${job.maxRetries}) para enviar a ${job.options.to}`);
        await query(
          `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
           VALUES ('cola_correos', 'COLA_CORREO_AGOTADA', 'SISTEMA_MAIL', $1)`,
          [JSON.stringify({ to: job.options.to, subject: job.options.subject, retries: job.retries, error: err.message })]
        ).catch(() => {});
      }
    }
  }, 2000);
}

