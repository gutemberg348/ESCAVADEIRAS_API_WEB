import { z } from 'zod';

const hardwareConfigSchema = z.object({
  telemetryIntervalMs: z.coerce.number().int().min(1000).max(3600000).default(1000),
  heartbeatIntervalMs: z.coerce.number().int().min(5000).max(3600000).default(30000),
  gpsEnabled: z.boolean().default(true),
  rfidEnabled: z.boolean().default(true),
  voltageScale: z.coerce.number().positive().max(100).default(5),
  currentZeroMv: z.coerce.number().min(0).max(5000).default(390),
  currentSensitivityMvA: z.coerce.number().min(0).max(1000).default(0)
}).partial();

export const createDeviceSchema = z.object({
  machineId: z.string().uuid(),
  deviceCode: z.string().trim().min(4).max(50).toUpperCase().regex(/^[A-Z0-9_-]+$/),
  hardwareSerial: z.string().trim().min(4).max(100).optional(),
  mqttClientId: z.string().trim().min(4).max(100).optional(),
  hardwareConfig: hardwareConfigSchema.optional()
});

export const updateDeviceSchema = z.object({
  hardwareSerial: z.string().trim().min(4).max(100).optional(),
  firmwareVersion: z.string().trim().max(50).optional(),
  hardwareConfig: hardwareConfigSchema.optional(),
  active: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo');
