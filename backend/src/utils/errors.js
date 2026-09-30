export class AppError extends Error { constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') { super(message); this.statusCode = statusCode; this.code = code; } }
export class ValidationError extends AppError { constructor(message = 'Validation failed') { super(message, 400, 'VALIDATION_ERROR'); } }
export class AuthenticationError extends AppError { constructor(message = 'Authentication required') { super(message, 401, 'AUTHENTICATION_ERROR'); } }
export class AuthorizationError extends AppError { constructor(message = 'Forbidden') { super(message, 403, 'AUTHORIZATION_ERROR'); } }
export class NotFoundError extends AppError { constructor(message = 'Resource not found') { super(message, 404, 'NOT_FOUND'); } }
export class ConflictError extends AppError { constructor(message = 'Resource already exists') { super(message, 409, 'CONFLICT'); } }
