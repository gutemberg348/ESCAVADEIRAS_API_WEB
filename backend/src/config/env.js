import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  MQTT_URL: z.string().url(),
  MQTT_PUBLIC_URL: z.string().url().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  OFFLINE_AFTER_SECONDS: z.coerce.number().int().positive().default(120),
  ALLOW_UNPROVISIONED_DEVICES: z.enum(['true', 'false']).default('true')
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
