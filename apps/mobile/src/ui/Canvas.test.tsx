// @vitest-environment jsdom
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { act, render } from '@testing-library/react';
import { useImperativeHandle, useInsertionEffect, useLayoutEffect, useState, type ReactNode, type Ref } from 'react';
import { afterEach, expect, test, vi } from 'vitest';

/** What happened to the canvases, in order: a drawing handed to a canvas, and a canvas asked to draw again (and from which thread). */
const told: string[] = [];
let onUiThread = false;
let nextId = 1;

// Skia's canvas, as far as the phone's goes: a native view with its id, which is handed its drawing (a recording of its children) twice for
// each commit of Skia's own reconciler (`root.render`): in that commit (`resetAfterCommit`, before the layout effects of what Skia draws, the
// kit's `Handed` among them), and again a microtask later, once the update it awaits has resolved. Each time `setJsiProperty`, which asks the
// view to draw from the JS thread.
vi.mock('@shopify/react-native-skia', () => ({
  Canvas: function Canvas({ children, ref }: { children?: ReactNode; ref?: Ref<{ getNativeId(): number }> }) {
    const id = useState(() => nextId++)[0];
    useImperativeHandle(ref, () => ({ getNativeId: () => id }));
    useInsertionEffect(() => {
      told.push(`drawing handed to ${id} in its commit`);
    }, [children, id]);
    useLayoutEffect(() => {
      queueMicrotask(() => told.push(`drawing handed to ${id} again`));
    }, [children, id]);
    return <div data-skia="Canvas">{children}</div>;
  },
}));
// The UI runtime is the phone's main thread, where its canvases draw: here a worklet scheduled on it runs at once, as on that thread. At once, so
// that what makes the kit's ask come after both hand-overs is the kit's own wait, and nothing of this stand-in.
const worklets = vi.hoisted(() => ({ lose: false }));
vi.mock('react-native-worklets', () => ({
  scheduleOnUI: (worklet: (...args: unknown[]) => unknown, ...args: unknown[]) => {
    onUiThread = true;
    try {
      // What a worklet is given is copied to the UI runtime: a copy that came out without what it holds is what `lose` stands for.
      worklet(...(worklets.lose ? args.map((arg) => (typeof arg === 'object' && arg !== null && !Array.isArray(arg) ? {} : arg)) : args));
    } finally {
      onUiThread = false;
    }
  },
}));
// A frame of the UI runtime (`requestAnimationFrame` inside a worklet): a moment later, on that thread.
const frames = vi.hoisted(() => ({ asked: 0 }));
vi.stubGlobal('requestAnimationFrame', (run: (at: number) => void) => {
  frames.asked += 1;
  return setTimeout(() => {
    onUiThread = true;
    try {
      run(performance.now());
    } finally {
      onUiThread = false;
    }
  }, 1) as unknown as number;
});
(globalThis as unknown as { SkiaViewApi: unknown }).SkiaViewApi = {
  requestRedraw: (id: number) => told.push(`${id} asked to draw again on the ${onUiThread ? 'UI' : 'JS'} thread`),
};

const { Canvas } = await import('./Canvas');

afterEach(() => {
  told.length = 0;
  frames.asked = 0;
  worklets.lose = false;
});
/** Lets every microtask and timer under way run. */
const settle = () => act(async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 5)); });

/**
 * The app: its sources, its entry (`index.ts`) and its scripts, everything of it but what is installed or built, and no folder whose name starts
 * with a dot (a tool's own: `.expo`, `.kit-shots`, and an agent's `.claude`, which may hold whole copies of the app in worktrees of its own).
 */
const APP = join(import.meta.dirname, '..', '..');
const NOT_THE_APP = new Set(['node_modules', 'ios', 'android', 'dist']);

/** Every file of code under `dir` that is not a test: TypeScript, and JavaScript of any kind. */
function codeUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name.startsWith('.') || NOT_THE_APP.has(name) ? [] : codeUnder(path);
    return /\.(tsx?|jsx?|mjs|cjs)$/.test(name) && !/\.test\.(tsx?|jsx?|mjs|cjs)$/.test(name) ? [path] : [];
  });
}

const SKIA = String.raw`['"]@shopify\/react-native-skia['"]`;
/** Names in braces, as an import or an export lists them: whether `Canvas` is among them (taken for what it is, not as a type). */
const namesCanvas = (names: string): boolean => names.split(',').some((name) => /^\s*Canvas(\s+as\s+\w+)?\s*$/.test(name));

/**
 * Whether a file can draw on Skia's own canvas, however it takes it: `Canvas` named among what it imports or passes on from Skia, beside a default
 * or alone; all of Skia at once (`import * as`, `export *`, `require`, `import()`), which has `Canvas` in it. A `require` that takes only other
 * names out of it (`const { Skia } = require(…)`) does not.
 */
