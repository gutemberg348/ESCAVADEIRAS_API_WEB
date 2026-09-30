import { env } from './env.js';
export const appConfig = { port: env.PORT, corsOrigins: env.CORS_ORIGIN.split(',').map((item) => item.trim()) };
