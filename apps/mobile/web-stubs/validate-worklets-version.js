/*
 * The web's stand-in for react-native-reanimated/scripts/validate-worklets-version (metro.config.js): Reanimated checks the worklets' version only in
 * development (`__DEV__`), with semver; the two are pinned in package.json, and the phone still checks them.
 */
module.exports = function validateWorkletsVersion() {
  return { ok: true };
};
