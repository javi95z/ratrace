// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeArea } from './SafeArea.web';

// The real library, from its own source as Metro reads it (its `react-native` entry, with the web's files picked): the stand-in every other test is
// given (testing/setup.ts) answers one fixed set of insets, and its built entry asks for the phone's React Native. (Named apart, so the type check
// is not led into the library's source, which is not written for this app's settings.)
vi.mock('react-native-safe-area-context', () => {
  const source = 'react-native-safe-area-context/src/index';
  return import(/* @vite-ignore */ source);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The browser's safe areas, as Chrome computes `env(safe-area-inset-*)` on the iPhone the shots are taken on (jsdom computes no env()), or as given:
 * what a probe padded by them reads.
 */
function onTheIphone(insets = { top: 62, bottom: 34 }): void {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element, pseudo?: string | null) => {
    const style = computed(element, pseudo);
    // The probe: a box of nothing, out of sight, padded by the safe areas (jsdom keeps no env() in a style, so it is known by its mark).
    if ((element as HTMLElement).dataset?.safeAreaProbe === undefined) return style;
    return { ...style, paddingTop: `${insets.top}px`, paddingBottom: `${insets.bottom}px`, paddingLeft: '0px', paddingRight: '0px' } as CSSStyleDeclaration;
  });
}

function Shown() {
  const inset = useSafeAreaInsets();
  return <p>{`${inset.top} ${inset.bottom} ${inset.left} ${inset.right}`}</p>;
}

test('the screens are given the safe areas the browser gives the page, where the router\'s own web provider gives none', async () => {
  onTheIphone();
  const zero = { top: 0, bottom: 0, left: 0, right: 0 };
  // expo-router's provider on the web: always nothing (its SafeAreaProvider.js).
  const page = render(
    <SafeAreaInsetsContext.Provider value={zero}>
      <SafeArea>
        <Shown />
      </SafeArea>
    </SafeAreaInsetsContext.Provider>,
  );
  await waitFor(() => expect(page.getByText('62 34 0 0')).toBeTruthy());
});

test('takes the safe areas again whenever the browser changes them, with no transition and no resize of the window', async () => {
  // An installed iPhone page reads no safe areas for a moment as it opens, or as the status bar changes, and its own then: a box padded by them
  // changes size, which a ResizeObserver hears; the library's own probe waits for a transition of its padding that WebKit does not always run.
  const observers: Array<(entries: unknown[]) => void> = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(heard: (entries: unknown[]) => void) {
        observers.push(heard);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const insets = { top: 0, bottom: 0 };
  onTheIphone(insets);
  const page = render(
    <SafeArea>
      <Shown />
    </SafeArea>,
  );
  await waitFor(() => expect(page.getByText('0 0 0 0')).toBeTruthy());
  insets.top = 62;
  insets.bottom = 34;
  act(() => observers.forEach((heard) => heard([])));
  await waitFor(() => expect(page.getByText('62 34 0 0')).toBeTruthy());
  vi.unstubAllGlobals();
});

test('the root layout puts the screens, the ground and the sheets inside it', () => {
  const layout = readFileSync(join(__dirname, '../app/_layout.tsx'), 'utf8');
  expect(layout).toContain("import { SafeArea } from '../ui/SafeArea';");
  const inside = layout.slice(layout.indexOf('<SafeArea>'), layout.indexOf('</SafeArea>'));
  for (const part of ['<GameProvider>', '<Page>', '<Stack ']) expect(inside).toContain(part);
});

test('measures them inside the boundary that waits for the language\'s words, so the page has been taken over before they change', () => {
  // The page's HTML is drawn with no safe areas. A boundary is taken over (hydrated) after what is outside it: safe areas measured outside it
  // change before the page inside is taken over, which is then drawn with them where its HTML has none, and React leaves a page's HTML as it
  // finds it then: an installed iPhone page stayed under the status bar. Inside it, they change once the page is the browser's.
  const layout = readFileSync(join(__dirname, '../app/_layout.tsx'), 'utf8');
  const waits = layout.indexOf('<Suspense');
  expect(waits).toBeGreaterThan(-1);
  expect(layout.indexOf('<SafeArea>')).toBeGreaterThan(waits);
  expect(layout.indexOf('</SafeArea>')).toBeLessThan(layout.indexOf('</Suspense>'));
});
