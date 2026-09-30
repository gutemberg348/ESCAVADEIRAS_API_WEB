import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { AuthorizationError, ValidationError } from '../../utils/errors.js';
import { decryptBleSecret } from '../devices/ble-secret.js';
import { telemetrySchema } from '../telemetry/telemetry.validation.js';
import { rfidCodeSchema } from '../rfid/rfid.validation.js';
import { rfidService } from '../rfid/rfid.service.js';
import { emitMachine } from '../../infrastructure/websocket/socket.js';

const wireSchema = z.object({ v: z.literal(1), deviceCode: z.string().min(1).max(50), eventId: z.string().min(1).max(90), bootId: z.string().min(1).max(40), kind: z.enum(['telemetry', 'rfid']), data: z.record(z.unknown()) });
const batchSchema = z.object({ records: z.array(z.object({ raw: z.string().min(2).max(3000), signature: z.string().regex(/^[a-f0-9]{64}$/), capturedAt: z.string().datetime() })).min(1).max(50) });
export const gatewayRouter = Router();
gatewayRouter.use(authenticate);
gatewayRouter.post('/batch', validate(batchSchema), async (req, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!actor?.active) throw new AuthorizationError();
  const accepted = [];
  for (const record of req.body.records) {
    let frame;
    try { frame = wireSchema.parse(JSON.parse(record.raw)); } catch { throw new ValidationError('Pacote Bluetooth inválido'); }
    const device = await prisma.device.findUnique({ where: { deviceCode: frame.deviceCode }, include: { machine: true } });
    if (!device?.active || device.revokedAt || !device.bleSecret || !device.machine.active || device.machine.deletedAt) throw new AuthorizationError('Dispositivo Bluetooth não provisionado ou revogado');
    if (actor.role !== 'SUPER_ADMIN' && actor.companyId !== device.machine.companyId) throw new AuthorizationError();
    const expected = crypto.createHmac('sha256', decryptBleSecret(device.bleSecret)).update(record.raw).digest();
    if (!crypto.timingSafeEqual(expected, Buffer.from(record.signature, 'hex'))) throw new AuthorizationError('Assinatura da leitura inválida');
    const capturedAt = new Date(record.capturedAt);
    if (capturedAt.getTime() > Date.now() + 60000) throw new ValidationError('Relógio do celular adiantado; ajuste data e hora');
    const live = Date.now() - capturedAt.getTime() < 30000;
    let reading, code;
    if (frame.kind === 'telemetry') {
      const parsed = telemetrySchema.safeParse(frame.data);
      if (!parsed.success) throw new ValidationError('Telemetria Bluetooth inválida');
      const { authToken, timestamp, rfidCode, ...safeReading } = parsed.data;
      reading = safeReading;
    } else {
      const parsed = rfidCodeSchema.safeParse(frame.data.code);
      if (!parsed.success) throw new ValidationError('UID inválido');
      code = parsed.data;
    }
    const outcome = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${device.id}))`;
      if (await tx.gatewayReceipt.findUnique({ where: { deviceId_eventId: { deviceId: device.id, eventId: frame.eventId } } })) return { duplicate: true };
      const current = await tx.machineCurrentState.findUnique({ where: { machineId: device.machineId } });
      const fresh = live && (!current?.gatewaySampleAt || capturedAt >= current.gatewaySampleAt);
      let rfid;
      // Do these idempotent effects before committing a receipt: a crash may retry,
      // but cannot acknowledge an RFID packet whose processing never ran.
      if (fresh) {
        await rfidService.boot(device.machine, frame.bootId);
        if (code) rfid = await rfidService.scan(device.machine, code, frame.eventId);
      }
      if (reading) {
        await tx.telemetry.create({ data: { ...reading, deviceId: device.id, machineId: device.machineId, timestamp: capturedAt,
          metadata: { ...reading.metadata, transport: 'BLE', bootId: frame.bootId, gatewayUserId: actor.id, historical: !fresh, timestampSource: 'phone' } } });
        if (fresh) {
          const gpsValid = reading.metadata?.gpsValid === true && reading.latitude != null && reading.longitude != null;
          const state = { online: true, gpsValid, gatewaySampleAt: capturedAt, voltage: reading.voltage, current: reading.metadata?.currentCalibrated ? reading.current : null, speed: gpsValid ? reading.speed : null,
            ...(gpsValid ? { latitude: reading.latitude, longitude: reading.longitude, gpsUpdatedAt: capturedAt } : {}) };
          await tx.machineCurrentState.upsert({ where: { machineId: device.machineId }, create: { machineId: device.machineId, ...state }, update: state });
          await tx.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date(), firmwareVersion: '3.0.0-ble' } });
          await tx.machine.update({ where: { id: device.machineId }, data: { status: 'ONLINE' } });
        }
      } else {
        if (fresh) await tx.machineCurrentState.updateMany({ where: { machineId: device.machineId }, data: { gatewaySampleAt: capturedAt } });
        await tx.auditLog.create({ data: { userId: actor.id, action: fresh ? 'BLE_RFID_READ' : 'BLE_RFID_OFFLINE_HISTORY', resource: 'Machine', resourceId: device.machineId, metadata: { code, capturedAt: capturedAt.toISOString(), eventId: frame.eventId } } });
      }
      await tx.gatewayReceipt.create({ data: { deviceId: device.id, eventId: frame.eventId } });
      return { fresh, rfid };
    });
    if (outcome.fresh) {
      if (reading) {
        const state = await prisma.machineCurrentState.findUnique({ where: { machineId: device.machineId } });
        emitMachine(device.machineId, 'machine:telemetry', { ...state, timestamp: capturedAt, metadata: reading.metadata });
      }
    }
    accepted.push({ eventId: frame.eventId, deviceCode: frame.deviceCode, duplicate: !!outcome.duplicate, historical: !outcome.fresh, rfid: outcome.rfid });
  }
  res.json({ accepted });
});
