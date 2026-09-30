import { Router } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowRoles } from '../../middlewares/role.middleware.js';
export const userRouter=Router(); userRouter.use(authenticate); userRouter.get('/',allowRoles('SUPER_ADMIN','COMPANY_ADMIN'),async(req,res)=>{const where=req.user.role==='SUPER_ADMIN'?{}:{companyId:req.user.companyId};res.json(await prisma.user.findMany({where,select:{id:true,name:true,email:true,role:true,active:true,createdAt:true}}));});
