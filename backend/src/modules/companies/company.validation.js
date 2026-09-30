import { z } from 'zod';
export const companySchema = z.object({ name: z.string().min(2).max(120), document: z.string().max(30).optional(), active: z.boolean().optional() });
