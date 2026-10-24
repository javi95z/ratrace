import type { AudioMode, AudioPlayer, AudioSource } from 'expo-audio';

/*
 * The web export's twin of `audio.ts` (Metro picks it for the web): the sound's library is not part of the first page. A cue's player is made at once,
 * as on the phone, but stands in for the library's until that is in: the library (and with it each cue's file) is fetched once the page is idle, or at
 * the first cue played before then, which is heard as soon as it is in. A browser plays nothing before the player's first tap anyway.
 */

export type { AudioPlayer } from 'expo-audio';

type Library = typeof import('expo-audio');

/** How long a browser with no `requestIdleCallback` (Safari) waits before fetching the library: a moment after the page is drawn. */
const NO_IDLE_WAIT_MS = 1_000;

let fetched: Promise<Library> | null = null;
let arrive: (library: Library) => void = () => undefined;
/** The library, once it is in, however it was asked for. */
const arrived = new Promise<Library>((resolve) => {
  arrive = resolve;
});

/** Fetches the library, once (again after a fetch that failed). */
function fetchLibrary(): Promise<Library> {
  if (fetched === null) {
    const fetching = import('expo-audio');
    fetched = fetching;
    fetching.then(arrive, () => {
      fetched = null;
    });
  }
  return fetched;
}

let warming = false;
/** Fetches the library once the page is idle, once. */
function fetchWhenIdle(): void {
  if (warming) return;
  warming = true;
  const fetch = () => void fetchLibrary().catch(() => undefined);
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fetch);
  else setTimeout(fetch, NO_IDLE_WAIT_MS);
}

/** A cue's player: the library's own once it is in; until then what is asked of it is done once it is, unless the player was taken away first. */
export function createAudioPlayer(source: AudioSource): AudioPlayer {
  fetchWhenIdle();
  let real: AudioPlayer | null = null;
  let removed = false;
  const made = (): Promise<AudioPlayer | null> =>
    fetchLibrary().then((library) => {
      if (removed) return null;
      real ??= library.createAudioPlayer(source);
      return real;
    });
  // Made as soon as the library is in, so a cue played after that is heard at once (the phone makes the tap's at once for the same reason).
  void arrived.then(made, () => undefined);
  const player = {
    play(): void {
      if (real) real.play();
      else void made().then((one) => one?.play(), () => undefined);
    },
    seekTo(seconds: number): Promise<void> {
      return real ? real.seekTo(seconds) : made().then((one) => one?.seekTo(seconds));
    },
    remove(): void {
      removed = true;
      real?.remove();
    },
  };
  return player as unknown as AudioPlayer;
}

/** The way the sound mixes with the page's others, set once the library is in. */
export function setAudioModeAsync(mode: Partial<AudioMode>): Promise<void> {
  fetchWhenIdle();
  return arrived.then((library) => library.setAudioModeAsync(mode));
}
