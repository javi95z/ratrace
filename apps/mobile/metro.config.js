// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const webStubs = require('./web-stubs/stubs');

/**
 * Expo's own Metro configuration, and on the web the modules of the libraries the site never runs (`web-stubs/stubs.js`) read as the small stand-in
 * each has in `web-stubs/`, so the web export does not carry them (`scripts/webSize.ts`). The phone is built as before: nothing here applies to it.
 */
const config = getDefaultConfig(__dirname);

const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
  if (platform !== 'web' || resolved.type !== 'sourceFile') return resolved;
  const filePath = resolved.filePath.split(path.sep).join('/');
  const stand = webStubs.find(({ file }) => file.test(filePath));
  return stand ? { type: 'sourceFile', filePath: path.join(__dirname, 'web-stubs', stand.stub) } : resolved;
};

module.exports = config;
