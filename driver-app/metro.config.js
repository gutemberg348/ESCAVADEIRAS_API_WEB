const { getDefaultConfig } = require('expo/metro-config');

// Gradle passes index.js relative to driver-app. Keep that same base for
// embedded bundles instead of resolving it against the workspace root.
// This also keeps Expo's URL rewriting consistent with Metro's root.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';
const config = getDefaultConfig(__dirname);
config.maxWorkers = 2;
module.exports = config;
