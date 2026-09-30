import { mqttTopics } from '../../config/mqtt.js';
import { getMqttClient } from './mqtt.client.js';
import { telemetrySchema, heartbeatSchema } from '../../modules/telemetry/telemetry.validation.js';
import { telemetryService } from '../../modules/telemetry/telemetry.service.js';
import { commandAckSchema } from '../../modules/commands/command.validation.js';
import { commandService } from '../../modules/commands/command.service.js';
import { receiveRfidEvent } from '../../modules/rfid/rfid-event.service.js';
import { logger } from '../logger/logger.js';

export const startMqttConsumer = () => {
  const client = getMqttClient();
  if (!client) return;
  const queues = new Map();
  client.subscribe(mqttTopics.wildcard, { qos: 1 });
  client.on('message', (topic, raw, packet) => {
    const [root, deviceCode, kind, extra] = topic.split('/');
    if (root !== 'machines' || extra || !['telemetry', 'status', 'ack', 'events'].includes(kind)) return;
    if (kind === 'events' && packet.retain) return;
    const pending = (queues.get(deviceCode) || Promise.resolve()).then(async () => {
      const json = JSON.parse(raw.toString());
      if (kind === 'telemetry') await telemetryService.ingest(deviceCode, telemetrySchema.parse(json));
      if (kind === 'status') await telemetryService.heartbeat(deviceCode, heartbeatSchema.parse(json));
      if (kind === 'ack') await commandService.handleAck(deviceCode, commandAckSchema.parse(json));
      if (kind === 'events') await receiveRfidEvent(deviceCode, json);
    }).catch(error => logger.warn({ topic, message: error.message }, 'MQTT payload rejected'));
    queues.set(deviceCode, pending);
    pending.finally(() => { if (queues.get(deviceCode) === pending) queues.delete(deviceCode); });
  });
};
