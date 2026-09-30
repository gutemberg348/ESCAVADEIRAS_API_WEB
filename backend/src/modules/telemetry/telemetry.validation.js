import { z } from 'zod';
import { rfidCodeSchema } from '../rfid/rfid.validation.js';
const number = (min, max) => z.number().min(min).max(max).optional();
export const telemetrySchema = z.object({
  authToken: z.string().min(20).max(200).optional(),
  timestamp: z.coerce.date().optional(),
  latitude: number(-90, 90), longitude: number(-180, 180),
  speed: number(0, 200), voltage: number(0, 1000), current: number(-1000, 1000),
  signalStrength: z.number().int().min(-150).max(0).optional(),
  gpsSatellites: z.number().int().min(0).max(100).optional(),
  rfidCode: rfidCodeSchema.optional(),
  engineState: z.boolean().optional(), relayState: z.boolean().optional(),
  metadata: z.object({ bootId: z.string().max(40).optional(), gpsValid: z.boolean().optional(), currentCalibrated: z.boolean().optional() }).passthrough().optional()
}).refine(value => (value.latitude === undefined) === (value.longitude === undefined), 'Envie latitude e longitude juntas');
export const heartbeatSchema = z.object({
  authToken: z.string().min(20).max(200).optional(),
  online: z.boolean(), firmware: z.string().max(50).optional(),
  signal: z.number().int().min(-150).max(0).optional(),
  bootId: z.string().max(40).optional(),
  timestamp: z.coerce.date().optional()
});
