import { afterEach, expect, test, vi } from 'vitest';

/*
 * On the web the sound's library (expo-audio) is not part of the first page: a cue's player is made at once, as on the phone, and the library is
 * fetched once the page is idle, or at the first cue played before then, which plays as soon as it is in.
 */

const played: string[] = [];
let imported = 0;

/** The module as a first visit finds it, over a library that counts its fetches and says what it plays. */
async function freshAudio() {
  vi.resetModules();
  vi.doMock('expo-audio', () => {
    imported += 1;
    return {
      createAudioPlayer: (source: string) => ({
        play: () => void played.push(source),
        seekTo: () => Promise.resolve(),
        remove: () => void played.push(`removed ${source}`),
      }),
      setAudioModeAsync: () => Promise.resolve(),
    };
  });
  return import('./audio');
}

afterEach(() => {
  vi.unstubAllGlobals();
  played.length = 0;
  imported = 0;
});

const turn = () => new Promise((settled) => setTimeout(settled, 0));

test('a player is made with no library fetched, and the library comes once the page is idle', async () => {
  const idle: Array<() => void> = [];
  vi.stubGlobal('requestIdleCallback', (run: () => void) => idle.push(run));
  const { createAudioPlayer } = await freshAudio();
  const player = createAudioPlayer('tap.wav');
  await turn();
  expect(imported).toBe(0);
  for (const run of idle.splice(0)) run();
  await turn();
  expect(imported).toBe(1);
  player.play();
  expect(played).toEqual(['tap.wav']);
});

test('a cue played before the library is in is heard once it is, in its turn; a player taken away first is never heard', async () => {
  vi.stubGlobal('requestIdleCallback', () => 0);
  const { createAudioPlayer, setAudioModeAsync } = await freshAudio();
  void setAudioModeAsync({ playsInSilentMode: false });
  expect(imported).toBe(0);
  const tap = createAudioPlayer('tap.wav');
  const coin = createAudioPlayer('coin.wav');
  const gone = createAudioPlayer('gone.wav');
  tap.play();
  void coin.seekTo(0).then(() => coin.play());
  gone.play();
  gone.remove();
  await turn();
  await turn();
  expect(imported).toBe(1);
  expect(played).toEqual(['tap.wav', 'coin.wav']);
});
