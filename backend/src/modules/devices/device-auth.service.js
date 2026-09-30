import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { AuthorizationError } from '../../utils/errors.js';

export async function verifyDeviceCredential(device, authToken) {
  if (!device.credentialHash) {
    if (env.NODE_ENV !== 'production' && env.ALLOW_UNPROVISIONED_DEVICES === 'true') return;
    throw new AuthorizationError('Dispositivo ainda não provisionado');
  }
  if (!authToken || !(await bcrypt.compare(authToken, device.credentialHash))) {
    throw new AuthorizationError('Credencial do dispositivo inválida');
  }
}
