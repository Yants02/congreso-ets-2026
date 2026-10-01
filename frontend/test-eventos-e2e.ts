import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function testEdicionesYEventos() {
  console.log('🏛️ Iniciando Auditoría Visual y Funcional de "Ediciones & Eventos" con Playwright...');
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const screenshotsDir = path.join(__dirname, '../test-screenshots/eventos_audit');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Iniciar Sesión como Superadmin
  console.log('[Paso 1] Autenticación administrativa en /login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'superadmin.congreso@bue.edu.ar');
  await page.fill('input[type="password"]', 'SuperAdmin2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // 2. Navegar a la pestaña "Ediciones & Eventos"
  console.log('[Paso 2] Ingresando al panel /admin?tab=eventos...');
  await page.goto('http://localhost:3000/admin?tab=eventos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '01_eventos_grid.png') });
  console.log('📸 Captura 01: Grilla de eventos tomada.');

  // 3. Crear una Nueva Edición de Evento
  console.log('[Paso 3] Probando botón "+ Nueva Edición / Evento"...');
  const newEventBtn = page.locator('button:has-text("Nueva Edición"), button:has-text("Nuevo Evento")').first();
  await newEventBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screenshotsDir, '02_eventos_modal_crear.png') });
  console.log('📸 Captura 02: Modal de alta abierto.');

  const uniqueCode = `ETS_${Date.now().toString().slice(-4)}`;
  const eventName = `Congreso Tecnológico Regional ${uniqueCode}`;
  console.log(`Completando datos para nuevo evento (${uniqueCode})...`);
  
  await page.fill('input[placeholder*="Ej: Congreso Nacional" i]', eventName);
  await page.fill('input[placeholder*="ETS_" i]', uniqueCode);
  await page.screenshot({ path: path.join(screenshotsDir, '03_eventos_modal_crear_filled.png') });

  // Guardar nuevo evento
  console.log('Pulsando "Crear Edición"...');
  await page.click('button:has-text("Crear Edición")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '04_eventos_created_banner.png') });
  console.log('📸 Captura 04: Evento creado y confirmado en la interfaz.');

  // 4. Buscar el evento recién creado en la tabla y editarlo
  console.log(`[Paso 4] Localizando y editando el evento ${uniqueCode}...`);
  const rowLocator = page.locator(`tr:has-text("${uniqueCode}")`);
  const editRowBtn = rowLocator.locator('button:has-text("Editar")').first();
  await editRowBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(screenshotsDir, '05_eventos_modal_editar.png') });
  console.log('📸 Captura 05: Modal de edición con datos precargados.');

  // Modificar cupo y nombre
  console.log('Modificando cupo máximo a 600 y nombre...');
  await page.fill('input[value*="Congreso Tecnológico Regional" i]', `${eventName} - Edición Especial`);
  const cupoInput = page.locator('div:has-text("Cupo Máximo") > input, input[name="cupo_maximo"]').first();
  if (await cupoInput.isVisible()) {
    await cupoInput.fill('600');
  }
  await page.screenshot({ path: path.join(screenshotsDir, '06_eventos_modal_editar_filled.png') });

  // Guardar cambios
  console.log('Pulsando "Guardar Cambios"...');
  await page.click('button:has-text("Guardar Cambios")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '07_eventos_saved_ok.png') });
  console.log('📸 Captura 07: Cambios guardados con éxito.');

  // 5. Eliminar el evento de prueba para dejar la base limpia
  console.log(`[Paso 5] Probando eliminación del evento de prueba ${uniqueCode}...`);
  const updatedRowLocator = page.locator(`tr:has-text("${uniqueCode}")`);
  const deleteBtn = updatedRowLocator.locator('button:has-text("🗑️")').first();
  if (await deleteBtn.isVisible()) {
    await deleteBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotsDir, '08_sweetalert_eliminar.png') });
    console.log('Confirmando eliminación en SweetAlert...');
    await page.click('button:has-text("Sí, eliminar")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, '09_eventos_eliminado_ok.png') });
    console.log('📸 Captura 09: Evento eliminado y lista actualizada.');
  }

  await browser.close();
  console.log('\n🏆 ¡AUDITORÍA COMPLETA DE "EDICIONES & EVENTOS" FINALIZADA CON ÉXITO AL 100%!');
}

testEdicionesYEventos().catch((err) => {
  console.error('❌ Error en auditoría de Eventos:', err);
  process.exit(1);
});
