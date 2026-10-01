import { prisma } from '../../infrastructure/database/prisma.js';

const counts = {
  _count: {
    select: {
      machines: { where: { deletedAt: null } },
      users: { where: { active: true } }
    }
  }
};

export const companyRepository = {
  list: ({ where, skip, take }) => prisma.company.findMany({
    where: { ...where, deletedAt: null }, skip, take,
    orderBy: { createdAt: 'desc' }, include: counts
  }),
  count: (where) => prisma.company.count({ where: { ...where, deletedAt: null } }),
  find: (id) => prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...counts,
      machines: {
        where: { deletedAt: null }, take: 20, orderBy: { updatedAt: 'desc' },
        select: { id: true, code: true, name: true, status: true, device: { select: { deviceCode: true, active: true } } }
      },
      users: {
        where: { active: true }, take: 20, orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, email: true, role: true }
      }
    }
  }),
  findByDocument: (document) => prisma.company.findUnique({ where: { document }, select: { id: true } }),
  create: (data) => prisma.company.create({ data }),
  update: (id, data) => prisma.company.update({ where: { id }, data, include: counts }),
  archive: (id, actorId) => prisma.$transaction(async (tx) => {
    // Serialize with RFID assignments and driver removal for this company.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${id}))`;
    const now = new Date();
    const original = await tx.company.findUnique({ where: { id }, select: { name: true, document: true } });
    const [machines, users] = await Promise.all([
      tx.machine.findMany({ where: { companyId: id }, select: { id: true } }),
      tx.user.findMany({ where: { companyId: id }, select: { id: true } })
    ]);
    const machineIds = machines.map((item) => item.id);
    const userIds = users.map((item) => item.id);

    await tx.driverMachineAssignment.updateMany({ where: { machineId: { in: machineIds }, endedAt: null }, data: { endedAt: now } });
    await tx.machineCurrentState.updateMany({ where: { machineId: { in: machineIds } }, data: { online: false, rfidCode: null, rfidStatus: 'AWAITING_CARD' } });
    await tx.device.updateMany({
      where: { machineId: { in: machineIds } },
      data: { active: false, revokedAt: now, archivedAt: now, machineId: null, hardwareSerial: null, credentialHash: null, bleSecret: null }
    });
    await tx.machine.updateMany({ where: { id: { in: machineIds }, deletedAt: null }, data: { active: false, status: 'DISABLED', deletedAt: now } });
    await tx.rfidCard.updateMany({ where: { driverProfile: { userId: { in: userIds } } }, data: { active: false } });
    await tx.driverProfile.updateMany({ where: { userId: { in: userIds }, deletedAt: null }, data: { deletedAt: now } });
    await tx.refreshToken.updateMany({ where: { userId: { in: userIds }, revokedAt: null }, data: { revokedAt: now } });
    await tx.user.updateMany({ where: { id: { in: userIds } }, data: { active: false } });
    const archived = await tx.company.update({ where: { id }, data: { active: false, deletedAt: now, document: null } });
    await tx.auditLog.create({ data: { userId: actorId, action: 'COMPANY_ARCHIVED', resource: 'Company', resourceId: id, metadata: { name: archived.name, document: original?.document || null, users: userIds.length, machines: machineIds.length } } });
    return { company: archived, userIds };
  })
};
