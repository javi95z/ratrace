'use client';

import { loadRulesFromSite } from '@/session/rulesFromSite';
import { content, CONTENT_VERSION, lives, textFor } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Locale } from '@ratrace/content';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { formatFor } from '@ratrace/core/lib/format';
import { browserOnline, browserPage } from '@/online';
import { followAccountLanguage } from '@/online/language';
import { offlineAccount } from '@ratrace/online/offline';
import type { Account, AccountLife, AccountSaves, AccountState, CloudSaving, Community } from '@ratrace/online/types';
import { LocalStore } from '@/session/indexeddb';
import { LocalSessions } from '@ratrace/core/session/local';
import { RankedSessions } from '@ratrace/core/session/ranked';
import type { RoomsLink } from '@ratrace/core/session/room';
import { GameSessions } from '@ratrace/core/session/sessions';
import { MemoryStore } from '@ratrace/core/session/memory';
import { settleRank, updateProfile } from '@ratrace/core/session/profile';
import { ResilientStore } from '@ratrace/core/session/resilient';
import { newProfile } from '@ratrace/core/session/types';
import type { FinishedRun, PlayerStore, Profile, Sessions } from '@ratrace/core/session/types';
import { createSoundBoard } from '@/ui/sound';
import type { Cue, SoundBoard } from '@/ui/sound';
import { KeyboardProvider } from '@/ui/keyboard';
import type { Translate, Words } from '@ratrace/core/game/present';
import { rulesKnow } from '@ratrace/core/game/rules';
import { browserBasket } from './browserBasket';
import type { BasketKeep } from '@ratrace/core/game/basket';
import { cuesFor } from './sound';
import { countingStarts, gameBegan, ignore, lifeEnded, toVercel } from '@/pwa/events';
import type { Track } from '@/pwa/events';
import { createRoomStore } from '@ratrace/core/game/room';
import type { RoomActions, RoomStore, RoomStoreState } from '@ratrace/core/game/room';
import { createGameStore } from '@ratrace/core/game/store';
import type { GameStore, RoundActions, RoundState } from '@ratrace/core/game/store';

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
  /** How the account's copy of the player's things stands. Left out, nothing is saved to an account. */
  saves?: AccountSaves | null;
  /** The other players, while someone is signed in, and null otherwise. Left out, there are none to ask. */
  community?: () => Community | null;
  /** The rooms, while someone is signed in, and null otherwise. Left out, there are none. */
  rooms?: () => RoomsLink | null;
  /** Runs something later, for the clocks of a room. Left out, the browser's own timers. */
  schedule?: (run: () => void, ms: number) => () => void;
  /** Where the orders of a round not yet played are kept, for a page opened again. Left out, only in the page. */
  basket?: BasketKeep;
  /** True where the tabs of the money are opened one by one through a guided first life. Left out, every tab is there from the start. */
  introduceTabs?: boolean;
  /** What plays the sounds. Left out, a test hears nothing. */
  sound?: SoundBoard;
  /** Where what is counted of how the game is played goes (`pwa/events.ts`). Left out, nothing is counted. */
  track?: Track;
}

/** Long enough for the second tap of a double tap or a double click, short enough that nobody waits for it. */
const TAP_GUARD_MS = 400;
const ALWAYS_SAVING: Saving = { degraded: () => false, subscribe: () => () => {} };
const NO_SAVES: AccountSaves = { status: () => 'off', offer: () => null, subscribe: () => () => {}, onDeviceChanged: () => () => {}, takeOffer: async () => false, declineOffer: async () => {} };

interface Game {
  game: GameStore;
  /** The room the player is in, as this page follows it. */
  rooms: RoomStore;
  /** True under a `GameScope`: the round store is a room's life, not the device's own. */
  inRoom: boolean;
  /** Reads the profile and the finished lives again. */
  reload(): void;
  store: PlayerStore;
  saving: Saving;
  account: Account;
  saves: AccountSaves;
  community: () => Community | null;
  sound: SoundBoard;
  introduceTabs: boolean;
  track: Track;
  words: Words;
  locale: Locale;
  profile: Profile;
  /** Finished lives, the latest first. Null until the device has answered. */
  runs: FinishedRun[] | null;
  changeProfile(change: (profile: Profile) => Profile): void;
}

const GameContext = createContext<Game | null>(null);

