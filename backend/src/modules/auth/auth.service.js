import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AuthenticationError, ConflictError } from '../../utils/errors.js';
import { authRepository } from './auth.repository.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { disconnectUser } from '../../infrastructure/websocket/socket.js';
const publicUser = ({ passwordHash, refreshTokens, sessionVersion, ...user }) => user;
const issueAccessToken = (user) => jwt.sign({ sub: user.id, role: user.role, companyId: user.companyId, sv: user.sessionVersion }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
const issueTokens = async (user) => {
  const accessToken = issueAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await authRepository.createRefreshToken({ userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 30 * 86400000) });
  return { accessToken, refreshToken, user: publicUser(user) };
};
export const authService = {
  async login({ email, password }) { const user = await authRepository.findUserByEmail(email); if (!user?.active || (user.role !== 'SUPER_ADMIN' && user.companyId && (!user.company?.active || user.company.deletedAt)) || !(await bcrypt.compare(password, user.passwordHash))) throw new AuthenticationError('Invalid email or password'); return issueTokens(user); },
  async refresh(token) { const record = await authRepository.findRefreshToken(token); if (!record || record.expiresAt < new Date() || !record.user.active || (record.user.role !== 'SUPER_ADMIN' && record.user.companyId && (!record.user.company?.active || record.user.company.deletedAt))) throw new AuthenticationError('Invalid refresh token'); await authRepository.revokeRefreshToken(token); return issueTokens(record.user); },
  async logout(token) { if (token) await authRepository.revokeRefreshToken(token); },
  async me(id) { const user = await authRepository.findUserById(id); if (!user) throw new AuthenticationError(); return publicUser(user); },
  async updateMe(id, data) {
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id }, data });
      await tx.auditLog.create({ data: { userId: id, action: 'PROFILE_UPDATED', resource: 'User', resourceId: id, metadata: { fields: Object.keys(data) } } });
    });
    return authService.me(id);
  },
  async changePassword(id, { currentPassword, newPassword }) {
    const user = await authRepository.findUserById(id);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AuthenticationError('Senha atual incorreta.');
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new ConflictError('A nova senha deve ser diferente da atual.');
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: id, action: 'PASSWORD_CHANGED', resource: 'User', resourceId: id } });
    });
    disconnectUser(id);
  }
};
