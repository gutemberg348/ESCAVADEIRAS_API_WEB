import { env } from '../../config/env.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { emitMachine } from '../../infrastructure/websocket/socket.js';
import { logger } from '../../infrastructure/logger/logger.js';

let timer;

async function markStaleDevicesOffline() {
  const cutoff = new Date(Date.now() - env.OFFLINE_AFTER_SECONDS * 1000);
  const stale = await prisma.device.findMany({
    where: { active: true, lastSeenAt: { lt: cutoff }, machine: { active: true, status: 'ONLINE' } },
    select: { machineId: true, deviceCode: true, lastSeenAt: true }
  });
  for (const device of stale) {
    await prisma.$transaction([
      prisma.machine.update({ where: { id: device.machineId }, data: { status: 'OFFLINE' } }),
      prisma.machineCurrentState.upsert({ where: { machineId: device.machineId }, create: { machineId: device.machineId, online: false }, update: { online: false } })
    ]);
    emitMachine(device.machineId, 'machine:status', { machineId: device.machineId, status: 'OFFLINE', online: false, lastSeenAt: device.lastSeenAt });
    logger.warn({ event: 'machine_offline', machineId: device.machineId, deviceCode: device.deviceCode }, 'Heartbeat timeout');
  }
}

export function startOfflineMonitor() {
  const intervalMs = Math.max(15000, Math.min(env.OFFLINE_AFTER_SECONDS * 500, 60000));
  timer = setInterval(() => markStaleDevicesOffline().catch((error) => logger.error({ error }, 'Offline monitor failed')), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