/** The services of the real game: the engine in this browser, saved in this browser, and in the player's account where there is one. */
function browserServices(): Services {
  const device: PlayerStore = typeof indexedDB === 'undefined' ? new MemoryStore() : new LocalStore();
  const listeners = new Set<() => void>();
  const kept = new ResilientStore(device, (degraded, error) => {
    if (degraded) console.warn('this browser is not saving:', error);
    for (const listener of listeners) listener();
  });
  const { account, store, saves, ranked, rooms, community } = browserOnline(kept);
  const saving: Saving = {
    degraded: () => kept.degraded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const deps = {
    newId: () => crypto.randomUUID(),
    // Thirty-two bytes: every random stream of a game starts from 128 bits of it.
    newSeed: () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    now: () => Date.now(),
    onSaveError: (error: unknown) => console.warn('could not save the game:', error),
    // A life begun under older rules is finished under them, loaded from the site for it.
    loadRules: loadRulesFromSite,
  };
  const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
  // Lives of both kinds: the ones this device plays, and the ranked ones the server plays while someone is signed in.
  const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(ranked, store, content, lives, versions, deps), versions);
  return { sessions, store, saving, account, saves, community, rooms, sound: createSoundBoard(), introduceTabs: true, basket: browserBasket, track: toVercel };
}

/** Anything a tap is meant for: it answers with a tick. */
const PRESSABLE = 'button, a[href], [role="tab"], [role="radio"], [role="switch"]';

/** Everything one page load makes once: the round store and the two services behind it. */
interface Made {
  game: GameStore;
  rooms: RoomStore;
  store: PlayerStore;
  saving: Saving;
  account: Account;
  saves: AccountSaves;
  community: () => Community | null;
  sound: SoundBoard;
  introduceTabs: boolean;
  track: Track;
}

function make({ sessions, store, saving, tapGuardMs, account, saves, community, rooms, schedule, sound, introduceTabs, basket, track = ignore }: Services): Made {
  const game = createGameStore({ sessions: countingStarts(sessions, track), content, now: () => performance.now(), guardMs: tapGuardMs ?? TAP_GUARD_MS, ...(basket ? { basket } : {}) });
  const roomStore = createRoomStore({
    link: rooms ?? (() => null),
    store,
    content,
    lives,
    versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION },
    tapClock: () => performance.now(),
    tapGuardMs: tapGuardMs ?? TAP_GUARD_MS,
    schedule,
    page: typeof window === 'undefined' ? undefined : browserPage,
    onSaveError: (error) => console.warn('could not save the life in the room:', error),
  });
  return { game, rooms: roomStore, store, saving: saving ?? ALWAYS_SAVING, account: account ?? offlineAccount, saves: saves ?? NO_SAVES, community: community ?? NO_COMMUNITY, sound: sound ?? createSoundBoard(() => null), introduceTabs: introduceTabs === true, track };
}

/** Noted while a guest is away at Google keeping their account, so that the page they come back to can count it. */
const KEEPING = 'ratrace:keeping-account';

