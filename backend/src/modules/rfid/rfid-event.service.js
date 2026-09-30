import { prisma } from '../../infrastructure/database/prisma.js';
import { redis } from '../../infrastructure/redis/redis.client.js';
import { getMqttClient } from '../../infrastructure/mqtt/mqtt.client.js';
import { verifyDeviceCredential } from '../devices/device-auth.service.js';
import { NotFoundError } from '../../utils/errors.js';
import { rfidEventSchema } from './rfid.validation.js';
import { rfidService } from './rfid.service.js';

export async function receiveRfidEvent(deviceCode, raw) {
  const event = rfidEventSchema.parse(raw);
  const device = await prisma.device.findUnique({ where: { deviceCode }, include: { machine: true } });
  if (!device?.active || !device.machine.active || device.machine.deletedAt) throw new NotFoundError('Dispositivo ou máquina inativo');
  await verifyDeviceCredential(device, event.authToken);
  const cacheKey = `rfid:result:${device.id}:${event.eventId}`;
  const cached = await redis.get(cacheKey);
  let result;
  if (cached) result = JSON.parse(cached);
  else {
    await rfidService.boot(device.machine, event.bootId);
    result = await rfidService.scan(device.machine, event.code, event.eventId);
    result = { eventId: event.eventId, status: result.status, authorized: result.authorized, driver: result.driver };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 600);
  }
  getMqttClient()?.publish(`machines/${deviceCode}/rfid-result`, JSON.stringify(result), { qos: 1, retain: false });
  return result;
}
