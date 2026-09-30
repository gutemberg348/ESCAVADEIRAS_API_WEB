import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const firmwareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = process.argv.find((argument) => argument.toLowerCase().endsWith('.json'));
if (!manifestPath) {
  throw new Error('Uso: node tools/provision.mjs arquivo-provisioning.json --network-file network.local.json');
}

function option(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
const useBle = process.argv.includes('--ble');
const mqttUrl = new URL(manifest.mqtt.url);
const hardware = manifest.device.hardwareConfig || {};
const mqttTls = mqttUrl.protocol === 'mqtts:';
if (!useBle && mqttTls) throw new Error('Este firmware usa WiFiClient sem TLS. Para produção, implemente WiFiClientSecure com CA antes de usar mqtts.');
if (!useBle && ['localhost', '127.0.0.1', '::1'].includes(mqttUrl.hostname)) throw new Error('O ESP32 precisa do IP LAN ou domínio do broker. Configure MQTT_PUBLIC_URL no backend e gere o manifesto novamente.');
const defaultPort = mqttTls ? 8883 : 1883;
const networkPath = option('--network-file');
const network = networkPath ? JSON.parse(fs.readFileSync(path.resolve(networkPath), 'utf8')) : manifest.network || {};
const wifiSsid = option('--ssid', network.wifiSsid || 'SUA_REDE_WIFI');
const wifiPassword = option('--wifi-password', network.wifiPassword ?? 'SUA_SENHA_WIFI');
if (!useBle && (!wifiSsid || wifiSsid === 'SUA_REDE_WIFI' || wifiSsid.startsWith('PREENCHA_') || wifiPassword === 'SUA_SENHA_WIFI' || wifiPassword.startsWith('PREENCHA_'))) {
  throw new Error('Preencha nome e senha do Wi-Fi em network.local.json antes de gerar o firmware.');
}
const quote = (value) => JSON.stringify(String(value));

const content = `#pragma once
// Gerado automaticamente. Não publique este arquivo no Git.
#define EMP_USE_BLE ${useBle ? 1 : 0}
#define EMP_DEVICE_CODE ${quote(manifest.device.code)}
#define EMP_DEVICE_TOKEN ${quote(manifest.device.token)}
#define EMP_MQTT_CLIENT_ID ${quote(manifest.mqtt.clientId)}
#define EMP_MQTT_USERNAME ${quote(manifest.mqtt.username)}
#define EMP_MQTT_PASSWORD ${quote(manifest.mqtt.password)}
#define EMP_MQTT_HOST ${quote(mqttUrl.hostname)}
#define EMP_MQTT_PORT ${Number(mqttUrl.port || defaultPort)}
#define EMP_MQTT_USE_TLS ${mqttTls ? 'true' : 'false'}
#define EMP_WIFI_SSID ${quote(wifiSsid)}
#define EMP_WIFI_PASSWORD ${quote(wifiPassword)}
#define EMP_TELEMETRY_INTERVAL_MS ${Number(hardware.telemetryIntervalMs || 1000)}UL
#define EMP_HEARTBEAT_INTERVAL_MS ${Number(hardware.heartbeatIntervalMs || 30000)}UL
#define EMP_VOLTAGE_SCALE ${Number(hardware.voltageScale || 5).toFixed(3)}F
#define EMP_CURRENT_ZERO_MV ${Number(hardware.currentZeroMv ?? 390).toFixed(2)}F
#define EMP_CURRENT_SENSITIVITY_MVA ${Number(hardware.currentSensitivityMvA ?? 0).toFixed(2)}F
`;

const target = path.join(firmwareRoot, 'TechCode_Escavadeira', 'src', 'config', 'provisioned_config.h');
fs.writeFileSync(target, content, { mode: 0o600 });
console.log(`Configuração Arduino criada para ${manifest.device.code}:`);
console.log(target);
console.log('Abra TechCode_Escavadeira/TechCode_Escavadeira.ino na Arduino IDE e envie para a placa.');
