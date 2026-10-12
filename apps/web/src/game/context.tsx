'use client';

import { content, lives, textFor } from '@ratrace/content';
import type { Locale } from '@ratrace/content';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

/** The two things a screen may talk to (spec 8.9, rule 1). Tests pass their own. */
export interface Services {
  sessions: Sessions;
  store: PlayerStore;
}

interface Game {
  game: GameStore;
  store: PlayerStore;
  words: Words;
  locale: Locale;
  reducedMotion: boolean;
  setReducedMotion(value: boolean): void;
}

const GameContext = createContext<Game | null>(null);

/** The services of the real game: the engine in this browser, saved in this browser. */
function browserServices(): Services {
  const device: PlayerStore = typeof indexedDB === 'undefined' ? new MemoryStore() : new LocalStore();
  const store = new ResilientStore(device, (error) => console.warn('saving is off for this visit:', error));
  const sessions = new LocalSessions(store, content, lives, {
    newId: () => crypto.randomUUID(),
    newSeed: () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    now: () => Date.now(),
    onSaveError: (error) => console.warn('could not save the game:', error),
  });
  return { sessions, store };
}

/**
 * Holds the game for every screen under it: the round store, the player's settings, and the words
 * of the language in use. It opens the life in progress, if there is one, as soon as it mounts.
 */
export function GameProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const locale = useLocale() as Locale;
  const [made] = useState(() => {
    const { sessions, store } = services ?? browserServices();
    return { game: createGameStore({ sessions, content }), store };
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

/** A translator for one section of the interface text. */
export const useT = (section: string): Translate => useTranslations(section) as unknown as Translate;
