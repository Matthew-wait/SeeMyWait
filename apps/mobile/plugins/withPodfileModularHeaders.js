const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Firebase's static-framework CocoaPods build needs `use_modular_headers!`
// (GoogleUtilities doesn't define Swift modules otherwise). Expo regenerates
// ios/Podfile from scratch on every prebuild, so this has to be injected via
// a plugin rather than committed directly to the Podfile.
module.exports = function withPodfileModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(/^(platform :ios.*)$/m, '$1\nuse_modular_headers!');
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
};
