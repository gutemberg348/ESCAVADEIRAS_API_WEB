import { prisma } from '../../infrastructure/database/prisma.js';
import { AuthorizationError, NotFoundError } from '../../utils/errors.js';
import { machineService } from '../machines/machine.service.js';
import bcrypt from 'bcrypt';
import { notifyAssignmentChange } from '../../infrastructure/websocket/socket.js';
import { setAssignment } from './assignment.service.js';

const companyScope = (user) => user.role === 'SUPER_ADMIN' ? {} : { user: { companyId: user.companyId } };

export const driverService = {
  async create(actor, data) {
    if (actor.role !== 'SUPER_ADMIN' && data.companyId !== actor.companyId) throw new AuthorizationError();
    const company = await prisma.company.findFirst({ where: { id: data.companyId, active: true, deletedAt: null } });
    if (!company) throw new NotFoundError('Empresa ativa não encontrada');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { name: data.name, email: data.email, passwordHash, role: 'DRIVER', companyId: company.id,
        driverProfile: { create: { phone: data.phone, ...(data.cardCode ? { rfidCards: { create: { code: data.cardCode } } } : {}) } } },
        select: { id: true, name: true, email: true, driverProfile: { include: { rfidCards: true } } } });
      await tx.auditLog.create({ data: { userId: actor.sub, action: 'DRIVER_CREATED', resource: 'User', resourceId: user.id } });
      return user;
    });
  },
  async currentMachine(user) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId: user.sub }, include: { assignments: { where: { endedAt: null }, take: 1, include: { machine: { include: { currentState: true, company: true } } } } } });
    return profile?.assignments[0]?.machine || null;
  },
  list: (user) => prisma.driverProfile.findMany({ where: companyScope(user), include: { user: { select: { id: true, name: true, email: true, active: true, companyId: true } }, rfidCards: true, assignments: { where: { endedAt: null }, include: { machine: { select: { id: true, code: true, name: true, status: true } } } } } }),
  async assign(user, profileId, machineId) {
    const [profile, machine] = await Promise.all([prisma.driverProfile.findUnique({ where: { id: profileId }, include: { user: true } }), machineService.get(user, machineId)]);
    if (!profile) throw new NotFoundError('Operador não encontrado');
    if (user.role !== 'SUPER_ADMIN' && profile.user.companyId !== user.companyId) throw new AuthorizationError();
    if (profile.user.companyId !== machine.companyId) throw new AuthorizationError('Operador e máquina devem pertencer à mesma empresa');
    if (!profile.user.active || !machine.active) throw new AuthorizationError('Motorista e máquina precisam estar ativos');
    const assignment = await setAssignment({ companyId: machine.companyId, machineId, profileId, actorId: user.sub });
    await notifyAssignmentChange(machine.companyId);
    return assignment;
  },
  async endAssignment(user, assignmentId) {
    const assignment = await prisma.driverMachineAssignment.findUnique({ where: { id: assignmentId }, include: { machine: true } });
    if (!assignment) throw new NotFoundError('Vínculo não encontrado');
    if (user.role !== 'SUPER_ADMIN' && assignment.machine.companyId !== user.companyId) throw new AuthorizationError();
    const ended = await prisma.driverMachineAssignment.update({ where: { id: assignmentId }, data: { endedAt: new Date() } });
    if (!assignment.endedAt) await prisma.machineCurrentState.updateMany({ where: { machineId: assignment.machineId }, data: { rfidCode: null, rfidStatus: 'AWAITING_CARD' } });
    await notifyAssignmentChange(assignment.machine.companyId);
    return ended;
  }
};
