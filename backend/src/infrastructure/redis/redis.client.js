import Redis from 'ioredis';
import { redisConfig } from '../../config/redis.js';
import { logger } from '../logger/logger.js';
export const redis = new Redis(redisConfig.url, { lazyConnect: true, maxRetriesPerRequest: 2 });
redis.on('error', (error) => logger.warn({ error }, 'Redis unavailable'));
export const connectRedis = async () => { try { await redis.connect(); } catch (error) { logger.warn({ error }, 'Redis connection deferred'); } };
