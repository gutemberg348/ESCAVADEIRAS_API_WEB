import { prisma } from '../../infrastructure/database/prisma.js';
export const authRepository = {
  findUserByEmail: (email) => prisma.user.findUnique({ where: { email }, include: { driverProfile: true, company: true } }),
  findUserById: (id) => prisma.user.findUnique({ where: { id }, include: { company: true, driverProfile: true } }),
  createRefreshToken: (data) => prisma.refreshToken.create({ data }),
  findRefreshToken: (token) => prisma.refreshToken.findFirst({ where: { token, revokedAt: null }, include: { user: true } }),
  revokeRefreshToken: (token) => prisma.refreshToken.updateMany({ where: { token }, data: { revokedAt: new Date() } })
};
