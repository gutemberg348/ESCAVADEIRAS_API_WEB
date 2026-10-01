import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database/prisma.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { AuthorizationError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { disconnectUser } from '../../infrastructure/websocket/socket.js';

const password = z.string().min(10, 'A senha precisa ter ao menos 10 caracteres.').max(128);
const managerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password,
  companyId: z.string().uuid()
});
const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()).optional(),
  active: z.boolean().optional()
}).refine(value => Object.keys(value).length > 0);
const resetSchema = z.object({ password });
const userSelect = {
  id: true, companyId: true, name: true, email: true, role: true, active: true,
  avatarData: true, createdAt: true,
  company: { select: { id: true, name: true } },
  driverProfile: { select: { id: true, deletedAt: true } }
};
const assertEditable = async (actor, id) => {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, companyId: true, role: true } });
  if (!target || (actor.role !== 'SUPER_ADMIN' && target.companyId !== actor.companyId)) throw new NotFoundError('Usuário não encontrado.');
  if (target.id === actor.sub) throw new ConflictError('Altere sua própria conta em Configurações.');
  if (target.role === 'SUPER_ADMIN' || (actor.role === 'COMPANY_ADMIN' && target.role === 'COMPANY_ADMIN')) throw new AuthorizationError('Esta conta não pode ser alterada por você.');
  return target;
};

export const userRouter = Router();
userRouter.use(authenticate);
userRouter.get('/', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), async (req, res) => {
  const where = req.user.role === 'SUPER_ADMIN' ? {} : { companyId: req.user.companyId };
  res.json(await prisma.user.findMany({ where, select: userSelect, orderBy: { name: 'asc' } }));
});
userRouter.post('/managers', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(managerSchema), async (req, res) => {
  const { companyId, name, email, password: plainPassword } = req.body;
  if (req.user.role !== 'SUPER_ADMIN' && companyId !== req.user.companyId) throw new AuthorizationError();
  const company = await prisma.company.findFirst({ where: { id: companyId, active: true, deletedAt: null }, select: { id: true } });
  if (!company) throw new NotFoundError('Empresa ativa não encontrada.');
  const user = await prisma.$transaction(async tx => {
    const created = await tx.user.create({ data: { companyId, name, email, role: 'MANAGER', passwordHash: await bcrypt.hash(plainPassword, 12) }, select: userSelect });
    await tx.auditLog.create({ data: { userId: req.user.sub, action: 'MANAGER_CREATED', resource: 'User', resourceId: created.id, metadata: { companyId } } });
    return created;
  });
  res.status(201).json(user);
});
userRouter.patch('/:id', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(updateSchema), async (req, res) => {
  const target = await assertEditable(req.user, req.params.id);
  if (target.role === 'DRIVER' && 'active' in req.body) throw new ConflictError('A situação do motorista deve ser alterada em Motoristas, junto com seus vínculos e cartões.');
  const user = await prisma.$transaction(async tx => {
    const updated = await tx.user.update({ where: { id: target.id }, data: { ...req.body, ...(req.body.active === false ? { sessionVersion: { increment: 1 } } : {}) }, select: userSelect });
    if (req.body.active === false) await tx.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: req.user.sub, action: 'USER_UPDATED', resource: 'User', resourceId: target.id, metadata: { fields: Object.keys(req.body) } } });
    return updated;
  });
  if (req.body.active === false) disconnectUser(target.id);
  res.json(user);
});
userRouter.post('/:id/reset-password', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(resetSchema), async (req, res) => {
  const target = await assertEditable(req.user, req.params.id);
  await prisma.$transaction(async tx => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(req.body.password, 12), sessionVersion: { increment: 1 } } });
    await tx.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: req.user.sub, action: 'USER_PASSWORD_RESET', resource: 'User', resourceId: target.id } });
  });
  disconnectUser(target.id);
  res.status(204).send();
});
