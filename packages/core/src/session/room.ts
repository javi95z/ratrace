import type { LifeDef, LifeRecord, Milestone } from '@ratrace/content';
import type { Content, GameEvent, GameView, Order, RoundChoices } from '@ratrace/engine';
import { StaleSession, Unreachable } from './errors';
import { settleRank, tellProfile } from './profile';
import type { RankedRun, RankedStep } from './ranked';
import { SAVE_FORMAT } from './types';
import type { FinishedRun, GameSession, PlayerStore, Sessions, StepResult } from './types';

/** How long a round of a room may take, in seconds: the host chooses one. The server keeps to the same. */
export const ROUND_SECONDS = [90, 180, 300, 43_200, 86_400] as const;
export type RoundSeconds = (typeof ROUND_SECONDS)[number];
/** How long after its deadline the server still waits for a round's orders. */
export const GRACE_MS = 5_000;
/** The most members a room holds, and the fewest it starts with. */
export const MAX_MEMBERS = 6;
export const MIN_MEMBERS = 2;
/** How many sit at a public game when it starts: rats take the seats nobody came for. The server keeps to the same. */
export const TABLE = 4;

/** How a member stood when the last round turned. */
export interface RoomStanding {
  /** What their life would score if it ended now; at the end, its score. */
  score: number;
  /** Net worth in start-of-game cents. */
  netWorth: number;
  /** Status averaged over the rounds played. */
  status: number;
  escaped: boolean;
  bankruptcies: number;
  /** How they stood the round before: their score and their place. Null after the first round. */
  before: { score: number; place: number } | null;
  /** Where they live, and their job and its rung, as the round left them. Null where the server did not say. */
  cityId: string | null;
  career: { id: string; level: number } | null;
}

export interface RoomMember {
  userId: string;
  /** The name they chose, or null for one who has none. */
  name: string | null;
  me: boolean;
  host: boolean;
  /** For a rat the server plays in a public game, the kind of player it plays as (`saver`, `gambler`...); null for a person. */
  bot: string | null;
  /** True once they have played the round in play. */
  ready: boolean;
  left: boolean;
  /** As of the last round that turned; null before the first. */
  standing: RoomStanding | null;
  /** The rat they chose to be seen as (`rat_<colour>`), or null: one is picked for them from their id. */
  avatar: string | null;
  /** The last thing they shouted to everyone, as a number of `SHOUTS`, and when by the server's clock; null for nothing lately. */
  shout: { n: number; at: number } | null;
}

/** What a member may shout to the others: six faces, then eight phrases, by their number. Only these, so there is nothing to moderate. */
export const SHOUT_FACES = ['😂', '😱', '🔥', '💸', '👑', '👋'] as const;
export const SHOUT_PHRASES = 8;
/** How long after a shout the server takes another from the same member. */
export const SHOUT_EVERY_MS = 10_000;


/** A room as a member may see it. */
export interface RoomState {
  id: string;
  code: string;
  host: string;
  lifeId: string;
  engineVersion: string;
  contentVersion: string;
  seconds: number;
  status: 'open' | 'playing' | 'finished' | 'closed';
  /** The round the room is in; past the last once it is over. */
  round: number;
  rounds: number;
  /** When the round in play is due, in milliseconds by the server's clock. Null outside play. */
  deadline: number | null;
  /** The server's clock when it answered, in milliseconds. */
  now: number;
  /** Everyone who has been in the room, in the order they joined, those who left too. */
  members: RoomMember[];
  /** The rematch opened from this room once it was over: its code, and whether it can still be joined. */
  rematch: { code: string; open: boolean } | null;
  /** True for a room that is the rematch of another. */
  rematchOf: boolean;
  /** A public game: found rather than shared, started by anyone in it, and filled with rats when it starts. */
  public: boolean;
  /** When a public lobby starts by itself, in milliseconds by the server's clock. Null for any other room. */
  startsAt: number | null;
  /** The loans the player is part of: offers of the round in play, and what came of those of the round before. */
  loans: RoomLoan[];
}

/**
 * A loan between the player and another in their room, from the player's side: `lend` when the
 * player is the one who lends, `mine` when they made the offer. Amounts in cents.
 */
