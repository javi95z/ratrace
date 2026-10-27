import { roomBadges, ROOM_BOTS } from '@ratrace/content';
import type { LifeDef } from '@ratrace/content';
import type { Content } from '@ratrace/engine';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { Unreachable } from '../session/errors';
import { tellProfile } from '../session/profile';
import { GRACE_MS, RoomRefused, RoomSessions } from '../session/room';
import type { PublicPace, RoomGameOver, RoomsApi, RoomsLink, RoomState, RoundSeconds } from '../session/room';
import type { PlayerStore } from '../session/types';
import type { MilestoneKeep } from './lifeMilestones';
import { createGameStore } from './store';
import type { GameStore } from './store';

// What the screens of a room need to know of one, without reaching past the round stores into the sessions.
export { LOAN_MAX, LOAN_MIN, LOAN_RATES_BP, LOAN_ROUNDS, MAX_MEMBERS, MIN_MEMBERS, ROUND_SECONDS, SHOUT_EVERY_MS, SHOUT_FACES, SHOUT_PHRASES, TABLE } from '../session/room';
export type { PublicPace, RoomGameOver, RoomLoan, RoomMember, RoomState, RoomStanding, RoundSeconds } from '../session/room';

/**
 * What someone in a game is called: a rat of the server by its kind, a player by their name, or by
 * the four characters of their id when they chose none. `t` is the translator of the rooms' words.
 */
export function memberName(
  t: (key: string, values?: Record<string, string | number>) => string,
  member: { name: string | null; bot?: string | null; userId?: string | null; tag?: string },
): string {
  if (member.bot) return ROOM_BOTS.includes(member.bot) ? t(`bots.${member.bot}`) : t('bot');
  return member.name ?? t('nameless', { tag: member.tag ?? (member.userId ?? '').slice(0, 4).toUpperCase() });
}

/** How often a page in a room asks how it stands, besides whenever it hears that it changed. */
export const LOOK_EVERY_MS = 15_000;
/** How long before the deadline a page plays the round as it stands for a player who has not. */
export const TIME_UP_BEFORE_MS = 1_000;
/** How long after the deadline and its grace a page asks again, so that the server has turned the round by then. */
const AFTER_DUE_MS = 500;

export interface RoomStoreState {
  /**
   * `booting` until the server has been asked; `unavailable` with nobody signed in to play with;
   * `away` when the server could not be asked just now; `none` in no room; `in` in one.
   */
  status: 'booting' | 'unavailable' | 'away' | 'none' | 'in';
  room: RoomState | null;
  /** The server's clock less this page's, in milliseconds. */
  skew: number;
  /** The player's life in the room, with its own round store, once the room has started. */
  game: GameStore | null;
  /** True while opening, joining, starting or leaving. */
  busy: boolean;
  /** Why the last opening, joining or starting did not happen: the server's word, or `unreachable`. */
  refusal: string | null;
  /** Rounds the clock played for the player while this page was not looking, until they have been told. */
  missed: number;
  /** The room the player was in was closed under them, by its host or for being left alone a day, until they have been told. */
  closed: boolean;
  /** True when the room plays other rules than this page: its life cannot be played here, and the page says to reload. */
  otherRules: boolean;
  /** True for a game begun on older rules than this page's: it is played all the same, and the player is told the page's forecasts may be a little off. */
  olderRules: boolean;
  /** The multiplayer badges the room that is over has just earned the player, for the end to show. */
  earned: string[];
  /** What has been shouted, by the others and by the player, that the page has still to show, the oldest first. */
  heard: Array<{ key: string; userId: string; n: number }>;
  /** How many public games are waiting for players now, at each pace, as last asked; null before it was. */
  lobbies: { live: number; slow: number } | null;
  /** The player was taken out of a public game for letting the clock play their rounds, until they have been told. */
  dropped: boolean;
}

