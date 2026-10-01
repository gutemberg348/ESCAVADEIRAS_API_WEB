// Run against a local admin server. API responses are fixtures; no data is changed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://localhost:3101';
const company = { id: 'company', name: 'Empresa de teste', active: true, _count: { machines: 1, users: 1 } };
const user = { id: 'user', name: 'Operador de teste', email: 'operador.com.nome.longo@empresa.example', companyId: company.id, active: true, role: 'SUPER_ADMIN' };
const reading = { id: 'reading', timestamp: new Date().toISOString(), voltage: 12.5, current: null, speed: 0, latitude: -7.05457, longitude: -37.27730, gpsSatellites: 6 };
const machine = { id: 'machine', code: 'ESC-001', name: 'Escavadeira de teste', companyId: company.id, company, status: 'ONLINE', active: true, assignments: [], currentState: { online: true, voltage: 12.5, gpsValid: true, latitude: reading.latitude, longitude: reading.longitude, gpsUpdatedAt: reading.timestamp }, telemetry: [reading], alerts: [], commands: [] };
const driver = { id: 'driver', user, rfidCards: [{ id: 'card', code: 'F7DB4632', active: true }], assignments: [] };
const card = { ...driver.rfidCards[0], driverProfile: driver };
const fixtures = { '/auth/me': user, '/drivers': [driver], '/rfid': [card], '/devices': [], '/companies': { data: [company] }, '/machines': { data: [machine], pagination: { total: 1 } }, '/machines/machine': machine, '/telemetry/machines/machine': [reading], '/alerts': [], '/commands': [], '/users': [user], '/firmware': [] };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const output = path.resolve(__dirname, '../../.local-logs/ui');
  fs.mkdirSync(output, { recursive: true });
  const errors = [];
  try {
    for (const width of [360, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      page.on('pageerror', err => errors.push(`${width} ${page.url()}: ${err.message}`));
      await page.addInitScript(({ user }) => {
        localStorage.setItem('empimecatronic_session', JSON.stringify({ user, accessToken: 'layout-fixture' }));
        localStorage.setItem('empimecatronic_admin_theme', 'dark');
      }, { user });
      await page.route('**/api/v1/**', route => {
        const key = new URL(route.request().url()).pathname.replace('/api/v1', '');
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixtures[key] || []) });
      });
      for (const route of ['/admin', '/admin/drivers', '/admin/rfid', '/admin/devices', '/admin/machines', '/admin/machines/new', '/admin/machines/machine', '/admin/companies', '/admin/alerts', '/admin/commands', '/admin/map', '/admin/telemetry', '/admin/users', '/admin/firmware', '/login']) {
        await page.goto(base + route);
        await page.waitForTimeout(350);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        if (overflow) {
          const offenders = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.responsive-table,.leaflet-container,.admin-sidebar')).slice(0, 8).map(el => el.className));
          errors.push(`${width} ${route}: horizontal overflow ${JSON.stringify(offenders)}`);
        }
        if (['/admin', '/admin/rfid', '/admin/drivers', '/admin/devices', '/admin/map', '/admin/telemetry', '/admin/machines/machine'].includes(route)) {
          await page.screenshot({ path: path.join(output, `${route.split('/').pop()}-${width}.png`), fullPage: true });
        }
        if (route === '/admin/rfid') {
          const badge = await page.locator('.rfid-row .status-badge').boundingBox();
          assert.ok(badge && badge.width > badge.height, 'RFID status must be a horizontal pill');
          const button = await page.getByRole('button', { name: 'Conectar leitor' }).boundingBox();
          assert.ok(button && button.height >= 44, 'USB capture touch target');
          await page.getByRole('button', { name: 'Alternar tema claro e escuro' }).click();
          await page.screenshot({ path: path.join(output, `rfid-light-${width}.png`), fullPage: true });
        }
        if (route === '/admin/map' && width === 360) {
          await page.locator('.map-asset').first().click();
          await page.getByText('Ver detalhes da máquina').waitFor();
          await page.getByRole('button', { name: 'Offline', exact: true }).click();
          await page.getByText('Nenhuma máquina corresponde a este filtro.').waitFor();
          await page.getByRole('button', { name: 'Todas', exact: true }).click();
        }
        if (route === '/admin/telemetry' && width === 360) {
          await page.getByText('Primeira leitura registrada').waitFor();
          await page.getByRole('button', { name: 'Corrente', exact: true }).click();
          await page.getByText('Nenhuma leitura de corrente neste período.').waitFor();
        }
        if (route === '/admin/drivers') {
          await page.getByRole('button', { name: 'Excluir motorista' }).waitFor();
          await page.getByRole('button', { name: 'Cadastrar operador' }).click();
          await page.getByRole('dialog').waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Create driver dialog overflow');
          await page.getByRole('button', { name: 'Fechar', exact: true }).click();
        }
        if (route === '/admin/devices' && width === 360) {
          await page.locator('select[aria-label="Escavadeira"]').selectOption('machine');
          await page.getByRole('button', { name: 'Sim, está conectada' }).click();
          await page.getByRole('button', { name: 'Sim, já está instalado' }).click();
          await page.getByPlaceholder('ESP-ESC-001').waitFor();
          await page.screenshot({ path: path.join(output, 'devices-wizard-360.png'), fullPage: true });
          await page.route('**/api/v1/devices', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'device', machineId: machine.id, machine, deviceCode: 'ESP-ESC-001', active: true, lastSeenAt: reading.timestamp }]) }));
          await page.reload();
          await page.getByRole('button', { name: 'Retirar vínculo' }).waitFor();
          await page.getByRole('button', { name: 'Ver instalação' }).click();
          await page.getByRole('button', { name: 'Sim, está conectada' }).click();
          await page.getByRole('button', { name: 'Sim, já está instalado' }).click();
          await page.getByText('Esta escavadeira já tem um ESP32 cadastrado').waitFor();
          await page.screenshot({ path: path.join(output, 'devices-existing-360.png'), fullPage: true });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Device wizard overflow');
        }
        if (route === '/admin/machines/new' && width === 360) {
          await page.getByRole('combobox', { name: 'EMPRESA *' }).selectOption('company');
          await page.getByPlaceholder('ESC-001').fill('ESC-002');
          await page.getByPlaceholder('Escavadeira principal').fill('Escavadeira nova');
          await page.getByRole('button', { name: 'Continuar' }).click();
          await page.getByText('Complete se souber').first().waitFor();
          await page.getByRole('button', { name: 'Continuar' }).click();
          await page.getByText('Confira antes de cadastrar').first().waitFor();
        }
        if (route === '/admin/machines' && width === 360) {
          await page.getByRole('button', { name: 'Excluir', exact: true }).waitFor();
        }
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS 15 pages at 360, 768 and 1440px; RFID light/dark, map, telemetry, modal, delete action, USB button and status pills. Screenshots:', output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
