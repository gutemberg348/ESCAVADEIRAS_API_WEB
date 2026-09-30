import { z } from 'zod';

// MFRC522 UIDs are 4, 7 or 10 bytes. Keep leading zeroes.
export const rfidCodeSchema = z.string().trim()
  .regex(/^[a-fA-F0-9 :\-]+$/, 'Informe o UID hexadecimal do cartão')
  .transform(value => value.replace(/[ :\-]/g, '').toUpperCase())
  .refine(value => [8, 14, 20].includes(value.length), 'O UID deve ter 8, 14 ou 20 caracteres hexadecimais');
export const rfidEventSchema = z.object({
  authToken: z.string().min(20).max(200).optional(),
  type: z.literal('RFID_SCAN'),
  eventId: z.string().min(3).max(80).regex(/^[\w-]+$/),
  code: rfidCodeSchema,
  bootId: z.string().max(40).optional()
});
