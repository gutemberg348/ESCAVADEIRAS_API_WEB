import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { deviceController } from './device.controller.js';
import { createDeviceSchema, updateDeviceSchema } from './device.validation.js';

export const deviceRouter = Router();
deviceRouter.use(authenticate);
deviceRouter.get('/', deviceController.list);
deviceRouter.post('/', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(createDeviceSchema), deviceController.create);
deviceRouter.post('/:id/rotate-credentials', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), deviceController.rotateCredentials);
deviceRouter.patch('/:id', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(updateDeviceSchema), deviceController.update);
deviceRouter.delete('/:id', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), deviceController.revoke);
