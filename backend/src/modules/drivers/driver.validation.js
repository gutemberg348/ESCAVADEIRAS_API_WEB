import { z } from 'zod';
import { rfidCodeSchema } from '../rfid/rfid.validation.js';
export const createDriverSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(8).max(72),
  companyId: z.string().uuid(),
  phone: z.string().trim().max(30).optional(),
  cardCode: rfidCodeSchema.optional()
});
export const assignmentSchema = z.object({ machineId: z.string().uuid() });
