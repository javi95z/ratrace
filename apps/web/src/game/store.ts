import { previewRound } from '@ratrace/engine';
import type { Content, GameEvent, GameView, Order, RejectReason, RoundPreview } from '@ratrace/engine';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { GameSession, Lost, Sessions } from '@/session/types';

/** Where the player is within a round. */
export type Stage = 'news' | 'cards' | 'outcome' | 'finance' | 'resolve' | 'end';

export interface RoundState {
  /** `booting` until the device has been asked for a life in progress. */
  status: 'booting' | 'none' | 'playing';
  /** Why a saved life could not be opened, when one existed. */
  lost: Lost | null;
  lifeId: string | null;
  view: GameView | null;
  /** Net worth in start-of-game cents at the start and after each round played. */
  history: number[];
  /** How many times this life has gone bankrupt. */
  bankruptcies: number;
  stage: Stage;
  /** What the card just answered did, while its result is on screen. The card to answer next is `view.hand[view.answered]`. */
  cardEvents: GameEvent[];
  /** The basket: orders for this round, in the order they will run. None of them will be refused. */
  orders: Order[];
  /** What the round will pay and charge with the basket as it is. Null outside the finance phase. */
  preview: RoundPreview | null;
  /** Why the last order was not taken. */
  refusal: RejectReason | null;
  /** The round just played: the game as it stood before, and everything that happened. */
  resolved: { before: GameView; events: GameEvent[] } | null;
  /** True while an answer or a round is being played. */
  busy: boolean;
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
  play(): Promise<void>;
  /** From the ledger to the next round, or to the end. */
  next(): void;
}

export type GameStore = StoreApi<RoundState & RoundActions>;

const blank: RoundState = {
  status: 'none',
  lost: null,
  lifeId: null,
  view: null,
  history: [],
  bankruptcies: 0,
  stage: 'news',
  cardEvents: [],
  orders: [],
  preview: null,
  refusal: null,
  resolved: null,
  busy: false,
};

/**
 * The state of the round on screen. It talks to the game through a `GameSession` only,
 * and asks the engine's own preview what each order would do: no rule of the game lives here.
 */
export function createGameStore({ sessions, content }: { sessions: Sessions; content: Content }): GameStore {
  let session: GameSession | null = null;

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

  return createStore<RoundState & RoundActions>()((set, get) => {
    const open = (opened: GameSession) => {
      session = opened;
      const view = opened.view();
      const base = { ...blank, status: 'playing' as const, lifeId: opened.lifeId, view, history: opened.history(), bankruptcies: opened.bankruptcies() };
      if (view.finished) set({ ...base, stage: 'end' });
      // A hand left half answered opens on its next card: the news were read before the first.
      else if (view.phase === 'cards') set({ ...base, stage: view.answered === 0 ? 'news' : 'cards' });
      else set({ ...base, stage: 'finance', ...settle(view, []) });
    };

    return {
      ...blank,
      status: 'booting',

      async boot() {
        const { session: found, lost } = await sessions.resume();
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
        const { view } = get();
        if (!view) return;
        if (view.phase === 'cards') set({ stage: 'cards', cardEvents: [] });
        else get().toFinance();
      },

      async pick(option) {
        const { view, busy, stage } = get();
        if (!view || !session || busy || stage !== 'cards') return;
        set({ busy: true });
        try {
          const result = await session.answerCard(option);
          set({ view: result.view, cardEvents: result.events, stage: 'outcome' });
        } finally {
          set({ busy: false });
        }
      },

      afterCard() {
        const { view, stage } = get();
        if (!view || stage !== 'outcome') return;
        if (view.phase === 'cards') set({ stage: 'cards', cardEvents: [] });
        else {
          set({ cardEvents: [] });
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
        set({ refusal: null, ...settle(view, orders.filter((_, i) => i !== index)) });
      },

      setOrder(same, order) {
        const { view, orders } = get();
        if (!view) return false;
        const base = orders.filter((existing) => !same(existing));
        if (order === null) {
          set({ refusal: null, ...settle(view, base) });
          return true;
        }
        const tried = previewRound(content, view, { orders: [...base, order] });
        const refused = tried.rejected.find((r) => r.index === base.length);
        if (refused) {
          set({ refusal: refused.reason });
          return false;
        }
        set({ refusal: null, ...settle(view, [...base, order]) });
        return true;
      },

      clearRefusal() {
        set({ refusal: null });
      },

      async play() {
        const { view, orders, busy } = get();
        if (!view || !session || busy) return;
        set({ busy: true });
        try {
          const result = await session.playRound({ orders });
          set({
            view: result.view,
            history: session.history(),
            bankruptcies: session.bankruptcies(),
            resolved: { before: view, events: result.events },
            orders: [],
            preview: null,
            refusal: null,
            stage: 'resolve',
          });
        } finally {
          set({ busy: false });
        }
      },

      next() {
        const { view } = get();
        if (!view) return;
        set({ stage: view.finished ? 'end' : 'news', cardEvents: [], resolved: null });
      },
    };
  });
}
