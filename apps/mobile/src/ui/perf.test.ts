import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { released as releasedFile } from './testing/released';

/*
 * The timing probe is in a build made with `EXPO_PUBLIC_PERF=1` and nowhere else. Its switch (perf.ts) is put through what a release build puts it
 * through: Expo's Babel preset (which writes the flag into the code, `undefined` when it is not set) and Metro's constant folding (which runs before
 * the bundle's files are gathered, on a build that is not for development). Without the flag nothing of it names the probe, so the probe's file is
 * never gathered into the bundle; with it, it does.
 */
const here = fileURLToPath(new URL('.', import.meta.url));
/** The switch by default, as a release build makes it (testing/released.ts). */
const released = (file = `${here}perf.ts`): string => releasedFile(file);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the timing probe', () => {
  it('is cut out of a release build made without the flag: nothing of the switch names it, and every name is a no-op', () => {
    vi.stubEnv('EXPO_PUBLIC_PERF', undefined);
    const code = released();
    expect(code).not.toContain('perfProbe');
    expect(code).toMatch(/PERF = false/);
    expect(code).toMatch(/var probe = null;/);
    expect(code).toMatch(/perfTouched = undefined;/);
    expect(code).toMatch(/PerfDrawn = none;/);
  }, 60_000);

  it('is in a release build made with EXPO_PUBLIC_PERF=1', () => {
    vi.stubEnv('EXPO_PUBLIC_PERF', '1');
    const code = released();
    expect(code).toContain("require('./perfProbe')");
    expect(code).toMatch(/PERF = true/);
  }, 60_000);

  it('has its route put a long life on the phone only in a build with the flag: without it the route goes home, and the life\'s maker is cut out', () => {
    const route = `${here}../app/perf.tsx`;
    vi.stubEnv('EXPO_PUBLIC_PERF', undefined);
    const off = released(route);
    expect(off).not.toContain('perfLife');
    expect(off).toMatch(/var lives = null;/);
    vi.stubEnv('EXPO_PUBLIC_PERF', '1');
    expect(released(route)).toContain("require('../testing/perfLife')");
  }, 60_000);

  it('is reached only through the switch, and its long life only through its route: no other file of the app names either', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const { join, relative } = await import('node:path');
    const src = join(here, '..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : /\.(tsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
      });
    const naming = files(src).filter((path) => /perfProbe/.test(readFileSync(path, 'utf8'))).map((path) => relative(src, path));
    expect(naming.sort()).toEqual(['ui/perf.ts']);
    const putting = files(src).filter((path) => /perfLife/.test(readFileSync(path, 'utf8'))).map((path) => relative(src, path));
    expect(putting.sort()).toEqual(['app/perf.tsx']);
  });
});
