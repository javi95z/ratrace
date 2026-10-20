import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// Built from parts so that this file does not contain the words it forbids.
const FORBIDDEN = [['border', 'Radius'], ['shadow', 'Color'], ['shadow', 'Offset'], ['shadow', 'Opacity'], ['shadow', 'Radius'], ['eleva', 'tion']].map((p) => p.join(''));

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name === 'node_modules' ? [] : e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  );

test('no rounded corners, no soft shadows: corners are square and shadows are hard strips', () => {
  const src = join(__dirname, '..');
  const hits = filesUnder(src)
    .filter((f) => /\.(tsx?|jsx?|json)$/.test(f))
    .flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return FORBIDDEN.filter((w) => text.includes(w)).map((w) => `${f}: ${w}`);
    });
  expect(hits).toEqual([]);
});
