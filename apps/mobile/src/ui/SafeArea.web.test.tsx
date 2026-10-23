// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
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

/** The browser's safe areas, as Chrome computes `env(safe-area-inset-*)` on the iPhone the shots are taken on (jsdom computes no env()). */
function onTheIphone(): void {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element, pseudo?: string | null) => {
    const style = computed(element, pseudo);
    const asked = (element as HTMLElement).style;
    // The library's own probe: a box of nothing, out of sight, padded by the safe areas.
    if (asked.visibility !== 'hidden' || asked.zIndex !== '-1') return style;
    return { ...style, paddingTop: '62px', paddingBottom: '34px', paddingLeft: '0px', paddingRight: '0px' } as CSSStyleDeclaration;
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

test('the root layout puts the screens, the ground and the sheets inside it', () => {
  const layout = readFileSync(join(__dirname, '../app/_layout.tsx'), 'utf8');
  expect(layout).toContain("import { SafeArea } from '../ui/SafeArea';");
  const inside = layout.slice(layout.indexOf('<SafeArea>'), layout.indexOf('</SafeArea>'));
  for (const part of ['<GameProvider>', '<Page>', '<Stack ']) expect(inside).toContain(part);
});
