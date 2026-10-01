import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { mqttTopics } from '../../config/mqtt.js';
import { AuthorizationError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { machineService } from '../machines/machine.service.js';
import { deviceRepository } from './device.repository.js';
import { encryptBleSecret } from './ble-secret.js';

const publicDevice = ({ credentialHash, bleSecret, ...device }) => device;
const scope = (user) => user.role === 'SUPER_ADMIN' ? { archivedAt: null } : { archivedAt: null, machine: { companyId: user.companyId } };

function firmwareManifest(device, credential) {
  const hardwareConfig = {
    telemetryIntervalMs: 1000,
    heartbeatIntervalMs: 30000,
    gpsEnabled: true,
    rfidEnabled: true,
    voltageScale: 5,
    currentZeroMv: 390,
    currentSensitivityMvA: 0,
    ...(device.hardwareConfig || {})
  };
  return {
    generatedAt: new Date().toISOString(),
    warning: 'Esta credencial aparece somente agora. No painel, use Configurar pela USB logo após gravar o firmware-base. O fluxo Arduino permanece disponível como contingência.',
    device: {
      id: device.id,
      code: device.deviceCode,
      token: credential,
      hardwareSerial: device.hardwareSerial,
      hardwareConfig
    },
    mqtt: {
      url: env.MQTT_PUBLIC_URL || env.MQTT_URL,
      clientId: device.mqttClientId,
      username: device.mqttUsername,
      password: credential,
      topics: {
        telemetry: mqttTopics.telemetry(device.deviceCode),
        status: mqttTopics.status(device.deviceCode),
        events: mqttTopics.events(device.deviceCode),
        commands: mqttTopics.commands(device.deviceCode),
        ack: mqttTopics.ack(device.deviceCode)
      }
    }
  };
}

async function allowed(user, id) {
  const device = await deviceRepository.find(id);
  if (!device || device.archivedAt || !device.machine) throw new NotFoundError('Dispositivo não encontrado ou já retirado');
  if (user.role !== 'SUPER_ADMIN' && device.machine.companyId !== user.companyId) throw new AuthorizationError();
  return device;
}

async function audit(user, action, device, metadata = {}) {
  await deviceRepository.audit({ userId: user.sub, action, resource: 'Device', resourceId: device.id, metadata });
}

export const deviceService = {
  async list(user) {
    const devices = await deviceRepository.list(scope(user));
    return devices.map(publicDevice);
  },
  async create(user, data) {
    await machineService.get(user, data.machineId);
    if (await deviceRepository.findByMachine(data.machineId)) throw new ConflictError('A máquina já possui um dispositivo vinculado');
    if (await deviceRepository.findByCode(data.deviceCode)) throw new ConflictError('Este código de ESP32 já foi usado. Escolha outro código para a nova placa.');
    if (data.hardwareSerial && await deviceRepository.findBySerial(data.hardwareSerial)) throw new ConflictError('Este serial já está vinculado a outra placa. Confira o número ou deixe o campo vazio.');
    const credential = crypto.randomBytes(32).toString('base64url');
    const mqttClientId = data.mqttClientId || `empimecatronic-${data.deviceCode.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}`;
    const created = await deviceRepository.create({
      ...data,
      mqttClientId,
      mqttUsername: data.deviceCode,
      credentialHash: await bcrypt.hash(credential, 12),
      bleSecret: encryptBleSecret(credential),
      provisionedAt: new Date()
    });
    await audit(user, 'DEVICE_LINKED', created, { machineId: created.machineId, deviceCode: created.deviceCode });
    return { device: publicDevice(created), provisioning: firmwareManifest(created, credential) };
  },
  async rotateCredentials(user, id) {
    const current = await allowed(user, id);
    const credential = crypto.randomBytes(32).toString('base64url');
    const updated = await deviceRepository.update(id, {
      credentialHash: await bcrypt.hash(credential, 12),
      bleSecret: encryptBleSecret(credential),
      mqttUsername: current.mqttUsername || current.deviceCode,
      provisionedAt: new Date(),
      revokedAt: null,
      active: true
    });
    await audit(user, 'DEVICE_CREDENTIAL_ROTATED', updated);
    return { device: publicDevice(updated), provisioning: firmwareManifest(updated, credential) };
  },
  async update(user, id, data) {
    await allowed(user, id);
    const updated = await deviceRepository.update(id, data);
    await audit(user, 'DEVICE_UPDATED', updated, { fields: Object.keys(data) });
    return publicDevice(updated);
  },
  async revoke(user, id) {
    const current = await allowed(user, id);
    const updated = await deviceRepository.archive(current, user.sub);
    return publicDevice(updated);
  }
};
