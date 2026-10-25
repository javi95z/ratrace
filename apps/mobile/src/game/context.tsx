import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import type { BasketKeep } from '@ratrace/core/game/basket';
import type { Words } from '@ratrace/core/game/present';
import { createRoomStore } from '@ratrace/core/game/room';
import type { RoomActions, RoomStore, RoomStoreState } from '@ratrace/core/game/room';
import { rulesKnow } from '@ratrace/core/game/rules';
import { createGameStore } from '@ratrace/core/game/store';
import type { GameStore, RoundActions, RoundState } from '@ratrace/core/game/store';
import { formatFor } from '@ratrace/core/lib/format';
import { LocalSessions, type SessionDeps } from '@ratrace/core/session/local';
import { settleRank, updateProfile } from '@ratrace/core/session/profile';
import { RankedSessions } from '@ratrace/core/session/ranked';
import { ResilientStore } from '@ratrace/core/session/resilient';
import type { RoomsLink } from '@ratrace/core/session/room';
import { GameSessions } from '@ratrace/core/session/sessions';
import { newProfile } from '@ratrace/core/session/types';
import type { FinishedRun, PlayerStore, Profile, Sessions, Settings } from '@ratrace/core/session/types';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Locale } from '@ratrace/i18n/locales';
import { offlineAccount } from '@ratrace/online/offline';
import type { Account, AccountLife, AccountSaves, AccountState, CloudSaving, Community } from '@ratrace/online/types';
import { getCalendars } from 'expo-localization';
import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { kvForget, kvForgotten, kvKeeping, kvLanguage, kvLastAccount, kvPush, KvStore, kvText } from '../kvStore';
import { phoneOnline } from '../online';
import type { Online } from '../online';
import { backFromGoogle, openForGoogle } from '../online/browser';
import { CaptchaHost } from '../online/captcha';
import { firstScreenDoor } from '../online/held';
import { usePlace } from '../online/errors';
import { followAccountLanguage } from '../online/language';
import { phoneConnection, phonePage } from '../online/page';
import { phonePush } from '../online/push';
import type { Push } from '../online/push';
import { phoneTrack } from '../online/track';
import { alsoToVercel } from '../pwa/visits';
import { closeAllSheets, closeEverySheet, openSheetsAgain, sheetsGone } from '../ui/back';
import { whenShown } from '../ui/drawnFirst';
import { perfStore } from '../ui/perf';
import { ReducedMotionProvider, useReducedMotion } from '../ui/animations';
import { SoundProvider, useSound } from '../ui/sound';
import { cuesFor } from './cues';
import { countingStarts, gameBegan, ignore, lifeEnded } from './events';
import type { Track } from './events';
import { sameProfile, sameRuns } from './keep';
import { deviceLanguages, localeOf, type LanguageKeep } from './locale';
import { reloadDocument } from './reloadDocument';
import { pageAt, useGoFromAnywhere } from './pages';
import { useLanguage } from './useLanguage';
import { loadBundledRules } from './olderRules';
import { phoneBasket } from './phoneBasket';
import { useContentText } from './languageWords';
import { WordsProvider } from './words';

export { useT } from './words';
export type { Counted, Track } from './events';
export { usePictureShare } from './sharing';
export type { PictureShare } from './sharing';
export { useSound };
export type { Cue } from '../ui/sound';

/*
 * The phone's counterpart of the web's game/context.tsx: the one place that wires the session, the device's store, the round store and the
 * cloud. The hooks of the cloud are the web's, by name and by what they answer: with no project in the build (or no services in a test), nobody
 * signs in, and a life is played on the phone as the web plays one for a guest with no connection.
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
  /** Who is playing, as the cloud knows them. Left out, the game has no cloud: nobody is signed in. */
  account?: Account;
  /** How the account's copy of the player's things stands. Left out, nothing is saved to an account. */
  saves?: AccountSaves | null;
  /** The other players, while someone is signed in, and null otherwise. Left out, there are none to ask. */
  community?: () => Community | null;
  /** The rooms, while someone is signed in, and null otherwise. Left out, there are none. */
  rooms?: () => RoomsLink | null;
  /** Runs something later, for the clocks of a room. Left out, the phone's own timers. */
  schedule?: (run: () => void, ms: number) => () => void;
  /** Where the orders of a round not yet played are kept. Left out, only in memory. */
  basket?: BasketKeep;
  /** True where the tabs of the money are opened one by one through a guided first life. */
  introduceTabs?: boolean;
  /** Where the language the player chose is kept. Left out, on the phone. */
  language?: LanguageKeep;
  /**
   * The clock a screen reads the date by, in milliseconds (`useClock`): the week's challenge and the days left of it.
   * Left out, the phone's own. A scene (`testing/scene.tsx`) holds it at one day so its shot is the same on any day.
   */
  now?: () => number;
  /** Where what is counted of how the game is played goes (`events.ts`). Left out, nothing is counted. */
  track?: Track;
  /** The game's notices on the phone (`online/push.ts`). Left out, the phone's own, over its store. */
  push?: Push;
  /** Told once the game's first screen is drawn, with the game opened: what waits for it (the account's lives in progress, `online/held.ts`) may go. */
  firstDrawn?: () => void;
}