export interface RoomLoan {
  id: string;
  round: number;
  lend: boolean;
  other: string;
  mine: boolean;
  amount: number;
  rateBp: number;
  rounds: number;
  status: 'open' | 'accepted' | 'refused' | 'paid' | 'failed' | 'expired';
}

/** What a loan between players may be, as the server holds it to: rates in whole points up to twenty, terms of one to five rounds. */
export const LOAN_RATES_BP = [0, 300, 500, 800, 1_000, 1_500, 2_000] as const;
export const LOAN_ROUNDS = [1, 2, 3, 4, 5] as const;
export const LOAN_MIN = 10_000;
export const LOAN_MAX = 1_000_000_000;

/** A game over, as a player's history keeps it. */
export interface RoomGameOver {
  id: string;
  lifeId: string;
  seconds: number;
  /** When it was opened, in milliseconds. */
  playedAt: number;
  rematchOf: boolean;
  /** A public game, which rats may have sat in. */
  public: boolean;
  /** The player's own life in it: the id their finished life is kept under. Null when the server does not say. */
  gameId: string | null;
  /** Everyone who was in it, in their final order; those who left last. */
  /** `left` for one who gave their life up before the end; `bot`, the kind of a rat. Net worth in the dollars the life began with, where it lived and its job, when the server says. */
  players: Array<{ name: string | null; tag: string; bot: string | null; me: boolean; score: number | null; left: boolean; netWorth: number | null; cityId: string | null; career: { id: string; level: number } | null }>;
}

/** A member's life in a room, as the server shows it: the whole of what they may see, and what its last step did. */
export interface RoomLife {
  gameId: string;
  lifeId: string;
  /** The engine version of the room's rules, when the server says. */
  engineVersion?: string;
  step: number;
  view: GameView;
  record: LifeRecord;
  events: GameEvent[];
  run: RankedRun | null;
}

/** The server would not, in a word of its own: `in-a-room`, `full`, `started`, `other-version`... `roomId` names the room in the way, if one is. */
export class RoomRefused extends Error {
  constructor(
    readonly word: string,
    readonly roomId: string | null = null,
  ) {
    super(`the room was refused: ${word}`);
    this.name = 'RoomRefused';
  }
}

/**
 * The server of rooms. Every one of these throws `Unreachable` when the server cannot answer just
 * now (nothing has changed then, and the same can be asked again), and the first five throw
 * `RoomRefused` when it answers no.
 */
export interface RoomsApi {
  /** The room the player is in, if any. */
  mine(): Promise<RoomState | null>;
  open(lifeId: string, seconds: RoundSeconds, versions: { engine: string; content: string }): Promise<RoomState>;
  /** A seat in a public game: one waiting on these rules, or a new one. */
  quick(versions: { engine: string; content: string }): Promise<RoomState>;
  join(code: string, versions: { engine: string; content: string }): Promise<RoomState>;
  start(roomId: string): Promise<RoomState>;
  /** Leaves the room. Null if the player was no longer in it. */
  leave(roomId: string): Promise<RoomState | null>;
  /** The room as it stands. `gone` if the player is not in it. */
  state(roomId: string): Promise<RoomState | 'gone'>;
  /** The player's life in the room. `gone` if they have none to play there. */
  view(roomId: string): Promise<RoomLife | 'gone'>;
  /** Answers the next card, as step number `step`. `moved` if the life or the round is not where the page thinks. */
  card(roomId: string, step: number, option: number): Promise<RankedStep | 'moved'>;
  /** Plays the round, as step number `step`: the room as it then stands, and the round's result if it turned in this very call. */
  submit(roomId: string, step: number, orders: Order[]): Promise<{ room: RoomState; result: RankedStep | null } | 'moved'>;
  /** Opens the rematch of a room that is over, or joins it if someone else opened it first. Throws `RoomRefused` when the server says no. */
  rematch(roomId: string, lifeId: string, versions: { engine: string; content: string }): Promise<RoomState>;
  /** The games over the player was in, the latest first. */
  history(): Promise<RoomGameOver[]>;
  /** Shouts to everyone in the room. `soon` if the player shouted a moment ago, `gone` if they are not in it. */
  shout(roomId: string, shout: number): Promise<RoomState | 'soon' | 'gone'>;
  /** Offers another player a loan: to lend them money, or to borrow it from them. `gone` if either is no longer in the game. */
  offerLoan(roomId: string, loan: { to: string; lend: boolean; amount: number; rateBp: number; rounds: number }): Promise<RoomState | 'gone'>;
  /** Says yes or no to an offer, or takes back one's own with a no. `gone` if it is no longer open. */
  answerLoan(roomId: string, loanId: string, yes: boolean): Promise<RoomState | 'gone'>;
}

