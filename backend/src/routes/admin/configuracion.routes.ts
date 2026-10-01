import { Router, Response } from 'express';
import { query } from '../../lib/db';
import { configuracionUpdateSchema } from '../../lib/schemas';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';
import { 
  getMailSettings, 
  saveMailSettings, 
  verifySmtpConnection, 
  getMailTemplate, 
  saveMailTemplate, 
  wrapInstitutionalTemplate, 
  DEFAULT_MAIL_TEMPLATE,
  MailSettings, 
  SmtpAccountConfig, 
  MailTemplateConfig 
} from '../../lib/mailService';

const router = Router();

/**
 * GET /api/admin/configuracion
 * Obtener listado de parámetros de configuración del sistema
 */
router.get('/', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT clave, valor, descripcion, actualizado_en 
       FROM configuraciones_sistema 
       ORDER BY clave ASC`
    );
    res.json({ ok: true, configuracion: result.rows });
  } catch (error: any) {
    console.error('Error en GET /api/admin/configuracion:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/configuracion
 * Actualizar valor de configuración del sistema
 */
router.put('/', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = configuracionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ERR_VALIDATION', details: parsed.error.format() });
      return;
    }

    const { clave, valor, descripcion } = parsed.data;

    const result = await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, actualizado_en)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (clave) DO UPDATE
       SET valor = $2, descripcion = COALESCE($3, configuraciones_sistema.descripcion), actualizado_en = NOW()
       RETURNING *`,
      [clave, JSON.stringify(valor), descripcion || null]
    );

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'CONFIGURACION_UPDATE', $1, $2)`,
      [req.operator?.email || 'SUPERADMIN', JSON.stringify({ clave, valor })]
    ).catch(() => {});

    res.json({ ok: true, item: result.rows[0], mensaje: `Parámetro '${clave}' actualizado correctamente.` });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/configuracion:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/configuracion/mail
 * Obtener configuración de cuentas de correo (con claves enmascaradas)
 */
router.get('/mail', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await getMailSettings();

    // Enmascarar contraseñas para visualización segura e indicar si tiene clave configurada
    const safeSettings = {
      ...settings,
      cuenta_principal: {
        ...settings.cuenta_principal,
        password: settings.cuenta_principal.password ? '••••••••••••' : '',
        has_password: Boolean(settings.cuenta_principal.password && settings.cuenta_principal.password.trim() !== ''),
      },
      cuenta_secundaria: settings.cuenta_secundaria ? {
        ...settings.cuenta_secundaria,
        password: settings.cuenta_secundaria.password ? '••••••••••••' : '',
        has_password: Boolean(settings.cuenta_secundaria.password && settings.cuenta_secundaria.password.trim() !== ''),
      } : undefined,
    };

    res.json({ ok: true, settings: safeSettings });
  } catch (error: any) {
    console.error('Error obteniendo configuración de correo:', error);
    res.status(500).json({ ok: false, error: 'ERR_MAIL_CONFIG', message: error.message });
  }
});

/**
 * PUT /api/admin/configuracion/mail
 * Guardar configuración de cuentas de correo
 */
router.put('/mail', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const incoming = req.body as MailSettings;
    const current = await getMailSettings();

    // Preservar contraseñas si el usuario no las cambió (vinieron enmascaradas)
    const finalPrincipalPassword = (!incoming.cuenta_principal.password || incoming.cuenta_principal.password === '••••••••••••')
      ? current.cuenta_principal.password
      : incoming.cuenta_principal.password;

    let finalSecundariaPassword = current.cuenta_secundaria?.password || '';
    if (incoming.cuenta_secundaria) {
      finalSecundariaPassword = (!incoming.cuenta_secundaria.password || incoming.cuenta_secundaria.password === '••••••••••••')
        ? (current.cuenta_secundaria?.password || '')
        : incoming.cuenta_secundaria.password;
    }

    const mergedSettings: MailSettings = {
      cuenta_principal: {
        ...incoming.cuenta_principal,
        password: finalPrincipalPassword,
      },
      cuenta_secundaria: incoming.cuenta_secundaria ? {
        ...incoming.cuenta_secundaria,
        password: finalSecundariaPassword,
      } : undefined,
      sandbox_mode: Boolean(incoming.sandbox_mode),
      notificar_inscripcion: Boolean(incoming.notificar_inscripcion),
      notificar_espera: Boolean(incoming.notificar_espera),
      notificar_48hs: Boolean(incoming.notificar_48hs),
      notificar_certificados: Boolean(incoming.notificar_certificados),
    };

    await saveMailSettings(mergedSettings, req.operator?.email || 'SUPERADMIN');

    res.json({
      ok: true,
      mensaje: 'Parámetros y cuentas de correo actualizados exitosamente en el sistema.',
    });
  } catch (error: any) {
    console.error('Error guardando configuración de correo:', error);
    res.status(500).json({ ok: false, error: 'ERR_MAIL_SAVE', message: error.message });
  }
});

/**
 * POST /api/admin/configuracion/mail/test
 * Probar conexión SMTP y despacho de correo de prueba
 */
router.post('/mail/test', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { accountType, testRecipient, accountConfig, sandbox_mode } = req.body;
    const settings = await getMailSettings();

    let targetAccount: SmtpAccountConfig;

    if (accountConfig) {
      // Probar con los valores recibidos en el formulario antes de guardar
      const currentPwd = accountType === 'secundaria'
        ? (settings.cuenta_secundaria?.password || '')
        : settings.cuenta_principal.password;

      targetAccount = {
        ...accountConfig,
        password: (!accountConfig.password || accountConfig.password === '••••••••••••')
          ? currentPwd
          : accountConfig.password,
      };
    } else {
      targetAccount = accountType === 'secundaria' && settings.cuenta_secundaria
        ? settings.cuenta_secundaria
        : settings.cuenta_principal;
    }

    const isSandbox = typeof sandbox_mode === 'boolean' ? sandbox_mode : settings.sandbox_mode;
    const recipient = testRecipient || req.operator?.email || 'test@ifts04.edu.ar';
    const result = await verifySmtpConnection(targetAccount, recipient, isSandbox);

    if (result.success) {
      res.json({ ok: true, mensaje: result.message, messageId: result.messageId, simulated: result.simulated });
    } else {
      res.status(400).json({ ok: false, error: 'ERR_SMTP_TEST_FAILED', mensaje: result.message });
    }
  } catch (error: any) {
    console.error('Error en test SMTP:', error);
    res.status(500).json({ ok: false, error: 'ERR_SMTP_TEST', message: error.message });
  }
});

/**
 * GET /api/admin/configuracion/mail/plantilla
 * Obtener la plantilla activa de diseño de correos (Header, Footer, estilos)
 */
router.get('/mail/plantilla', requireHierarchy(3), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const plantilla = await getMailTemplate();
    res.json({ ok: true, plantilla });
  } catch (error: any) {
    console.error('Error en GET /api/admin/configuracion/mail/plantilla:', error);
    res.status(500).json({ ok: false, error: 'ERR_GET_MAIL_TEMPLATE', message: error.message });
  }
});

/**
 * PUT /api/admin/configuracion/mail/plantilla
 * Guardar la configuración de diseño de la plantilla institucional de correos
 */
router.put('/mail/plantilla', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const incoming = req.body as MailTemplateConfig;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ ok: false, error: 'ERR_INVALID_BODY', message: 'Configuración de plantilla requerida' });
      return;
    }

    const tpl: MailTemplateConfig = {
      header: {
        ...DEFAULT_MAIL_TEMPLATE.header,
        ...(incoming.header || {}),
      },
      footer: {
        ...DEFAULT_MAIL_TEMPLATE.footer,
        ...(incoming.footer || {}),
      },
      estilos: {
        ...DEFAULT_MAIL_TEMPLATE.estilos,
        ...(incoming.estilos || {}),
      },
    };

    await saveMailTemplate(tpl, req.operator?.email || 'ADMIN');
    res.json({ ok: true, mensaje: 'Plantilla institucional de correos guardada y aplicada exitosamente.', plantilla: tpl });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/configuracion/mail/plantilla:', error);
    res.status(500).json({ ok: false, error: 'ERR_SAVE_MAIL_TEMPLATE', message: error.message });
  }
});

/**
 * POST /api/admin/configuracion/mail/plantilla/preview
 * Generar preview HTML en tiempo real con datos de muestra
 */
router.post('/mail/plantilla/preview', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plantilla, tipo_muestra } = req.body;
    const tpl = plantilla || await getMailTemplate();

    let sampleContent = '';
    if (tipo_muestra === 'espera') {
      sampleContent = `
        <h2 style="color: #d35400; margin-top: 0;">Inscripción en Lista de Espera</h2>
        <p>Estimado/a <strong>Nicolás Romero</strong>,</p>
        <p>Le informamos que el cupo nominal inmediato para el <strong>1er Congreso ETS 2026</strong> ha alcanzado su capacidad máxima. Su solicitud ha quedado registrada en nuestra <strong>Lista de Espera por orden de llegada (FIFO)</strong>.</p>
        <div style="background-color: #fff9f2; border: 1px solid #f9e1cc; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>DNI / Pasaporte:</strong> 35.555.666</p>
          <p style="margin: 4px 0;"><strong>Posición en Cola:</strong> N° 12</p>
        </div>
        <div style="text-align: center;">
          <a href="#" class="btn" style="background-color: #7f8c8d;">Consultar Estado en el Portal</a>
        </div>
      `;
    } else if (tipo_muestra === 'certificado') {
      sampleContent = `
        <h2 style="color: ${tpl.estilos?.color_primario || '#005691'}; margin-top: 0;">Certificado Oficial de Asistencia</h2>
        <p>Estimado/a <strong>Lic. Juan Carlos Pérez</strong>,</p>
        <p>Agradecemos su valiosa participación en las jornadas académicas del <strong>1er Congreso de Educación Técnica Superior</strong>.</p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Código de Validación:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">ETS26-DEMO-CERT</code></p>
          <p style="margin: 4px 0;"><strong>Carga Horaria:</strong> 12 horas cátedra</p>
        </div>
        <div style="text-align: center;">
          <a href="#" class="btn">Descargar Mi Certificado Oficial</a>
        </div>
      `;
    } else {
      // Inscripción / Bienvenida default
      sampleContent = `
        <h2 style="color: ${tpl.estilos?.color_primario || '#005691'}; margin-top: 0;">¡Inscripción Confirmada!</h2>
        <p>Estimado/a <strong>Mariana González</strong>,</p>
        <p>Nos complace confirmar su vacante en el <strong>1er Congreso de Educación Técnica Superior (ETS 2026)</strong>, que se llevará a cabo el <strong>viernes 6 de noviembre de 2026</strong> en el Auditorio Polo Saavedra.</p>
        <div style="background-color: #f0f7ff; border: 1px solid #cce3f5; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>DNI / Pasaporte:</strong> 28.333.444</p>
          <p style="margin: 4px 0;"><strong>Rol:</strong> Docente</p>
          <p style="margin: 4px 0;"><strong>Estado:</strong> <span style="color: #27ae60; font-weight: bold;">CONFIRMADO</span></p>
        </div>
        <p>Su credencial digital oficial ya está generada y protegida criptográficamente:</p>
        <div style="text-align: center;">
          <a href="#" class="btn">Ver Mi Credencial y Código QR</a>
        </div>
      `;
    }

    const html = await wrapInstitutionalTemplate(sampleContent, tpl);
    res.json({ ok: true, html });
  } catch (error: any) {
    console.error('Error en POST /api/admin/configuracion/mail/plantilla/preview:', error);
    res.status(500).json({ ok: false, error: 'ERR_PREVIEW_FAILED', message: error.message });
  }
});

/**
 * GET /api/admin/configuracion/tema-default
 * Obtiene el tema predeterminado global configurado en el servidor para el Backend
 */
router.get('/tema-default', requireHierarchy(1), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT valor FROM configuraciones_sistema WHERE clave = 'tema_backend_default'`
    );
    if (result.rows.length > 0 && result.rows[0].valor) {
      res.json({ ok: true, defaultTheme: result.rows[0].valor });
    } else {
      res.json({ ok: true, defaultTheme: null });
    }
  } catch (error: any) {
    console.error('Error en GET /api/admin/configuracion/tema-default:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/configuracion/tema-default
 * Guarda o actualiza el tema predeterminado global del Backend en PostgreSQL (Requiere Admin/Superadmin)
 */
router.put('/tema-default', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { themeId, customVars, themeName } = req.body;
    if (!themeId) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', message: 'Se requiere themeId' });
      return;
    }

    const payload = {
      themeId,
      themeName: themeName || themeId,
      customVars: customVars || null,
      actualizado_por: req.operator?.email || 'ADMIN',
      actualizado_en: new Date().toISOString(),
    };

    await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, actualizado_en)
       VALUES ('tema_backend_default', $1, 'Tema visual predeterminado del sistema administrativo para todos los operadores', NOW())
       ON CONFLICT (clave) DO UPDATE
       SET valor = $1, actualizado_en = NOW()`,
      [JSON.stringify(payload)]
    );

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'TEMA_DEFAULT_UPDATE', $1, $2)`,
      [req.operator?.email || 'ADMIN', JSON.stringify(payload)]
    ).catch(() => {});

    res.json({
      ok: true,
      mensaje: `El tema "${payload.themeName}" ha sido fijado como predeterminado para todos los operadores del sistema.`,
      defaultTheme: payload,
    });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/configuracion/tema-default:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * GET /api/admin/configuracion/tema-frontend-default
 * Obtiene el tema predeterminado global configurado en el servidor para el Frontend
 */
