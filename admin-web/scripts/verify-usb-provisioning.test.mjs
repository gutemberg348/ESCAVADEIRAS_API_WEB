import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionOverUsb, resetToApplication } from '../services/usbProvisioning.mjs';

const device = { code: 'ESP-TEST-001', token: 't'.repeat(43) };
const options = { identifyTimeout: 60, ackTimeout: 30, rebootTimeout: 60, pollInterval: 1, sleep: ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 2))) };
function fakePort(mode = 'success') {
  let controller, written = false, reads = 0;
  const commands = [], signals = [];
  const emit = line => {
    const bytes = new TextEncoder().encode(line + '\r\n');
    controller.enqueue(bytes.slice(0, 7));
    controller.enqueue(bytes.slice(7));
  };
  const port = {
    commands, signals, closed: false,
    async open() {
      this.readable = new ReadableStream({ start(c) { controller = c; } });
      this.writable = new WritableStream({ write(bytes) {
        const command = new TextDecoder().decode(bytes).trim();
        commands.push(command);
        if (mode === 'silent') return;
        if (mode === 'bootloader') { emit('waiting for download'); return; }
        if (command === 'EMP_IDENTIFY') {
          if (mode === 'slow' && ++reads === 1) return;
          if (written && mode === 'no-reboot') return;
          emit(JSON.stringify({ type: 'EMP_IDENTITY', deviceCode: written ? device.code : 'DEV-ESC-001', provisioned: written, firmware: '3.0.0-ble' }));
        } else {
          if (mode === 'disconnect') { controller.error(new Error('removed')); return; }
          if (mode === 'reject') { emit('EMP_PROVISION_ERROR:falha_ao_salvar'); return; }
          if (mode === 'wrong-ack') { emit('EMP_PROVISION_OK:ANOTHER-DEVICE'); return; }
          written = true;
          emit(`EMP_PROVISION_OK:${device.code}`);
        }
      } });
    },
    async setSignals(value) { signals.push(value); },
    async close() {
      assert.equal(this.readable.locked, false);
      assert.equal(this.writable.locked, false);
      this.closed = true;
    },
  };
  return port;
}
test('reset keeps BOOT released and pulses EN', async () => {
  const port = fakePort();
  await resetToApplication(port, async () => {});
  assert.deepEqual(port.signals.map(s => s.requestToSend), [false, true, false]);
  assert.ok(port.signals.every(s => s.dataTerminalReady === false));
});
test('fragmented responses, handshake, one write, reboot confirmation and release', async () => {
  const port = fakePort();
  const result = await provisionOverUsb(port, device, options);
  assert.equal(result.deviceCode, device.code);
  assert.equal(result.provisioned, true);
  assert.equal(port.commands[0], 'EMP_IDENTIFY');
  assert.equal(port.commands.filter(c => c.startsWith('EMP_PROVISION:')).length, 1);
  assert.equal(port.commands.at(-1), 'EMP_IDENTIFY');
  assert.equal(port.closed, true);
});
test('startup delay retries identification before writing', async () => {
  const port = fakePort('slow');
  await provisionOverUsb(port, device, { ...options, identifyTimeout: 1200 });
  assert.deepEqual(port.commands.slice(0, 2), ['EMP_IDENTIFY', 'EMP_IDENTIFY']);
});
for (const [mode, message] of [
  ['silent', /Sem resposta/], ['bootloader', /modo de gravação/],
  ['reject', /salvar/], ['wrong-ack', /não confirmou/],
  ['no-reboot', /conferir o reinício/], ['disconnect', /interrompida/],
]) {
  test(`${mode}: reports failure and releases port`, async () => {
    const port = fakePort(mode);
    await assert.rejects(provisionOverUsb(port, device, options), message);
    assert.equal(port.closed, true);
    if (['silent', 'bootloader'].includes(mode)) assert.ok(port.commands.every(c => c === 'EMP_IDENTIFY'));
  });
}
test('invalid credentials never open USB', async () => {
  await assert.rejects(provisionOverUsb({ open() { assert.fail('must not open'); } }, { code: 'bad', token: '' }), /inválida/);
});
