import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database/prisma.js';
import { companyController } from './company.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { companySchema } from './company.validation.js';
import { AuthorizationError, NotFoundError } from '../../utils/errors.js';
const brandingSchema = z.object({
  logoData: z.string().max(180000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).nullable().optional(),
  accentColor: z.enum(['#D9FF43', '#4DDC8F', '#69B7FF', '#FFB75E', '#B99AFF']).nullable().optional()
}).refine(value => Object.keys(value).length > 0);
export const companyRouter = Router();
companyRouter.use(authenticate);
companyRouter.get('/', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), companyController.list);
companyRouter.get('/:id', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), companyController.get);
companyRouter.patch('/:id/branding', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(brandingSchema), async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN' && req.user.companyId !== req.params.id) throw new AuthorizationError();
  const company = await prisma.company.findFirst({ where: { id: req.params.id, active: true, deletedAt: null }, select: { id: true } });
  if (!company) throw new NotFoundError('Empresa ativa não encontrada.');
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.company.update({ where: { id: company.id }, data: req.body });
    await tx.auditLog.create({ data: { userId: req.user.sub, action: 'BRANDING_UPDATED', resource: 'Company', resourceId: company.id, metadata: { fields: Object.keys(req.body) } } });
    return result;
  });
  res.json(updated);
});
companyRouter.post('/', allowRoles('SUPER_ADMIN'), validate(companySchema), companyController.create);
companyRouter.patch('/:id', allowRoles('SUPER_ADMIN'), validate(companySchema), companyController.update);
companyRouter.delete('/:id', allowRoles('SUPER_ADMIN'), companyController.remove);
