// One-time bench provisioning. Does not replace credentials of an already installed device.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const firmwareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(firmwareRoot, 'provisioning.local.json');
const deviceCode = process.argv[2] || 'DEV-ESC-001';
const base = process.env.EMP_API_URL || 'http://localhost:3000/api/v1';
async function call(route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return data;
}
if (!fs.existsSync(target)) {
  const login = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: process.env.EMP_ADMIN_EMAIL || 'admin@demo.local', password: process.env.EMP_ADMIN_PASSWORD || 'Demo@123' }) });
  const headers = { Authorization: `Bearer ${login.accessToken}` };
  const devices = await call('/devices', { headers });
  const device = devices.find(item => item.deviceCode === deviceCode);
  if (!device) throw new Error('Cadastre o dispositivo no admin primeiro');
  if (device.provisionedAt) throw new Error('Este dispositivo já foi provisionado. Use o manifesto existente ou renove a credencial pelo admin.');
  const result = await call(`/devices/${device.id}/rotate-credentials`, { method: 'POST', headers });
  fs.writeFileSync(target, JSON.stringify(result.provisioning, null, 2), { flag: 'wx', mode: 0o600 });
}
const saved = JSON.parse(fs.readFileSync(target, 'utf8'));
if (saved.device.code !== deviceCode) throw new Error('O manifesto local pertence a outro dispositivo');
const child = spawnSync(process.execPath, [path.join(firmwareRoot, 'tools/provision.mjs'), target, '--ble'], { stdio: 'inherit' });
process.exitCode = child.status || 0;
