import { homeOf, realNetWorth } from '@ratrace/engine';
import type { Content, GameEvent, GameView } from '@ratrace/engine';
import { usd } from './money';

/**
 * Something that happened in a life and is worth telling afterwards. `round` is the round the life
 * had reached when it was true: age follows from it.
 */
export type Milestone =
  | { round: number; kind: 'promoted'; careerId: string; level: number; top: boolean }
  | { round: number; kind: 'career'; careerId: string }
  | { round: number; kind: 'jobLost' }
  | { round: number; kind: 'retired' }
  | { round: number; kind: 'gift' }
  | { round: number; kind: 'moved'; cityId: string }
  | { round: number; kind: 'partner' }
  | { round: number; kind: 'split' }
  | { round: number; kind: 'child'; first: boolean }
  | { round: number; kind: 'home'; typeId: string }
  | { round: number; kind: 'business' }
  | { round: number; kind: 'soldBusiness' }
  | { round: number; kind: 'escaped' }
  | { round: number; kind: 'escapeLost' }
  | { round: number; kind: 'bankrupt' }
  | { round: number; kind: 'crisis'; crisisId: string }
  | { round: number; kind: 'worth'; mark: number };

/** The sums that are milestones the first time a life is worth them, in start-of-game cents. */
export const WORTH_MARKS: readonly number[] = [usd(100_000), usd(1_000_000), usd(10_000_000)];

/**
 * The story of a life so far: its milestones in the order they came, and what the life looked
 * like at the last step, which is what the next step is told apart from. Like the rest of the
 * journal it follows from the events of the life, so a replay rebuilds it exactly.
 */
export interface Story {
  milestones: Milestone[];
  last: {
    careerId: string | null;
    partner: boolean;
    children: number;
    ownsHome: boolean;
    business: boolean;
    soldBusiness: boolean;
    retired: boolean;
    /** What has been given to the children in life, in start-of-game cents. */
    legacy: number;
    /** How many of `WORTH_MARKS` the life has been worth. */
    marks: number;
    /** The crisis the life is in or has been through, or null. */
    crisisId: string | null;
  };
}

function standing(content: Content, view: GameView, marks: number, crisisId: string | null): Story['last'] {
  const p = view.player;
  const worth = realNetWorth(view);
  return {
    careerId: p.life.career?.id ?? null,
    partner: p.life.partner,
    children: p.life.children.length,
    ownsHome: homeOf(p, content) !== null,
    business: p.businesses.length > 0,
    soldBusiness: Object.hasOwn(p.life.flags, 'sold_business'),
    retired: p.life.retiredAtRound !== null,
    legacy: p.life.legacy,
    marks: Math.max(marks, WORTH_MARKS.filter((mark) => worth >= mark).length),
    crisisId: view.timeline[view.round]?.crisis?.id ?? crisisId,
  };
}

/** Nothing has happened yet. What the life starts with is where it starts, not a milestone. */
export function storyStart(content: Content, view: GameView): Story {
  return { milestones: [], last: standing(content, view, 0, null) };
}

/** The story after one step: the answer to a card, or a round. */
export function storyAfter(content: Content, story: Story, after: GameView, events: readonly GameEvent[]): Story {
  const was = story.last;
  const now = standing(content, after, was.marks, was.crisisId);
  const round = after.round;
  const p = after.player;
  const told: Milestone[] = [];

  if (now.crisisId !== null && now.crisisId !== was.crisisId) told.push({ round, kind: 'crisis', crisisId: now.crisisId });
  if (events.some((event) => event.kind === 'bankrupt')) told.push({ round, kind: 'bankrupt' });

  // A career left to retire is a retirement, not a job lost.
  if (now.retired && !was.retired) told.push({ round, kind: 'retired' });
  else if (now.careerId !== was.careerId) told.push(now.careerId === null ? { round, kind: 'jobLost' } : { round, kind: 'career', careerId: now.careerId });
  if (now.legacy > was.legacy) told.push({ round, kind: 'gift' });
  // Two promotions in one step are one piece of news: the rung reached.
  const rose = events.filter((event): event is Extract<GameEvent, { kind: 'promoted' }> => event.kind === 'promoted').at(-1);
  if (rose) {
    const levels = content.careers.find((career) => career.id === rose.careerId)?.levels.length ?? 0;
    told.push({ round, kind: 'promoted', careerId: rose.careerId, level: rose.level, top: rose.level === levels - 1 });
  }
  for (const event of events) if (event.kind === 'moved') told.push({ round, kind: 'moved', cityId: event.cityId });

  if (now.partner !== was.partner) told.push({ round, kind: now.partner ? 'partner' : 'split' });
  if (now.children > was.children) told.push({ round, kind: 'child', first: !story.milestones.some((m) => m.kind === 'child') });
  if (now.ownsHome && !was.ownsHome && !story.milestones.some((m) => m.kind === 'home')) {
    const home = homeOf(p, content);
    if (home) told.push({ round, kind: 'home', typeId: home.typeId });
  }
  if (now.business && !was.business) told.push({ round, kind: 'business' });
  if (now.soldBusiness && !was.soldBusiness) told.push({ round, kind: 'soldBusiness' });

  for (const event of events) {
    if (event.kind === 'escaped') told.push({ round, kind: 'escaped' });
    if (event.kind === 'escapeLost') told.push({ round, kind: 'escapeLost' });
  }
  for (let i = was.marks; i < now.marks; i++) told.push({ round, kind: 'worth', mark: WORTH_MARKS[i] });

  return { milestones: told.length > 0 ? [...story.milestones, ...told] : story.milestones, last: now };
}
