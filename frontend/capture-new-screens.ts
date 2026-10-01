import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function captureNewScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const destDir = path.join(__dirname, '../manuales/capturas');

  // Iniciar sesion como superadmin
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'superadmin.congreso@bue.edu.ar');
  await page.fill('input[type="password"]', 'SuperAdmin2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // 1. Roles y Permisos RBAC
  await page.goto('http://localhost:3000/admin?tab=roles', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(destDir, '17_admin_rbac_roles.png') });
  console.log('📸 17_admin_rbac_roles.png capturada.');

  // 2. CMS de Tarjetas Frontend
  await page.goto('http://localhost:3000/admin?tab=cms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(destDir, '18_admin_cms_tarjetas.png') });
  console.log('📸 18_admin_cms_tarjetas.png capturada.');

  // 3. Editor de Plantillas de Correo
  await page.goto('http://localhost:3000/admin?tab=correo_plantillas', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(destDir, '19_admin_correo_plantilla.png') });
  console.log('📸 19_admin_correo_plantilla.png capturada.');

  // 4. Diseñador de Identificaciones Digitales
  await page.goto('http://localhost:3000/admin?tab=identificaciones', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(destDir, '20_admin_identificacion_editor.png') });
  console.log('📸 20_admin_identificacion_editor.png capturada.');

  // 5. Ediciones & Eventos (Sede Dinamica)
  await page.goto('http://localhost:3000/admin?tab=eventos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(destDir, '21_admin_eventos_sedes.png') });
  console.log('📸 21_admin_eventos_sedes.png capturada.');

  // 6. Vista del Asistente: Mi Identificación Móvil
  await page.goto('http://localhost:3000/mi-identificacion', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(destDir, '22_asistente_identificacion_movil.png') });
  console.log('📸 22_asistente_identificacion_movil.png capturada.');

  await browser.close();
  console.log('🎉 Capturas adicionales guardadas exitosamente en manuales/capturas/.');
}

captureNewScreenshots().catch(console.error);
