import { WORTH_MARKS } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { ENGINE_VERSION, escapeProgress } from '@ratrace/engine';
import { escapeUnder } from './rules';
import type { Content, GameEvent, GameView } from '@ratrace/engine';
import type { FinishedRun } from '../session/types';
import { ageAt, escapeAge, milestoneAge } from './present';

/**
 * The milestones of a life the game celebrates, in every life, whatever badges say: the biggest first, which is the order a step that reaches
 * several tells them in.
 */
export const LIFE_MILESTONES = ['escaped', 'worth10m', 'worth1m', 'home', 'business', 'halfway', 'debtFree', 'worth100k'] as const;
export type LifeMilestone = (typeof LIFE_MILESTONES)[number];

/** The worth milestones, one for each of the story's `WORTH_MARKS`, in their order. */
const WORTH: readonly LifeMilestone[] = ['worth100k', 'worth1m', 'worth10m'];

/** A milestone a step reached: at what age, the youngest it had been reached at before (any life, null for never), and how big it is shown. */
export interface Reached {
  id: LifeMilestone;
  age: number;
  best: number | null;
  /** Big the first time ever, for a new personal record, and for the way out; medium otherwise. */
  size: 'big' | 'medium';
}

/**
 * What a life keeps of the two milestones its story does not tell: whether it has been in debt, and which of the two it has reached. The rest
 * (the worth, the first home and business, the way out) are read from the story, which the life keeps and replays.
 */
export interface LifeMemory {
  gameId: string;
  hadDebt: boolean;
  reached: LifeMilestone[];
}

/** What the device keeps of milestones: the memory of the last few lives, and the youngest age each milestone was ever reached at. */
export interface MilestoneBook {
  lives: LifeMemory[];
  best: Partial<Record<LifeMilestone, number>>;
}

export const EMPTY_BOOK: MilestoneBook = { lives: [], best: {} };

/** Where the device keeps its book: read and written at once, as the basket is, because the round store keeps it as each step is taken. */
export interface MilestoneKeep {
  load(): MilestoneBook;
  save(book: MilestoneBook): void;
}

/** A book held in memory, for tests, for a room's page and for pages with no storage. */
export function memoryMilestones(): MilestoneKeep {
  let book = EMPTY_BOOK;
  return {
    load: () => book,
    save: (next) => {
      book = next;
    },
  };
}

/** How many lives the book remembers. Only a life in progress needs remembering, and a room's beside the device's own. */
const KEPT_LIVES = 8;

/** Half the way out: what the investments pay after tax covers at least half of what the life costs (the guide's note of a first time too). */
export const isHalfway = ({ passiveAfterTax, outgoings }: { passiveAfterTax: number; outgoings: number }): boolean => outgoings > 0 && passiveAfterTax * 2 >= outgoings;

/** Where a life stands on the two milestones its story does not tell. */
function standingOf(content: Content, view: GameView, rules: string): { debt: boolean; halfway: boolean } {
  return { debt: view.player.debts.some((debt) => debt.principal > 0), halfway: isHalfway(escapeUnder(rules, escapeProgress(content, view))) };
}

/** The milestone the story tells, if it is one the game celebrates and the first of its kind in the life. */
function fromStory(m: Milestone, before: readonly Milestone[]): LifeMilestone | null {
  switch (m.kind) {
    case 'worth': {
      const at = WORTH_MARKS.indexOf(m.mark);
      return at >= 0 ? WORTH[at] : null;
    }
    // The story tells a home only the first time already; a business and the way out it tells each time.
    case 'home':
      return 'home';
    case 'business':
      return before.some((earlier) => earlier.kind === 'business') ? null : 'business';
    case 'escaped':
      return before.some((earlier) => earlier.kind === 'escaped') ? null : 'escaped';
    default:
      return null;
  }
}

export interface MilestoneStep {
  content: Content;
  gameId: string;
  book: MilestoneBook;
  /** The life before the step and after it. */
  before: GameView;
  after: GameView;
  /** The story before the step and after it: what it newly tells is what the step did. */
  story: { before: readonly Milestone[]; after: readonly Milestone[] };
  events: readonly GameEvent[];
  /** The engine version of the rules the life is played under, which say how far out it is: this page's own unless it is older. */
  rules?: string;
}

/**
 * The milestones one step of a life reached (the answer to a card, or a round), each once a life, and the book after it.
 *
 * Once a life is known without keeping anything new for most of them: the story the life keeps tells each the first time. Debts paid off and
 * halfway out are not in the story, so the book remembers them by the life. A life the book does not know yet (a new one, or one begun before
 * milestones were celebrated) starts from where it stands before the step: what was true then is not celebrated, so an old life does not
 * celebrate everything it had already done.
 */
