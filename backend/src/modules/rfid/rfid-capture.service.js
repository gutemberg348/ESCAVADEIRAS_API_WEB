import crypto from 'node:crypto';
import { redis } from '../../infrastructure/redis/redis.client.js';
import { machineService } from '../machines/machine.service.js';
import { AuthorizationError, ConflictError, NotFoundError } from '../../utils/errors.js';

const key = machineId => `rfid:capture:${machineId}`;
export const captureService = {
  async start(user, machineId) {
    const machine = await machineService.get(user, machineId);
    if (!machine.device?.active || !machine.currentState?.online) throw new ConflictError('O leitor da máquina precisa estar conectado');
    const session = { id: crypto.randomUUID(), machineId, userId: user.sub, expiresAt: new Date(Date.now() + 120000).toISOString(), code: null };
    if (!(await redis.set(key(machineId), JSON.stringify(session), 'EX', 120, 'NX'))) throw new ConflictError('Este leitor já está em cadastro. Aguarde ou cancele a captura atual.');
    return session;
  },
  async get(user, machineId, id) {
    await machineService.get(user, machineId);
    const raw = await redis.get(key(machineId));
    if (!raw) throw new NotFoundError('Captura expirada. Inicie uma nova leitura.');
    const session = JSON.parse(raw);
    if (session.id !== id || session.userId !== user.sub) throw new AuthorizationError();
    return session;
  },
  async cancel(user, machineId, id) {
    await this.get(user, machineId, id);
    await redis.eval("local raw=redis.call('GET',KEYS[1]); if raw and cjson.decode(raw).id==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0", 1, key(machineId), id);
  },
  async consume(machineId, code, eventId) {
    // Atomic: first scan wins; subsequent scans remain in enrollment until closed/expired.
    return Number(await redis.eval(`local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end;
      local s=cjson.decode(raw); if s.code==cjson.null then s.code=ARGV[1]; s.eventId=ARGV[2]; s.readAt=ARGV[3];
      redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL'); end; return 1`, 1, key(machineId), code, eventId, new Date().toISOString())) === 1;
  }
};
