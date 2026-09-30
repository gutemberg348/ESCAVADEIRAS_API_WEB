import { getMqttClient } from './mqtt.client.js';
import { mqttTopics } from '../../config/mqtt.js';
export const publishCommand = (deviceId, command) => new Promise((resolve, reject) => {
  const client = getMqttClient();
  if (!client?.connected) return reject(new Error('MQTT unavailable'));
  client.publish(mqttTopics.commands(deviceId), JSON.stringify(command), { qos: 1 }, (error) => error ? reject(error) : resolve());
});