function takesSkiaCanvas(source: string): boolean {
  const imported = [...source.matchAll(new RegExp(String.raw`import\s+(?!type\b)([^;'"]*?)\s+from\s+${SKIA}`, 'g'))].some(([, clause]) => {
    if (/\*\s+as\s+\w+/.test(clause)) return true;
    const braces = /\{([^}]*)\}/.exec(clause);
    return braces !== null && namesCanvas(braces[1]);
  });
  const passedOn = [...source.matchAll(new RegExp(String.raw`export\s+(?!type\b)(\*|\*\s+as\s+\w+|\{[^}]*\})\s+from\s+${SKIA}`, 'g'))].some(([, what]) => what.startsWith('*') || namesCanvas(what.slice(1, -1)));
  const required = [...source.matchAll(new RegExp(String.raw`(?:(const|let|var)\s+([^=]+?)\s*=\s*)?\brequire\(\s*${SKIA}\s*\)`, 'g'))].some(([, , binding]) => {
    const braces = binding === undefined ? null : /^\{([^}]*)\}$/.exec(binding.trim());
    return braces === null || braces[1].split(',').some((name) => /^\s*Canvas\s*(:|$)/.test(name));
  });
  const late = new RegExp(String.raw`\bimport\(\s*${SKIA}\s*\)`).test(source);
  return imported || passedOn || required || late;
}

test('every canvas the app draws is the kit\'s: Skia\'s own is named in ui/Canvas.tsx alone, however it would be taken, anywhere in the app', () => {
  expect(takesSkiaCanvas("import { Canvas, Fill } from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("import {\n  Canvas,\n  Group,\n} from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("import { Canvas as SkiaCanvas, type CanvasProps } from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("import Skia, { Canvas } from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("import * as S from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("export { Canvas } from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("export { Group, Canvas as Drawing } from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("export * from '@shopify/react-native-skia';")).toBe(true);
  expect(takesSkiaCanvas("const Skia = require('@shopify/react-native-skia');")).toBe(true);
  expect(takesSkiaCanvas("const { Canvas } = require('@shopify/react-native-skia');")).toBe(true);
  expect(takesSkiaCanvas("const { Canvas: C, Fill } = require('@shopify/react-native-skia');")).toBe(true);
  expect(takesSkiaCanvas("require('@shopify/react-native-skia').Canvas;")).toBe(true);
  expect(takesSkiaCanvas("const skia = await import('@shopify/react-native-skia');")).toBe(true);
  // What draws on the kit's canvas and only takes the pieces it draws with does not.
  expect(takesSkiaCanvas("import { Fill, Skia, type SkImage } from '@shopify/react-native-skia';")).toBe(false);
  expect(takesSkiaCanvas("import { CanvasRef } from '@shopify/react-native-skia';")).toBe(false);
  expect(takesSkiaCanvas("import type { CanvasProps } from '@shopify/react-native-skia';")).toBe(false);
  expect(takesSkiaCanvas("export { Group } from '@shopify/react-native-skia';")).toBe(false);
  expect(takesSkiaCanvas("const { Skia } = require('@shopify/react-native-skia');")).toBe(false);
  expect(takesSkiaCanvas("import { Canvas } from './Canvas';")).toBe(false);
  // Read: the app's sources, its entry and its scripts; never a folder of a tool's (a dot-folder: a worktree's copy of the app), nor what is installed.
  const scratch = mkdtempSync(join(tmpdir(), 'one-canvas-'));
  try {
    for (const [folder, file] of [['src', 'drawn.tsx'], ['.claude/worktrees/copy/src', 'copied.tsx'], ['node_modules/x', 'x.js']]) {
      mkdirSync(join(scratch, folder), { recursive: true });
      writeFileSync(join(scratch, folder, file), "import { Canvas } from '@shopify/react-native-skia';\n");
    }
    expect(codeUnder(scratch).map((path) => relative(scratch, path))).toEqual([join('src', 'drawn.tsx')]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const files = codeUnder(APP).map((path) => relative(APP, path));
  expect(files).toEqual(expect.arrayContaining(['index.ts', 'src/ui/Canvas.tsx', 'src/ui/Sprite.tsx', 'scripts/scene-shots.ts']));
  expect(files.some((path) => path.startsWith('node_modules'))).toBe(false);
  const drawing = codeUnder(APP).filter((path) => takesSkiaCanvas(readFileSync(path, 'utf8'))).map((path) => relative(APP, path));
  expect(drawing).toEqual(['src/ui/Canvas.tsx']);
});

test('a canvas handed a drawing is asked to draw it once more, from the UI thread, after both of Skia\'s hand-overs', async () => {
  const { rerender } = render(<Canvas style={{ width: 8, height: 8 }}><div>first</div></Canvas>);
  await settle();
  const id = nextId - 1;
  // Asked after both hand-overs, and again on the next frame of the UI thread: an ask let go while a drawing was under way is made once more after it.
  const once = [`drawing handed to ${id} in its commit`, `drawing handed to ${id} again`, `${id} asked to draw again on the UI thread`, `${id} asked to draw again on the UI thread`];
  expect(told).toEqual(once);
  // Each new drawing, the same.
  rerender(<Canvas style={{ width: 8, height: 8 }}><div>second</div></Canvas>);
  await settle();
  expect(told).toEqual([...once, ...once]);
  // One frame asked for each ask from the UI thread, not one per frame for ever.
  expect(frames.asked).toBe(2);
});

test('a canvas whose way to Skia\'s views did not come through to the UI thread asks nothing, and the app goes on', async () => {
  // A worklet's arguments are copied to the UI runtime: should a copy ever come out without Skia's views in it, the ask is let go, not thrown.
  worklets.lose = true;
  const errors: unknown[] = [];
  const caught = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener('error', caught);
  try {
    render(<Canvas style={{ width: 8, height: 8 }}><div>lost</div></Canvas>);
    await settle();
  } finally {
    window.removeEventListener('error', caught);
  }
  expect(errors).toEqual([]);
  expect(told.filter((line) => line.includes('asked'))).toEqual([]);
});
