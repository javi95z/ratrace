import type { LifeDef } from '@ratrace/content';
import type { Content } from '@ratrace/engine';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { Unreachable } from '@/session/errors';
import { GRACE_MS, RoomRefused, RoomSessions } from '@/session/room';
import type { RoomsApi, RoomsLink, RoomState, RoundSeconds } from '@/session/room';
import type { PlayerStore } from '@/session/types';
import { createGameStore } from './store';
import type { GameStore } from './store';

// What the screens of a room need to know of one, without reaching past the round stores into the sessions.
export { MAX_MEMBERS, MIN_MEMBERS, ROUND_SECONDS } from '@/session/room';
export type { RoomMember, RoomState, RoomStanding, RoundSeconds } from '@/session/room';

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
}

export interface RoomActions {
  /** Asks the server for the room the player is in. */
  boot(): Promise<void>;
  open(lifeId: string, seconds: RoundSeconds): Promise<boolean>;
  join(code: string): Promise<boolean>;
  start(): Promise<void>;
  /** Leaves the room: out of the lobby, giving up the life in play, or done with a room that is over. */
  leave(): Promise<void>;
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
  /** Runs `run` in `ms`; returns how to stop it. */
  schedule?(run: () => void, ms: number): () => void;
  /** What the page says of itself: shown again, back online. Each returns how to stop listening. */
  page?: { onShown(listener: () => void): () => void; onOnline(listener: () => void): () => void };
  onSaveError?(error: unknown): void;
}

const blank: RoomStoreState = { status: 'booting', room: null, skew: 0, game: null, busy: false, refusal: null, missed: 0, closed: false, otherRules: false };

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
  /** The last round, by room, in which this page saw the player ready: a round they played, not one the clock played for them. */
  const readyIn = new Map<string, number>();

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
      const game = createGameStore({ sessions, content: options.content, now: options.tapClock, guardMs: options.tapGuardMs ?? 0 });
      void game.getState().boot().catch((error: unknown) => console.error('the life in the room could not be opened:', error));
      return game;
    };

    /** Sets the clocks of the round in play: the time-up a second before the deadline, and a look once it is due. */
    const setClocks = (room: RoomState, skew: number) => {
      stopClocks();
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
        const closedUnder = room.id !== left && room.status === 'closed';
        adopt(null);
        if (closedUnder) set({ closed: true });
        return;
      }
      if (room === null) {
        stopClocks();
        stopWatching();
        release(null);
        // What the player has still to be told stays until they have been.
        set({ ...blank, status: 'none', closed: get().closed });
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
      const otherRules = room.engineVersion !== options.versions.engine || room.contentVersion !== options.versions.content;
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
      set({ status: 'in', room, skew, game, missed, otherRules });
      release(room);
      if (room.status === 'open' || room.status === 'playing') {
        watch(room);
        setClocks(room, skew);
      } else {
        stopClocks();
        stopWatching();
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
              if (room === null) adopt(await rooms.mine());
              else {
                const now = await rooms.state(room.id);
                adopt(now === 'gone' ? null : now);
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
    // Away, the server is asked again for the room; in one that is not over, how it stands.
    if (status === 'away' || (status === 'in' && room !== null && (room.status === 'open' || room.status === 'playing'))) void store.getState().refresh();
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
