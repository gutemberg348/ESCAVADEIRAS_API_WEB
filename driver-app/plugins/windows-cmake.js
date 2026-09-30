const { withAppBuildGradle } = require('@expo/config-plugins');
// Hash C++ object paths before Ninja hits Windows' 260-character path limit.
module.exports = config => withAppBuildGradle(config, result => {
  const marker = '// EMP: short CMake object paths';
  if (!result.modResults.contents.includes(marker)) {
    result.modResults.contents += `\n${marker}\nandroid.defaultConfig.externalNativeBuild.cmake.arguments "-DCMAKE_OBJECT_PATH_MAX=250"\nandroid.externalNativeBuild.cmake.buildStagingDirectory = new File(rootProject.projectDir, "../../.cxx")\n`;
  }
  return result;
});
