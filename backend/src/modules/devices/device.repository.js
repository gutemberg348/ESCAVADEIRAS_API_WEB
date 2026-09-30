import { prisma } from '../../infrastructure/database/prisma.js';

const include = {
  machine: { select: { id: true, code: true, name: true, companyId: true, status: true } }
};

export const deviceRepository = {
  list: (where) => prisma.device.findMany({ where, include, orderBy: { updatedAt: 'desc' } }),
  find: (id) => prisma.device.findUnique({ where: { id }, include }),
  findByMachine: (machineId) => prisma.device.findUnique({ where: { machineId } }),
  create: (data) => prisma.device.create({ data, include }),
  update: (id, data) => prisma.device.update({ where: { id }, data, include }),
  audit: (data) => prisma.auditLog.create({ data })
};