/** Long enough for the second tap of a double tap, short enough that nobody waits for it. */
export const TAP_GUARD_MS = 400;
const ALWAYS_SAVING: Saving = { degraded: () => false, subscribe: () => () => {} };
const NO_SAVES: AccountSaves = { status: () => 'off', offer: () => null, subscribe: () => () => {}, onDeviceChanged: () => () => {}, takeOffer: async () => false, declineOffer: async () => {} };
const NO_COMMUNITY = (): Community | null => null;
const NO_ROOMS = (): RoomsLink | null => null;

/**
 * What a screen reads of the game is held in five contexts, so that a screen is drawn again only for what it reads: the game itself (the
 * round store, the words, the date, the language: made once, and again only for a language), the settings the player has set, the profile
 * and the finished lives (each put in place only when it has changed), and the cloud (the account, its copy of the player's things, the other
 * players, the rooms: made once for each start of the game, and read by the screens that ask, through the hooks below, as they change). One
 * context for everything drew every screen again, twice, after every card: the profile and the lives were read and set again with each step,
 * whether or not they had changed.
 */
interface Game {
  game: GameStore;
  /** True under a `GameScope`: the round store is a room's life, not the device's own. */
  inRoom: boolean;
  /** Reads the profile and the finished lives again, and holds what is read whether or not it changed. */
  reload(): void;
  store: PlayerStore;
  saving: Saving;
  introduceTabs: boolean;
  now: () => number;
  words: Words;
  locale: Locale;
  setLocale(locale: Locale): void;
  changeProfile(change: (profile: Profile) => Profile): void;
}

/** The cloud, as one start of the game holds it. None of it changes: what moves in it is read by the hooks that watch it. */
interface Cloud {
  rooms: RoomStore;
  account: Account;
  saves: AccountSaves;
  community: () => Community | null;
  track: Track;
  push: Push;
  store: PlayerStore;
  /** True where the phone has a project to sign in to. */
  canSignIn: boolean;
  /**
   * Resolves once the life on the phone is the newest copy the account knows of, for what acts on it (Continue), waiting up to `FRESH_WAIT_MS` for
   * the account: while it signs in at a start, then until it has been read for that life and the copy it brought is opened (`freshLife`). Past that
   * time, the phone's copy is used; a further copy the account brings later replaces it then, as on the web. Null where there is nothing to wait for.
   */
  untilFresh(): Promise<void> | null;
  /**
   * Starts the game again, as a page is loaded again: everything the screens hold is drawn anew from what the device holds, from the settings
   * given (what the device holds of them, so nothing the player set flashes back to its default while the device is read), on the front door.
   */
  restart(settings: Settings): Promise<void>;
}

const GameContext = createContext<Game | null>(null);
/** The two settings the player can set that screens read; held apart from the profile so that the rest of it moving is not a change of them. */
const SettingsContext = createContext<{ reducedMotion: boolean; sound: boolean } | null>(null);
const ProfileContext = createContext<Profile | null>(null);
/** Finished lives, the latest first. Null until the device has answered. */
const RunsContext = createContext<{ runs: FinishedRun[] | null } | null>(null);
const CloudContext = createContext<Cloud | null>(null);

/** The longest what acts on the life in progress waits for the account to be read at a start (`untilFresh`). */
export const FRESH_WAIT_MS = 1500;

/** What the phone's mirror tells besides the web's: whether the account has been read for the life on the device (`@ratrace/online/mirror`). */
type ReadSaves = AccountSaves & { lifeRead?(): boolean; onLifeRead?(listener: () => void): () => void };

/**
 * Waits, at most `FRESH_WAIT_MS` in all, for the newest copy of the life on the phone the account knows of: while the account is still signing in at
 * a start (not settled: the session read, and renewed over the network if it has run out), or someone is signed in and the mirror has not yet read
 * the account for the life on the device (its pass not failed: `waiting`, no network); then for that copy to be opened (`opening`, null once it
 * is). Null where none of it is under way: act at once. Past the time, the life is acted on as the phone has it; a further copy the account brings
 * later replaces it then, as on the web.
 */
export function freshLife(saves: ReadSaves, account: Account, opening: () => Promise<unknown> | null, schedule: (run: () => void, ms: number) => unknown = setTimeout): Promise<void> | null {
  const signingIn = () => account.settled?.() === false;
  const reading = () => signingIn() || (saves.lifeRead !== undefined && !saves.lifeRead() && account.state().kind !== 'offline' && saves.status() !== 'waiting');
  if (!reading() && opening() === null) return null;
  return new Promise<void>((resolve) => {
    let over = false;
    const stops: Array<() => void> = [];
    const done = () => {
      if (over) return;
      over = true;
      for (const stop of stops) stop();
      resolve();
    };
    const opened = () => {
      const under = opening();
      if (under === null) done();
      else void under.then(done, done);
    };
    const look = () => {
      if (!over && !reading()) opened();
    };
    if (saves.onLifeRead) stops.push(saves.onLifeRead(look));
    stops.push(saves.subscribe(look));
    stops.push(account.subscribe(look));
    schedule(done, FRESH_WAIT_MS);
    look();
  });
}

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

const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };

/**
 * The services of the game over the cloud of a phone (`phoneOnline`, or a test's): the store with the account behind it, and lives of both
 * kinds, the ones the phone plays and the ranked ones the server plays while someone is signed in.
 */
