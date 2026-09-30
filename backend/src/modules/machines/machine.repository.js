import { prisma } from '../../infrastructure/database/prisma.js';
const include = { company: { select: { id: true, name: true } }, device: { select: { id: true, deviceCode: true, active: true, firmwareVersion: true, lastSeenAt: true, mqttClientId: true } }, currentState: true, assignments: { where: { endedAt: null }, take: 1, include: { driverProfile: { include: { user: { select: { id: true, name: true } } } } } } };
export const machineRepository = {
  list: (where, skip, take) => prisma.machine.findMany({ where: { ...where, deletedAt: null }, include, skip, take, orderBy: { updatedAt: 'desc' } }),
  count: (where) => prisma.machine.count({ where: { ...where, deletedAt: null } }),
  find: (id) => prisma.machine.findFirst({ where: { id, deletedAt: null }, include: { ...include, telemetry: { take: 30, orderBy: { timestamp: 'desc' } }, alerts: { take: 10, orderBy: { createdAt: 'desc' } }, commands: { take: 10, orderBy: { createdAt: 'desc' } } } }),
  create: (data) => prisma.machine.create({ data, include }), update: (id,data) => prisma.machine.update({ where:{id}, data, include }), remove:(id) => prisma.machine.update({where:{id},data:{deletedAt:new Date(),active:false,status:'DISABLED'}}),
  dashboard: (companyId) => prisma.machine.groupBy({ by:['status'], where: { ...(companyId ? { companyId } : {}), deletedAt:null }, _count:true })
};
