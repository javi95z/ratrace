// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Canvas } from './Canvas.web';

afterEach(cleanup);

const SRC = join(__dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test('on the web a canvas is only the box it would have drawn in: its size, and none of what it was to draw', () => {
  const { container } = render(
    <Canvas style={{ width: 40, height: 30 }}>
      <span>drawn</span>
    </Canvas>,
  );
  const box = container.firstElementChild as HTMLElement;
  expect([box.style.width, box.style.height]).toEqual(['40px', '30px']);
  expect(box.textContent).toBe('');
  expect(container.querySelector('canvas')).toBeNull();
});

test('no web twin reaches the canvas: the web export loads no Skia, and the canvas is the one door to it', () => {
  const twins = filesUnder(SRC).filter((file) => /\.web\.tsx?$/.test(file) && !/\.test\./.test(file) && !file.endsWith('Canvas.web.tsx'));
  expect(twins.length).toBeGreaterThan(5);
  const reaching = twins.filter((file) => /from\s+['"](?:\.{1,2}\/(?:ui\/)?|@\/ui\/)Canvas(?:\.web)?['"]|from\s+['"]@shopify\/react-native-skia['"]/.test(readFileSync(file, 'utf8')));
  expect(reaching.map((file) => relative(SRC, file))).toEqual([]);
});