export function servicesOver(online: Online, deps: SessionDeps): Pick<Services, 'sessions' | 'store' | 'account' | 'saves' | 'community' | 'rooms'> {
  const { account, store, saves, ranked, rooms, community } = online;
  const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(ranked, store, content, lives, VERSIONS, deps), VERSIONS);
  return { sessions, store, account, saves, community, rooms };
}

/** The services of the real game: the engine on this phone, saved on this phone and in the player's account where there is one, with the orders of the round kept as they are put in. */
export function phoneServices(): Services {
  const listeners = new Set<() => void>();
  // The phone's store makes each finished life anew from its text for every list (kvStore.ts): the resilient store hands them on without copying them
  // again (`freshReads`). The probe times both: the device's calls, and what the game waits for with the resilient store's work (and the account's) over them.
  const resilient = new ResilientStore(
    perfStore(new KvStore(), 'device'),
    (degraded, error) => {
      if (degraded) console.warn('this phone is not saving:', error);
      for (const listener of listeners) listener();
    },
    { freshReads: true },
  );
  // The account's lives in progress are handed to its mirror once the game's first screen is drawn (`online/held.ts`): what it plays back of them
  // comes after the front door, a life at a time.
  const firstScreen = firstScreenDoor();
  const online = phoneOnline(resilient, firstScreen.wait);
  const saving: Saving = {
    degraded: () => resilient.degraded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const wired = servicesOver({ ...online, store: perfStore(online.store, 'saved') }, phoneDeps());
  // What is counted goes to the game's own project, in a release build only (`online/track.ts`), and the install with it, on the first launch; on the
  // web also to Vercel, as the Next web counts (`pwa/visits.web.tsx`).
  return { ...wired, saving, introduceTabs: true, basket: phoneBasket, firstDrawn: firstScreen.open, track: alsoToVercel(phoneTrack(online.account, kvText)) };
}

/** Everything one start of the app makes once: the round store and the services behind it. */
interface Made {
  /** The round store of the game as it was last started (`restart` makes a new one). */
  game: GameStore;
  rooms: RoomStore;
  sessions: Sessions;
  store: PlayerStore;
  saving: Saving;
  account: Account;
  saves: AccountSaves;
  community: () => Community | null;
  canSignIn: boolean;
  introduceTabs: boolean;
  language: LanguageKeep;
  now: () => number;
  track: Track;
  push: Push;
  basket?: BasketKeep;
  tapGuardMs: number;
  firstDrawn?: () => void;
}

/** A round store over the game's sessions, with nothing in it until it is booted. */
const roundStore = ({ sessions, tapGuardMs, basket }: Pick<Made, 'sessions' | 'tapGuardMs' | 'basket'>): GameStore =>
  createGameStore({ sessions, content, now: () => performance.now(), guardMs: tapGuardMs, ...(basket ? { basket } : {}) });

function make({ sessions, store, saving, tapGuardMs, account, saves, community, rooms, schedule, basket, introduceTabs, language, now, track = ignore, push, firstDrawn }: Services): Made {
  const guard = tapGuardMs ?? TAP_GUARD_MS;
  const counted = countingStarts(sessions, track);
  const roomStore = createRoomStore({
    link: rooms ?? NO_ROOMS,
    store,
    content,
    lives,
    versions: VERSIONS,
    tapClock: () => performance.now(),
    tapGuardMs: guard,
    // The room's clocks by the game's own clock (`now`, the phone's): a scene's, held still, holds a lobby's count and a round's time still with it.
    now: now ?? (() => Date.now()),
    schedule,
    // None where the page is drawn with no browser (the web export's HTML, made on the build's machine), as the Next web's: the browser's own
    // game, made as it takes the page over, listens to it.
    page: typeof window === 'undefined' ? undefined : phonePage,
    onSaveError: (error) => console.warn('could not save the life in the room:', error),
  });
  return {
    game: roundStore({ sessions: counted, tapGuardMs: guard, basket }),
    rooms: roomStore,
    sessions: counted,
    store,
    saving: saving ?? ALWAYS_SAVING,
    account: account ?? offlineAccount,
    saves: saves ?? NO_SAVES,
    community: community ?? NO_COMMUNITY,
    canSignIn: account !== undefined && account !== offlineAccount,
    introduceTabs: introduceTabs === true,
    language: language ?? kvLanguage,
    now: now ?? Date.now,
    track,
    // The phone's notices, over the note the phone's store keeps of them: made with the game, whatever services a test hands it.
    push: push ?? phonePush(kvPush),
    basket,
    tapGuardMs: guard,
    firstDrawn,
  };
}

/** The real game of this start of the app: made once, whatever is drawn again above it, and the one cloud of it, whoever signs in or out. */
let shared: Made | null = null;

/**
 * For a test (and `testing/*`) only, which the wall holds (architecture.test.ts): the next provider with no services makes the real game anew, as
 * a new start of the app would.
 */
export function forgetTheGame(): void {
  shared = null;
}
/** Round stores that have already asked the device for a life in progress. */
const booted = new WeakSet<GameStore>();

/**
 * The phone's language, outside the game: the player's choice, else the phone's own. What the app's own links are opened in (`app/+native-intent.tsx`),
 * which the router asks before anything is drawn.
 */
export const linkLocale = (): Locale => localeOf(kvLanguage.read(), deviceLanguages());

/**
 * The sounds follow the round on screen: every change of it is heard as the web hears it (`cues.ts`). The tap of a press
 * is not here: the kit ticks on each press itself.
 */
function Cues({ game }: { game: GameStore }) {
  const play = useSound();
  useEffect(
    () =>
      game.subscribe((state, before) => {
        for (const cue of cuesFor(state, before)) play(cue);
      }),
    [game, play],
  );
  return null;
}

/**
 * The screen in front, for the reports of what goes wrong (`app:<path>`): heard inside the router, round every screen, by a leaf of its own, so
 * that a change of screen draws nothing else again.
 */
function Place(): null {
  usePlace();
  return null;
}

/** How long a tap waits for the sheets it closed to be gone: one that will not close by then keeps the tap from opening anything. */
const SHEETS_PATIENCE = 2_000;

/**
 * A tap on one of the game's notices opens the screen it names: the tap that opened the app (once the router is there), and each one while it runs.
 * The sheets open over whatever was shown are closed first, each as the player would close it (as a page left on the web takes its sheets with it),
 * and the screen changes once they are gone: nothing is left open behind it to come back. A sheet that will not close in a while (a question being
 * answered) keeps the tap from opening anything rather than leave its Modal over the new screen. The screen in front already is opened anew in its
 * place, never a second copy over it. Inside the router, round every screen, once for the app: a game started again does not open the same tap again.
 */
function Taps({ push }: { push: Push }): null {
  // The way to the pages as it is now: in the language of the address in front, whichever that is when the tap comes. A notice opens a page over the
  // stack in front, whose pages are all of one language (the address's), so the page goes on in it; the app's own links (`+native-intent`) may come
  // before any page is drawn, with no address to follow, and are opened in the phone's language, the player's choice (`linkLocale`). The two differ
  // only once the player has chosen another language while the app runs, and the words on screen are the player's choice either way.
  const now = useGoFromAnywhere();
  const go = useRef(now);
  go.current = now;
  const pathname = usePathname();
  // The screen in front, as the router last said.
  const shown = useRef(pathname);
  shown.current = pathname;
  useEffect(() => {
    let live = true;
    const stop = push.onTap(({ page, query }) => {
      closeAllSheets();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), SHEETS_PATIENCE);
      });
      void Promise.race([sheetsGone().then(() => true as const), late]).then((gone) => {
        clearTimeout(timer);
        if (!live || !gone) return;
        try {
          if (pageAt(shown.current) === page) go.current.replace(page, { query });
          else go.current.push(page, { query });
        } catch {
          // The router could not go there: the screen stays as it is, with nothing of the tap left behind.
        }
      });
    });
    return () => {
      live = false;
      stop();
    };
  }, [push]);
  return null;
}

