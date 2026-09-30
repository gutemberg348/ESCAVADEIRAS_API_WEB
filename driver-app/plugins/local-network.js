const { withAndroidManifest } = require('@expo/config-plugins');
module.exports = config => withAndroidManifest(config, result => {
  if (process.env.EMP_LOCAL_TEST === '1') result.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
  return result;
});
