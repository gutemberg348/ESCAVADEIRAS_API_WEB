import { prisma } from '../../infrastructure/database/prisma.js';
export const companyRepository = {
  list: ({ where, skip, take }) => prisma.company.findMany({ where: { ...where, deletedAt: null }, skip, take, orderBy: { createdAt: 'desc' }, include: { _count: { select: { machines: true, users: true } } } }),
  count: (where) => prisma.company.count({ where: { ...where, deletedAt: null } }),
  find: (id) => prisma.company.findFirst({ where: { id, deletedAt: null }, include: { _count: { select: { machines: true, users: true } } } }),
  create: (data) => prisma.company.create({ data }),
  update: (id, data) => prisma.company.update({ where: { id }, data }),
  remove: (id) => prisma.company.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
};
