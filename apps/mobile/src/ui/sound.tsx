import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { SOUND_SOURCES } from './soundSources';
import { TapProvider } from './tap';

/** Everything the game can be heard doing: the web's cues (apps/web/src/ui/sound.ts), one rendered file each. */
export const CUES = ['tap', 'card', 'pick', 'coin', 'refuse', 'round', 'good', 'bad', 'promote', 'badge', 'badgeUncommon', 'badgeRare', 'badgeLegendary', 'million', 'escape', 'bankrupt', 'crisis', 'calm', 'end'] as const;
export type Cue = (typeof CUES)[number];

/** Players per cue: a cue pressed again while it still rings plays on a second player, over the first, not instead of it. */
const POOL = 2;

const noPlay = (): void => {};
const SoundContext = createContext<(cue: Cue) => void>(noPlay);

/** Plays a cue now. Silent without a provider, or when the provider is off. */
export function useSound(): (cue: Cue) => void {
  return useContext(SoundContext);
}

interface Pool {
  players: AudioPlayer[];
  next: number;
}

/**
 * Loads every cue when sound is on (so that the first tap is instant), and plays them; supplies the kit's tap sound.
 * The game's chiptune follows the phone's silent switch (`playsInSilentMode: false`) and mixes with the player's own music.
 */
export function SoundProvider({ on, children }: { on: boolean; children: ReactNode }) {
  const pools = useRef<Map<Cue, Pool> | null>(null);

  useEffect(() => {
    if (!on) return;
    const made = new Map<Cue, Pool>();
    try {
      void Promise.resolve(setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })).catch(() => undefined);
      for (const cue of CUES) made.set(cue, { players: Array.from({ length: POOL }, () => createAudioPlayer(SOUND_SOURCES[cue])), next: 0 });
    } catch {
      // A device that will not play is a silent game, never a broken one.
    }
    pools.current = made;
    return () => {
      pools.current = null;
      for (const pool of made.values()) for (const player of pool.players) player.remove();
    };
  }, [on]);

  const play = useCallback((cue: Cue): void => {
    const pool = pools.current?.get(cue);
    if (!pool) return;
    try {
      const player = pool.players[pool.next]!;
      pool.next = (pool.next + 1) % pool.players.length;
      void Promise.resolve(player.seekTo(0)).catch(() => undefined);
      player.play();
    } catch {
      // See above.
    }
  }, []);

  const tap = useMemo(() => () => play('tap'), [play]);
  return (
    <SoundContext.Provider value={play}>
      <TapProvider value={tap}>{children}</TapProvider>
    </SoundContext.Provider>
  );
}
