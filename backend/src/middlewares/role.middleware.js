import { AuthorizationError } from '../utils/errors.js';
export const allowRoles = (...roles) => (req, _res, next) => roles.includes(req.user.role) ? next() : next(new AuthorizationError());
