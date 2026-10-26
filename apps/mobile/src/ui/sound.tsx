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
const silentTap = (): void => {};
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
 * except the tap's, made as soon as sound is on (where a press clicks) so that the first press is instant. Turning sound off only stops playing: nothing is rebuilt.
 * The game's chiptune follows the phone's silent switch (`playsInSilentMode: false`) and mixes with the player's own music.
 */
export function SoundProvider({ on, tap: clicks = true, children }: { on: boolean; /** Whether a press clicks too (the phone's own choice, off until turned on). */ tap?: boolean; children: ReactNode }) {
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
    if (clicks) pool('tap');
  }, [on, clicks, pool]);

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

  // A press that does not click says nothing to the sound at all (the phone's touch still says it, ./haptics).
  const tap = useMemo(() => (clicks ? () => play('tap') : silentTap), [play, clicks]);
  return (
    <SoundContext.Provider value={play}>
      <TapProvider value={tap}>{children}</TapProvider>
    </SoundContext.Provider>
  );
}
