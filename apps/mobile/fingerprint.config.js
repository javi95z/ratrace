/**
 * What tells one native build of the app from another (EAS Update's runtime version, app.json's `fingerprint` policy): an update over the air goes
 * only to builds of the same native code. Expo's `balanced` preset, and beside it what changes nothing native here: the package's scripts (the
 * sprites, the rules, the checks) and .gitignore. A change of either never cuts the players' builds off from the next update.
 * @type {import('@expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: [
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
    'PackageJsonScriptsAll',
    'GitIgnore',
  ],
};