export interface RoomActions {
  /** Asks the server for the room the player is in. */
  boot(): Promise<void>;
  open(lifeId: string, seconds: RoundSeconds): Promise<boolean>;
  /** Takes a seat in a public game at a pace (played together unless asked otherwise): one waiting, or a new one. */
  quick(pace?: PublicPace): Promise<boolean>;
  join(code: string): Promise<boolean>;
  start(): Promise<void>;
  /** Leaves the room: out of the lobby, giving up the life in play, or done with a room that is over. */
  leave(): Promise<void>;
  /** Opens the rematch of the room that is over, with a life, or joins it if someone opened it first. */
  rematch(lifeId: string): Promise<boolean>;
  /** The games over the player was in, the latest first. Null when they cannot be asked for just now. */
  history(): Promise<RoomGameOver[] | null>;
  /** Shouts to the others. `soon` if the player shouted a moment ago; `failed` if it did not get through. */
  shout(n: number): Promise<'ok' | 'soon' | 'failed'>;
  /** Offers another player a loan, to lend or to borrow. `failed` if it did not get through, or either of them is gone. */
  offerLoan(loan: { to: string; lend: boolean; amount: number; rateBp: number; rounds: number }): Promise<'ok' | 'failed'>;
  /** Says yes or no to an offer, or takes back the player's own with a no. `failed` if it is no longer open. */
  answerLoan(loanId: string, yes: boolean): Promise<'ok' | 'failed'>;
  /** Takes a shout off once it has been shown. */
  dismissHeard(key: string): void;
  /** Asks how many public games are waiting for players now; not again within a little while. */
  lookForLobbies(): Promise<void>;
  /** Reports another player's name in a public game. `failed` if it did not get through. */
  report(userId: string): Promise<'ok' | 'cleared' | 'nameless' | 'failed'>;
  /** Follows another player of the room. `full` at the most one may follow; `failed` if it did not get through. */
  follow(userId: string): Promise<'ok' | 'full' | 'failed'>;
  /** Asks a friend into the room while it waits for its players. `here` if they are in it; `failed` if it did not get through (not a friend, no seat, no lobby). */
  invite(userId: string): Promise<'sent' | 'here' | 'failed'>;
  clearDropped(): void;
  /** Asks the server how the room stands now. */
  refresh(): Promise<void>;
  clearRefusal(): void;
  clearMissed(): void;
  clearClosed(): void;
}

export type RoomStore = StoreApi<RoomStoreState & RoomActions>;

export interface RoomStoreOptions {
  /** The rooms while someone is signed in, and null otherwise. */
  link(): RoomsLink | null;
  store: PlayerStore;
  content: Content;
  lives: ReadonlyArray<LifeDef>;
  versions: { engine: string; content: string };
  /** The page's clock, in milliseconds. */
  now?(): number;
  /** The page's clock for telling taps apart, as the round store takes it. */
  tapClock?(): number;
  tapGuardMs?: number;
  /** Where the milestones of lives are kept, the room's life among them (the round store's own). Left out, nowhere beyond the page. */
  milestones?: MilestoneKeep | null;
  /** Runs `run` in `ms`; returns how to stop it. */
  schedule?(run: () => void, ms: number): () => void;
  /** What the page says of itself: shown again, back online. Each returns how to stop listening. */
  page?: { onShown(listener: () => void): () => void; onOnline(listener: () => void): () => void };
  onSaveError?(error: unknown): void;
}

