import { logger } from '../infrastructure/logger/logger.js';
export const errorHandler = (error, _req, res, _next) => {
  if (error.code === 'P2002') return res.status(409).json({ error: { code: 'CONFLICT', message: 'E-mail, cartão ou vínculo já cadastrado. Confira os dados.' } });
  logger.error({ message: error.message, code: error.code }, 'Request failed');
  res.status(error.statusCode || 500).json({ error: { code: error.code || 'INTERNAL_ERROR', message: error.statusCode ? error.message : 'Internal server error' } });
};
