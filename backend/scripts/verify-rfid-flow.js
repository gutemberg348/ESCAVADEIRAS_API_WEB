// Run from backend: node scripts/verify-rfid-flow.js (API and Docker must be running).
// Fixtures use unique IDs and are deleted in finally; existing machines are untouched.
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { encryptBleSecret } from '../src/modules/devices/ble-secret.js';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);
const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
const run = crypto.randomBytes(6).toString('hex');
const companyId = crypto.randomUUID();
const otherCompanyId = crypto.randomUUID();
const machineId = crypto.randomUUID();
const secondMachineId = crypto.randomUUID();
const machineIds = [machineId, secondMachineId];
const deviceId = crypto.randomUUID();
const adminId = crypto.randomUUID();
const deviceCode = `VERIFY-${run}`;
const secret = crypto.randomBytes(32).toString('base64url');
const uid = crypto.randomBytes(7).toString('hex').toUpperCase();
const otherUid = crypto.randomBytes(7).toString('hex').toUpperCase();
const password = `Verify-${run}!`;
const token = jwt.sign({ sub: adminId, role: 'SUPER_ADMIN', companyId, sv: 0 }, process.env.JWT_SECRET, { expiresIn: '5m' });
const sockets = [];
let client;
let serial = 0;
async function request(path, { method = 'GET', body, accessToken = token, status = 200 } = {}) {
  const response = await fetch(`${base}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let attempt = 0; attempt < 60; attempt++) { const value = await check(); if (value) return value; await pause(100); }
  throw new Error(`Timeout: ${label}`);
}
async function scan(code, options = {}) {
  const event = { type: 'RFID_SCAN', eventId: options.eventId || `verify-${++serial}`, bootId: options.bootId || 'boot-one', code, authToken: secret };
  const response = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.off('message', receive); reject(new Error('RFID acknowledgement timeout')); }, 8000);
    function receive(topic, bytes) {
      if (topic !== `machines/${deviceCode}/rfid-result`) return;
      const result = JSON.parse(bytes.toString());
      if (result.eventId !== event.eventId) return;
      clearTimeout(timer); client.off('message', receive); resolve(result);
    }
    client.on('message', receive);
  });
  client.publish(`machines/${deviceCode}/events`, JSON.stringify(event), { qos: 1 });
  return response;
}
const active = () => prisma.driverMachineAssignment.findMany({ where: { machineId, endedAt: null } });

try {
  await prisma.company.createMany({ data: [{ id: companyId, name: `VERIFY ${run}` }, { id: otherCompanyId, name: `VERIFY OTHER ${run}` }] });
  await prisma.user.create({ data: { id: adminId, companyId, role: 'SUPER_ADMIN', name: 'Verification admin', email: `verify-admin-${run}@example.invalid`, passwordHash: await bcrypt.hash(password, 4) } });
  await prisma.machine.create({ data: { id: machineId, companyId, code: deviceCode, name: 'Temporary RFID integration fixture', currentState: { create: { online: true } }, device: { create: { id: deviceId, deviceCode, mqttClientId: deviceCode, credentialHash: await bcrypt.hash(secret, 4) } } } });
  await prisma.machine.create({ data: { id: secondMachineId, companyId, code: `${deviceCode}-2`, name: 'Temporary assignment fixture' } });
  client = await mqtt.connectAsync(process.env.MQTT_URL, { username: process.env.MQTT_USERNAME || undefined, password: process.env.MQTT_PASSWORD || undefined });
  await client.subscribeAsync(`machines/${deviceCode}/rfid-result`);
  const driver = await request('/drivers', { method: 'POST', status: 201, body: { companyId, name: 'USB Driver', email: `verify-driver-${run}@example.invalid`, password, cardCode: uid.match(/../g).join(':').toLowerCase() } });
  assert.equal(driver.driverProfile.rfidCards[0].code, uid);
  assert.equal(driver.passwordHash, undefined);
  await request('/drivers', { method: 'POST', status: 409, body: { companyId, name: 'Duplicate', email: `verify-duplicate-${run}@example.invalid`, password, cardCode: uid } });
  assert.equal(await prisma.user.count({ where: { email: `verify-duplicate-${run}@example.invalid` } }), 0, 'Duplicate card must rollback member creation');
  console.log('PASS member creation, USB UID normalization, duplicate card rollback');

  const second = await request('/drivers', { method: 'POST', status: 201, body: { companyId, name: 'Machine Driver', email: `verify-second-${run}@example.invalid`, password } });
  const login = await request('/auth/login', { method: 'POST', body: { email: driver.email, password } });
  assert.equal(await request('/drivers/me/machine', { accessToken: login.accessToken }), null);
  const socket = io(base, { auth: { token: login.accessToken }, transports: ['websocket'] }); sockets.push(socket);
  let changes = 0; let telemetryMessages = 0;
  socket.on('assignment:changed', () => changes++);
  socket.on('machine:telemetry', () => telemetryMessages++);
  await until(() => socket.connected, 'driver socket connection without machine');

  assert.equal((await scan(uid)).status, 'AUTHORIZED');
  await until(() => changes > 0, 'assignment notification');
  assert.equal((await request('/drivers/me/machine', { accessToken: login.accessToken })).id, machineId);
  assert.equal((await active()).length, 1);
  const duplicate = 'duplicate-one';
  await scan(uid, { eventId: duplicate }); await scan(uid, { eventId: duplicate });
  assert.equal((await active()).length, 1);
  console.log('PASS real MQTT authorization, acknowledgement, deduplication, app discovery');

  const capture = await request('/rfid/captures', { method: 'POST', status: 201, body: { machineId } });
  await request('/rfid/captures', { method: 'POST', status: 409, body: { machineId } });
  assert.equal((await scan(otherUid)).status, 'CAPTURED');
  const captured = await request(`/rfid/captures/${machineId}/${capture.id}`);
  assert.equal(captured.code, otherUid);
  assert.equal((await active())[0].driverProfileId, driver.driverProfile.id, 'Enrollment must not change operator');
  await scan(uid);
  assert.equal((await request(`/rfid/captures/${machineId}/${capture.id}`)).code, otherUid, 'First scan wins');
  await request('/rfid', { method: 'POST', status: 201, body: { code: captured.code, driverProfileId: second.driverProfile.id } });
  await request(`/rfid/captures/${machineId}/${capture.id}`, { method: 'DELETE', status: 204 });
  console.log('PASS machine capture, exclusive session, first scan wins, card registration');

  socket.emit('machine:join', machineId); await pause(150);
  client.publish(`machines/${deviceCode}/telemetry`, JSON.stringify({ authToken: secret, latitude: -7.11, longitude: -34.86, voltage: 12.4, speed: 0, metadata: { gpsValid: true, currentCalibrated: false, bootId: 'boot-one' } }));
  await until(() => telemetryMessages > 0, 'authorized telemetry socket');
  let state = await prisma.machineCurrentState.findUnique({ where: { machineId } });
  assert.equal(state.gpsValid, true); assert.equal(state.current, null);
  await scan(otherUid);
  assert.equal((await request('/drivers/me/machine', { accessToken: login.accessToken })), null);
  await request(`/machines/${machineId}`, { accessToken: login.accessToken, status: 403 });
  const before = telemetryMessages;
  client.publish(`machines/${deviceCode}/telemetry`, JSON.stringify({ authToken: secret, metadata: { gpsValid: false, bootId: 'boot-one' } }));
  await until(async () => (await prisma.machineCurrentState.findUnique({ where: { machineId } })).gpsValid === false, 'GPS stale state');
  await pause(150); assert.equal(telemetryMessages, before, 'Previous driver must leave socket room');
  state = await prisma.machineCurrentState.findUnique({ where: { machineId } });
  assert.equal(state.latitude, -7.11); assert.equal(state.longitude, -34.86); assert.ok(state.gpsUpdatedAt);
  console.log('PASS GPS pipeline, uncalibrated current, stale position, operator handover/revocation');

  const unknownUid = crypto.randomBytes(7).toString('hex').toUpperCase();
  assert.equal((await scan(unknownUid)).status, 'DENIED'); assert.equal((await active()).length, 0);
  const foreign = await request('/drivers', { method: 'POST', status: 201, body: { companyId: otherCompanyId, name: 'Other Company', email: `verify-other-${run}@example.invalid`, password, cardCode: unknownUid } });
  assert.equal((await scan(unknownUid)).status, 'DENIED');
  await scan(uid);
  await request(`/rfid/${driver.driverProfile.rfidCards[0].id}`, { method: 'PATCH', body: { active: false } });
  assert.equal((await active()).length, 0);
  assert.equal((await scan(uid)).status, 'DENIED');
  await scan(otherUid);
  client.publish(`machines/${deviceCode}/status`, JSON.stringify({ authToken: secret, online: true, bootId: 'boot-two', firmware: '2.1.0-arduino' }));
  await until(async () => (await active()).length === 0, 'reboot requires new card');
  assert.equal((await scan(otherUid, { bootId: 'boot-two' })).status, 'AUTHORIZED');
  console.log('PASS unknown/foreign/disabled cards and device reboot');

  await request('/rfid', { accessToken: login.accessToken, status: 403 });
  const scopedToken = jwt.sign({ sub: foreign.id, role: 'COMPANY_ADMIN', companyId: otherCompanyId, sv: 0 }, process.env.JWT_SECRET, { expiresIn: '5m' });
  await request('/rfid/captures', { method: 'POST', accessToken: scopedToken, status: 403, body: { machineId } });
  await request('/drivers', { method: 'POST', accessToken: scopedToken, status: 403, body: { companyId, name: 'Invalid scope', email: `invalid-${run}@example.invalid`, password } });
  await request('/rfid', { method: 'POST', status: 400, body: { driverProfileId: second.driverProfile.id, code: '12345' } });
  console.log('PASS role/company boundaries and UID validation');
  await Promise.all(machineIds.map(id => request(`/drivers/${second.driverProfile.id}/assignments`, { method: 'POST', status: 201, body: { machineId: id } })));
  assert.equal(await prisma.driverMachineAssignment.count({ where: { driverProfileId: second.driverProfile.id, endedAt: null } }), 1, 'A driver must have only one active machine under concurrent assignments');
  console.log('PASS simultaneous assignments preserve one active machine');
  let outgoing;
  const receiveCommand = (topic, bytes) => { if (topic === `machines/${deviceCode}/commands`) outgoing = JSON.parse(bytes.toString()); };
  client.on('message', receiveCommand);
  await client.subscribeAsync(`machines/${deviceCode}/commands`);
  const command = await request(`/commands/machines/${machineId}`, { method: 'POST', status: 201, body: { type: 'BEEP' } });
  await until(() => outgoing?.commandId === command.id, 'BEEP MQTT delivery');
  for (const status of ['RECEIVED', 'EXECUTED']) {
    client.publish(`machines/${deviceCode}/ack`, JSON.stringify({ commandId: command.id, status, authToken: secret }));
    await until(async () => (await prisma.command.findUnique({ where: { id: command.id } })).status === status, `command ${status}`);
  }
  await request(`/commands/machines/${machineId}`, { method: 'POST', status: 400, body: { type: 'RELAY_OFF' } });
  client.off('message', receiveCommand);
  console.log('PASS BEEP command/ACK transport and disabled relay command');
  await prisma.device.update({ where: { id: deviceId }, data: { bleSecret: encryptBleSecret(secret) } });
  const bleRecord = (eventId, kind, data, capturedAt = new Date().toISOString()) => {
    const raw = JSON.stringify({ v: 1, deviceCode, eventId, bootId: 'ble-boot', kind, ageMs: 0, data });
    return { raw, signature: crypto.createHmac('sha256', secret).update(raw).digest('hex'), capturedAt };
  };
  const upload = (record, options = {}) => request('/gateway/batch', { method: 'POST', body: { records: [record] }, ...options });
  const bleLive = bleRecord('ble-live', 'telemetry', { latitude: -8.5, longitude: -35.2, voltage: 12.6, metadata: { gpsValid: true, currentCalibrated: false } });
  const firstBle = await upload(bleLive);
  assert.equal(firstBle.accepted[0].historical, false);
  assert.equal((await upload(bleLive)).accepted[0].duplicate, true);
  const blePast = bleRecord('ble-history', 'telemetry', { latitude: -9, longitude: -36, voltage: 11.1, metadata: { gpsValid: true } }, new Date(Date.now() - 3600000).toISOString());
  assert.equal((await upload(blePast)).accepted[0].historical, true);
  assert.equal((await prisma.machineCurrentState.findUnique({ where: { machineId } })).latitude, -8.5, 'Historical sync must not replace live position');
  assert.equal(await prisma.telemetry.count({ where: { machineId, latitude: -8.5 } }), 1, 'Duplicate HTTP sends create only one reading');
  await upload({ ...bleLive, signature: '0'.repeat(64) }, { status: 403 });
  await upload(bleLive, { accessToken: scopedToken, status: 403 });
  await upload(bleRecord('ble-live-rfid', 'rfid', { code: otherUid }));
  const bleAssignment = (await active())[0].driverProfileId;
  await upload(bleRecord('ble-old-rfid', 'rfid', { code: uid }, new Date(Date.now() - 3600000).toISOString()));
  assert.equal((await active())[0].driverProfileId, bleAssignment, 'Offline RFID is history, not a retroactive assignment');
  console.log('PASS signed BLE gateway, offline history, deduplication, tamper rejection and stale RFID');
  console.log('RFID + GPS integration verified successfully.');
} finally {
  sockets.forEach(socket => socket.close());
  if (client) await client.endAsync();
  await redis.del(`rfid:capture:${machineId}`, `machine:${machineId}:state`);
  const keys = await redis.keys(`rfid:result:${deviceId}:*`);
  if (keys.length) await redis.del(...keys);
  const users = await prisma.user.findMany({ where: { companyId: { in: [companyId, otherCompanyId] } }, select: { id: true } });
  const userIds = users.map(user => user.id);
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { resourceId: { in: machineIds } }] } }),
    prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.alert.deleteMany({ where: { machineId } }),
    prisma.gatewayReceipt.deleteMany({ where: { deviceId } }),
    prisma.commandEvent.deleteMany({ where: { command: { machineId } } }),
    prisma.command.deleteMany({ where: { machineId } }),
    prisma.telemetry.deleteMany({ where: { machineId } }),
    prisma.driverMachineAssignment.deleteMany({ where: { machineId: { in: machineIds } } }),
    prisma.rfidCard.deleteMany({ where: { driverProfile: { userId: { in: userIds } } } }),
    prisma.driverProfile.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.machineCurrentState.deleteMany({ where: { machineId: { in: machineIds } } }),
    prisma.device.deleteMany({ where: { id: deviceId } }),
    prisma.machine.deleteMany({ where: { id: { in: machineIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } })
  ]);
  await prisma.$disconnect(); await redis.quit();
  console.log('Temporary integration fixtures removed.');
}
