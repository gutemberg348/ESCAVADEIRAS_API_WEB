import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { appConfig } from '../../config/app.js';
import { prisma } from '../database/prisma.js';
import { logger } from '../logger/logger.js';

let io;
export const createSocketServer = (server) => {
  io = new Server(server, { cors: { origin: appConfig.corsOrigins, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, env.JWT_SECRET);
      socket.user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, companyId: true, active: true } });
      if (!socket.user?.active) throw new Error('User not found');
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  io.on('connection', (socket) => {
    socket.on('machine:join', async (machineId) => {
      if (typeof machineId !== 'string' || machineId.length > 80) return;
      try {
      const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { companyId: true, assignments: { where: { endedAt: null }, select: { driverProfile: { select: { userId: true } } } } } });
      const companyAllowed = socket.user.role === 'SUPER_ADMIN' || socket.user.companyId === machine?.companyId;
      const driverAllowed = socket.user.role !== 'DRIVER' || machine?.assignments.some((assignment) => assignment.driverProfile.userId === socket.user.id);
      if (machine && companyAllowed && driverAllowed) socket.join(`machine:${machineId}`);
      } catch (error) { logger.warn({ error }, 'Machine subscription failed'); }
    });
    socket.on('machine:leave', machineId => { if (typeof machineId === 'string') socket.leave(`machine:${machineId}`); });
  });
  return io;
};
export const emitMachine = (machineId, event, payload) => io?.to(`machine:${machineId}`).emit(event, payload);

export async function notifyAssignmentChange(companyId) {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.user.role !== 'SUPER_ADMIN' && socket.user.companyId !== companyId) continue;
    if (socket.user.role === 'DRIVER') {
      const assignments = await prisma.driverMachineAssignment.findMany({ where: { endedAt: null, driverProfile: { userId: socket.user.id } }, select: { machineId: true } });
      const allowed = new Set(assignments.map(item => `machine:${item.machineId}`));
      for (const room of socket.rooms) if (room.startsWith('machine:') && !allowed.has(room)) socket.leave(room);
    }
    socket.emit('assignment:changed', {});
  }
}
