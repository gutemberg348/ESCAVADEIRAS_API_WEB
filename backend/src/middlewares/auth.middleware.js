import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticationError } from '../utils/errors.js';
import { prisma } from '../infrastructure/database/prisma.js';
export const authenticate = async (req, _res, next) => {
  let payload;
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error();
    payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub) throw new Error();
  } catch { return next(new AuthenticationError()); }
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, active: true, role: true, companyId: true } });
    if (!user?.active) return next(new AuthenticationError());
    req.user = { ...payload, role: user.role, companyId: user.companyId };
    next();
  } catch (error) { next(error); }
};
