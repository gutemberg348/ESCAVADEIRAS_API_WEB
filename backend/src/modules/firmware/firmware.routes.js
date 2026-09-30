import { Router } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowRoles } from '../../middlewares/role.middleware.js';
export const firmwareRouter=Router(); firmwareRouter.use(authenticate); firmwareRouter.get('/',async(_req,res)=>res.json(await prisma.firmwareVersion.findMany({orderBy:{createdAt:'desc'}}))); firmwareRouter.post('/',allowRoles('SUPER_ADMIN'),async(req,res)=>res.status(201).json(await prisma.firmwareVersion.create({data:{version:req.body.version,notes:req.body.notes}})));
