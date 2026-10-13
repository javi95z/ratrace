'use client';

import { content, lives, textFor } from '@ratrace/content';
import type { Locale } from '@ratrace/content';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { formatFor } from '@/lib/format';
import { browserAccount } from '@/online';
import { offlineAccount } from '@/online/offline';
import type { Account, AccountState } from '@/online/types';
import { LocalStore } from '@/session/indexeddb';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import { updateProfile } from '@/session/profile';
import { ResilientStore } from '@/session/resilient';
import { newProfile } from '@/session/types';
import type { FinishedRun, PlayerStore, Profile, Sessions } from '@/session/types';
import type { Translate, Words } from './present';
import { createGameStore } from './store';
import type { GameStore, RoundActions, RoundState } from './store';

/** Whether what is played is reaching the device. */
export interface Saving {
  /** True while the device is not taking saves, so closing the page would lose progress. */
  degraded(): boolean;
  subscribe(listener: () => void): () => void;
}

/** The things a screen may talk to (spec 8.9, rule 1), and how they are set up. Tests pass their own. */
export interface Services {
  sessions: Sessions;
  store: PlayerStore;
  /** How long after a change of screen a tap is ignored. See `GameStoreOptions.guardMs`. */
  tapGuardMs?: number;
  saving?: Saving;
  /** Who is playing, as the cloud knows them. Left out, the game has no cloud: nobody is signed in. */
  account?: Account;
}

/** Long enough for the second tap of a double tap or a double click, short enough that nobody waits for it. */
const TAP_GUARD_MS = 400;
const ALWAYS_SAVING: Saving = { degraded: () => false, subscribe: () => () => {} };

interface Game {
  game: GameStore;
  store: PlayerStore;
  saving: Saving;
  account: Account;
  words: Words;
  locale: Locale;
  profile: Profile;
  /** Finished lives, the latest first. Null until the device has answered. */
  runs: FinishedRun[] | null;
  changeProfile(change: (profile: Profile) => Profile): void;
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
  return { sessions, store, saving, account: browserAccount() };
}

/** Everything one page load makes once: the round store and the two services behind it. */
interface Made {
  game: GameStore;
  store: PlayerStore;
  saving: Saving;
  account: Account;
}

function make({ sessions, store, saving, tapGuardMs, account }: Services): Made {
  const game = createGameStore({ sessions, content, now: () => performance.now(), guardMs: tapGuardMs ?? TAP_GUARD_MS });
  return { game, store, saving: saving ?? ALWAYS_SAVING, account: account ?? offlineAccount };
}

/**
 * The real game of this page load. It lives outside the provider, because the provider sits under
 * the language of the page and is drawn anew when the language changes: the round on screen, with
 * its basket of orders, must not be thrown away for that.
 */
let shared: Made | null = null;
/** Round stores that have already asked the device for a life in progress. */
const booted = new WeakSet<GameStore>();

/**
 * Holds the game for every screen under it: the round store, the player's profile, and the words
 * of the language in use. It opens the life in progress, if there is one, as soon as it mounts.
 */
export function GameProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const locale = useLocale() as Locale;
  const [made] = useState(() => (services ? make(services) : (shared ??= make(browserServices()))));
  const [profile, setProfile] = useState<Profile>(newProfile);
  const [runs, setRuns] = useState<FinishedRun[] | null>(null);

  useEffect(() => {
    let mounted = true;
    // What the player has earned changes with every step of a life, and the list of lives when one ends.
    const refresh = () => {
      void made.store.loadProfile().then((loaded) => mounted && setProfile(loaded));
      void made.store.listRuns().then((loaded) => mounted && setRuns(loaded));
    };
    if (!booted.has(made.game)) {
      booted.add(made.game);
      void made.game.getState().boot();
    }
    refresh();
    const stop = made.game.subscribe((state, before) => {
      if (state.view !== before.view || state.status !== before.status) refresh();
    });
    return () => {
      mounted = false;
      stop();
    };
  }, [made]);

  // The player is signed in as a guest in the background. The game does not wait for it and does not need it.
  useEffect(() => {
    void made.account.start(locale);
    // Once for the page: a change of language is not a new player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [made]);

  const reducedMotion = profile.settings.reducedMotion;
  useEffect(() => {
    if (reducedMotion) document.documentElement.dataset.motion = 'reduced';
    else delete document.documentElement.dataset.motion;
  }, [reducedMotion]);

  const value = useMemo<Game>(
    () => ({
      game: made.game,
      store: made.store,
      saving: made.saving,
      account: made.account,
      words: { content, ...textFor(locale), fmt: formatFor(locale) },
      locale,
      profile,
      runs,
      changeProfile: (change) => {
        // Shown at once, then merged into what the device holds: the profile is never written over whole,
        // because it also holds every badge and the gallery.
        setProfile((current) => change(current));
        void updateProfile(made.store, change).then(setProfile, () => undefined);
      },
    }),
    [made, locale, profile, runs],
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
  const { profile, changeProfile, locale } = useGameContext();
  return {
    reducedMotion: profile.settings.reducedMotion,
    setReducedMotion: (reducedMotion: boolean) => changeProfile((current) => ({ ...current, settings: { ...current.settings, reducedMotion } })),
    locale,
  };
};

/** What belongs to the player rather than to one life: badges, the gallery, the lives unlocked. */
export const useProfile = (): Profile => useGameContext().profile;

/** The guided first life: the tips already read, and the two ways to be done with one. */
export function useGuide() {
  const { profile, changeProfile } = useGameContext();
  return {
    ...profile.guide,
    /** Marks one tip as read. */
    read: (tip: string) => changeProfile((current) => (current.guide.seen.includes(tip) ? current : { ...current, guide: { ...current.guide, seen: [...current.guide.seen, tip] } })),
    /** Turns the guide off for good. */
    turnOff: () => changeProfile((current) => ({ ...current, guide: { ...current.guide, off: true } })),
    /** Turns the guide off, or back on: the tips not yet read then show again. */
    setOff: (off: boolean) => changeProfile((current) => ({ ...current, guide: { ...current.guide, off } })),
  };
}

/** Finished lives, the latest first, or null while the device has not answered yet. */
export const useRuns = (): FinishedRun[] | null => useGameContext().runs;

const NOBODY: AccountState = { kind: 'offline' };

/** Who is playing, as the cloud knows them, and the two things a player can do about it. */
export function useAccount(): { state: AccountState; keepWithGoogle(): Promise<boolean>; useExistingAccount(): Promise<boolean>; dismissNotice(): void } {
  const { account } = useGameContext();
  const state = useSyncExternalStore(account.subscribe, account.state, () => NOBODY);
  // Back to the very page the player is on, without whatever a sign-in left after the hash.
  const here = () => window.location.href.split('#')[0];
  return {
    state,
    keepWithGoogle: () => account.keepWithGoogle(here()),
    useExistingAccount: () => account.useExistingAccount(here()),
    dismissNotice: () => account.dismissNotice(),
  };
}

/** False while the device is not taking saves. The screens that promise "saved" say so instead. */
export function useSaving(): boolean {
  const { saving } = useGameContext();
  return !useSyncExternalStore(saving.subscribe, saving.degraded, () => false);
}

/** A translator for one section of the interface text. */
export const useT = (section: string): Translate => useTranslations(section) as unknown as Translate;
