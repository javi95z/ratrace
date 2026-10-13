import { previewRound } from '@ratrace/engine';
import type { Content, GameEvent, GameView, Order, RejectReason, RoundPreview } from '@ratrace/engine';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { StaleSession } from '@/session/errors';
import type { GameSession, Lost, Sessions } from '@/session/types';

/** Where the player is within a round. */
export type Stage = 'news' | 'cards' | 'outcome' | 'finance' | 'resolve' | 'end';

export interface RoundState {
  /** `booting` until the device has been asked for a life in progress. */
  status: 'booting' | 'none' | 'playing';
  /** Why a saved life could not be opened, when one existed. */
  lost: Lost | null;
  lifeId: string | null;
  /** The id of the life on screen, to tell what the profile earned in it. */
  gameId: string | null;
  view: GameView | null;
  /** Net worth in start-of-game cents at the start and after each round played. */
  history: number[];
  /** How many times this life has gone bankrupt. */
  bankruptcies: number;
  /** The badges earned in this life so far, in the order they came. */
  badges: string[];
  /** Badges the step on screen earned for the first time ever. Shown with its result, and gone with it. */
  earned: string[];
  /** Lives the step on screen unlocked. */
  unlocked: string[];
  stage: Stage;
  /** What the card just answered did, while its result is on screen. The card to answer next is `view.hand[view.answered]`. */
  cardEvents: GameEvent[];
  /** The basket: orders for this round, in the order they will run. None of them will be refused. */
  orders: Order[];
  /** What the round will pay and charge with the basket as it is. Null outside the finance phase. */
  preview: RoundPreview | null;
  /** Why the last order was not taken. */
  refusal: RejectReason | null;
  /** How many other orders went with the last one removed, because they only worked thanks to it. The player is told. */
  alsoRemoved: number;
  /** The round just played: the game as it stood before, and everything that happened. */
  resolved: { before: GameView; events: GameEvent[] } | null;
  /** True while an answer or a round is being played. */
  busy: boolean;
  /** True once the life was found to have moved on in another tab, until the player has been told. The store has already opened it as it now stands. */
  moved: boolean;
  /** True when the game itself refused a step. The life cannot go on from here; the screen says so. */
  fault: boolean;
}

export interface RoundActions {
  /** Asks the device for a life in progress. */
  boot(): Promise<void>;
  start(lifeId: string): Promise<void>;
  abandon(): Promise<void>;
  /** From the news to the cards, or straight to the finances when there are none. */
  leaveNews(): void;
  /** Answers the card on screen. The game settles it at once and its result is shown. */
  pick(option: number): Promise<void>;
  /** From a card's result to the next card, or to the finances after the last. */
  afterCard(): void;
  toFinance(): void;
  /** Puts an order in the basket if the round would accept it. Returns false, and sets `refusal`, if not. */
  addOrder(order: Order): boolean;
  /** Takes an order out, together with any later order that only worked because of it. */
  removeOrder(index: number): void;
  /**
   * For choices that are switches or settings: takes out every order that `same` matches,
   * then adds `order` unless it is null. If the new order is refused the basket is left as it was.
   */
  setOrder(same: (order: Order) => boolean, order: Order | null): boolean;
  clearRefusal(): void;
  clearAlsoRemoved(): void;
  clearMoved(): void;
  play(): Promise<void>;
  /** From the ledger to the next round, or to the end. */
  next(): void;
}

export type GameStore = StoreApi<RoundState & RoundActions>;

const blank: RoundState = {
  status: 'none',
  lost: null,
  lifeId: null,
  gameId: null,
  view: null,
  history: [],
  bankruptcies: 0,
  badges: [],
  earned: [],
  unlocked: [],
  stage: 'news',
  cardEvents: [],
  orders: [],
  preview: null,
  refusal: null,
  alsoRemoved: 0,
  resolved: null,
  busy: false,
  moved: false,
  fault: false,
};

export interface GameStoreOptions {
  sessions: Sessions;
  content: Content;
  /** A clock in milliseconds, for telling a second tap from a first. */
  now?: () => number;
  /**
   * How long after the screen changes a tap is still taken for the tail of the last one, and
   * ignored. The primary button sits in the same place on every screen, and a card's first option
   * sits where the button before it was: without this a double tap answers a card for good,
   * plays a round, or skips the ledger. Zero, the default, ignores nothing.
   */
  guardMs?: number;
}

/**
 * The state of the round on screen. It talks to the game through a `GameSession` only,
 * and asks the engine's own preview what each order would do: no rule of the game lives here.
 */
