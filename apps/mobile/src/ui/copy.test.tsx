// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The phone's clipboard: what was put on it, and whether it takes it (the web's `navigator.clipboard` can refuse; a phone's says yes).
const board = vi.hoisted(() => ({ text: null as string | null, answer: true as boolean | Error }));
vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(async (text: string) => {
    if (board.answer instanceof Error) throw board.answer;
    if (board.answer) board.text = text;
    return board.answer;
  }),
}));
// Sprites are drawn with Skia on the phone only (the overlay's module holds the kit's sprites).
vi.mock('./Sprite', () => ({ Sprite: () => null }));
// Reanimated needs the worklets runtime: the shared reactive fake stands in for it (the toast rises).
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
// The gesture handler's native side does not load here: its stand-in.
vi.mock('react-native-gesture-handler', async () => (await import('./testing/gestures')).gestureFake());
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const { copy } = await import('./copy');
const { Toast } = await import('./overlay');

beforeEach(() => {
  board.text = null;
  board.answer = true;
});
afterEach(cleanup);

test('copy puts the text on the clipboard and then tells', async () => {
  const told = vi.fn();
  await expect(copy('AB12CD34', told)).resolves.toBe(true);
  expect(board.text).toBe('AB12CD34');
  expect(told).toHaveBeenCalledTimes(1);
});

test('where the clipboard does not take it, nothing is told: the code is on screen to be copied by hand, as on the web', async () => {
  const told = vi.fn();
  board.answer = false;
  await expect(copy('AB12CD34', told)).resolves.toBe(false);
  board.answer = new Error('no clipboard');
  await expect(copy('AB12CD34', told)).resolves.toBe(false);
  expect(told).not.toHaveBeenCalled();
});

test('a screen tells it with the web\'s toast: its words, as an alert', async () => {
  function Profile() {
    const [told, setTold] = useState<string | null>(null);
    return (
      <View>
        <Pressable accessibilityRole="button" onPress={() => void copy('AB12CD34', () => setTold('Code copied'))}>
          <Text>Copy</Text>
        </Pressable>
        <Toast message={told} onDone={() => setTold(null)} />
      </View>
    );
  }
  render(<Profile />);
  expect(screen.queryByRole('alert')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByText('Copy'));
  });
  expect(board.text).toBe('AB12CD34');
  expect(screen.getByRole('alert').textContent).toBe('Code copied');
});
