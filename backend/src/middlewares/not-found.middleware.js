import { NotFoundError } from '../utils/errors.js';
export const notFound = (req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
