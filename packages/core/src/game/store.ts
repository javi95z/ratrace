import { ENGINE_VERSION, previewCard, previewRound } from '@ratrace/engine';
import { CONTENT_VERSION } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import type { Content, GameEvent, GameView, OptionPreview, Order, RejectReason, RoundPreview, WorldState } from '@ratrace/engine';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { RankedInProgress, StaleSession, Unreachable } from '../session/errors';
import type { RankedLifeInTheWay } from '../session/errors';
import type { GameSession, Lost, Sessions, StepResult } from '../session/types';
import { knownOrders } from './rules';
import { memoryBasket } from './basket';
import type { BasketKeep } from './basket';

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
  /** What has happened in this life that is worth telling, in the order it came. */
  story: Milestone[];
  /** Badges the step on screen earned for the first time ever. Shown with its result, and gone with it. */
  earned: string[];
  /** Lives the step on screen unlocked. */
  unlocked: string[];
  stage: Stage;
  /** What the card just answered did, while its result is on screen. The card to answer next is `view.hand[view.answered]`. */
  cardEvents: GameEvent[];
  /**
   * The card just answered as it stood when it was answered: what each of its options offered, and
   * the world they were offered in. Kept with the result, to say how likely what came up was.
   */
  offered: { cardId: string; options: OptionPreview[]; world: WorldState; partnered: boolean } | null;
  /** The basket: orders for this round, in the order they will run. None of them will be refused. */
  orders: Order[];
  /** What the round will pay and charge with the basket as it is. Null outside the finance phase. */
  preview: RoundPreview | null;
  /** The basket as it was before an order was taken out of it, while that can still be undone; null otherwise. */
  undo: Order[] | null;
  /** Why the last order was not taken. */
  refusal: RejectReason | null;
  /** How many other orders went with the last one removed, because they only worked thanks to it. The player is told. */
  alsoRemoved: number;
  /** The round just played: the game as it stood before, and everything that happened. */
  resolved: { before: GameView; events: GameEvent[] } | null;
  /** True while an answer or a round is being played. */
  busy: boolean;
  /** The option of the card being answered, from the tap until its result is on screen. */
  picked: number | null;
  /**
   * True while the result of a card a server plays is on its way: the card is already shown as
   * answered, with the choice made, and what followed comes in when the server says.
   */
  pending: boolean;
  /** True once the life was found to have moved on in another tab or on another device, until the player has been told. The store has already opened it as it now stands. */
  moved: boolean;
  /** True when the game itself refused a step. The life cannot go on from here; the screen says so. */
  fault: boolean;
  /** True for a life the server plays: its result is set beside everyone else's. */
  ranked: boolean;
  /** The engine version of the rules the life is played under: this page's own, or older ones a life begun under them keeps. */
  rules: string;
  /** The week whose challenge the life is: the attempt, when ranked, or a practice. Null for any other life. */
  challenge: string | null;
  /** True once a life asked for as ranked began as a casual one, because a ranked one could not be had just then, until the player has been told. */
  fellBack: boolean;
  /** True when the last step of a ranked life did not get through. It can be taken again. */
  unreachable: boolean;
  /**
   * The ranked life the player has in progress on another device, when a new one was asked for and
   * could not begin because of it. `here` says whether this page plays its rules, and so could go
   * on with it. Null once the player has said what to do.
   */
  elsewhere: (RankedLifeInTheWay & { here: boolean }) | null;
}

export interface RoundActions {
  /** Asks the device for a life in progress. */
  boot(): Promise<void>;
  /** Starts a new life. `ranked` asks for one the server plays; `fellBack` says if it could not be had. */
  start(lifeId: string, options?: { ranked?: boolean; replace?: string; challenge?: string }): Promise<boolean>;
  /**
   * Takes up the ranked life in progress elsewhere, in place of starting a new one. `taken`: it is
   * the life on this device now. `away`: the server did not answer, and the question stands.
   * `gone`: it is no longer there to take, or this page cannot play it; nothing is asked any more.
   */
  continueElsewhere(): Promise<'taken' | 'away' | 'gone'>;
  /** The player leaves things as they are. */
  clearElsewhere(): void;
  /**
   * The life on the device was changed from outside this page, by the account bringing another
   * device's copy: opens it as it now stands, and says so if a life was on screen.
   */
  reopen(): Promise<void>;
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
  /** Puts back the basket as it was before the last order was taken out of it. */
  undoRemove(): void;
  /**
   * For choices that are switches or settings: takes out every order that `same` matches,
   * then adds `order` unless it is null. If the new order is refused the basket is left as it was.
   */
  setOrder(same: (order: Order) => boolean, order: Order | null): boolean;
  clearRefusal(): void;
  clearAlsoRemoved(): void;
  clearMoved(): void;
  clearFellBack(): void;
  clearUnreachable(): void;
  play(): Promise<void>;
  /**
   * The round's time is up, in a room: it is played as it stands. From the finances, with the
   * basket; from anywhere before them, with no orders, and the cards still waiting take their first
   * option. A round already being played, or over, is left as it is.
   */
  timeUp(): Promise<void>;
  /**
   * A round was played while this page was not waiting for it, in a room: by the clock, or before
   * the page was opened again. Its result is shown as a played round's is. Nothing if there is none.
   */
  catchUp(): Promise<void>;
  /** From the ledger to the next round, or to the end. */
  next(): void;
}

