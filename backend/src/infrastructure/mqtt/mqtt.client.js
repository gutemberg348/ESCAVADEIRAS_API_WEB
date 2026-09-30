import mqtt from 'mqtt';
import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';
let client;
export const getMqttClient = () => client;
export const connectMqtt = () => new Promise((resolve) => {
  client = mqtt.connect(env.MQTT_URL, { username: env.MQTT_USERNAME || undefined, password: env.MQTT_PASSWORD || undefined, reconnectPeriod: 3000 });
  client.on('connect', () => { logger.info('MQTT connected'); resolve(client); });
  client.on('error', (error) => logger.warn({ error }, 'MQTT error'));
});
