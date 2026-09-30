export const mqttTopics = {
  telemetry: (deviceId) => `machines/${deviceId}/telemetry`,
  status: (deviceId) => `machines/${deviceId}/status`,
  events: (deviceId) => `machines/${deviceId}/events`,
  commands: (deviceId) => `machines/${deviceId}/commands`,
  ack: (deviceId) => `machines/${deviceId}/ack`,
  wildcard: 'machines/+/+'
};