export type GameStore = StoreApi<RoundState & RoundActions>;

/** How long a server may take over a card before the card turns to wait for its result: a quick answer is never shown waiting. */
export const PENDING_AFTER_MS = 150;

const blank: RoundState = {
  status: 'none',
  lost: null,
  lifeId: null,
  gameId: null,
  view: null,
  history: [],
  bankruptcies: 0,
  badges: [],
  story: [],
  earned: [],
  unlocked: [],
  stage: 'news',
  cardEvents: [],
  offered: null,
  orders: [],
  undo: null,
  preview: null,
  refusal: null,
  alsoRemoved: 0,
  resolved: null,
  busy: false,
  picked: null,
  pending: false,
  moved: false,
  fault: false,
  ranked: false,
  rules: ENGINE_VERSION,
  challenge: null,
  fellBack: false,
  unreachable: false,
  elsewhere: null,
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
  /** Where the orders of the round being planned are kept until it is played. Left out, nowhere beyond the page. */
  basket?: BasketKeep;
}

/**
 * The state of the round on screen. It talks to the game through a `GameSession` only,
 * and asks the engine's own preview what each order would do: no rule of the game lives here.
 */
export function createGameStore({ sessions, content, now = () => 0, guardMs = 0, basket = memoryBasket() }: GameStoreOptions): GameStore {
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
      } else if (error instanceof Unreachable) {
        // A ranked life is played by the server, and the server did not answer. The same step can be asked again:
        // if it was taken after all and only its answer was lost, asking again brings that answer.
        set({ unreachable: true });
      } else {
        console.error('the game refused a step:', error);
        set({ fault: true });
      }
    };

    /** Shows what a round did, as the ledger after it. */
    const shown = (view: GameView, result: StepResult) => {
      if (!session) return;
      set({
          view: result.view,
          history: session.history(),
          bankruptcies: session.bankruptcies(),
          badges: session.badges(),
          story: session.story(),
          earned: result.earned,
          unlocked: result.unlocked,
          resolved: { before: view, events: result.events },
          orders: [],
          undo: null,
          preview: null,
          refusal: null,
          alsoRemoved: 0,
          cardEvents: [],
          offered: null,
          stage: 'resolve',
          unreachable: false,
        });
    };

    /** Plays the round with these orders, and shows what it did. */
    const playing = async (view: GameView, orders: Order[]) => {
      if (!session) return;
      set({ busy: true });
      try {
        // Only what the life's rules know is sent: an order of newer rules would be refused, as an action that does not exist.
        shown(view, await session.playRound({ orders: knownOrders(session.rules ?? ENGINE_VERSION, orders) }));
      } catch (error) {
        await refused(error);
      } finally {
        set({ busy: false });
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
        story: opened.story(),
        ranked: opened.ranked === true,
        rules: opened.rules ?? ENGINE_VERSION,
        challenge: opened.challenge ?? null,
      };
      if (view.finished) set({ ...base, stage: 'end' });
      // A hand left half answered opens on its next card: the news were read before the first.
      else if (view.phase === 'cards') set({ ...base, stage: view.answered === 0 ? 'news' : 'cards' });
      // Orders planned for this round before the page was closed are taken up again, as the engine still allows them.
      else set({ ...base, stage: 'finance', ...settle(view, basket.load(opened.gameId, view.round)) });
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

      async reopen() {
        const shown = get().status === 'playing';
        await get().boot();
        if (shown) set({ moved: true });
      },

      async start(lifeId, options) {
        let opened: GameSession;
        try {
          opened = await sessions.start(lifeId, options);
        } catch (error) {
          // The player has a ranked life in progress somewhere else. Nothing began, and nothing ended: it is theirs to say.
          if (!(error instanceof RankedInProgress)) throw error;
          set({ elsewhere: { ...error.life, here: error.life.engineVersion === ENGINE_VERSION && error.life.contentVersion === CONTENT_VERSION } });
          return false;
        }
        open(opened);
        set({ elsewhere: null });
        // Asked for as ranked, and begun on the device because a ranked one could not be had: the player is told.
        if (options?.ranked === true && opened.ranked !== true) set({ fellBack: true });
        return true;
      },

      async continueElsewhere() {
        const life = get().elsewhere;
        if (life === null || !life.here || !sessions.takeUp) return 'gone';
        let opened: GameSession | null;
        try {
          opened = await sessions.takeUp(life);
        } catch (error) {
          // The server did not answer. The question stands, and can be answered again.
          if (!(error instanceof Unreachable)) throw error;
          return 'away';
        }
        set({ elsewhere: null });
        if (opened === null) return 'gone';
        open(opened);
        return 'taken';
      },

      clearElsewhere() {
        set({ elsewhere: null });
      },

      async abandon() {
        await sessions.abandon();
        session = null;
        set({ ...blank });
      },

      leaveNews() {
        const { view, stage } = get();
        if (!view || stage !== 'news' || !settled()) return;
        if (view.phase === 'cards') set({ stage: 'cards', cardEvents: [], offered: null });
        else get().toFinance();
      },

      async pick(option) {
        const { view, busy, stage } = get();
        if (!view || !session || busy || stage !== 'cards' || !settled()) return;
        set({ busy: true, picked: option });
        // What every option offered is asked before the answer: afterwards the card is no longer in the hand to be judged.
        const cardId = view.hand[view.answered];
        // And whether the player had a partner then: a card that brings one in is told as that, not as a change of their pay.
        const offered = { cardId, options: previewCard(content, view, cardId), world: view.timeline[view.round], partnered: view.player.life.partner };
        // A server takes a moment to answer. The tap is seen at once on the option; then the card turns, its choice made, while the dice roll there.
        const turning = session.served ? setTimeout(() => get().picked === option && get().busy && set({ stage: 'outcome', offered, cardEvents: [], earned: [], unlocked: [], pending: true }), PENDING_AFTER_MS) : null;
        try {
          const result = await session.answerCard(option);
          set({ offered, view: result.view, cardEvents: result.events, badges: session.badges(), story: session.story(), earned: result.earned, unlocked: result.unlocked, stage: 'outcome', pending: false, unreachable: false });
        } catch (error) {
          // The card was not answered after all: it is back, to be answered again.
          if (get().pending) set({ stage: 'cards', offered: null, pending: false });
          await refused(error);
        } finally {
          if (turning !== null) clearTimeout(turning);
          set({ busy: false, picked: null, pending: false });
        }
      },

      afterCard() {
        const { view, stage, pending } = get();
        if (!view || stage !== 'outcome' || pending || !settled()) return;
        if (view.phase === 'cards') set({ stage: 'cards', cardEvents: [], offered: null, earned: [], unlocked: [] });
        else {
          set({ cardEvents: [], offered: null, earned: [], unlocked: [] });
          get().toFinance();
        }
      },

      toFinance() {
        const { view, gameId } = get();
        if (!view || view.finished || view.phase !== 'finance') return;
        set({ stage: 'finance', refusal: null, undo: null, ...settle(view, gameId === null ? [] : basket.load(gameId, view.round)) });
      },

      addOrder(order) {
        return get().setOrder(() => false, order);
      },

      removeOrder(index) {
        const { view, orders } = get();
        if (!view) return;
        const without = orders.filter((_, i) => i !== index);
        const settled = settle(view, without);
        set({ refusal: null, alsoRemoved: without.length - settled.orders.length, undo: without.length < orders.length ? orders : get().undo, ...settled });
      },

      undoRemove() {
        const { view, undo } = get();
        if (!view || undo === null) return;
        set({ refusal: null, alsoRemoved: 0, undo: null, ...settle(view, undo) });
      },

      setOrder(same, order) {
        const { view, orders } = get();
        if (!view) return false;
        // A new change to the basket is the one to keep: what was taken out before it is not put back.
        set({ undo: null });
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

      clearFellBack() {
        set({ fellBack: false });
      },

      clearUnreachable() {
        set({ unreachable: false });
      },

      async play() {
        const { view, orders, busy, stage } = get();
        if (!view || !session || busy || stage !== 'finance' || !settled()) return;
        await playing(view, orders);
      },

      async timeUp() {
        const { view, orders, busy, stage } = get();
        // Before the finances the basket is empty: the round is played with no orders.
        if (!view || !session || busy || (stage !== 'news' && stage !== 'cards' && stage !== 'outcome' && stage !== 'finance')) return;
        await playing(view, orders);
      },

      async catchUp() {
        const { view, busy } = get();
        if (!view || !session?.catchUp || busy) return;
        set({ busy: true });
        try {
          const result = await session.catchUp();
          if (result !== null) shown(view, result);
        } catch (error) {
          await refused(error);
        } finally {
          set({ busy: false });
        }
      },

      next() {
        const { view, stage } = get();
        if (!view || stage !== 'resolve' || !settled()) return;
        set({ stage: view.finished ? 'end' : 'news', cardEvents: [], offered: null, resolved: null, earned: [], unlocked: [] });
      },
    };
  });

  // Every change of screen starts the short wait in which a tap is taken for the tail of the last one.
  store.subscribe((state, before) => {
    if (state.stage !== before.stage) changedAt = now();
    // The basket is kept as it changes, and emptied once the round it was for is played.
    if (state.orders !== before.orders && state.gameId !== null && state.view !== null && state.stage === 'finance') basket.save(state.gameId, state.view.round, state.orders);
    if (state.view !== null && before.view !== null && state.gameId !== null && state.view.round !== before.view.round) basket.save(state.gameId, before.view.round, []);
  });
  return store;
}
