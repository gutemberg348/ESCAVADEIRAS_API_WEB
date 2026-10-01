import { companyRepository } from './company.repository.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { disconnectUser } from '../../infrastructure/websocket/socket.js';
export const companyService = {
  list: async (user, { page = 1, limit = 20 }) => { const take = Math.min(Math.max(Number(limit) || 20, 1), 100); const currentPage = Math.max(Number(page) || 1, 1); const where = user.role === 'SUPER_ADMIN' ? {} : { id: user.companyId }; const [data, total] = await Promise.all([companyRepository.list({ where, skip: (currentPage - 1) * take, take }), companyRepository.count(where)]); return { data, pagination: { page: currentPage, limit: take, total } }; },
  get: async (user, id) => { const company = await companyRepository.find(id); if (!company || (user.role !== 'SUPER_ADMIN' && company.id !== user.companyId)) throw new NotFoundError('Company not found'); return company; },
  create: async (data) => {
    const normalized = { ...data, document: data.document || null };
    if (normalized.document && await companyRepository.findByDocument(normalized.document)) throw new ConflictError('Este documento já está cadastrado em outra empresa.');
    return companyRepository.create(normalized);
  },
  update: async (user, id, data) => {
    await companyService.get(user, id);
    const normalized = { ...data, ...('document' in data ? { document: data.document || null } : {}) };
    if (normalized.document) {
      const existing = await companyRepository.findByDocument(normalized.document);
      if (existing && existing.id !== id) throw new ConflictError('Este documento já está cadastrado em outra empresa.');
    }
    return companyRepository.update(id, normalized);
  },
  remove: async (user, id) => {
    await companyService.get(user, id);
    if (user.companyId === id) throw new ConflictError('Não é possível excluir a empresa da sua própria conta administrativa. Use outra conta superadministradora.');
    const result = await companyRepository.archive(id, user.sub);
    result.userIds.forEach(disconnectUser);
    return result.company;
  }
};
