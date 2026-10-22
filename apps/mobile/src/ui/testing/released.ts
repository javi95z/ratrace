import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/*
 * A file of the app as a release build for iOS makes it, before the bundle's files are gathered: Expo's Babel preset (which writes
 * `process.env.EXPO_PUBLIC_*` in as its value and `__DEV__` as `false`), then Metro's constant folding. A `require` that this cuts out is
 * never gathered into the bundle. Used by the tests that hold what a release build leaves out (perf.test.ts, devRoutes.test.ts).
 */
const fromExpo = createRequire(createRequire(import.meta.url).resolve('expo/package.json'));
const fromMetroConfig = createRequire(fromExpo.resolve('@expo/metro-config/package.json'));

interface Babel {
  transformSync(code: string, options: object): { ast: unknown; code?: string | null } | null;
  transformFromAstSync(ast: unknown, code: string, options: object): { code?: string | null } | null;
}

export function released(file: string): string {
  const babel = fromExpo('@babel/core') as Babel;
  const { constantFoldingPlugin } = fromMetroConfig('metro-transform-plugins') as { constantFoldingPlugin: unknown };
  const source = readFileSync(file, 'utf8');
  const caller = { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, engine: 'hermes' };
  const first = babel.transformSync(source, { filename: file, babelrc: false, configFile: false, presets: [fromExpo.resolve('babel-preset-expo')], caller, ast: true, code: false });
  const folded = babel.transformFromAstSync(first?.ast, source, { filename: file, babelrc: false, configFile: false, plugins: [constantFoldingPlugin], code: true, comments: false });
  return folded?.code ?? '';
}
