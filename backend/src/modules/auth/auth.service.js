import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AuthenticationError } from '../../utils/errors.js';
import { authRepository } from './auth.repository.js';
const publicUser = ({ passwordHash, refreshTokens, ...user }) => user;
const issueAccessToken = (user) => jwt.sign({ sub: user.id, role: user.role, companyId: user.companyId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
const issueTokens = async (user) => {
  const accessToken = issueAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await authRepository.createRefreshToken({ userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 30 * 86400000) });
  return { accessToken, refreshToken, user: publicUser(user) };
};
export const authService = {
  async login({ email, password }) { const user = await authRepository.findUserByEmail(email); if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) throw new AuthenticationError('Invalid email or password'); return issueTokens(user); },
  async refresh(token) { const record = await authRepository.findRefreshToken(token); if (!record || record.expiresAt < new Date() || !record.user.active) throw new AuthenticationError('Invalid refresh token'); await authRepository.revokeRefreshToken(token); return issueTokens(record.user); },
  async logout(token) { if (token) await authRepository.revokeRefreshToken(token); },
  async me(id) { const user = await authRepository.findUserById(id); if (!user) throw new AuthenticationError(); return publicUser(user); }
};