/**
 * Holds the game for every screen under it: the round store, the player's profile, the words of the language in use, and the cloud. It
 * opens the life in progress, if there is one, as soon as it mounts. Started again (`restart`, when the player signs out) it is drawn anew
 * over a new round store, as the web's page is loaded again: the cloud is the same one, and the account in it starts a new guest. The player
 * lands then on the front door, as the web's sign-out leaves them on a page that has nothing of the account's left to show.
 */
export function GameProvider({ children, services }: { children: ReactNode; services?: Services }) {
  const [made] = useState(() => (services ? make(services) : (shared ??= make(phoneServices()))));
  const [started, setStarted] = useState<{ count: number; settings: Settings | null }>({ count: 0, settings: null });
  // The sheets open (the question of signing out, the settings under it) are shut first, and the game starts again once they have gone: a sheet
  // is never left presented while the screens under it are taken away (on iOS a view controller torn down so can be left half gone).
  // What holds the sheets shut while the game starts again: let go once it is drawn anew (or the start failed).
  const shutForStart = useRef<(() => void) | null>(null);
  const restart = useCallback(
    async (settings: Settings) => {
      shutForStart.current?.();
      shutForStart.current = closeEverySheet();
      let ready = false;
      try {
        await sheetsGone();
        made.game = roundStore(made);
        ready = true;
      } finally {
        // A start that failed leaves the game as it was, and its sheets free to open again; one that did not lets them open once it is drawn.
        if (!ready) {
          shutForStart.current?.();
          shutForStart.current = null;
        }
      }
      setStarted((was) => ({ count: was.count + 1, settings }));
    },
    [made],
  );
  // Taken away halfway (the layout above it drawn anew), the game leaves no sheet shut for whatever comes next.
  useEffect(() => openSheetsAgain, []);
  // The account was deleted in another tab of the site (or the installed game beside it): this one holds the player in its memory still, and would
  // write them back. It starts afresh from what the browser now holds. (The phone runs once: it hears nothing.)
  useEffect(() => kvForgotten.listen(reloadDocument), []);
  // Once the game is drawn anew: the sheets may open again.
  const reopen = useCallback(() => {
    shutForStart.current?.();
    shutForStart.current = null;
  }, []);
  return (
    <>
      <Place />
      <Taps push={made.push} />
      <Started key={started.count} made={made} settings={started.settings} restart={restart}>
        {children}
      </Started>
      {/* After the game, as the effect of its parent was: the game drawn anew has run its own first. */}
      <Landing count={started.count} landed={reopen} />
    </>
  );
}

