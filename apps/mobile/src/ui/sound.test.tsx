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
const playsOf = (source: string) => audio.made.filter((p) => p.source === source).reduce((n, p) => n + p.play.mock.calls.length, 0);

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

test('every cue is loaded up front, when sound is on, and the phone is told to respect its silent switch', () => {
  mount(true);
  for (const cue of CUES) expect(audio.made.filter((p) => p.source === `file:${cue}`).length).toBeGreaterThanOrEqual(2);
  expect(audio.mode).toEqual([{ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }]);
});

test('a cue plays from its start, and one pressed again while it rings plays over it on another player', () => {
  const { got } = mount(true);
  act(() => got.play('coin'));
  act(() => got.play('coin'));
  const coins = audio.made.filter((p) => p.source === 'file:coin');
  expect(coins[0]!.play).toHaveBeenCalledTimes(1);
  expect(coins[1]!.play).toHaveBeenCalledTimes(1);
  expect(coins[0]!.seekTo).toHaveBeenCalledWith(0);
  act(() => got.play('coin'));
  expect(coins[0]!.play).toHaveBeenCalledTimes(2);
  expect(playsOf('file:card')).toBe(0);
});

test("the kit's tap plays the tap cue", () => {
  const { got } = mount(true);
  act(() => got.tap());
  expect(playsOf('file:tap')).toBe(1);
});

test('off: nothing is loaded, nothing plays, the tap is silent', () => {
  const { got } = mount(false);
  act(() => {
    got.play('end');
    got.tap();
  });
  expect(audio.made).toHaveLength(0);
  expect(audio.mode).toEqual([]);
});

test('turning sound off lets the players go; turning it on loads them', () => {
  const { got, view } = mount(true);
  const loaded = [...audio.made];
  view.rerender(<SoundProvider on={false}><Probe onReady={(play, tap) => Object.assign(got, { play, tap })} /></SoundProvider>);
  expect(loaded.every((p) => p.remove.mock.calls.length === 1)).toBe(true);
  act(() => got.play('tap'));
  expect(loaded.every((p) => p.play.mock.calls.length === 0)).toBe(true);
  view.rerender(<SoundProvider on><Probe onReady={(play, tap) => Object.assign(got, { play, tap })} /></SoundProvider>);
  expect(audio.made.length).toBe(loaded.length * 2);
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
