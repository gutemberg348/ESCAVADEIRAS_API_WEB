import { prisma } from '../../infrastructure/database/prisma.js';
import { emitMachine, notifyAssignmentChange } from '../../infrastructure/websocket/socket.js';
import { captureService } from './rfid-capture.service.js';
import { rfidCodeSchema } from './rfid.validation.js';
import { AuthorizationError, NotFoundError } from '../../utils/errors.js';
import { setAssignment } from '../drivers/assignment.service.js';

async function unauthorized(machineId, code, message) {
  const recent = await prisma.alert.findFirst({ where: { machineId, type: 'RFID_UNAUTHORIZED', message, createdAt: { gte: new Date(Date.now() - 5 * 60000) } } });
  if (recent) return { authorized: false, alert: recent };
  const alert = await prisma.alert.create({ data: { machineId, severity: 'WARNING', type: 'RFID_UNAUTHORIZED', message } });
  emitMachine(machineId, 'machine:alert', alert);
  return { authorized: false, alert };
}

export const rfidService = {
  async setCardActive(user, id, active) {
    const card = await prisma.rfidCard.findUnique({ where: { id }, include: { driverProfile: { include: { user: true } } } });
    if (!card) throw new NotFoundError('Cartão não encontrado');
    if (user.role !== 'SUPER_ADMIN' && card.driverProfile.user.companyId !== user.companyId) throw new AuthorizationError();
    if (active && (card.driverProfile.deletedAt || !card.driverProfile.user.active)) throw new AuthorizationError('Vincule este cartão a um operador ativo antes de reativá-lo');
    const updated = await prisma.rfidCard.update({ where: { id }, data: { active }, include: { driverProfile: { include: { user: { select: { name: true, email: true, companyId: true } } } } } });
    if (!active) {
      const machines = await prisma.machine.findMany({ where: { currentState: { rfidCode: card.code }, companyId: card.driverProfile.user.companyId } });
      for (const machine of machines) await this.clearOperator(machine);
    }
    await prisma.auditLog.create({ data: { userId: user.sub, action: active ? 'RFID_ENABLED' : 'RFID_DISABLED', resource: 'RfidCard', resourceId: id } });
    return updated;
  },
  async authorize(machine, rawCode) {
    const code = rfidCodeSchema.parse(rawCode);
    const card = await prisma.rfidCard.findUnique({ where: { code }, include: { driverProfile: { include: { user: true } } } });
    if (!card?.active || !card.driverProfile.user.active) return unauthorized(machine.id, code, `Cartão RFID ${code} não autorizado`);
    if (card.driverProfile.user.role !== 'DRIVER' || card.driverProfile.user.companyId !== machine.companyId) return unauthorized(machine.id, code, `Cartão RFID ${code} não autorizado nesta empresa`);
    const assignment = await setAssignment({ companyId: machine.companyId, machineId: machine.id, profileId: card.driverProfileId, cardCode: code });
    await notifyAssignmentChange(machine.companyId);
    const result = { authorized: true, assignmentId: assignment.id, driver: { id: card.driverProfile.user.id, name: card.driverProfile.user.name } };
    emitMachine(machine.id, 'machine:driver', { machineId: machine.id, ...result });
    return result;
  },
  async scan(machine, code, eventId = 'legacy') {
    if (await captureService.consume(machine.id, code, eventId)) return { status: 'CAPTURED', authorized: false, code };
    const result = await this.authorize(machine, code);
    if (!result.authorized) await this.clearOperator(machine);
    const status = result.authorized ? 'AUTHORIZED' : 'DENIED';
    if (!result.authorized) await prisma.machineCurrentState.upsert({ where: { machineId: machine.id }, create: { machineId: machine.id, rfidCode: code, rfidStatus: status }, update: { rfidCode: code, rfidStatus: status } });
    emitMachine(machine.id, 'machine:rfid', { machineId: machine.id, status, code });
    return { ...result, status, code };
  },
  async clearOperator(machine) {
    const ended = await prisma.driverMachineAssignment.updateMany({ where: { machineId: machine.id, endedAt: null }, data: { endedAt: new Date() } });
    await prisma.machineCurrentState.updateMany({ where: { machineId: machine.id }, data: { rfidStatus: 'AWAITING_CARD', rfidCode: null } });
    if (ended.count) await notifyAssignmentChange(machine.companyId);
  },
  async boot(machine, bootId) {
    if (!bootId) return;
    const state = await prisma.machineCurrentState.findUnique({ where: { machineId: machine.id } });
    if (state?.deviceBootId === bootId) return;
    await this.clearOperator(machine);
    await prisma.machineCurrentState.upsert({ where: { machineId: machine.id }, create: { machineId: machine.id, deviceBootId: bootId }, update: { deviceBootId: bootId } });
  }
};