/** The rooms of the player's account: the server, and a way to hear of every change to one room. */
export interface RoomsLink {
  api: RoomsApi;
  /** Calls `onChange` whenever the room or anyone in it changes. Returns how to stop. */
  watch(roomId: string, onChange: () => void): () => void;
}

/** What a room's life needs from the room around it. */
export interface RoomSessionDeps {
  now(): number;
  /** Told when the device could not write. The game goes on. */
  onSaveError?(error: unknown): void;
  /** Resolves once the room has turned past this round, or stopped being played. */
  turned(round: number): Promise<void>;
  /** Told the room as an answer brought it, so that whoever shows it has it at once. */
  onRoom(room: RoomState): void;
}

/**
 * A member's life in a room, played by the server. Cards are played at once, as in a ranked life.
 * A round played waits for the room: everyone's round turns at once, and its result comes then,
 * by the server's answer to the last to play or once this page hears that the room has turned.
 * Nothing of it is kept as the device's life in progress, which stays as it is; it is told to the
 * profile, and its run goes among the device's finished lives, as any life's does.
 */
export class RoomSession implements GameSession {
  readonly ranked = false;
  readonly served = true;
  /** Steps run one after another, in the order they were asked for. */
  private tail: Promise<unknown> = Promise.resolve();
  private ofGallery: string[] = [];
  private kept = false;

  constructor(
    readonly roomId: string,
    private life: RoomLife,
    private readonly api: () => RoomsApi | null,
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly lives: ReadonlyArray<LifeDef>,
    private readonly deps: RoomSessionDeps,
  ) {}

  get rules(): string | undefined {
    return this.life.engineVersion;
  }

  get gameId(): string {
    return this.life.gameId;
  }

  get lifeId(): string {
    return this.life.lifeId;
  }

  /** How many steps the server has taken, as far as this page knows. */
  get step(): number {
    return this.life.step;
  }

  view(): GameView {
    return this.life.view;
  }

  history(): number[] {
    return [...this.life.record.history];
  }

  bankruptcies(): number {
    return this.life.record.bankruptcies;
  }

  badges(): string[] {
    return [...this.life.record.journal.earned, ...this.ofGallery];
  }

  story(): Milestone[] {
    return this.life.record.journal.story.milestones;
  }

  answerCard(option: number): Promise<StepResult> {
    return this.queue(async (api) => {
      const reply = await api.card(this.roomId, this.life.step, option);
      if (reply === 'moved') throw new StaleSession();
      return this.took(reply);
    });
  }

  playRound(choices: RoundChoices): Promise<StepResult> {
    return this.queue(async (api) => {
      const round = this.life.view.round;
      const reply = await api.submit(this.roomId, this.life.step, choices.orders);
      if (reply === 'moved') throw new StaleSession();
      this.deps.onRoom(reply.room);
      if (reply.result !== null) return this.took(reply.result);
      // Ready, and waiting for the others: the round turns for everyone at once, and its result comes then.
      await this.deps.turned(round);
      const now = await api.view(this.roomId);
      // Only the round played is shown as played. A page that woke rounds later opens the life as it stands; the room says how many the clock played.
      if (now === 'gone' || now.view.round !== round + 1) throw new StaleSession();
      return this.became(now);
    });
  }