export function createGameStore({ sessions, content, now = () => 0, guardMs = 0 }: GameStoreOptions): GameStore {
  let session: GameSession | null = null;
  /** When the stage on screen last changed. */
  let changedAt = Number.NEGATIVE_INFINITY;
  /** False while a tap may still be the tail of the one that brought this screen. */
  const settled = () => now() - changedAt >= guardMs;

  /** The basket with every order the round would refuse taken out, and the preview of what is left. */
  const settle = (view: GameView, orders: Order[]): { orders: Order[]; preview: RoundPreview } => {
    let kept = orders;
    for (;;) {
      const preview = previewRound(content, view, { orders: kept });
      if (preview.rejected.length === 0) return { orders: kept, preview };
      const refused = new Set(preview.rejected.map((r) => r.index));
      kept = kept.filter((_, i) => !refused.has(i));
    }
  };

  const store = createStore<RoundState & RoundActions>()((set, get) => {
    /** What every step does when the session refuses it: open the life as it now stands, or stop. */
    const refused = async (error: unknown) => {
      if (error instanceof StaleSession) {
        // The session is no longer the life's: let it go, and open whatever the device now holds.
        session = null;
        await get().boot();
        set({ moved: true });
      } else {
        console.error('the game refused a step:', error);
        set({ fault: true });
      }
    };

    const open = (opened: GameSession) => {
      session = opened;
      const view = opened.view();
      const base = {
        ...blank,
        status: 'playing' as const,
        lifeId: opened.lifeId,
        gameId: opened.gameId,
        view,
        history: opened.history(),
        bankruptcies: opened.bankruptcies(),
        badges: opened.badges(),
      };
      if (view.finished) set({ ...base, stage: 'end' });
      // A hand left half answered opens on its next card: the news were read before the first.
      else if (view.phase === 'cards') set({ ...base, stage: view.answered === 0 ? 'news' : 'cards' });
      else set({ ...base, stage: 'finance', ...settle(view, []) });
    };

    return {
      ...blank,
      status: 'booting',

      async boot() {
        const held = session;
        const { session: found, lost } = await sessions.resume();
        // A life started while the device was being asked is the one to play: what the device then answers is old news.
        if (session !== held) return;
        if (found) open(found);
        else {
          session = null;
          set({ ...blank, lost });
        }
      },

      async start(lifeId) {
        open(await sessions.start(lifeId));
      },

      async abandon() {
        await sessions.abandon();
        session = null;
        set({ ...blank });
      },

      leaveNews() {
        const { view, stage } = get();
        if (!view || stage !== 'news' || !settled()) return;
        if (view.phase === 'cards') set({ stage: 'cards', cardEvents: [] });
        else get().toFinance();
      },

      async pick(option) {
        const { view, busy, stage } = get();
        if (!view || !session || busy || stage !== 'cards' || !settled()) return;
        set({ busy: true });
        try {
          const result = await session.answerCard(option);
          set({ view: result.view, cardEvents: result.events, badges: session.badges(), earned: result.earned, unlocked: result.unlocked, stage: 'outcome' });
        } catch (error) {
          await refused(error);
        } finally {
          set({ busy: false });
        }
      },

      afterCard() {
        const { view, stage } = get();
        if (!view || stage !== 'outcome' || !settled()) return;
        if (view.phase === 'cards') set({ stage: 'cards', cardEvents: [], earned: [], unlocked: [] });
        else {
          set({ cardEvents: [], earned: [], unlocked: [] });
          get().toFinance();
        }
      },

      toFinance() {
        const { view } = get();
        if (!view || view.finished || view.phase !== 'finance') return;
        set({ stage: 'finance', refusal: null, ...settle(view, []) });
      },

      addOrder(order) {
        return get().setOrder(() => false, order);
      },

      removeOrder(index) {
        const { view, orders } = get();
        if (!view) return;
        const without = orders.filter((_, i) => i !== index);
        const settled = settle(view, without);
        set({ refusal: null, alsoRemoved: without.length - settled.orders.length, ...settled });
      },

      setOrder(same, order) {
        const { view, orders } = get();
        if (!view) return false;
        const base = orders.filter((existing) => !same(existing));
        if (order === null) {
          set({ refusal: null, alsoRemoved: 0, ...settle(view, base) });
          return true;
        }
        const tried = previewRound(content, view, { orders: [...base, order] });
        const refused = tried.rejected.find((r) => r.index === base.length);
        if (refused) {
          set({ refusal: refused.reason });
          return false;
        }
        set({ refusal: null, alsoRemoved: 0, ...settle(view, [...base, order]) });
        return true;
      },

      clearRefusal() {
        set({ refusal: null });
      },

      clearAlsoRemoved() {
        set({ alsoRemoved: 0 });
      },

      clearMoved() {
        set({ moved: false });
      },

      async play() {
        const { view, orders, busy, stage } = get();
        if (!view || !session || busy || stage !== 'finance' || !settled()) return;
        set({ busy: true });
        try {
          const result = await session.playRound({ orders });
          set({
            view: result.view,
            history: session.history(),
            bankruptcies: session.bankruptcies(),
            badges: session.badges(),
            earned: result.earned,
            unlocked: result.unlocked,
            resolved: { before: view, events: result.events },
            orders: [],
            preview: null,
            refusal: null,
            alsoRemoved: 0,
            stage: 'resolve',
          });
        } catch (error) {
          await refused(error);
        } finally {
          set({ busy: false });
        }
      },

      next() {
        const { view, stage } = get();
        if (!view || stage !== 'resolve' || !settled()) return;
        set({ stage: view.finished ? 'end' : 'news', cardEvents: [], resolved: null, earned: [], unlocked: [] });
      },
    };
  });

  // Every change of screen starts the short wait in which a tap is taken for the tail of the last one.
  store.subscribe((state, before) => {
    if (state.stage !== before.stage) changedAt = now();
  });
  return store;
}
