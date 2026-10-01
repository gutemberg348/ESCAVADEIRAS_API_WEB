import { redis } from '../../infrastructure/redis/redis.client.js';
import { telemetryRepository } from './telemetry.repository.js';
import { emitMachine } from '../../infrastructure/websocket/socket.js';
import { NotFoundError } from '../../utils/errors.js';
import { verifyDeviceCredential } from '../devices/device-auth.service.js';
import { rfidService } from '../rfid/rfid.service.js';

async function authenticateDevice(code, token) {
  const device = await telemetryRepository.device(code);
  if (!device?.active || !device.machine?.active || device.machine.deletedAt) throw new NotFoundError('Dispositivo ou máquina inativo');
  await verifyDeviceCredential(device, token);
  return device;
}

export const telemetryService = {
  async ingest(deviceCode, payload) {
    const device = await authenticateDevice(deviceCode, payload.authToken);
    const { authToken, ...telemetry } = payload;
    const receivedAt = new Date();
    const timestamp = telemetry.timestamp || receivedAt;
    const gpsValid = telemetry.metadata?.gpsValid !== false && telemetry.latitude != null && telemetry.longitude != null;
    const state = {
      online: true, gpsValid,
      ...(gpsValid ? { latitude: telemetry.latitude, longitude: telemetry.longitude, gpsUpdatedAt: timestamp } : {}),
      speed: gpsValid ? telemetry.speed : null, voltage: telemetry.voltage,
      current: telemetry.metadata?.currentCalibrated === false ? null : telemetry.current,
      signalStrength: telemetry.signalStrength
    };
    await rfidService.boot(device.machine, telemetry.metadata?.bootId);
    await telemetryRepository.create({ ...telemetry, current: state.current, deviceId: device.id, machineId: device.machineId, timestamp });
    const saved = await telemetryRepository.state(device.machineId, state);
    await telemetryRepository.deviceSeen(device.id, { lastSeenAt: receivedAt });
    await telemetryRepository.status(device.machineId, 'ONLINE');
    const rfid = telemetry.rfidCode ? await rfidService.scan(device.machine, telemetry.rfidCode) : undefined;
    const event = { ...saved, machineId: device.machineId, deviceId: device.id, timestamp, rfid, gpsSatellites: telemetry.gpsSatellites, metadata: telemetry.metadata };
    await redis.set(`machine:${device.machineId}:state`, JSON.stringify(event), 'EX', 3600).catch(() => {});
    emitMachine(device.machineId, 'machine:telemetry', event);
    return event;
  },
  async heartbeat(deviceCode, payload) {
    const device = await authenticateDevice(deviceCode, payload.authToken);
    if (payload.online) await rfidService.boot(device.machine, payload.bootId);
    const status = payload.online ? 'ONLINE' : 'OFFLINE';
    await telemetryRepository.deviceSeen(device.id, { ...(payload.online ? { lastSeenAt: new Date() } : {}), firmwareVersion: payload.firmware });
    await telemetryRepository.status(device.machineId, status);
    const state = { online: payload.online, signalStrength: payload.signal };
    await telemetryRepository.state(device.machineId, state);
    emitMachine(device.machineId, 'machine:status', { machineId: device.machineId, status, ...state });
    return state;
  },
  history: (machineId, limit) => telemetryRepository.history(machineId, limit)
};
