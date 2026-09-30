import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticationError } from '../utils/errors.js';
export const authenticate = (req, _res, next) => { try { const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!token) throw new Error(); req.user = jwt.verify(token, env.JWT_SECRET); next(); } catch { next(new AuthenticationError()); } };
