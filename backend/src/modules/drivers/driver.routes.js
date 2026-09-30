import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { driverController } from './driver.controller.js';
import { assignmentSchema, createDriverSchema } from './driver.validation.js';
import { driverService } from './driver.service.js';

export const driverRouter = Router();
driverRouter.use(authenticate);
driverRouter.get('/me/machine', driverController.currentMachine);
driverRouter.get('/', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), driverController.list);
driverRouter.post('/', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(createDriverSchema), async (req, res) => res.status(201).json(await driverService.create(req.user, req.body)));
driverRouter.post('/:profileId/assignments', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), validate(assignmentSchema), driverController.assign);
driverRouter.delete('/assignments/:assignmentId', allowRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), driverController.endAssignment);
