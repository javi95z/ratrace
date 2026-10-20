// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { Raised } from './kit';

// What the platform's own Pressable is given, which the web (where the tests run) cannot show: iOS-only props among them.
const given = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }));
vi.mock('react-native', async () => {
  const rn = await vi.importActual<Record<string, unknown>>('react-native-web');
  return {
    ...rn,
    Pressable: (props: { children: ReactNode } & Record<string, unknown>) => {
      given.props.push(props);
      return <div>{props.children}</div>;
    },
  };
});
vi.mock('./Sprite', () => ({ Sprite: () => null }));

afterEach(() => {
  cleanup();
  given.props.length = 0;
});

test('a Raised in another language than the phone\'s says so to a screen reader (iOS: the web\'s `lang`), and says nothing where it has no language to name', () => {
  render(
    <>
      <Raised onPress={() => {}} language="ru"><span>{'Русский'}</span></Raised>
      <Raised onPress={() => {}}><span>{'plain'}</span></Raised>
    </>,
  );
  expect(given.props.map((props) => props.accessibilityLanguage)).toEqual(['ru', undefined]);
});