router.get('/tema-frontend-default', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT valor FROM configuraciones_sistema WHERE clave = 'tema_frontend_default'`
    );
    if (result.rows.length > 0 && result.rows[0].valor) {
      res.json({ ok: true, defaultTheme: result.rows[0].valor });
    } else {
      res.json({ ok: true, defaultTheme: null });
    }
  } catch (error: any) {
    console.error('Error en GET /api/admin/configuracion/tema-frontend-default:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/configuracion/tema-frontend-default
 * Guarda o actualiza el tema predeterminado global del Frontend en PostgreSQL (Requiere Admin/Superadmin)
 */
router.put('/tema-frontend-default', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { themeId, customVars, themeName } = req.body;
    if (!themeId) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', message: 'Se requiere themeId' });
      return;
    }

    const payload = {
      themeId,
      themeName: themeName || themeId,
      customVars: customVars || null,
      actualizado_por: req.operator?.email || 'ADMIN',
      actualizado_en: new Date().toISOString(),
    };

    await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, actualizado_en)
       VALUES ('tema_frontend_default', $1, 'Tema visual predeterminado del portal público para todos los visitantes y usuarios', NOW())
       ON CONFLICT (clave) DO UPDATE
       SET valor = $1, actualizado_en = NOW()`,
      [JSON.stringify(payload)]
    );

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'TEMA_FRONTEND_DEFAULT_UPDATE', $1, $2)`,
      [req.operator?.email || 'ADMIN', JSON.stringify(payload)]
    ).catch(() => {});

    res.json({
      ok: true,
      mensaje: `El tema de Frontend "${payload.themeName}" ha sido fijado como predeterminado oficial del portal público.`,
      defaultTheme: payload,
    });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/configuracion/tema-frontend-default:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
