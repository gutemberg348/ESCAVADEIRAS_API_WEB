// Run from backend. Uses unique fixtures and removes only those fixtures in finally.
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { companyService } from '../src/modules/companies/company.service.js';

const companyId = crypto.randomUUID();
const actorId = crypto.randomUUID();
const userId = crypto.randomUUID();
const profileId = crypto.randomUUID();
const machineId = crypto.randomUUID();
const deviceId = crypto.randomUUID();
const tokenId = crypto.randomUUID();
const cardId = crypto.randomUUID();
const suffix = crypto.randomBytes(5).toString('hex').toUpperCase();

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { userId: actorId, resourceId: companyId } });
    await tx.telemetry.deleteMany({ where: { machineId } });
    await tx.driverMachineAssignment.deleteMany({ where: { machineId } });
    await tx.rfidCard.deleteMany({ where: { id: cardId } });
    await tx.driverProfile.deleteMany({ where: { id: profileId } });
    await tx.refreshToken.deleteMany({ where: { id: tokenId } });
    await tx.device.deleteMany({ where: { id: deviceId } });
    await tx.machineCurrentState.deleteMany({ where: { machineId } });
    await tx.machine.deleteMany({ where: { id: machineId } });
    await tx.user.deleteMany({ where: { id: { in: [userId, actorId] } } });
    await tx.company.deleteMany({ where: { id: companyId } });
  });
}

try {
  await prisma.user.create({ data: { id: actorId, name: 'Archive test admin', email: `archive-admin-${suffix.toLowerCase()}@example.invalid`, passwordHash: 'test-only', role: 'SUPER_ADMIN' } });
  await prisma.company.create({ data: { id: companyId, name: `Archive test ${suffix}`, document: `TEST-${suffix}` } });
  await prisma.user.create({ data: { id: userId, companyId, name: 'Archive test driver', email: `archive-driver-${suffix.toLowerCase()}@example.invalid`, passwordHash: 'test-only', role: 'DRIVER' } });
  await prisma.driverProfile.create({ data: { id: profileId, userId } });
  await prisma.rfidCard.create({ data: { id: cardId, driverProfileId: profileId, code: `AB${suffix}CD`, active: true } });
  await prisma.refreshToken.create({ data: { id: tokenId, userId, token: `archive-token-${suffix}`, expiresAt: new Date(Date.now() + 86400000) } });
  await prisma.machine.create({ data: { id: machineId, companyId, code: `ARCHIVE-M-${suffix}`, name: 'Archive fixture', status: 'ONLINE' } });
  await prisma.device.create({ data: { id: deviceId, machineId, deviceCode: `ARCHIVE-ESP-${suffix}`, mqttClientId: `archive-client-${suffix}`, credentialHash: 'test-only', bleSecret: 'test-only' } });
  await prisma.machineCurrentState.create({ data: { machineId, online: true, rfidCode: `AB${suffix}CD`, rfidStatus: 'AUTHORIZED' } });
  await prisma.driverMachineAssignment.create({ data: { machineId, driverProfileId: profileId } });
  await prisma.telemetry.create({ data: { machineId, deviceId, timestamp: new Date(), voltage: 12.5 } });

  const actor = { sub: actorId, role: 'SUPER_ADMIN', companyId: null };
  await companyService.remove(actor, companyId);
  const [company, user, profile, card, token, machine, device, assignment, state] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.driverProfile.findUnique({ where: { id: profileId } }),
    prisma.rfidCard.findUnique({ where: { id: cardId } }),
    prisma.refreshToken.findUnique({ where: { id: tokenId } }),
    prisma.machine.findUnique({ where: { id: machineId } }),
    prisma.device.findUnique({ where: { id: deviceId } }),
    prisma.driverMachineAssignment.findFirst({ where: { machineId } }),
    prisma.machineCurrentState.findUnique({ where: { machineId } })
  ]);
  assert.ok(company.deletedAt && !company.active);
  assert.equal(company.document, null);
  assert.equal(await prisma.company.findUnique({ where: { document: `TEST-${suffix}` } }), null);
  assert.equal(user.active, false);
  assert.ok(profile.deletedAt);
  assert.equal(card.active, false);
  assert.ok(token.revokedAt);
  assert.ok(machine.deletedAt && !machine.active && machine.status === 'DISABLED');
  assert.ok(device.archivedAt && !device.active && device.machineId === null && device.credentialHash === null && device.bleSecret === null);
  assert.ok(assignment.endedAt);
  assert.equal(state.online, false);
  assert.equal(state.rfidStatus, 'AWAITING_CARD');
  assert.equal(await prisma.telemetry.count({ where: { machineId } }), 1);
  console.log('PASS: company archive revokes users, cards, sessions, machine and ESP32; historical telemetry remains.');
} finally {
  await cleanup();
  await prisma.$disconnect();
}
