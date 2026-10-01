import { prisma } from '../../infrastructure/database/prisma.js';
const include = { company: { select: { id: true, name: true } }, device: { select: { id: true, deviceCode: true, active: true, firmwareVersion: true, lastSeenAt: true, mqttClientId: true } }, currentState: true, assignments: { where: { endedAt: null }, take: 1, include: { driverProfile: { include: { user: { select: { id: true, name: true } } } } } } };
export const machineRepository = {
  list: (where, skip, take) => prisma.machine.findMany({ where: { ...where, deletedAt: null }, include, skip, take, orderBy: { updatedAt: 'desc' } }),
  count: (where) => prisma.machine.count({ where: { ...where, deletedAt: null } }),
  find: (id) => prisma.machine.findFirst({ where: { id, deletedAt: null }, include: { ...include, telemetry: { take: 30, orderBy: { timestamp: 'desc' } }, alerts: { take: 10, orderBy: { createdAt: 'desc' } }, commands: { take: 10, orderBy: { createdAt: 'desc' } } } }),
  create: (data) => prisma.machine.create({ data, include }), update: (id,data) => prisma.machine.update({ where:{id}, data, include }), remove:(id,userId) => prisma.$transaction(async (tx) => {
    const linked = await tx.device.findUnique({ where: { machineId: id } });
    if (linked) await tx.device.update({ where: { id: linked.id }, data: { machineId: null, active: false, revokedAt: new Date(), archivedAt: new Date(), hardwareSerial: null, credentialHash: null, bleSecret: null } });
    await tx.driverMachineAssignment.updateMany({ where: { machineId: id, endedAt: null }, data: { endedAt: new Date() } });
    await tx.machineCurrentState.updateMany({ where: { machineId: id }, data: { online: false, rfidCode: null, rfidStatus: 'AWAITING_CARD' } });
    const removed = await tx.machine.update({ where: { id }, data: { deletedAt: new Date(), active: false, status: 'DISABLED' } });
    await tx.auditLog.create({ data: { userId, action: 'MACHINE_ARCHIVED', resource: 'Machine', resourceId: id, metadata: { deviceCode: linked?.deviceCode || null } } });
    return removed;
  }),
  dashboard: (companyId) => prisma.machine.groupBy({ by:['status'], where: { ...(companyId ? { companyId } : {}), deletedAt:null }, _count:true })
};
