import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Load the pure protocol module without React Native/Metro.
const source = fs.readFileSync(new URL('../services/bleProtocol.js', import.meta.url), 'utf8');
const { createFrameDecoder } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const frame = { v: 1, deviceCode: 'DEV-TEST', eventId: 'boot-1', bootId: 'boot', kind: 'rfid', ageMs: 5000, data: { code: '04ABCDEF' } };
const wire = JSON.stringify({ raw: JSON.stringify(frame), signature: 'a'.repeat(64) });
test('reassembles 20-byte BLE chunks and preserves age/leading zeros', () => {
  const packets = []; const decode = createFrameDecoder(packet => packets.push(packet));
  const stream = '\n' + wire + '\n';
  for (let offset = 0; offset < stream.length; offset += 20) decode(stream.slice(offset, offset + 20));
  assert.equal(packets.length, 1); assert.equal(packets[0].frame.data.code, '04ABCDEF');
  assert.ok(Math.abs(Date.now() - Date.parse(packets[0].capturedAt) - 5000) < 1000);
});
test('corrupt partial frames do not prevent the retry frame', () => {
  const packets = []; const decode = createFrameDecoder(packet => packets.push(packet));
  decode('garbage\n' + wire.slice(0, 10)); decode('\n' + wire + '\n');
  assert.equal(packets.length, 1);
});
test('bounded buffers reject runaway input', () => {
  const decode = createFrameDecoder(() => {});
  assert.throws(() => decode('x'.repeat(12001)), /limite/);
});
