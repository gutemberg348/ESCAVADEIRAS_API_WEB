import assert from 'node:assert/strict';
import { createDeviceSchema } from '../src/modules/devices/device.validation.js';

const machineId = '11111111-1111-4111-8111-111111111111';
const result = createDeviceSchema.parse({ machineId, deviceCode: 'ESP-TESTE 777777-CH91' });
assert.equal(result.deviceCode, 'ESP-TESTE-777777-CH91');

const invalid = createDeviceSchema.safeParse({ machineId, deviceCode: 'ESP-TESTE/CH91' });
assert.equal(invalid.success, false);
assert.match(invalid.error.issues[0].message, /letras, números, hífen/);

console.log('PASS: código com espaço normalizado; pontuação inválida recebe mensagem específica.');
