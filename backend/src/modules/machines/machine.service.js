import { machineRepository } from './machine.repository.js'; import { NotFoundError, AuthorizationError } from '../../utils/errors.js';
const scope = (user) => {
  if (user.role === 'SUPER_ADMIN') return {};
  if (user.role === 'DRIVER') {
    return {
      companyId: user.companyId,
      assignments: { some: { driverProfile: { userId: user.sub }, endedAt: null } }
    };
  }
  return { companyId: user.companyId };
};
export const machineService = {
  list: async (user, query) => { const page=Math.max(Number(query.page)||1,1), take=Math.min(Number(query.limit)||20,100); const where={...scope(user), ...(query.status ? {status:query.status}:{}), ...(query.search ? {OR:[{name:{contains:query.search,mode:'insensitive'}},{code:{contains:query.search,mode:'insensitive'}}]}:{})}; const [data,total]=await Promise.all([machineRepository.list(where,(page-1)*take,take),machineRepository.count(where)]); return {data,pagination:{page,limit:take,total}}; },
  get: async (user,id) => { const item=await machineRepository.find(id); if(!item) throw new NotFoundError('Machine not found'); if(user.role!=='SUPER_ADMIN'&&item.companyId!==user.companyId) throw new AuthorizationError(); if(user.role==='DRIVER'&&!item.assignments.some((assignment)=>assignment.driverProfile.user.id===user.sub)) throw new AuthorizationError(); return item; },
  create: (user,data) => machineRepository.create({...data,companyId:user.role==='SUPER_ADMIN'?data.companyId:user.companyId}),
  update: async (user,id,data) => { await machineService.get(user,id); if(user.role!=='SUPER_ADMIN') delete data.companyId; return machineRepository.update(id,data); },
  remove: async (user,id) => { await machineService.get(user,id); return machineRepository.remove(id,user.sub); }, dashboard: (user) => machineRepository.dashboard(user.role==='SUPER_ADMIN'?undefined:user.companyId)
};
