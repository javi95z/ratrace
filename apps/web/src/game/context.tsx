'use client';

import { content, lives, textFor } from '@ratrace/content';
import type { Locale } from '@ratrace/content';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { formatFor } from '@/lib/format';
import { LocalStore } from '@/session/indexeddb';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import { ResilientStore } from '@/session/resilient';
import type { PlayerStore, Sessions } from '@/session/types';
import type { Translate, Words } from './present';
import { createGameStore } from './store';
import type { GameStore, RoundActions, RoundState } from './store';

/** Whether what is played is reaching the device. */
export interface Saving {
  /** True while the device is not taking saves, so closing the page would lose progress. */
  degraded(): boolean;
  subscribe(listener: () => void): () => void;
}

/** The two things a screen may talk to (spec 8.9, rule 1), and how they are set up. Tests pass their own. */
export interface Services {
  sessions: Sessions;
  store: PlayerStore;
  /** How long after a change of screen a tap is ignored. See `GameStoreOptions.guardMs`. */
  tapGuardMs?: number;
  saving?: Saving;
}

/** Long enough for the second tap of a double tap or a double click, short enough that nobody waits for it. */
const TAP_GUARD_MS = 400;
const ALWAYS_SAVING: Saving = { degraded: () => false, subscribe: () => () => {} };

interface Game {
  game: GameStore;
  store: PlayerStore;
  saving: Saving;
  words: Words;
  locale: Locale;
  reducedMotion: boolean;
  setReducedMotion(value: boolean): void;
}

const GameContext = createContext<Game | null>(null);

/** The services of the real game: the engine in this browser, saved in this browser. */
function browserServices(): Services {
  const device: PlayerStore = typeof indexedDB === 'undefined' ? new MemoryStore() : new LocalStore();
  const listeners = new Set<() => void>();
  const store = new ResilientStore(device, (degraded, error) => {
    if (degraded) console.warn('this browser is not saving:', error);
    for (const listener of listeners) listener();
  });
  const saving: Saving = {
    degraded: () => store.degraded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const sessions = new LocalSessions(store, content, lives, {
    newId: () => crypto.randomUUID(),
    newSeed: () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    now: () => Date.now(),
    onSaveError: (error) => console.warn('could not save the game:', error),
  });
  return { sessions, store, saving };
}

/**
 * Holds the game for every screen under it: the round store, the player's settings, and the words
 * of the language in use. It opens the life in progress, if there is one, as soon as it mounts.
 */
export function GameProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const locale = useLocale() as Locale;
  const [made] = useState(() => {
    const { sessions, store, saving, tapGuardMs } = services ?? browserServices();
    const game = createGameStore({ sessions, content, now: () => performance.now(), guardMs: tapGuardMs ?? TAP_GUARD_MS });
    return { game, store, saving: saving ?? ALWAYS_SAVING };
  });
  const [reducedMotion, setReduced] = useState(false);

  useEffect(() => {
    void made.game.getState().boot();
    void made.store.loadProfile().then((profile) => setReduced(profile.settings.reducedMotion));
  }, [made]);

  useEffect(() => {
    if (reducedMotion) document.documentElement.dataset.motion = 'reduced';
    else delete document.documentElement.dataset.motion;
  }, [reducedMotion]);

  const value = useMemo<Game>(
    () => ({
      game: made.game,
      store: made.store,
      saving: made.saving,
      words: { content, ...textFor(locale), fmt: formatFor(locale) },
      locale,
      reducedMotion,
      setReducedMotion: (next) => {
        setReduced(next);
        void made.store.saveProfile({ format: 1, settings: { reducedMotion: next } });
      },
    }),
    [made, locale, reducedMotion],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

function useGameContext(): Game {
  const value = useContext(GameContext);
  if (!value) throw new Error('this component must be inside a GameProvider');
  return value;
}

/** A slice of the round on screen. The component redraws when that slice changes. */
export function useGame<T>(select: (state: RoundState & RoundActions) => T): T {
  return useStore(useGameContext().game, select);
}

/** The content with its text and names in the language in use, and how numbers are written. */
export const useWords = (): Words => useGameContext().words;

export const useSettings = () => {
  const { reducedMotion, setReducedMotion, locale } = useGameContext();
  return { reducedMotion, setReducedMotion, locale };
};

/** False while the device is not taking saves. The screens that promise "saved" say so instead. */
export function useSaving(): boolean {
  const { saving } = useGameContext();
  return !useSyncExternalStore(saving.subscribe, saving.degraded, () => false);
}

/** A translator for one section of the interface text. */
export const useT = (section: string): Translate => useTranslations(section) as unknown as Translate;
