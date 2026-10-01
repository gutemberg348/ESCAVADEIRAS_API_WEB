// Run from backend after `npx prisma migrate deploy`. Creates and removes only its own fixtures.
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { deviceRepository } from '../src/modules/devices/device.repository.js';
import { machineRepository } from '../src/modules/machines/machine.repository.js';

const companyId = crypto.randomUUID();
const userId = crypto.randomUUID();
const machineId = crypto.randomUUID();
const firstId = crypto.randomUUID();
const secondId = crypto.randomUUID();
const suffix = crypto.randomBytes(5).toString('hex').toUpperCase();
const firstCode = `VERIFY-ESP-${suffix}-1`;
const secondCode = `VERIFY-ESP-${suffix}-2`;
const serial = `VERIFY-SERIAL-${suffix}`;

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { userId } });
    await tx.telemetry.deleteMany({ where: { machineId } });
    await tx.device.deleteMany({ where: { id: { in: [firstId, secondId] } } });
    await tx.machineCurrentState.deleteMany({ where: { machineId } });
    await tx.machine.deleteMany({ where: { id: machineId } });
    await tx.user.deleteMany({ where: { id: userId } });
    await tx.company.deleteMany({ where: { id: companyId } });
  });
}

try {
  await prisma.company.create({ data: { id: companyId, name: `Lifecycle test ${suffix}` } });
  await prisma.user.create({ data: { id: userId, companyId, name: 'Test operator', email: `lifecycle-${suffix.toLowerCase()}@example.invalid`, passwordHash: 'not-a-login', role: 'SUPER_ADMIN' } });
  await prisma.machine.create({ data: { id: machineId, companyId, code: `VERIFY-M-${suffix}`, name: 'Machine lifecycle fixture', status: 'ONLINE' } });
  await prisma.device.create({ data: { id: firstId, machineId, deviceCode: firstCode, hardwareSerial: serial, mqttClientId: `verify-client-${suffix}-1`, credentialHash: 'test-only', bleSecret: 'test-only', active: true } });
  await prisma.machineCurrentState.create({ data: { machineId, online: true, rfidCode: 'ABCD1234', rfidStatus: 'AUTHORIZED' } });
  await prisma.telemetry.create({ data: { machineId, deviceId: firstId, timestamp: new Date(), voltage: 12.5 } });

  await deviceRepository.archive(await deviceRepository.find(firstId), userId);
  const first = await prisma.device.findUnique({ where: { id: firstId } });
  assert.equal(first.machineId, null);
  assert.equal(first.active, false);
  assert.equal(first.hardwareSerial, null);
  assert.equal(first.credentialHash, null);
  assert.ok(first.archivedAt);
  assert.equal(await prisma.telemetry.count({ where: { deviceId: firstId } }), 1);
  assert.equal(await deviceRepository.findByMachine(machineId), null);
  assert.equal((await prisma.machineCurrentState.findUnique({ where: { machineId } })).rfidStatus, 'AWAITING_CARD');

  await prisma.device.create({ data: { id: secondId, machineId, deviceCode: secondCode, hardwareSerial: serial, mqttClientId: `verify-client-${suffix}-2`, active: true } });
  assert.equal((await deviceRepository.findByMachine(machineId)).id, secondId);
  await machineRepository.remove(machineId, userId);
  const second = await prisma.device.findUnique({ where: { id: secondId } });
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  assert.equal(second.machineId, null);
  assert.equal(second.active, false);
  assert.ok(second.archivedAt);
  assert.ok(machine.deletedAt);
  assert.equal(await prisma.telemetry.count({ where: { deviceId: firstId } }), 1);
  console.log('PASS: device archive frees machine and serial; machine archive revokes replacement; telemetry remains.');
} finally {
  await cleanup();
  await prisma.$disconnect();
}
