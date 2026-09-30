import { ValidationError } from '../utils/errors.js';
export const validate = (schema, target = 'body') => (req, _res, next) => { const result = schema.safeParse(req[target]); if (!result.success) return next(new ValidationError(result.error.issues.map((issue) => issue.message).join(', '))); req[target] = result.data; next(); };