/** The note of a guest gone to keep their account. A browser that keeps nothing simply counts nothing. */
const keeping = {
  set: () => {
    try {
      window.sessionStorage.setItem(KEEPING, '1');
    } catch {
      // Nothing: the account is kept all the same, only not counted.
    }
  },
  /** True once, if the note was there: it is taken away as it is read. */
  take: (): boolean => {
    try {
      const was = window.sessionStorage.getItem(KEEPING) !== null;
      window.sessionStorage.removeItem(KEEPING);
      return was;
    } catch {
      return false;
    }
  },
};

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
      // Lives finished before ranks, or on another device, count towards the rank the first time they are seen.
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
      void made.rooms.getState().boot().catch((error: unknown) => console.error('the room could not be looked for:', error));
    }
    refresh();
    const stop = made.game.subscribe((state, before) => {
      if (state.view !== before.view || state.status !== before.status) refresh();
      const ended = lifeEnded(state, before);
      if (ended) made.track(ended);
    });
    const stopRooms = made.rooms.subscribe((state, before) => {
      const began = gameBegan(state.room, before.room);
      if (began) made.track(began);
    });
    // Back from Google: a member now, the guest kept their account. Back as a guest with a notice, they did not.
    const kept = () => {
      const state = made.account.state();
      if (state.kind === 'member' || (state.kind === 'guest' && state.notice !== null)) {
        if (keeping.take() && state.kind === 'member') made.track({ name: 'account_kept' });
      }
    };
    kept();
    // What the account brings from another device: a life is opened as the device now has it, the rest is read
    // again. The same life under a new id is opened too, with nothing to tell the player: nothing of it changed.
    const stopSaves = made.saves.onDeviceChanged((what) => {
      if (what === 'game') void made.game.getState().reopen();
      else if (what === 'renamed') void made.game.getState().boot();
      else refresh();
    });
    // The page asks the device for its life before anyone is signed in. A ranked life the device has only a note of
    // has nothing to show until the server can be asked for it: the device is asked again when someone signs in,
    // unless a life is already open.
    let signedIn = made.account.state().kind !== 'offline';
    const stopAccount = made.account.subscribe(() => {
      kept();
      const now = made.account.state().kind !== 'offline';
      const landed = now && !signedIn;
      const changed = now !== signedIn;
      signedIn = now;
      if (landed && made.game.getState().status !== 'playing') void made.game.getState().boot();
      // The rooms are the account's: whoever is now signed in, or nobody, has their own.
      if (changed) void made.rooms.getState().boot().catch((error: unknown) => console.error('the room could not be looked for:', error));
    });
    return () => {
      mounted = false;
      stop();
      stopRooms();
      stopSaves();
      stopAccount();
    };
  }, [made]);

  // Someone signing in on this device brings the language of their account with them.
  useEffect(() => followAccountLanguage(made.account, made.community, locale, (address) => window.location.replace(address)), [made, locale]);

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

  // The sounds follow the round on screen, and every press answers with a tick.
  const soundOn = profile.settings.sound;
  useEffect(() => {
    made.sound.setOn(soundOn);
  }, [made, soundOn]);
  useEffect(() => {
    const stop = made.game.subscribe((state, before) => {
      for (const cue of cuesFor(state, before)) made.sound.play(cue);
    });
    const onClick = (event: MouseEvent) => {
      const pressed = event.target instanceof Element ? event.target.closest(PRESSABLE) : null;
      if (pressed && !(pressed as HTMLButtonElement).disabled) made.sound.play('tap');
    };
    document.addEventListener('click', onClick, true);
    return () => {
      stop();
      document.removeEventListener('click', onClick, true);
    };
  }, [made]);

  const reload = useMemo(
    () => () => {
      void made.store.loadProfile().then(setProfile, () => undefined);
      void made.store.listRuns().then(setRuns, () => undefined);
    },
    [made],
  );
  const value = useMemo<Game>(
    () => ({
      game: made.game,
      rooms: made.rooms,
      inRoom: false,
      reload,
      store: made.store,
      saving: made.saving,
      account: made.account,
      saves: made.saves,
      community: made.community,
      sound: made.sound,
      introduceTabs: made.introduceTabs,
      track: made.track,
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
    [made, locale, profile, runs, reload],
  );
  return (
    <GameContext.Provider value={value}>
      <KeyboardProvider>{children}</KeyboardProvider>
    </GameContext.Provider>
  );
}

/**
 * Shows the screens under it a round store of their own: a life in a room, beside the device's own
 * life in progress, on the same screens. What the life earns reaches the profile, and its sounds
 * play, as for any life.
 */
export function GameScope({ game, children }: { game: GameStore; children: ReactNode }) {
  const parent = useGameContext();
  const { reload, sound } = parent;
  useEffect(
    () =>
      game.subscribe((state, before) => {
        if (state.view !== before.view || state.status !== before.status) reload();
        for (const cue of cuesFor(state, before)) sound.play(cue);
      }),
    [game, reload, sound],
  );
  const value = useMemo<Game>(() => ({ ...parent, game, inRoom: true }), [parent, game]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

function useGameContext(): Game {
  const value = useContext(GameContext);
  if (!value) throw new Error('this component must be inside a GameProvider');
  return value;
}

/** A slice of the round on screen. The component redraws when that slice changes. */
/**
 * Whether the rules the life is played under know an order, named by its key (`focus:careerMove`,
 * `pensionOut`...): a life begun under older rules is not offered what they do not know.
 */
export function useKnows(): (key: string) => boolean {
  const rules = useGame((s) => s.rules);
  return (key) => rulesKnow(rules, key);
}

export function useGame<T>(select: (state: RoundState & RoundActions) => T): T {
  return useStore(useGameContext().game, select);
}

/** The room the player is in, as this page follows it. */
export const useRooms = (): RoomStore => useGameContext().rooms;

/** A slice of the room the player is in. The component redraws when that slice changes. */
export function useRoom<T>(select: (state: RoomStoreState & RoomActions) => T): T {
  return useStore(useGameContext().rooms, select);
}

/** True for the screens of a life in a room. */
export const useInRoom = (): boolean => useGameContext().inRoom;

/** The content with its text and names in the language in use, and how numbers are written. */
export const useWords = (): Words => useGameContext().words;

export const useSettings = () => {
  const { profile, changeProfile, locale } = useGameContext();
  return {
    reducedMotion: profile.settings.reducedMotion,
    setReducedMotion: (reducedMotion: boolean) => changeProfile((current) => ({ ...current, settings: { ...current.settings, reducedMotion } })),
    sound: profile.settings.sound,
    setSound: (sound: boolean) => changeProfile((current) => ({ ...current, settings: { ...current.settings, sound } })),
    locale,
  };
};

/** Plays a cue. For the few sounds that belong to a screen and not to a change of the round. */
export const useSound = (): ((cue: Cue) => void) => {
  const { sound } = useGameContext();
  return (cue) => sound.play(cue);
};

/** What belongs to the player rather than to one life: badges, the gallery, the lives unlocked. */
export const useProfile = (): Profile => useGameContext().profile;

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
export function useIntroducesTabs(): boolean {
  const { introduceTabs } = useGameContext();
  return introduceTabs;
}

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

/** Finished lives, the latest first, or null while the device has not answered yet. */
export const useRuns = (): FinishedRun[] | null => useGameContext().runs;

const NOBODY: AccountState = { kind: 'offline' };

/** Who is playing, as the cloud knows them, and the two things a player can do about it. */
/** Whether the account has tried to sign in yet: before, nobody being signed in says nothing. */
export function useAccountSettled(): boolean {
  const { account } = useGameContext();
  return useSyncExternalStore(account.subscribe, () => account.settled?.() ?? true, () => false);
}

export function useAccount(): { state: AccountState; keepWithGoogle(): Promise<boolean>; useExistingAccount(): Promise<boolean>; dismissNotice(): void; signOut(): Promise<boolean> } {
  const { account, store } = useGameContext();
  const state = useSyncExternalStore(account.subscribe, account.state, () => NOBODY);
  // Back to the very page the player is on, without whatever a sign-in left after the hash.
  const here = () => window.location.href.split('#')[0];
  return {
    state,
    keepWithGoogle: async () => {
      const going = await account.keepWithGoogle(here());
      if (going) keeping.set();
      return going;
    },
    useExistingAccount: () => account.useExistingAccount(here()),
    dismissNotice: () => account.dismissNotice(),
    // What the account keeps goes from this device with it, so that the guest who comes next does not take it into an
    // account of their own: the life in progress, the finished ones and the progress. Only the settings stay. Signing
    // in with Google again brings it all back.
    signOut: async () => {
      const settings = (await store.loadProfile()).settings;
      if (!(await account.signOut())) return false;
      await store.clearGame();
      for (const run of await store.listRuns()) await store.removeRun(run.runId);
      await store.saveProfile({ ...newProfile(), settings });
      window.location.reload();
      return true;
    },
  };
}

const NO_COMMUNITY = (): Community | null => null;

/**
 * The other players: the rankings, the player's name, whom they follow. Null while nobody is
 * signed in. It is asked again whenever who is signed in changes.
 */
export function useCommunity(): Community | null {
  const { account, community } = useGameContext();
  // Who is signed in decides whether there is anyone to ask: read here so that a change of it draws the screen anew.
  useSyncExternalStore(account.subscribe, account.state, () => NOBODY);
  return community();
}

/** Tells of every change of whether the browser has a connection. Returns how to stop. */
function watchConnection(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/**
 * Whether a new life can be a ranked one, played by the server: `yes` when someone is signed in
 * and there is a connection; `offline` when someone is signed in and there is none, which the
 * player is told before the life begins; `no` where there is no account at all.
 */
export function useRanking(): 'yes' | 'offline' | 'no' {
  const { account } = useGameContext();
  const state = useSyncExternalStore(account.subscribe, account.state, () => NOBODY);
  const connected = useSyncExternalStore(watchConnection, () => window.navigator.onLine, () => true);
  if (state.kind === 'offline') return 'no';
  return connected ? 'yes' : 'offline';
}

/**
 * How the account's copy of the player's things stands, and the different life waiting there, if
 * there is one, with the two things a player can do about it.
 */
export function useAccountSaves(): { status: CloudSaving; offer: AccountLife | null; takeOffer(): Promise<boolean>; declineOffer(): Promise<void> } {
  const { saves, game } = useGameContext();
  const status = useSyncExternalStore(saves.subscribe, saves.status, () => 'off' as const);
  const offer = useSyncExternalStore(saves.subscribe, saves.offer, () => null);
  return {
    status,
    offer,
    takeOffer: async () => {
      const taken = await saves.takeOffer();
      // The player asked for it: the life is opened as the device now has it, with nothing to explain.
      if (taken) await game.getState().boot();
      return taken;
    },
    declineOffer: () => saves.declineOffer(),
  };
}

/** False while the device is not taking saves. The screens that promise "saved" say so instead. */
/** Counts something the player did (`pwa/events.ts`): for the screens, at the moment it succeeded. */
export function useTrack(): Track {
  return useGameContext().track;
}

export function useSaving(): boolean {
  const { saving } = useGameContext();
  return !useSyncExternalStore(saving.subscribe, saving.degraded, () => false);
}

/** A translator for one section of the interface text. */
export const useT = (section: string): Translate => useTranslations(section) as unknown as Translate;
