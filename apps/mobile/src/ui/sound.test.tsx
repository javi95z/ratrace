// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { SCORE } from '../../../web/src/ui/sound';
import { CUES, SoundProvider, useSound } from './sound';
import { useTap } from './tap';

const audio = vi.hoisted(() => ({
  made: [] as { source: unknown; seekTo: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }[],
  mode: [] as unknown[],
}));
vi.mock('expo-audio', () => ({
  createAudioPlayer: (source: unknown) => {
    const player = { source, seekTo: vi.fn(() => Promise.resolve()), play: vi.fn(), remove: vi.fn() };
    audio.made.push(player);
    return player;
  },
  setAudioModeAsync: (mode: unknown) => {
    audio.mode.push(mode);
    return Promise.resolve();
  },
}));
vi.mock('./soundSources', () => ({
  SOUND_SOURCES: new Proxy({}, { get: (_t, cue) => `file:${String(cue)}` }),
}));

afterEach(() => {
  cleanup();
  audio.made.length = 0;
  audio.mode.length = 0;
});

function Probe({ onReady }: { onReady: (play: (cue: (typeof CUES)[number]) => void, tap: () => void) => void }) {
  onReady(useSound(), useTap());
  return null;
}
function mount(on: boolean) {
  const got = {} as { play: (cue: (typeof CUES)[number]) => void; tap: () => void };
  const view = render(
    <SoundProvider on={on}>
      <Probe onReady={(play, tap) => Object.assign(got, { play, tap })} />
    </SoundProvider>,
  );
  return { got, view };
}

test("the cues are the web's, in the web's words", () => {
  expect([...CUES].sort()).toEqual(Object.keys(SCORE).sort());
  expect(CUES).toHaveLength(19);
});

test('soundSources.ts requires every cue file once', () => {
  const text = readFileSync(join(import.meta.dirname, 'soundSources.ts'), 'utf8');
  const required = [...text.matchAll(/^ {2}(\w+): require\('\.\.\/\.\.\/assets\/sounds\/(\w+)\.wav'\),$/gm)];
  expect(required.map((m) => m[1])).toEqual([...CUES]);
  expect(required.every((m) => m[1] === m[2])).toBe(true);
});

const made = (cue: string) => audio.made.filter((p) => p.source === `file:${cue}`);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

test('only the tap is made at mount, and the phone is told to respect its silent switch', () => {
  mount(true);
  expect(audio.made.map((p) => p.source)).toEqual(['file:tap', 'file:tap']);
  expect(audio.mode).toEqual([{ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }]);
});

test('the short cues that overlap have two players, every other cue one, made on its first play', () => {
  const { got } = mount(true);
  for (const cue of CUES) act(() => got.play(cue));
  for (const cue of CUES) expect(made(cue), cue).toHaveLength(['tap', 'card', 'pick', 'coin', 'refuse'].includes(cue) ? 2 : 1);
  act(() => got.play('end'));
  act(() => got.play('end'));
  expect(made('end')).toHaveLength(1);
});

test('a cue not played is never made', () => {
  const { got } = mount(true);
  act(() => got.play('coin'));
  expect(made('card')).toHaveLength(0);
  expect(made('end')).toHaveLength(0);
});

test('a cue pressed again while it rings plays over it on the other player; a player that has played goes back to its start before it plays', async () => {
  const { got } = mount(true);
  act(() => got.play('coin'));
  act(() => got.play('coin'));
  const [first, second] = made('coin');
  expect(first!.play).toHaveBeenCalledTimes(1);
  expect(second!.play).toHaveBeenCalledTimes(1);
  expect(first!.seekTo).not.toHaveBeenCalled();
  const order: string[] = [];
  first!.seekTo.mockImplementation(() => { order.push('seek'); return Promise.resolve(); });
  first!.play.mockImplementation(() => { order.push('play'); });
  act(() => got.play('coin'));
  expect(order).toEqual(['seek']);
  await flush();
  expect(order).toEqual(['seek', 'play']);
  expect(first!.seekTo).toHaveBeenCalledWith(0);
});

test("the kit's tap plays the tap cue", () => {
  const { got } = mount(true);
  act(() => got.tap());
  expect(made('tap').reduce((n, p) => n + p.play.mock.calls.length, 0)).toBe(1);
});

test('off: nothing is made, nothing plays, the tap is silent', () => {
  const { got } = mount(false);
  act(() => {
    got.play('end');
    got.tap();
  });
  expect(audio.made).toHaveLength(0);
  expect(audio.mode).toEqual([]);
});

test('turning sound off and on again rebuilds nothing, and off plays nothing; the players go when the provider does', () => {
  const { got, view } = mount(true);
  act(() => got.play('end'));
  const loaded = [...audio.made];
  const tree = (on: boolean) => <SoundProvider on={on}><Probe onReady={(play, tap) => Object.assign(got, { play, tap })} /></SoundProvider>;
  view.rerender(tree(false));
  act(() => got.play('end'));
  expect(made('end')[0]!.play).toHaveBeenCalledTimes(1);
  view.rerender(tree(true));
  expect(audio.made).toEqual(loaded);
  expect(loaded.every((p) => p.remove.mock.calls.length === 0)).toBe(true);
  view.unmount();
  expect(loaded.every((p) => p.remove.mock.calls.length === 1)).toBe(true);
});

test('without a provider, a cue is silence and nothing throws', () => {
  const got = {} as { play: (cue: (typeof CUES)[number]) => void };
  render(<Probe onReady={(play) => Object.assign(got, { play })} />);
  expect(() => got.play('tap')).not.toThrow();
});

test('a player that throws makes a silent game, not a broken one', () => {
  const { got } = mount(true);
  for (const p of audio.made) p.play.mockImplementation(() => { throw new Error('no audio'); });
  expect(() => act(() => got.play('tap'))).not.toThrow();
});
