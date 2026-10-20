import { content, lives, textFor } from '@ratrace/content';
import type { BasketKeep } from '@ratrace/core/game/basket';
import type { Words } from '@ratrace/core/game/present';
import { rulesKnow } from '@ratrace/core/game/rules';
import { createGameStore } from '@ratrace/core/game/store';
import type { GameStore, RoundActions, RoundState } from '@ratrace/core/game/store';
import { formatFor } from '@ratrace/core/lib/format';
import { LocalSessions, type SessionDeps } from '@ratrace/core/session/local';
import { settleRank, updateProfile } from '@ratrace/core/session/profile';
import { ResilientStore } from '@ratrace/core/session/resilient';
import { newProfile } from '@ratrace/core/session/types';
import type { FinishedRun, PlayerStore, Profile, Sessions } from '@ratrace/core/session/types';
import type { Locale } from '@ratrace/i18n';
import { getCalendars, getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { kvLanguage, KvStore } from '../kvStore';
import { ReducedMotionProvider } from '../ui/animations';
import { SoundProvider } from '../ui/sound';
import { localeOf, type LanguageKeep } from './locale';
import { loadBundledRules } from './olderRules';
import { WordsProvider } from './words';

export { useT } from './words';

/*
 * The phone's counterpart of the web's game/context.tsx: the one place that wires the session, the
 * device's store and the round store. Phase 1 has no cloud: nobody signs in, a ranked life is played
 * on the phone as the web plays one with no account, and there are no rooms, community or counting.
 */

/** Whether what is played is reaching the device. */
export interface Saving {
  /** True while the device is not taking saves, so closing the app would lose progress. */
  degraded(): boolean;
  subscribe(listener: () => void): () => void;
}

/** The things a screen may talk to, and how they are set up. Tests pass their own. */
export interface Services {
  sessions: Sessions;
  store: PlayerStore;
  /** How long after a change of screen a tap is ignored. See `GameStoreOptions.guardMs`. */
  tapGuardMs?: number;
  saving?: Saving;
  /** Where the orders of a round not yet played are kept. Left out, only in memory. */
  basket?: BasketKeep;
  /** True where the tabs of the money are opened one by one through a guided first life. */
  introduceTabs?: boolean;
  /** Where the language the player chose is kept. Left out, on the phone. */
  language?: LanguageKeep;
}

/** Long enough for the second tap of a double tap, short enough that nobody waits for it. */
const TAP_GUARD_MS = 400;
const ALWAYS_SAVING: Saving = { degraded: () => false, subscribe: () => () => {} };

interface Game {
  game: GameStore;
  /** Reads the profile and the finished lives again. */
  reload(): void;
  store: PlayerStore;
  saving: Saving;
  introduceTabs: boolean;
  words: Words;
  locale: Locale;
  setLocale(locale: Locale): void;
  profile: Profile;
  /** Finished lives, the latest first. Null until the device has answered. */
  runs: FinishedRun[] | null;
  changeProfile(change: (profile: Profile) => Profile): void;
}

const GameContext = createContext<Game | null>(null);

/** What the phone's lives need from the outside world: ids, seeds, the clock. */
export function phoneDeps(): SessionDeps {
  return {
    newId: () => crypto.randomUUID(),
    // Thirty-two bytes: every random stream of a game starts from 128 bits of it.
    newSeed: () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    now: () => Date.now(),
    onSaveError: (error: unknown) => console.warn('could not save the game:', error),
    // A life begun under older rules is finished under them (never interrupt a game): the app carries every bundle
    // the web serves. A life whose rules it does not carry waits, kept, for an update that does, instead of being
    // judged gone and deleted.
    loadRules: loadBundledRules,
  };
}

/** The services of the real game: the engine on this phone, saved on this phone. */
function phoneServices(): Services {
  const listeners = new Set<() => void>();
  const store = new ResilientStore(new KvStore(), (degraded, error) => {
    if (degraded) console.warn('this phone is not saving:', error);
    for (const listener of listeners) listener();
  });
  const saving: Saving = {
    degraded: () => store.degraded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { sessions: new LocalSessions(store, content, lives, phoneDeps()), store, saving, introduceTabs: true };
}

/** Everything one start of the app makes once: the round store and the services behind it. */
interface Made {
  game: GameStore;
  store: PlayerStore;
  saving: Saving;
  introduceTabs: boolean;
  language: LanguageKeep;
}

function make({ sessions, store, saving, tapGuardMs, basket, introduceTabs, language }: Services): Made {
  const game = createGameStore({ sessions, content, now: () => performance.now(), guardMs: tapGuardMs ?? TAP_GUARD_MS, ...(basket ? { basket } : {}) });
  return { game, store, saving: saving ?? ALWAYS_SAVING, introduceTabs: introduceTabs === true, language: language ?? kvLanguage };
}

/** The real game of this start of the app: made once, whatever is drawn again above it. */
let shared: Made | null = null;
/** Round stores that have already asked the device for a life in progress. */
const booted = new WeakSet<GameStore>();

/** The phone's languages, in its order of preference. */
const phoneLanguages = (): string[] => getLocales().map((locale) => locale.languageCode ?? '');

/**
 * Holds the game for every screen under it: the round store, the player's profile, and the words
 * of the language in use. It opens the life in progress, if there is one, as soon as it mounts.
 */
export function GameProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const [made] = useState(() => (services ? make(services) : (shared ??= make(phoneServices()))));
  const [locale, setLocaleState] = useState<Locale>(() => localeOf(made.language.read(), phoneLanguages()));
  const [timeZone] = useState(() => getCalendars()[0]?.timeZone ?? undefined);
  const [profile, setProfile] = useState<Profile>(newProfile);
  const [runs, setRuns] = useState<FinishedRun[] | null>(null);

  useEffect(() => {
    let mounted = true;
    // What the player has earned changes with every step of a life, and the list of lives when one ends.
    const refresh = () => {
      void made.store.loadProfile().then((loaded) => mounted && setProfile(loaded));
      void made.store.listRuns().then((loaded) => mounted && setRuns(loaded));
      // Lives finished before ranks count towards the rank the first time they are seen.
      void Promise.all([made.store.loadProfile(), made.store.listRuns()])
        .then(async ([held, finished]) => {
          if (finished.some((run) => !Object.hasOwn(held.rank.lives, run.runId))) {
            const next = await settleRank(made.store, finished);
            if (mounted) setProfile(next);
          }
        })
        .catch(() => undefined);
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

  const reload = useMemo(
    () => () => {
      void made.store.loadProfile().then(setProfile, () => undefined);
      void made.store.listRuns().then(setRuns, () => undefined);
    },
    [made],
  );
  // Made again only when the language changes: every screen that reads them is not drawn again with each step of the profile.
  const words = useMemo<Words>(() => ({ content, ...textFor(locale), fmt: formatFor(locale) }), [locale]);
  const value = useMemo<Game>(
    () => ({
      game: made.game,
      reload,
      store: made.store,
      saving: made.saving,
      introduceTabs: made.introduceTabs,
      words,
      locale,
      setLocale: (next) => {
        made.language.write(next);
        setLocaleState(next);
      },
      profile,
      runs,
      changeProfile: (change) => {
        // Shown at once, then merged into what the device holds: the profile is never written over whole,
        // because it also holds every badge and the gallery.
        setProfile((current) => change(current));
        void updateProfile(made.store, change).then(setProfile, () => undefined);
      },
    }),
    [made, words, locale, profile, runs, reload],
  );
  return (
    <GameContext.Provider value={value}>
      <WordsProvider locale={locale} timeZone={timeZone}>
        <ReducedMotionProvider value={profile.settings.reducedMotion}>
          <SoundProvider on={profile.settings.sound}>{children}</SoundProvider>
        </ReducedMotionProvider>
      </WordsProvider>
    </GameContext.Provider>
  );
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

/**
 * Whether the rules the life is played under know an order, named by its key: a life begun under
 * older rules is not offered what they do not know.
 */
export function useKnows(): (key: string) => boolean {
  const rules = useGame((s) => s.rules);
  return (key) => rulesKnow(rules, key);
}

/** The content with its text and names in the language in use, and how numbers are written. */
export const useWords = (): Words => useGameContext().words;

/** The player's settings, and the language, which the phone keeps beside them. */
export const useSettings = () => {
  const { profile, changeProfile, locale, setLocale } = useGameContext();
  return {
    reducedMotion: profile.settings.reducedMotion,
    setReducedMotion: (reducedMotion: boolean) => changeProfile((current) => ({ ...current, settings: { ...current.settings, reducedMotion } })),
    sound: profile.settings.sound,
    setSound: (sound: boolean) => changeProfile((current) => ({ ...current, settings: { ...current.settings, sound } })),
    locale,
    setLocale,
  };
};

/** What belongs to the player rather than to one life: badges, the gallery, the lives unlocked. */
export const useProfile = (): Profile => useGameContext().profile;

/** Finished lives, the latest first, or null while the device has not answered yet. */
export const useRuns = (): FinishedRun[] | null => useGameContext().runs;

/**
 * True while the player is guided through a first life: no life finished on this device, and the
 * guide not turned off. While the game is being made, always, so that it can be seen.
 */
export function useGuided(): boolean {
  const { profile, runs } = useGameContext();
  if (process.env.NODE_ENV === 'development') return true;
  return runs !== null && runs.length === 0 && !profile.guide.off;
}

/** True where the tabs of the money open one by one in a guided life. */
export const useIntroducesTabs = (): boolean => useGameContext().introduceTabs;

/** The guided first life: the tips already read, and the two ways to be done with one. */
export function useGuide() {
  const { profile, changeProfile } = useGameContext();
  return {
    ...profile.guide,
    /** Marks one tip as read. */
    read: (tip: string) => changeProfile((current) => (current.guide.seen.includes(tip) ? current : { ...current, guide: { ...current.guide, seen: [...current.guide.seen, tip] } })),
    /** Turns the guide off for good. */
    turnOff: () => changeProfile((current) => ({ ...current, guide: { ...current.guide, off: true } })),
    /** Turns the guide off, or back on: on again, every tip shows again from the start. */
    setOff: (off: boolean) => changeProfile((current) => ({ ...current, guide: { off, seen: off ? current.guide.seen : [] } })),
  };
}

/** False while the device is not taking saves. The screens that promise "saved" say so instead. */
export function useSaving(): boolean {
  const { saving } = useGameContext();
  return !useSyncExternalStore(saving.subscribe, saving.degraded, () => false);
}