/** A version as numbers: "0.38.0" → [0, 38, 0]. */
const parts = (version: string) => version.split('.').map((n) => Number(n) || 0);
/** True if one engine and content are newer than another's, the engine first. */
export function newer(a: { engine: string; content: string }, b: { engine: string; content: string }): boolean {
  for (const key of ['engine', 'content'] as const) {
    const x = parts(a[key]);
    const y = parts(b[key]);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

const blank: RoomStoreState = { status: 'booting', room: null, skew: 0, game: null, busy: false, refusal: null, missed: 0, closed: false, otherRules: false, olderRules: false, earned: [], heard: [], lobbies: null, dropped: false };

/** How long the count of public games waiting is good for: asked again only after that. */
const LOBBIES_EVERY_MS = 20_000;

/** The most shouts waiting to be shown at once: past that, the oldest go unshown. */
const HEARD_MAX = 3;

/** How a room that is over ended for the player, for its badges. */
export function resultOf(room: RoomState): { won: boolean; players: number; rematch: boolean } {
  const me = room.members.find((member) => member.me);
  // Everyone whose life began: they have stood somewhere since the first round turned.
  const played = room.members.filter((member) => member.standing !== null);
  const stayed = played.filter((member) => !member.left);
  const mine = me && !me.left ? me.standing : null;
  const won = mine !== null && stayed.every((member) => (member.standing?.score ?? 0) <= mine.score);
  // The rats are there to be beaten, but a game is counted by the people in it: a win over rats alone earns nothing.
  return { won, players: played.filter((member) => member.bot === null).length, rematch: room.rematchOf };
}

/**
 * The room the player is in, as this page follows it: it hears of every change, and asks the server
 * how the room stands then, every fifteen seconds, when the page is shown again or back online, and
 * once the round is due. It counts down to the deadline on the server's clock and, a second before
 * it, plays the round as it stands for a player who has not. The player's life in the room has its
 * round store of its own, so the device's own life in progress is never touched.
 */
export function createRoomStore(options: RoomStoreOptions): RoomStore {
  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? ((run: () => void, ms: number) => {
    const timer = setTimeout(run, Math.max(0, ms));
    return () => clearTimeout(timer);
  });
  const api = (): RoomsApi | null => options.link()?.api ?? null;

  let watching: { roomId: string; stop: () => void } | null = null;
  let clocks: Array<() => void> = [];
  let waiters: Array<{ round: number; resolve: () => void }> = [];
  let asking: Promise<void> | null = null;
  let askAgain = false;
  /** The round whose time-up this page has already played, so that it is played once. */
  let timedOut: string | null = null;
  /** The room the player left from this page: whatever is heard of it afterwards is not the player's any more. */
  let left: string | null = null;
  /** The rooms over whose badges this page has judged, so that each is judged once. */
  const judged = new Set<string>();
  /** The last shout of each member this page has heard, by when it was shouted. */
  const shoutsHeard = new Map<string, number>();
  /** The last round, by room, in which this page saw the player ready: a round they played, not one the clock played for them. */
  const readyIn = new Map<string, number>();
  /** When this page last asked how many public games are waiting. */
  let lobbiesAsked = Number.NEGATIVE_INFINITY;

  const store = createStore<RoomStoreState & RoomActions>()((set, get) => {
    const stopClocks = () => {
      for (const stop of clocks) stop();
      clocks = [];
    };
    const stopWatching = () => {
      watching?.stop();
      watching = null;
    };
    const release = (room: RoomState | null) => {
      const left: typeof waiters = [];
      for (const waiter of waiters) {
        if (room === null || room.status !== 'playing' || room.round > waiter.round) waiter.resolve();
        else left.push(waiter);
      }
      waiters = left;
    };

    /** The round store of the player's life in the room, opened as the server shows it. */
    const lifeOf = (room: RoomState): GameStore => {
      const sessions = new RoomSessions(room.id, api, options.store, options.content, options.lives, {
        now,
        onSaveError: options.onSaveError,
        onRoom: (seen) => {
          if (get().room?.id === seen.id) adopt(seen);
        },
        turned: (round) =>
          new Promise<void>((resolve) => {
            const current = get().room;
            if (current === null || current.id !== room.id || current.status !== 'playing' || current.round > round) resolve();
            else waiters.push({ round, resolve });
          }),
      });
      const game = createGameStore({ sessions, content: options.content, now: options.tapClock, guardMs: options.tapGuardMs ?? 0, ...(options.milestones !== undefined ? { milestones: options.milestones } : {}) });
      void game.getState().boot().catch((error: unknown) => console.error('the life in the room could not be opened:', error));
      return game;
    };

    /**
     * Sets the clocks of the room: in a public lobby, a look once it is to start, which starts it; in
     * play, the time-up a second before the deadline, and a look once it is due.
     */
    const setClocks = (room: RoomState, skew: number) => {
      stopClocks();
      if (room.status === 'open' && room.startsAt !== null) {
        clocks.push(schedule(() => void get().refresh(), room.startsAt - skew + AFTER_DUE_MS - now()));
        return;
      }
      if (room.status !== 'playing' || room.deadline === null) return;
      const deadline = room.deadline - skew;
      const key = `${room.id}/${room.round}`;
      clocks.push(
        schedule(() => {
          const { room: current, game } = get();
          if (timedOut === key || current?.id !== room.id || current.round !== room.round || current.members.find((m) => m.me)?.ready) return;
          const life = game?.getState();
          if (!life || life.status !== 'playing' || life.view?.round !== room.round) return;
          timedOut = key;
          void life.timeUp();
        }, deadline - TIME_UP_BEFORE_MS - now()),
      );
      clocks.push(schedule(() => void get().refresh(), deadline + GRACE_MS + AFTER_DUE_MS - now()));
    };

    const watch = (room: RoomState) => {
      if (watching?.roomId === room.id) return;
      stopWatching();
      const link = options.link();
      if (link === null) return;
      watching = { roomId: room.id, stop: link.watch(room.id, () => void get().refresh()) };
    };

    /** Takes the room as the server now shows it. */
    function adopt(room: RoomState | null) {
      // A room the player has left is not theirs, however late an answer about it comes. One closed under them says so.
      if (room !== null && (room.id === left || room.members.find((m) => m.me)?.left)) {
        // Out of a room they did not leave from this page: a public game takes out whoever let the clock play their rounds; any other was closed under them.
        const dropped = room.id !== left && room.public;
        const closedUnder = room.id !== left && !room.public && room.status === 'closed';
        adopt(null);
        if (dropped) set({ dropped: true });
        if (closedUnder) set({ closed: true });
        return;
      }
      if (room === null) {
        stopClocks();
        stopWatching();
        release(null);
        // What the player has still to be told stays until they have been, and what is known of the public games.
        set({ ...blank, status: 'none', closed: get().closed, dropped: get().dropped, lobbies: get().lobbies });
        return;
      }
      const skew = room.now - now();
      const was = get().room;
      // A page that hears of a room through two answers at once keeps the later one.
      if (was !== null && was.id === room.id && was.now > room.now) return;
      let { game, missed } = get();
      // Another room, another account's most often: nothing of the last one's life is kept.
      if (was !== null && was.id !== room.id) {
        game = null;
        missed = 0;
      }
      if (room.members.find((m) => m.me)?.ready) readyIn.set(room.id, room.round);
      // Every round beyond the one the player played and waited for was played by the clock.
      for (const waiter of waiters) if (room.round > waiter.round + 1) missed += room.round - waiter.round - 1;
      // A game on newer rules than this page can only be played once the page is reloaded; one on older rules is played
      // here all the same: the server plays it by its own rules, and the page only shows it.
      const otherRules = newer({ engine: room.engineVersion, content: room.contentVersion }, options.versions);
      const olderRules = !otherRules && (room.engineVersion !== options.versions.engine || room.contentVersion !== options.versions.content);
      const inPlay = room.status === 'playing' || room.status === 'finished';
      if (game === null && inPlay && !otherRules) game = lifeOf(room);
      else if (game !== null && inPlay && game.getState().status === 'none') {
        // The life could not be opened when the room began, or was lost since: it is asked for again on every look.
        void game.getState().boot().catch((error: unknown) => console.error('the life in the room could not be opened:', error));
      } else if (game !== null && was?.id === room.id && room.round > was.round) {
        const life = game.getState();
        // The room turned while this page was not waiting for it. One round is shown as a played round is; more, and the life is
        // opened again as it stands. Either way the player is told of every round the clock played for them.
        if (!life.busy && life.status === 'playing' && life.view !== null && life.view.round < room.round && !waiters.some((w) => w.round === life.view?.round)) {
          const behind = room.round - life.view.round;
          missed += behind - (readyIn.get(room.id) === life.view.round ? 1 : 0);
          const again = behind === 1 ? life.catchUp() : life.boot();
          void again.catch((error: unknown) => console.error('the life in the room could not be brought up to date:', error));
        }
      }
      // What was shouted since this page last heard, the player's own too, so they see what the others see: each shout once.
      let heard = was?.id === room.id ? get().heard : [];
      for (const member of room.members) {
        if (member.shout === null) continue;
        const key = `${room.id}/${member.userId}`;
        if ((shoutsHeard.get(key) ?? 0) >= member.shout.at) continue;
        shoutsHeard.set(key, member.shout.at);
        heard = [...heard, { key: `${key}/${member.shout.at}`, userId: member.userId, n: member.shout.n }].slice(-HEARD_MAX);
      }
      set({ status: 'in', room, skew, game, missed, otherRules, olderRules, earned: was?.id === room.id ? get().earned : [], heard });
      release(room);
      if (room.status === 'finished' && !judged.has(room.id)) {
        judged.add(room.id);
        void judge(room);
      }
      // A room that is over is still listened to: its rematch is heard of the moment someone opens it.
      if (room.status === 'closed') {
        stopClocks();
        stopWatching();
      } else {
        watch(room);
        setClocks(room, skew);
      }
    }

    /** Tells the profile the badges of a room that is over, and keeps those that are new for the end to show. */
    async function judge(room: RoomState) {
      const earned = roomBadges(resultOf(room));
      if (earned.length === 0) return;
      try {
        const told = await tellProfile(options.store, options.content, options.lives, { gameId: room.id, at: now(), earned, collection: [], over: false });
        if (get().room?.id === room.id && told.earned.length > 0) set({ earned: told.earned });
      } catch (error) {
        options.onSaveError?.(error);
      }
    }

    /** Runs one of the player's own requests: busy meanwhile, and the server's no kept to be shown. */
    const request = async (ask: (rooms: RoomsApi) => Promise<RoomState | null>): Promise<boolean> => {
      const rooms = api();
      if (rooms === null) {
        set({ refusal: 'unreachable' });
        return false;
      }
      set({ busy: true, refusal: null, closed: false });
      try {
        adopt(await ask(rooms));
        return true;
      } catch (error) {
        if (error instanceof RoomRefused) {
          set({ refusal: error.word });
          // Already in a room: that one is shown.
          if (error.word === 'in-a-room') await get().refresh();
        } else if (error instanceof Unreachable) set({ refusal: 'unreachable' });
        else throw error;
        return false;
      } finally {
        set({ busy: false });
      }
    };

    return {
      ...blank,

      async boot() {
        // Asked again, most often because someone else is signed in now: nothing of the last answer is kept.
        stopClocks();
        stopWatching();
        release(null);
        left = null;
        readyIn.clear();
        const rooms = api();
        if (rooms === null) {
          set({ ...blank, status: 'unavailable' });
          return;
        }
        try {
          adopt(await rooms.mine());
        } catch (error) {
          if (!(error instanceof Unreachable)) throw error;
          if (get().room === null) set({ status: 'away' });
        }
      },

      open: (lifeId, seconds) =>
        request(async (rooms) => {
          const room = await rooms.open(lifeId, seconds, options.versions);
          left = null;
          return room;
        }),

      quick: (pace = 'live') =>
        request(async (rooms) => {
          const room = await rooms.quick(options.versions, pace);
          left = null;
          return room;
        }),

      // A lobby left by mistake can be joined again: the room the player left is theirs again once they are back in it.
      join: (code) =>
        request(async (rooms) => {
          const room = await rooms.join(code, options.versions);
          left = null;
          return room;
        }),

      async start() {
        const room = get().room;
        if (room === null) return;
        await request((rooms) => rooms.start(room.id));
      },

      async leave() {
        const room = get().room;
        if (room === null) return;
        // Left only once the server says so: a leaving that did not get through keeps the room, and says why.
        await request(async (rooms) => {
          await rooms.leave(room.id);
          left = room.id;
          return null;
        });
      },

      async rematch(lifeId) {
        const room = get().room;
        if (room === null) return false;
        return request(async (rooms) => {
          const next = await rooms.rematch(room.id, lifeId, options.versions);
          left = null;
          return next;
        });
      },

      async shout(n) {
        const room = get().room;
        const rooms = api();
        if (room === null || rooms === null) return 'failed';
        try {
          const now = await rooms.shout(room.id, n);
          if (now === 'soon') return 'soon';
          if (now === 'gone') return 'failed';
          if (get().room?.id === now.id) adopt(now);
          return 'ok';
        } catch (error) {
          if (error instanceof Unreachable || error instanceof RoomRefused) return 'failed';
          throw error;
        }
      },

      async offerLoan(loan) {
        const room = get().room;
        const rooms = api();
        if (room === null || rooms === null) return 'failed';
        try {
          const now = await rooms.offerLoan(room.id, loan);
          if (now === 'gone') return 'failed';
          if (get().room?.id === now.id) adopt(now);
          return 'ok';
        } catch (error) {
          if (error instanceof Unreachable || error instanceof RoomRefused) return 'failed';
          throw error;
        }
      },

      async answerLoan(loanId, yes) {
        const room = get().room;
        const rooms = api();
        if (room === null || rooms === null) return 'failed';
        try {
          const now = await rooms.answerLoan(room.id, loanId, yes);
          if (now === 'gone') {
            void get().refresh();
            return 'failed';
          }
          if (get().room?.id === now.id) adopt(now);
          return 'ok';
        } catch (error) {
          if (error instanceof Unreachable || error instanceof RoomRefused) return 'failed';
          throw error;
        }
      },

      dismissHeard(key) {
        set({ heard: get().heard.filter((shout) => shout.key !== key) });
      },

      async lookForLobbies() {
        const rooms = api();
        if (rooms === null || now() - lobbiesAsked < LOBBIES_EVERY_MS) return;
        lobbiesAsked = now();
        try {
          const { live, slow, dropped } = await rooms.lobbies(options.versions);
          // Taken out of their last game: said on the door, until they take a seat again.
          set({ lobbies: { live, slow }, dropped: dropped || get().dropped });
        } catch (error) {
          // Not known just now: nothing is said of them, and the next look asks again.
          if (!(error instanceof Unreachable)) throw error;
          lobbiesAsked = Number.NEGATIVE_INFINITY;
        }
      },

      async report(userId) {
        const room = get().room;
        const rooms = api();
        if (room === null || rooms === null) return 'failed';
        try {
          const said = await rooms.report(room.id, userId);
          if (said === 'gone') return 'failed';
          if (get().room?.id === said.room.id) adopt(said.room);
          return said.report;
        } catch (error) {
          if (error instanceof Unreachable || error instanceof RoomRefused) return 'failed';
          throw error;
        }
      },

      async invite(userId) {
        const room = get().room;
        const rooms = api();
        if (room === null || rooms === null) return 'failed';
        try {
          const said = await rooms.invite(room.id, userId);
          if (typeof said === 'string') return 'failed';
          if (get().room?.id === said.room.id) adopt(said.room);
          return said.invite;
        } catch (error) {
          if (error instanceof Unreachable || error instanceof RoomRefused) return 'failed';
          throw error;
        }
      },

      async follow(userId) {
        const room = get().room;
        const rooms = api();
        if (room === null || rooms === null) return 'failed';
        try {
          const now = await rooms.follow(room.id, userId);
          if (now === 'full') return 'full';
          if (now === 'gone') return 'failed';
          if (get().room?.id === now.id) adopt(now);
          return 'ok';
        } catch (error) {
          if (error instanceof Unreachable || error instanceof RoomRefused) return 'failed';
          throw error;
        }
      },

      clearDropped() {
        set({ dropped: false });
      },

      async history() {
        const rooms = api();
        if (rooms === null) return null;
        try {
          return await rooms.history();
        } catch (error) {
          if (error instanceof Unreachable) return null;
          throw error;
        }
      },

      async refresh() {
        // One question at a time: a change heard while asking is asked about once more, after.
        if (asking !== null) {
          askAgain = true;
          return asking;
        }
        asking = (async () => {
          do {
            askAgain = false;
            const rooms = api();
            const room = get().room;
            if (rooms === null) return;
            try {
              if (room === null) {
                const found = await rooms.mine();
                // Meanwhile the player's own request may have put them in a room: that answer is newer.
                if (get().room === null) adopt(found);
              } else {
                const now = await rooms.state(room.id);
                // A look at a room the page has moved on from, to a rematch most often, is about a room no longer shown.
                if (get().room?.id === room.id) adopt(now === 'gone' ? null : now);
              }
            } catch (error) {
              if (!(error instanceof Unreachable)) throw error;
            }
          } while (askAgain);
        })().finally(() => {
          asking = null;
        });
        return asking;
      },

      clearRefusal() {
        set({ refusal: null });
      },

      clearMissed() {
        set({ missed: 0 });
      },

      clearClosed() {
        set({ closed: false });
      },
    };
  });

  // Every fifteen seconds, and whenever the page comes back, the room is looked at again.
  const look = () => {
    const { status, room } = store.getState();
    // Away, the server is asked again for the room; in one, how it stands: one that is over may have its rematch.
    if (status === 'away' || (status === 'in' && room !== null && room.status !== 'closed')) void store.getState().refresh();
  };
  const loop = () => {
    look();
    schedule(loop, LOOK_EVERY_MS);
  };
  schedule(loop, LOOK_EVERY_MS);
  options.page?.onShown(look);
  options.page?.onOnline(look);
  return store;
}
