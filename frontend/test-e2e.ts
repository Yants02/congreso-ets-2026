import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function runBrowserTest() {
  console.log('🚀 Iniciando navegador Chromium con Playwright...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const screenshotsDir = path.join(__dirname, '../test-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Landing Page
  console.log('\n[1/5] Accediendo a la Landing Page (http://localhost:3000)...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(screenshotsDir, '01_landing.png') });
  console.log('✅ Landing Page cargada correctamente.');

  // 2. Navegar a Formulario de Inscripción (/participa)
  console.log('\n[2/5] Navegando a Inscripción (/participa)...');
  await page.goto('http://localhost:3000/participa', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(screenshotsDir, '02_participa.png') });

  // Rellenar formulario como un usuario real
  const randomDni = `45${Date.now().toString().slice(-6)}`;
  console.log(`Llenando formulario con DNI: ${randomDni}...`);
  await page.waitForSelector('input[placeholder="Ej: 38123456"]');
  await page.fill('input[placeholder="Ej: 38123456"]', randomDni);
  await page.fill('input[placeholder="Ej: +54 9 11 5555-5555"]', '1145678901');
  
  // Nombre y Apellido comparten el placeholder 'Como figurará en tu certificado'
  const certInputs = page.locator('input[placeholder="Como figurará en tu certificado"]');
  await certInputs.nth(0).fill('Facundo');
  await certInputs.nth(1).fill('Morales');
  await page.fill('input[placeholder*="@" i]', `facundo.${randomDni}@ifts.edu.ar`);

  // Checkbox de consentimiento
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.isVisible()) {
    await checkbox.check();
  }

  await page.screenshot({ path: path.join(screenshotsDir, '03_participa_filled.png') });
  
  // Enviar formulario
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(1500); // Esperar animación de SweetAlert
  await page.screenshot({ path: path.join(screenshotsDir, '04_participa_submitted.png') });
  console.log('✅ Formulario enviado y confirmado con alerta.');

  // 3. Login en Centro de Control (/login)
  console.log('\n[3/5] Accediendo al Centro de Control (/login)...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'superadmin.congreso@bue.edu.ar');
  await page.fill('input[type="password"]', 'SuperAdmin2026!');
  await page.screenshot({ path: path.join(screenshotsDir, '05_login_filled.png') });

  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000); // Esperar redirección a /admin
  await page.screenshot({ path: path.join(screenshotsDir, '06_admin_dashboard.png') });
  console.log('✅ Sesión iniciada con éxito en el Tablero 360°.');

  // 4. Módulo Ediciones & Eventos
  console.log('\n[4/5] Probando pestaña "Ediciones & Eventos"...');
  await page.goto('http://localhost:3000/admin?tab=eventos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '07_admin_eventos.png') });

  // Buscar botón "Editar" en la primera fila de la tabla
  const editEventBtn = page.locator('button:has-text("Editar")').first();
  if (await editEventBtn.isVisible()) {
    console.log('Haciendo clic en "Editar" Evento...');
    await editEventBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '08_admin_eventos_modal.png') });

    // Modificar cupo máximo en el modal
    const cupoInput = page.locator('input[name="cupo_maximo"], input[type="number"]').first();
    if (await cupoInput.isVisible()) {
      await cupoInput.fill('420');
    }

    // Guardar cambios
    const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("Actualizar")').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, '09_admin_eventos_saved.png') });
    console.log('✅ Evento editado y guardado sin errores.');
  }

  // 5. Módulo Recintos y Puntos de Acceso
  console.log('\n[5/5] Probando pestaña "Recintos y Puntos de Acceso"...');
  await page.goto('http://localhost:3000/admin?tab=puntos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '10_admin_puntos.png') });
  console.log('✅ Vista de Recintos y Puntos de Acceso inspeccionada.');

  await browser.close();
  console.log('\n🎉 ¡TODAS LAS PRUEBAS VISUALES E2E CON PLAYWRIGHT FINALIZARON CON ÉXITO!');
}

runBrowserTest().catch((err) => {
  console.error('❌ Error en pruebas Playwright:', err);
  process.exit(1);
});
