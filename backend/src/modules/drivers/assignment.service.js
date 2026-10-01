import { prisma } from '../../infrastructure/database/prisma.js';
import { AuthorizationError } from '../../utils/errors.js';

export async function setAssignment({ companyId, machineId, profileId, cardCode, actorId }) {
  // Serialize transfers inside a company, including simultaneous reads on two machines.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${companyId}))`;
    // Recheck under the same lock as deletion so an in-flight scan cannot restore an archived operator.
    const profile = await tx.driverProfile.findUnique({ where: { id: profileId }, include: { user: true } });
    if (!profile || profile.deletedAt || !profile.user.active || profile.user.companyId !== companyId) throw new AuthorizationError('Operador indisponível');
    if (cardCode && !await tx.rfidCard.findFirst({ where: { code: cardCode, driverProfileId: profileId, active: true } })) throw new AuthorizationError('Cartão indisponível');
    const existing = await tx.driverMachineAssignment.findFirst({ where: { machineId, driverProfileId: profileId, endedAt: null } });
    const previous = await tx.driverMachineAssignment.findMany({ where: { endedAt: null, driverProfileId: profileId, machineId: { not: machineId } }, select: { machineId: true } });
    await tx.machineCurrentState.updateMany({ where: { machineId: { in: previous.map(item => item.machineId) } }, data: { rfidCode: null, rfidStatus: 'AWAITING_CARD' } });
    if (!existing) await tx.driverMachineAssignment.updateMany({ where: { endedAt: null, OR: [{ machineId }, { driverProfileId: profileId }] }, data: { endedAt: new Date() } });
    const assignment = existing || await tx.driverMachineAssignment.create({ data: { machineId, driverProfileId: profileId } });
    const state = { rfidCode: cardCode || null, rfidStatus: cardCode ? 'AUTHORIZED' : 'MANUAL_ASSIGNMENT' };
    await tx.machineCurrentState.upsert({ where: { machineId }, create: { machineId, ...state }, update: state });
    if (!existing) await tx.auditLog.create({ data: { userId: actorId, action: cardCode ? 'RFID_DRIVER_AUTHORIZED' : 'DRIVER_MACHINE_LINKED', resource: 'Machine', resourceId: machineId, metadata: { driverProfileId: profileId, code: cardCode || null } } });
    return assignment;
  });
}
