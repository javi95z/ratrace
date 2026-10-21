// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { act, render } from '@testing-library/react';
import { useImperativeHandle, useLayoutEffect, useState, type ReactNode, type Ref } from 'react';
import { afterEach, expect, test, vi } from 'vitest';

/** What happened to the canvases, in order: a drawing handed to a canvas, and a canvas asked to draw again (and from which thread). */
const told: string[] = [];
let onUiThread = false;
let nextId = 1;

// Skia's canvas, as far as the phone's goes: a native view with its id, which is handed its drawing (a recording of its children) a
// moment after each commit (Skia's `root.render`: its own reconciler's commit, then, a microtask later, `setJsiProperty`).
vi.mock('@shopify/react-native-skia', () => ({
  Canvas: function Canvas({ children, ref }: { children?: ReactNode; ref?: Ref<{ getNativeId(): number }> }) {
    const id = useState(() => nextId++)[0];
    useImperativeHandle(ref, () => ({ getNativeId: () => id }));
    useLayoutEffect(() => {
      queueMicrotask(() => told.push(`drawing handed to ${id}`));
    }, [children, id]);
    return <div data-skia="Canvas">{children}</div>;
  },
}));
// The UI runtime is the phone's main thread, where its canvases draw: a worklet scheduled on it runs there, later.
vi.mock('react-native-worklets', () => ({
  scheduleOnUI: (worklet: (...args: unknown[]) => unknown, ...args: unknown[]) => {
    setTimeout(() => {
      onUiThread = true;
      try {
        worklet(...args);
      } finally {
        onUiThread = false;
      }
    }, 0);
  },
}));
(globalThis as unknown as { SkiaViewApi: unknown }).SkiaViewApi = {
  requestRedraw: (id: number) => told.push(`${id} asked to draw again on the ${onUiThread ? 'UI' : 'JS'} thread`),
};

const { Canvas } = await import('./Canvas');

afterEach(() => {
  told.length = 0;
});
/** Lets every microtask and timer under way run. */
const settle = () => act(async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 5)); });

const SRC = join(import.meta.dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Whether a file draws on Skia's own canvas: `Canvas` among what it imports from Skia. */
const takesSkiaCanvas = (source: string): boolean =>
  [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@shopify\/react-native-skia['"]/g)].some((m) => /(^|[\s,])Canvas([\s,]|$)/.test(m[1]));

test('every canvas the app draws is the kit\'s: Skia\'s own is named in ui/Canvas.tsx alone', () => {
  expect(takesSkiaCanvas("import { Canvas, Fill } from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("import {\n  Canvas,\n  Group,\n} from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("import { Fill, Skia, type SkImage } from '@shopify/react-native-skia';")).toBe(false);
  expect(takesSkiaCanvas("import { CanvasRef } from '@shopify/react-native-skia';")).toBe(false);
  const drawing = filesUnder(SRC).filter((path) => takesSkiaCanvas(readFileSync(path, 'utf8'))).map((path) => relative(SRC, path));
  expect(drawing).toEqual(['ui/Canvas.tsx']);
});

test('a canvas handed a drawing is asked to draw it once more, from the UI thread, after the drawing is in', async () => {
  const { rerender } = render(<Canvas style={{ width: 8, height: 8 }}><div>first</div></Canvas>);
  await settle();
  expect(told).toEqual(['drawing handed to 1', '1 asked to draw again on the UI thread']);
  // Each new drawing, the same.
  rerender(<Canvas style={{ width: 8, height: 8 }}><div>second</div></Canvas>);
  await settle();
  expect(told).toEqual(['drawing handed to 1', '1 asked to draw again on the UI thread', 'drawing handed to 1', '1 asked to draw again on the UI thread']);
});
