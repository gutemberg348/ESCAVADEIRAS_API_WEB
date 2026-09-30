module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    'expo-sqlite', 'expo-secure-store',
    ['react-native-ble-plx', { isBackgroundEnabled: false, bluetoothAlwaysPermission: 'Conectar ao ESP32 da máquina e coletar telemetria.' }],
    './plugins/local-network',
    './plugins/windows-cmake',
  ],
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      ...(process.env.GOOGLE_MAPS_API_KEY ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } } : {}),
    },
  },
});
