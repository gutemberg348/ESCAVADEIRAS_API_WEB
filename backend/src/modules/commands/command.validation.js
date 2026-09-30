import { z } from 'zod';
export const commandSchema=z.object({ type:z.enum(['REQUEST_STATUS','BEEP']), payload:z.record(z.unknown()).optional(), expiresAt:z.coerce.date().optional() });
export const commandAckSchema=z.object({ commandId:z.string().uuid(), status:z.enum(['RECEIVED','EXECUTED','FAILED']), authToken:z.string().min(20).max(200).optional(), message:z.string().max(300).optional(), timestamp:z.coerce.date().optional() });
