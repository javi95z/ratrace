import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from './audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { SOUND_SOURCES } from './soundSources';
import { TapProvider } from './tap';

/** Everything the game can be heard doing: the web's cues (apps/web/src/ui/sound.ts), one rendered file each. */
export const CUES = ['tap', 'card', 'pick', 'coin', 'refuse', 'round', 'good', 'bad', 'promote', 'badge', 'badgeUncommon', 'badgeRare', 'badgeLegendary', 'million', 'escape', 'bankrupt', 'crisis', 'calm', 'end'] as const;
export type Cue = (typeof CUES)[number];

/** The short cues that really overlap when a player is quick: these get a second player, so a cue pressed again plays over the first, not instead of it. */
const OVERLAPS: readonly Cue[] = ['tap', 'card', 'pick', 'coin', 'refuse'];

const noPlay = (): void => {};
const SoundContext = createContext<(cue: Cue) => void>(noPlay);

/** Plays a cue now. Silent without a provider, or when the provider is off. */
export function useSound(): (cue: Cue) => void {
  return useContext(SoundContext);
}

interface Pool {
  players: AudioPlayer[];
  /** Whether each player has played: one that has not is at its start already. */
  played: boolean[];
  next: number;
}

/**
 * Plays the cues; supplies the kit's tap sound. A cue's players are made when it is first played (an ExoPlayer each on Android),
 * except the tap's, made as soon as sound is on so that the first press is instant. Turning sound off only stops playing: nothing is rebuilt.
 * The game's chiptune follows the phone's silent switch (`playsInSilentMode: false`) and mixes with the player's own music.
 */
export function SoundProvider({ on, children }: { on: boolean; children: ReactNode }) {
  const pools = useRef<Map<Cue, Pool>>(new Map());
  const wanted = useRef(on);
  wanted.current = on;

  const pool = useCallback((cue: Cue): Pool | null => {
    const known = pools.current.get(cue);
    if (known) return known;
    try {
      const count = OVERLAPS.includes(cue) ? 2 : 1;
      const made: Pool = { players: Array.from({ length: count }, () => createAudioPlayer(SOUND_SOURCES[cue])), played: Array(count).fill(false), next: 0 };
      pools.current.set(cue, made);
      return made;
    } catch {
      // A device that will not play is a silent game, never a broken one.
      return null;
    }
  }, []);

  useEffect(() => {
    if (!on) return;
    void Promise.resolve(setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })).catch(() => undefined);
    pool('tap');
  }, [on, pool]);

  useEffect(() => {
    const all = pools.current;
    return () => {
      for (const made of all.values()) for (const player of made.players) player.remove();
      all.clear();
    };
  }, []);

  const play = useCallback(
    (cue: Cue): void => {
      if (!wanted.current) return;
      const made = pool(cue);
      if (!made) return;
      try {
        const i = made.next;
        const player = made.players[i]!;
        made.next = (i + 1) % made.players.length;
        if (!made.played[i]) {
          made.played[i] = true;
          player.play();
          return;
        }
        // Back to the start first, and only then play: a play that came before the seek would be taken back by it.
        void Promise.resolve(player.seekTo(0))
          .then(() => player.play())
          .catch(() => undefined);
      } catch {
        // See above.
      }
    },
    [pool],
  );

  const tap = useMemo(() => () => play('tap'), [play]);
  return (
    <SoundContext.Provider value={play}>
      <TapProvider value={tap}>{children}</TapProvider>
    </SoundContext.Provider>
  );
}
