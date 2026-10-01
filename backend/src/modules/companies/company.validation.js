import { z } from 'zod';
export const companySchema = z.object({ name: z.string().trim().min(2).max(120), document: z.string().trim().max(30).nullable().optional(), active: z.boolean().optional() });
