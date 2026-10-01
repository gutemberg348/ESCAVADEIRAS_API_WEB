// Local database only. Creates isolated fixtures and removes them after testing.
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { app } from '../src/app.js';
import { createSocketServer } from '../src/infrastructure/websocket/socket.js';

assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Use only a local test database');
const companyId = crypto.randomUUID();
const foreignCompanyId = crypto.randomUUID();
const suffix = crypto.randomBytes(8).toString('hex');
const companyIds = [companyId, foreignCompanyId];
const server = http.createServer(app);
const socketServer = createSocketServer(server);
let socket;
let token;
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const sign = user => jwt.sign({ sub: user.id, role: user.role, companyId: user.companyId, sv: user.sessionVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '5m' });
async function request(path, method = 'GET', body, expected = 200, accessToken = token) {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
try {
  await prisma.company.createMany({ data: companyIds.map(id => ({ id, name: `Delete test ${suffix}` })) });
  const admin = await prisma.user.create({ data: { companyId, name: 'Delete test admin', email: `admin-${suffix}@example.invalid`, passwordHash: 'unused', role: 'COMPANY_ADMIN' } });
  const foreign = await prisma.user.create({ data: { companyId: foreignCompanyId, name: 'Foreign admin', email: `foreign-${suffix}@example.invalid`, passwordHash: 'unused', role: 'COMPANY_ADMIN' } });
  token = sign(admin);
  const password = `Password-${suffix}!`;
  const driver = await request('/drivers', 'POST', { companyId, name: 'Temporary driver', email: `driver-${suffix}@example.invalid`, password, cardCode: 'AB' + suffix.slice(0, 6).toUpperCase() }, 201);
  const profileId = driver.driverProfile.id;
  const card = driver.driverProfile.rfidCards[0];
  const login = await request('/auth/login', 'POST', { email: driver.email, password });
  const machine = await prisma.machine.create({ data: { companyId, code: `DEL-${suffix}`, name: 'Temporary machine' } });
  await request(`/drivers/${profileId}/assignments`, 'POST', { machineId: machine.id }, 201);
  socket = io(base.replace('/api/v1', ''), { auth: { token: login.accessToken }, transports: ['websocket'], reconnection: false });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Socket timeout')), 5000); socket.once('connect', () => { clearTimeout(timer); resolve(); }); });
  await request(`/drivers/${profileId}`, 'DELETE', undefined, 403, sign(foreign));
  await request(`/drivers/${profileId}`, 'DELETE', undefined, 403, login.accessToken);
  await request(`/drivers/${profileId}`, 'DELETE', undefined, 204);
  assert.equal((await request('/drivers')).some(item => item.id === profileId), false);
  assert.equal((await prisma.user.findUnique({ where: { id: driver.id } })).active, false);
  assert.ok((await prisma.driverProfile.findUnique({ where: { id: profileId } })).deletedAt);
  assert.equal((await prisma.rfidCard.findUnique({ where: { id: card.id } })).active, false);
  assert.equal(await prisma.driverMachineAssignment.count({ where: { driverProfileId: profileId, endedAt: null } }), 0);
  assert.equal(await prisma.driverMachineAssignment.count({ where: { driverProfileId: profileId } }), 1, 'History must survive');
  assert.equal((await prisma.machineCurrentState.findUnique({ where: { machineId: machine.id } })).rfidStatus, 'AWAITING_CARD');
  await request('/auth/me', 'GET', undefined, 401, login.accessToken);
  await request('/devices', 'GET', undefined, 401, login.accessToken);
  await request('/auth/login', 'POST', { email: driver.email, password }, 401);
  await request(`/rfid/${card.id}`, 'PATCH', { active: true }, 403);
  await request(`/drivers/${profileId}/assignments`, 'POST', { machineId: machine.id }, 403);
  await request(`/drivers/${profileId}`, 'DELETE', undefined, 204);
  assert.equal(await prisma.auditLog.count({ where: { resourceId: profileId, action: 'DRIVER_DELETED' } }), 1);
  assert.equal(await prisma.refreshToken.count({ where: { userId: driver.id, revokedAt: null } }), 0);
  const replacement = await request('/drivers', 'POST', { companyId, name: 'Replacement', email: `replacement-${suffix}@example.invalid`, password }, 201);
  const reused = await request('/rfid', 'POST', { driverProfileId: replacement.driverProfile.id, code: card.code });
  assert.equal(reused.driverProfileId, replacement.driverProfile.id);
  assert.equal(reused.active, true);
  // Give the client one event-loop turn to observe the server disconnect.
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(socket.connected, false);
  console.log('PASS deletion: company/role boundaries, history, card revocation/reuse, assignment cleanup, token revocation, socket disconnect, idempotency.');
} finally {
  socket?.close();
  await new Promise(resolve => socketServer.close(resolve));
  const users = await prisma.user.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
  const ids = users.map(user => user.id);
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { userId: { in: ids } } }),
    prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } }),
    prisma.driverMachineAssignment.deleteMany({ where: { driverProfile: { userId: { in: ids } } } }),
    prisma.rfidCard.deleteMany({ where: { driverProfile: { userId: { in: ids } } } }),
    prisma.driverProfile.deleteMany({ where: { userId: { in: ids } } }),
    prisma.machineCurrentState.deleteMany({ where: { machine: { companyId: { in: companyIds } } } }),
    prisma.machine.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
    prisma.company.deleteMany({ where: { id: { in: companyIds } } })
  ]);
  await prisma.$disconnect();
  console.log('Temporary deletion fixtures removed.');
}
