import { prisma } from '../../infrastructure/database/prisma.js';

const include = {
  machine: { select: { id: true, code: true, name: true, companyId: true, status: true } }
};

export const deviceRepository = {
  list: (where) => prisma.device.findMany({ where, include, orderBy: { updatedAt: 'desc' } }),
  find: (id) => prisma.device.findUnique({ where: { id }, include }),
  findByCode: (deviceCode) => prisma.device.findUnique({ where: { deviceCode } }),
  findBySerial: (hardwareSerial) => prisma.device.findUnique({ where: { hardwareSerial } }),
  findByMachine: (machineId) => prisma.device.findUnique({ where: { machineId } }),
  create: (data) => prisma.device.create({ data, include }),
  update: (id, data) => prisma.device.update({ where: { id }, data, include }),
  audit: (data) => prisma.auditLog.create({ data }),
  archive: (device, userId) => prisma.$transaction(async (tx) => {
    const archived = await tx.device.update({
      where: { id: device.id },
      data: { active: false, revokedAt: new Date(), archivedAt: new Date(), machineId: null, hardwareSerial: null, credentialHash: null, bleSecret: null },
      include
    });
    await tx.machine.update({ where: { id: device.machineId }, data: { status: 'OFFLINE' } });
    await tx.machineCurrentState.updateMany({ where: { machineId: device.machineId }, data: { online: false, rfidCode: null, rfidStatus: 'AWAITING_CARD' } });
    await tx.auditLog.create({ data: { userId, action: 'DEVICE_ARCHIVED', resource: 'Device', resourceId: device.id, metadata: { machineId: device.machineId, deviceCode: device.deviceCode, hardwareSerial: device.hardwareSerial } } });
    return archived;
  })
};