/**
 * Once the game is drawn anew (`count`, the starts so far): whatever the stack is, the front door, on purpose, once for each start, whatever else draws
 * this again; `landed` first. A leaf of its own, as `Taps`: it reads the address in front, which changes at every move of the router, and nothing
 * else is drawn again for it.
 */
function Landing({ count, landed }: { count: number; landed: () => void }): null {
  const go = useGoFromAnywhere();
  const seen = useRef(0);
  useEffect(() => {
    if (count === seen.current) return;
    seen.current = count;
    landed();
    go.home();
  }, [count, landed, go]);
  return null;
}

function Started({ made, settings: startedWith, restart, children }: { made: Made; settings: Settings | null; restart: (settings: Settings) => Promise<void>; children: ReactNode }) {
  const [game] = useState(() => made.game);
  // The phone's choice, else its own; on the web, the page's address (`useLanguage.web.ts`).
  const { locale, choose: setLocale, follow } = useLanguage(made.language);
  const [timeZone] = useState(() => getCalendars()[0]?.timeZone ?? undefined);
  const [profile, setProfile] = useState<Profile>(() => (startedWith ? { ...newProfile(), settings: startedWith } : newProfile()));
  const [runs, setRuns] = useState<FinishedRun[] | null>(null);
  // The opening of the life the account last brought (`onDeviceChanged`), while it is under way: what waits for the freshest life waits for it too.
  const reopened = useRef<Promise<unknown> | null>(null);

  // Held when read again only if it changed: the device is read after every step and nearly always says what it said.
  const holdProfile = useCallback((read: Profile) => setProfile((held) => (sameProfile(held, read) ? held : read)), []);
  const holdRuns = useCallback((read: FinishedRun[]) => setRuns((held) => (sameRuns(held, read) ? held : read)), []);

  useEffect(() => {
    let mounted = true;
    // What the player has earned changes with every step of a life: the profile is read again with each. The list of lives changes when one ends
    // (or the life is let go), and when the game opens: only then is it read, and only then are lives finished before ranks counted towards the rank.
    const refresh = (lives: boolean) => {
      const profileRead = made.store.loadProfile();
      void profileRead.then((loaded) => mounted && holdProfile(loaded));
      if (!lives) return;
      const runsRead = made.store.listRuns();
      void runsRead.then((loaded) => mounted && holdRuns(loaded));
      void Promise.all([profileRead, runsRead])
        .then(async ([held, finished]) => {
          if (finished.some((run) => !Object.hasOwn(held.rank.lives, run.runId))) {
            const next = await settleRank(made.store, finished);
            if (mounted) holdProfile(next);
          }
        })
        .catch(() => undefined);
    };
    const lookForRoom = () => void made.rooms.getState().boot().catch((error: unknown) => console.error('the room could not be looked for:', error));
    if (!booted.has(game)) {
      booted.add(game);
      void game.getState().boot();
      lookForRoom();
    }
    refresh(true);
    const stop = game.subscribe((state, before) => {
      // The game opening is not a life ending: the lives were read as the provider mounted, and are not read again for it (the profile is, for what opening a life tells it).
      if (before.status === 'booting') refresh(false);
      else if (state.status !== before.status || state.view?.finished !== before.view?.finished) refresh(true);
      else if (state.view !== before.view) refresh(false);
      const ended = lifeEnded(state, before);
      if (ended) made.track(ended);
    });
    const stopRooms = made.rooms.subscribe((state, before) => {
      const began = gameBegan(state.room, before.room);
      if (began) made.track(began);
    });
    // Back from Google: a member now, the guest kept their account. Still a guest with a notice, they did not.
    const kept = () => {
      const state = made.account.state();
      if (state.kind === 'member' || (state.kind === 'guest' && state.notice !== null)) {
        if (kvKeeping.take() && state.kind === 'member') made.track({ name: 'account_kept' });
      }
    };
    kept();
    // What the account brings from another device: a life is opened as the device now has it, the rest is read again. The same life under a
    // new id is opened too, with nothing to tell the player: nothing of it changed.
    const stopSaves = made.saves.onDeviceChanged((what) => {
      if (what === 'game') {
        const opening = game.getState().reopen();
        reopened.current = opening;
        const over = () => {
          if (reopened.current === opening) reopened.current = null;
        };
        void opening.then(over, over);
      }
      else if (what === 'renamed') void game.getState().boot();
      else refresh(true);
    });
    // The game asks the device for its life before anyone is signed in. A ranked life the device has only a note of has nothing to show until the
    // server can be asked for it: the device is asked again when someone signs in, unless a life is already open.
    let signedIn = made.account.state().kind !== 'offline';
    const stopAccount = made.account.subscribe(() => {
      kept();
      const now = made.account.state().kind !== 'offline';
      const landed = now && !signedIn;
      const changed = now !== signedIn;
      signedIn = now;
      if (landed && game.getState().status !== 'playing') void game.getState().boot();
      // The rooms are the account's: whoever is now signed in, or nobody, has their own.
      if (changed) lookForRoom();
    });
    return () => {
      mounted = false;
      stop();
      stopRooms();
      stopSaves();
      stopAccount();
    };
  }, [made, game, holdProfile, holdRuns]);

  // The game opened and its first screen on the phone's screen (the UI thread at its pace again): what waited for it is told, once a start.
  // Not yet where the page is drawn on the server (the web export's HTML): the game opens in the browser.
  const opened = useSyncExternalStore(game.subscribe, () => game.getState().status !== 'booting', () => false);
  useEffect(() => (opened && made.firstDrawn ? whenShown(made.firstDrawn) : undefined), [opened, made]);

  // Someone signing in on this phone brings the language of their account with them.
  useEffect(() => followAccountLanguage(made.account, made.community, locale, kvLastAccount, follow), [made, locale, follow]);

  // The phone's notices, where they are on, follow the account and the language of the game: the next one speaks the language the game does.
  useEffect(() => made.push.follow(made.account, made.community, locale), [made, locale]);

  // The player is signed in as a guest in the background. The game does not wait for it and does not need it. Started again (after signing out),
  // a new guest is.
  useEffect(() => {
    void made.account.start(locale);
    // Once for each start: a change of language is not a new player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [made]);

  const reload = useMemo(
    () => () => {
      void made.store.loadProfile().then(setProfile, () => undefined);
      void made.store.listRuns().then(setRuns, () => undefined);
    },
    [made],
  );
  // Made again only when the language changes: every screen that reads them is not drawn again with each step of the profile. (On the web the
  // language's words are fetched first, and the game waits for them: languageWords.web.ts.)
  const text = useContentText(locale);
  const words = useMemo<Words>(() => ({ content, ...text, fmt: formatFor(locale) }), [text, locale]);
  const changeProfile = useCallback(
    (change: (profile: Profile) => Profile) => {
      // Shown at once, then merged into what the device holds: the profile is never written over whole,
      // because it also holds every badge and the gallery.
      setProfile((current) => change(current));
      void updateProfile(made.store, change).then(holdProfile, () => undefined);
    },
    [made, holdProfile],
  );
  const value = useMemo<Game>(
    () => ({
      game,
      inRoom: false,
      reload,
      store: made.store,
      saving: made.saving,
      introduceTabs: made.introduceTabs,
      now: made.now,
      words,
      locale,
      setLocale,
      changeProfile,
    }),
    [made, game, words, locale, reload, setLocale, changeProfile],
  );
  const untilFresh = useCallback(() => freshLife(made.saves, made.account, () => reopened.current), [made]);
  const cloud = useMemo<Cloud>(
    () => ({ rooms: made.rooms, account: made.account, saves: made.saves, community: made.community, track: made.track, push: made.push, store: made.store, canSignIn: made.canSignIn, untilFresh, restart }),
    [made, untilFresh, restart],
  );
  const { reducedMotion, sound } = profile.settings;
  const settings = useMemo(() => ({ reducedMotion, sound }), [reducedMotion, sound]);
  const finished = useMemo(() => ({ runs }), [runs]);
  return (
    <CloudContext.Provider value={cloud}>
      <GameContext.Provider value={value}>
        <SettingsContext.Provider value={settings}>
          <ProfileContext.Provider value={profile}>
            <RunsContext.Provider value={finished}>
              <WordsProvider locale={locale} timeZone={timeZone}>
                <ReducedMotionProvider value={reducedMotion}>
                  <SoundProvider on={sound}>
                    <Cues game={game} />
                    {children}
                    <CaptchaHost />
                  </SoundProvider>
                </ReducedMotionProvider>
              </WordsProvider>
            </RunsContext.Provider>
          </ProfileContext.Provider>
        </SettingsContext.Provider>
      </GameContext.Provider>
    </CloudContext.Provider>
  );
}

/**
 * Shows the screens under it a round store of their own: a life in a room, beside the device's own
 * life in progress, on the same screens. What the life earns reaches the profile, and its sounds
 * play, as for any life.
 */
export function GameScope({ game, children }: { game: GameStore; children: ReactNode }) {
  const parent = useGameContext();
  const { reload } = parent;
  const play = useSound();
  useEffect(
    () =>
      game.subscribe((state, before) => {
        if (state.view !== before.view || state.status !== before.status) reload();
        for (const cue of cuesFor(state, before)) play(cue);
      }),
    [game, reload, play],
  );
  const value = useMemo<Game>(() => ({ ...parent, game, inRoom: true }), [parent, game]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

function useGameContext(): Game {
  const value = useContext(GameContext);
  if (!value) throw new Error('this component must be inside a GameProvider');
  return value;
}

/** What one of the other contexts holds; they are all made by the same provider as the first. */
function held<T>(value: T | null): T {
  if (value === null) throw new Error('this component must be inside a GameProvider');
  return value;
}

const useCloud = (): Cloud => held(useContext(CloudContext));

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

/** The room the player is in, as this phone follows it. */
export const useRooms = (): RoomStore => useCloud().rooms;

/** A slice of the room the player is in. The component redraws when that slice changes. */
export function useRoom<T>(select: (state: RoomStoreState & RoomActions) => T): T {
  return useStore(useCloud().rooms, select);
}

/** True for the screens of a life in a room. */
export const useInRoom = (): boolean => useGameContext().inRoom;

/** The clock the date is read by, in milliseconds: the phone's own, unless the game was given another (a scene's, held at one day). */
export const useClock = (): (() => number) => useGameContext().now;

/** The content with its text and names in the language in use, and how numbers are written. */
export const useWords = (): Words => useGameContext().words;

/**
 * True where motion is to be left out: the OS asks for it, or the game's setting says so. What only moves is then not
 * drawn at all, and what counts shows where it ends at once. (The web's `useStill`.)
 */
export const useStill = (): boolean => useReducedMotion();

/** The player's settings, and the language, which the phone keeps beside them. */
export const useSettings = () => {
  const { changeProfile, locale, setLocale } = useGameContext();
  const { reducedMotion, sound } = held(useContext(SettingsContext));
  return {
    reducedMotion,
    setReducedMotion: (reducedMotion: boolean) => changeProfile((current) => ({ ...current, settings: { ...current.settings, reducedMotion } })),
    sound,
    setSound: (sound: boolean) => changeProfile((current) => ({ ...current, settings: { ...current.settings, sound } })),
    locale,
    setLocale,
  };
};

/** What belongs to the player rather than to one life: badges, the gallery, the lives unlocked. */
export const useProfile = (): Profile => held(useContext(ProfileContext));

/** Finished lives, the latest first, or null while the device has not answered yet. */
export const useRuns = (): FinishedRun[] | null => held(useContext(RunsContext)).runs;

/**
 * True while the player is guided through a first life: no life finished on this device, and the
 * guide not turned off. While the game is being made, always, so that it can be seen.
 */
export function useGuided(): boolean {
  const profile = useProfile();
  const runs = useRuns();
  if (process.env.NODE_ENV === 'development') return true;
  return runs !== null && runs.length === 0 && !profile.guide.off;
}

/** True where the tabs of the money open one by one in a guided life. */
export const useIntroducesTabs = (): boolean => useGameContext().introduceTabs;

/** The guided first life: the tips already read, and the two ways to be done with one. */
export function useGuide() {
  const profile = useProfile();
  const { changeProfile } = useGameContext();
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

const NOBODY: AccountState = { kind: 'offline' };

/** Whether the account has tried to sign in yet: before, nobody being signed in says nothing. */
export function useAccountSettled(): boolean {
  const { account } = useCloud();
  return useSyncExternalStore(account.subscribe, () => account.settled?.() ?? true, () => false);
}

/**
 * Who is playing, as the cloud knows them, and what a player can do about it. Google is opened over the app and comes back to it
 * (`online/browser.ts`): the calls resolve once it has, as the web's resolve once the page has left for it. On the web (`online/browser.web.ts`) the
 * page itself leaves for Google and comes back to where it was, as the Next web's does.
 */
export function useAccount(): {
  state: AccountState;
  keepWithGoogle(): Promise<boolean>;
  useExistingAccount(): Promise<boolean>;
  dismissNotice(): void;
  signOut(): Promise<boolean>;
  /**
   * Null where the account offers no deletion (a test's that does not); with no project the offline account's answers false, and the settings offer
   * none, nobody being signed in.
   */
  deleteAccount: (() => Promise<boolean>) | null;
} {
  const { account, store, saves, restart, push, community } = useCloud();
  const state = useSyncExternalStore(account.subscribe, account.state, () => NOBODY);
  return {
    state,
    keepWithGoogle: async () => {
      // Noted before the browser opens, because the account may be kept (and counted, as the provider hears it) before the call resolves.
      kvKeeping.set();
      let kept = false;
      try {
        kept = await account.keepWithGoogle(backFromGoogle(), openForGoogle);
        return kept;
      } finally {
        // A trip that came to nothing (or broke on the way) leaves no note behind for a later sign-in to be counted by.
        if (!kept) kvKeeping.take();
      }
    },
    useExistingAccount: () => {
      // Signing in to an account that was already a player's is not keeping this one: a note left by a trip the app did not see end is not this.
      kvKeeping.take();
      return account.useExistingAccount(backFromGoogle(), openForGoogle);
    },
    dismissNotice: () => account.dismissNotice(),
    // What the account keeps goes from this device with it, so that the guest who comes next does not take it into an account of their own: the
    // life in progress, the finished ones and the progress. Only the settings stay. Signing in with Google again brings it all back. Then the game
    // starts again, as the web's page is loaded again, and a new guest with it.
    signOut: async () => {
      const settings = (await store.loadProfile()).settings;
      // The phone's notices are the account's no more: taken from it while it is still signed in (at best, and never in the way of signing out).
      await push.release(community());
      if (!(await account.signOut())) {
        push.resume();
        return false;
      }
      await store.clearGame();
      for (const run of await store.listRuns()) await store.removeRun(run.runId);
      await store.saveProfile({ ...newProfile(), settings });
      await restart(settings);
      return true;
    },
    // Deleted on the server first, and only then forgotten here: a deletion that did not happen (no network, a refusal) leaves the device as it
    // was. Once the account is gone, nothing of the player's is left on the device to go up to the next guest: the mirror's pass with it is stopped
    // and waited for first (`forget`), then the life in progress, every finished life, the profile, the session, the lists for the account and the
    // notices go (`kvForget`), and the mirror forgets again what clearing the life noted for it. Only the settings stay, and what is the device's own
    // (the language). The other tabs of the site are told, and load afresh (`kvForgotten`). Then the game starts again as on a first visit, as it
    // does on signing out, and a new guest with it. After the server's yes, all of it is done at best: the account is gone whatever fails here.
    deleteAccount:
      account.deleteAccount === undefined
        ? null
        : async () => {
            const settings = await store.loadProfile().then((profile) => profile.settings, () => newProfile().settings);
            if (!(await account.deleteAccount?.())) return false;
            const step = (work: () => Promise<unknown>) => work().catch((error: unknown) => console.warn('could not forget the player here:', error));
            await step(async () => saves.forget?.());
            await step(() => push.forget());
            await step(() => store.clearGame());
            await step(async () => {
              for (const run of await store.listRuns()) await store.removeRun(run.runId);
            });
            await step(kvForget);
            await step(() => store.saveProfile({ ...newProfile(), settings }));
            await step(async () => saves.forget?.());
            kvForgotten.tell();
            await step(() => restart(settings));
            return true;
          },
  };
}

/** A thing that never changes, for `useSyncExternalStore`: nothing to listen to. */
const UNCHANGING = () => () => undefined;

/**
 * Whether the phone has a way to sign in: a project to sign in to. The web has no such question (a browser always can); a line that tells a guest
 * to sign in (`challenge.needsAccount`) is not drawn on a phone that cannot: a player is never told to do what the app cannot. The web export's
 * HTML is drawn offline whatever its build's project (`online/index.web.ts`), so the page is taken over with nobody to sign in to, as it was drawn
 * (the server's answer), and learns of the project right after.
 */
export function useCanSignIn(): boolean {
  const { canSignIn } = useCloud();
  return useSyncExternalStore(UNCHANGING, () => canSignIn, () => false);
}

/**
 * The other players: the rankings, the player's name, whom they follow. Null while nobody is
 * signed in. It is asked again whenever who is signed in changes.
 */
export function useCommunity(): Community | null {
  const { account, community } = useCloud();
  // Who is signed in decides whether there is anyone to ask: read here so that a change of it draws the screen anew.
  useSyncExternalStore(account.subscribe, account.state, () => NOBODY);
  return community();
}

/**
 * Whether a new life can be a ranked one, played by the server: `yes` when someone is signed in
 * and there is a connection; `offline` when someone is signed in and there is none, which the
 * player is told before the life begins; `no` where there is no account at all.
 */
export function useRanking(): 'yes' | 'offline' | 'no' {
  const { account } = useCloud();
  // One answer of both, the account and the connection: a screen is drawn again when the answer changes, not each time the connection comes and
  // goes where nobody is signed in.
  const subscribe = useCallback(
    (listener: () => void) => {
      const stopAccount = account.subscribe(listener);
      const stopConnection = phoneConnection.subscribe(listener);
      return () => {
        stopAccount();
        stopConnection();
      };
    },
    [account],
  );
  return useSyncExternalStore(subscribe, () => (account.state().kind === 'offline' ? 'no' : phoneConnection.connected() ? 'yes' : 'offline'), () => 'no');
}

/**
 * Whether someone is signed in to the cloud, a guest or a member (`useRanking() !== 'no'`): for a screen that draws only that (the way to the
 * rankings), which is not drawn again as the connection comes and goes.
 */
export function useSignedIn(): boolean {
  const { account } = useCloud();
  return useSyncExternalStore(account.subscribe, () => account.state().kind !== 'offline', () => false);
}

/**
 * How the account's copy of the player's things stands, and the different life waiting there, if
 * there is one, with the two things a player can do about it.
 */
export function useAccountSaves(): { status: CloudSaving; offer: AccountLife | null; takeOffer(): Promise<boolean>; declineOffer(): Promise<void> } {
  const { saves } = useCloud();
  const status = useSyncExternalStore(saves.subscribe, saves.status, () => 'off' as const);
  return { status, ...useAccountOffer() };
}

/**
 * The different life waiting in the account, and the two things a player can do about it: `useAccountSaves` without the status, for a screen that
 * draws only the offer (the front door's), and is not drawn again as the account's copy goes and comes with every step of a life. (The phone's: the
 * front door stays mounted under the screens of a life.)
 */
export function useAccountOffer(): { offer: AccountLife | null; takeOffer(): Promise<boolean>; declineOffer(): Promise<void> } {
  const { saves } = useCloud();
  const { game } = useGameContext();
  const offer = useSyncExternalStore(saves.subscribe, saves.offer, () => null);
  return {
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

/**
 * Whether the account's copy stands as `is` says (a function made once, outside the screen): for a screen that draws only that (the account's block:
 * out of reach, or still on its way), drawn again when the answer changes, not each time the copy goes and comes with a step of a life.
 */
export function useAccountSaving(is: (status: CloudSaving) => boolean): boolean {
  const { saves } = useCloud();
  return useSyncExternalStore(saves.subscribe, () => is(saves.status()), () => false);
}

/** Counts something the player did (`events.ts`): for the screens, at the moment it succeeded. */
export const useTrack = (): Track => useCloud().track;

/** The game's notices on this phone (`online/push.ts`): whether they can be had, turned on, and the switches of them. */
export const usePush = (): Push => useCloud().push;
export type { Push, PushOn } from '../online/push';

/** False while the device is not taking saves. The screens that promise "saved" say so instead. */
/** What waits for the freshest copy of the life in progress before acting on it (Continue): see `Cloud.untilFresh`. */
export function useUntilFresh(): () => Promise<void> | null {
  return useCloud().untilFresh;
}

export function useSaving(): boolean {
  const { saving } = useGameContext();
  return !useSyncExternalStore(saving.subscribe, saving.degraded, () => false);
}