export function milestonesOfStep({ content, gameId, book, before, after, story, events, rules = ENGINE_VERSION }: MilestoneStep): { reached: Reached[]; book: MilestoneBook } {
  const was = standingOf(content, before, rules);
  const known = book.lives.find((life) => life.gameId === gameId);
  const life: LifeMemory = known ?? { gameId, hadDebt: was.debt, reached: was.halfway ? ['halfway'] : [] };
  const found: Array<{ id: LifeMilestone; age: number }> = [];
  const reach = (id: LifeMilestone, age: number) => {
    if (!found.some((each) => each.id === id)) found.push({ id, age });
  };

  for (const m of story.after.slice(story.before.length)) {
    const id = fromStory(m, story.before);
    if (id) reach(id, milestoneAge(content, m));
  }

  const now = standingOf(content, after, rules);
  const age = ageAt(content, after.round);
  const kept = new Set(life.reached);
  const broke = events.some((event) => event.kind === 'bankrupt');
  let hadDebt = life.hadDebt || now.debt;
  if (broke) {
    // A bankruptcy clears the debts by taking everything: that is no debt paid off, and the life starts its count again from nothing owed.
    hadDebt = false;
  } else if (life.hadDebt && !now.debt && !kept.has('debtFree')) {
    reach('debtFree', age);
    kept.add('debtFree');
  }
  if (now.halfway && !kept.has('halfway')) {
    kept.add('halfway');
    // Halfway and all the way out in one step: the way out says it all.
    if (!found.some((each) => each.id === 'escaped')) reach('halfway', age);
  }
  for (const each of found) kept.add(each.id);

  const best = { ...book.best };
  const reached: Reached[] = LIFE_MILESTONES.flatMap((id) => {
    const each = found.find((one) => one.id === id);
    if (!each) return [];
    const before = best[id] ?? null;
    const big = id === 'escaped' || before === null || each.age < before;
    if (before === null || each.age < before) best[id] = each.age;
    return [{ id, age: each.age, best: before, size: big ? ('big' as const) : ('medium' as const) }];
  });

  const memory: LifeMemory = { gameId, hadDebt, reached: LIFE_MILESTONES.filter((id) => kept.has(id)) };
  const lives = [memory, ...book.lives.filter((other) => other.gameId !== gameId)].slice(0, KEPT_LIVES);
  return { reached, book: { lives, best } };
}

/**
 * The youngest age each milestone was reached at in the lives finished, as far as what a finished life keeps can tell: the worth from its graph
 * (round by round; what a life started with is no milestone), and the way out from its round. A life lived on another device is known so too.
 */
export function bestsOfRuns(content: Content, runs: readonly FinishedRun[]): Partial<Record<LifeMilestone, number>> {
  const best: Partial<Record<LifeMilestone, number>> = {};
  const lower = (id: LifeMilestone, age: number) => {
    if (best[id] === undefined || age < (best[id] as number)) best[id] = age;
  };
  for (const run of runs) {
    WORTH_MARKS.forEach((mark, i) => {
      if ((run.history[0] ?? 0) >= mark) return;
      const round = run.history.findIndex((worth) => worth >= mark);
      if (round > 0) lower(WORTH[i], ageAt(content, round));
    });
    if (run.escapedAtRound !== null) lower('escaped', escapeAge(content, run.escapedAtRound));
  }
  return best;
}

/** The book with these ages taken in where they are younger than what it knows. */
export function withBests(book: MilestoneBook, bests: Partial<Record<LifeMilestone, number>>): MilestoneBook {
  const best = { ...book.best };
  for (const id of LIFE_MILESTONES) {
    const age = bests[id];
    if (age !== undefined && (best[id] === undefined || age < (best[id] as number))) best[id] = age;
  }
  return { ...book, best };
}

/** Reads a book as it was kept. What is not one is an empty book. */
export function readBook(raw: unknown): MilestoneBook {
  if (typeof raw !== 'object' || raw === null) return EMPTY_BOOK;
  const kept = raw as { lives?: unknown; best?: unknown };
  const isId = (x: unknown): x is LifeMilestone => typeof x === 'string' && (LIFE_MILESTONES as readonly string[]).includes(x);
  const lives = Array.isArray(kept.lives)
    ? kept.lives.flatMap((life: unknown): LifeMemory[] => {
        if (typeof life !== 'object' || life === null) return [];
        const { gameId, hadDebt, reached } = life as Record<string, unknown>;
        if (typeof gameId !== 'string') return [];
        return [{ gameId, hadDebt: hadDebt === true, reached: Array.isArray(reached) ? reached.filter(isId) : [] }];
      })
    : [];
  const best: Partial<Record<LifeMilestone, number>> = {};
  if (typeof kept.best === 'object' && kept.best !== null) {
    for (const [id, age] of Object.entries(kept.best)) if (isId(id) && typeof age === 'number' && Number.isFinite(age)) best[id] = age;
  }
  return { lives: lives.slice(0, KEPT_LIVES), best };
}

/** What a celebration shows: the milestone that leads, the others the same step reached, and the badges it earned. */
export interface Carried {
  lead: Reached;
  others: Reached[];
  badges: string[];
}

/** How a step's milestones and badges are shown together: always one moment, the milestone leading and the badges inside it. */
export type Celebration =
  /** No milestone: the badges are shown as they always were. */
  | { where: 'badges' }
  /**
   * `moment`: inside the moment that already has the screen for the first million or the way out. `sheet`: the whole screen. `banner`: a card
   * that rises with the step's result and stops nothing.
   */
  | ({ where: 'moment' | 'sheet' | 'banner' } & Carried);

/**
 * Where the milestones a step reached are shown, and with what. A step with a big milestone, or a legendary badge, has the whole screen; any
 * other is a banner. A room never stops for one: its clock runs for everyone. `moment` is the moment the screen already stops for, if any.
 */
export function celebrationOf({ reached, earned, legendary, moment, inRoom }: { reached: readonly Reached[]; earned: readonly string[]; legendary: (badgeId: string) => boolean; moment: 'escape' | 'million' | null; inRoom: boolean }): Celebration {
  if (reached.length === 0) return { where: 'badges' };
  const covered = moment === 'escape' ? 'escaped' : moment === 'million' ? 'worth1m' : null;
  const held = covered === null ? undefined : reached.find((each) => each.id === covered);
  const order = [...reached].sort((a, b) => (a.size === b.size ? 0 : a.size === 'big' ? -1 : 1));
  const lead = held ?? order[0];
  const others = order.filter((each) => each !== lead);
  const badges = [...earned];
  if (held) return { where: 'moment', lead, others, badges };
  const big = !inRoom && (reached.some((each) => each.size === 'big') || earned.some(legendary));
  return { where: big ? 'sheet' : 'banner', lead, others, badges };
}
