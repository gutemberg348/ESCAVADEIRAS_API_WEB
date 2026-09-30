export const BLE_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export function createFrameDecoder(onFrame) {
  let pending = '';
  return chunk => {
    pending += chunk;
    if (pending.length > 12000) { pending = ''; throw new Error('Pacote Bluetooth excedeu o limite'); }
    let index;
    while ((index = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, index); pending = pending.slice(index + 1);
      if (!line.trim()) continue;
      try {
        const envelope = JSON.parse(line);
        if (typeof envelope.raw !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature)) continue;
        const frame = JSON.parse(envelope.raw);
        if (frame.v !== 1 || !['telemetry', 'rfid'].includes(frame.kind) || !/^[\w-]{1,90}$/.test(frame.eventId) || typeof frame.deviceCode !== 'string' || !frame.data) continue;
        if (!Number.isFinite(frame.ageMs) || frame.ageMs < 0 || frame.ageMs > 0xffffffff) continue;
        onFrame({ ...envelope, frame, capturedAt: new Date(Date.now() - frame.ageMs).toISOString() });
      } catch { /* Partial or corrupt packets are retried until the phone ACKs. */ }
    }
  };
}
