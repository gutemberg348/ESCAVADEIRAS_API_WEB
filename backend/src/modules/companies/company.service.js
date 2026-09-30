import { companyRepository } from './company.repository.js';
import { NotFoundError } from '../../utils/errors.js';
export const companyService = {
  list: async (user, { page = 1, limit = 20 }) => { const take = Math.min(Number(limit), 100); const where = user.role === 'SUPER_ADMIN' ? {} : { id: user.companyId }; const [data, total] = await Promise.all([companyRepository.list({ where, skip: (Number(page) - 1) * take, take }), companyRepository.count(where)]); return { data, pagination: { page: Number(page), limit: take, total } }; },
  get: async (user, id) => { const company = await companyRepository.find(id); if (!company || (user.role !== 'SUPER_ADMIN' && company.id !== user.companyId)) throw new NotFoundError('Company not found'); return company; },
  create: (data) => companyRepository.create(data), update: async (user, id, data) => { await companyService.get(user, id); return companyRepository.update(id, data); }, remove: async (user, id) => { await companyService.get(user, id); return companyRepository.remove(id); }
};