  /** The round the room turned since this page last saw the life, if it turned exactly one: the clock played it, or it was played before the page was opened again. */
  catchUp(): Promise<StepResult | null> {
    const run = async (): Promise<StepResult | null> => {
      const api = this.api();
      if (api === null) throw new Unreachable('nobody is signed in');
      const now = await api.view(this.roomId);
      if (now === 'gone') throw new StaleSession();
      if (now.view.round === this.life.view.round) return null;
      // More than one round, or a life that is not where this page had it: it is opened again as it stands.
      if (now.view.round !== this.life.view.round + 1) throw new StaleSession();
      return this.became(now);
    };
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private queue(ask: (api: RoomsApi) => Promise<StepResult>): Promise<StepResult> {
    const run = async (): Promise<StepResult> => {
      const api = this.api();
      if (api === null) throw new Unreachable('nobody is signed in');
      return ask(api);
    };
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  /** Takes a step's answer: what changed, added to what this page holds. */
  private async took(reply: RankedStep): Promise<StepResult> {
    const before = this.life.view;
    const view = { ...reply.view, timeline: reply.world ? [...before.timeline, reply.world] : before.timeline } as GameView;
    // A view always holds one world a round and the one it is in. Anything else is not the life this page was following.
    if (view.timeline.length !== view.round + 1) throw new StaleSession();
    this.life = { ...this.life, step: reply.step, view, record: reply.record, events: reply.events, run: reply.run ?? this.life.run };
    return { view, events: reply.events, ...(await this.told()) };
  }

  /** Takes the life as the server shows it whole: after a round the page waited for. */
  private async became(now: RoomLife): Promise<StepResult> {
    this.life = now;
    return { view: now.view, events: now.events, ...(await this.told()) };
  }

  /** Tells the profile what the life has earned, and keeps its run among the finished lives once it is over. */
  async told(): Promise<{ earned: string[]; unlocked: string[] }> {
    try {
      const { life } = this;
      const at = this.deps.now();
      const told = await tellProfile(this.store, this.content, this.lives, { gameId: life.gameId, at, earned: life.record.journal.earned, collection: life.view.player.life.collection, over: life.view.finished });
      this.ofGallery = told.ofGallery;
      if (life.run !== null && !this.kept) {
        await this.store.addRun(this.asRun(life.run));
        this.kept = true;
        await settleRank(this.store);
      }
      return { earned: told.earned, unlocked: told.unlocked };
    } catch (error) {
      this.deps.onSaveError?.(error);
      return { earned: [], unlocked: [] };
    }
  }

  /** The finished life for the records of this device. The figures are the server's; the seed and the log stay with it. */
  private asRun(run: RankedRun): FinishedRun {
    return {
      format: SAVE_FORMAT,
      runId: run.id,
      engineVersion: run.engineVersion,
      contentVersion: run.contentVersion,
      lifeId: run.lifeId,
      seed: '',
      log: [],
      finishedAt: Date.parse(run.finishedAt) || this.deps.now(),
      score: run.score,
      netWorth: run.netWorth,
      status: run.status,
      escapedAtRound: run.escapedAtRound,
      bankruptcies: run.bankruptcies,
      history: run.history,
      badges: this.badges(),
      cities: run.cities,
      verified: false,
      room: true,
    };
  }
}

/**
 * The one life a room gives a member, as the round store asks for lives. It cannot start one:
 * the room starts it. Giving it up is leaving the room.
 */
export class RoomSessions implements Sessions {
  private current: RoomSession | null = null;

  constructor(
    private readonly roomId: string,
    private readonly api: () => RoomsApi | null,
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly lives: ReadonlyArray<LifeDef>,
    private readonly deps: RoomSessionDeps,
  ) {}

  start(): Promise<GameSession> {
    return Promise.reject(new Error('a life in a room is started by the room'));
  }

  /**
   * The member's life as the server now shows it. With no answer just now, the life as this page
   * last had it, if it had one: it is shown, and the next step will ask again.
   */
  async resume(): Promise<{ session: GameSession | null; lost: null }> {
    const api = this.api();
    let now: RoomLife | 'gone';
    try {
      if (api === null) throw new Unreachable('nobody is signed in');
      now = await api.view(this.roomId);
    } catch (error) {
      if (!(error instanceof Unreachable)) throw error;
      return { session: this.current, lost: null };
    }
    if (now === 'gone') {
      this.current = null;
      return { session: null, lost: null };
    }
    this.current = new RoomSession(this.roomId, now, this.api, this.store, this.content, this.lives, this.deps);
    void this.current.told();
    return { session: this.current, lost: null };
  }

  async abandon(): Promise<void> {
    await this.api()?.leave(this.roomId);
    this.current = null;
  }
}
