import type { LifeDef, Milestone } from '@ratrace/content';
import { netWorth, realNetWorth } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { ageAt, milestoneAge, milestoneRound } from './present';
import type { Translate, Words } from './present';

/** How many milestones the middle of an epilogue tells. A life is a few turns, not a list. */
const TOLD = 6;

/** How much each kind of milestone says about a life. The heaviest are told; the rest are left out. */
function weight(m: Milestone): number {
  switch (m.kind) {
    case 'escaped':
      return 10;
    case 'bankrupt':
      return 9;
    case 'crisis':
      return 8;
    case 'worth':
      // The first hundred thousand is a start; a million is the story.
      return m.mark >= 100_000_000 ? 8 : 3;
    case 'career':
    case 'soldBusiness':
    case 'retired':
      return 7;
    case 'promoted':
      return m.top ? 7 : 2;
    case 'moved':
    case 'jobLost':
    case 'escapeLost':
      return 6;
    case 'partner':
    case 'home':
    case 'business':
    case 'gift':
      return 5;
    case 'child':
      return m.first ? 5 : 3;
    case 'split':
      return 4;
  }
}

/** One milestone as a sentence. `t` translates the `epilogue.told` section. */
function sentence(m: Milestone, { content, text, names }: Words, t: Translate): string {
  const age = milestoneAge(content, m);
  switch (m.kind) {
    case 'promoted':
      return t(m.top ? 'top' : 'promoted', { age, title: text.careers[m.careerId].levels[m.level] });
    case 'career':
      return t('career', { age, career: text.careers[m.careerId].name });
    case 'moved':
      return t('moved', { age, city: names.cities[m.cityId] });
    case 'child':
      return t(m.first ? 'firstChild' : 'child', { age });
    case 'home':
      return t('home', { age, home: text.propertyTypes[m.typeId] });
    case 'crisis':
      return t('crisis', { age, crisis: text.crises[m.crisisId].name });
    case 'worth':
      return t(m.mark >= 1_000_000_000 ? 'tenMillion' : m.mark >= 100_000_000 ? 'million' : 'hundred', { age });
    default:
      return t(m.kind, { age });
  }
}

/** The milestones worth telling, the heaviest first when there are too many, in the order they happened. */
export function chapters(story: readonly Milestone[]): Milestone[] {
  // One promotion is told at most: the last, which is where the ladder led.
  const lastRise = story.findLast((m) => m.kind === 'promoted');
  const kept = story.filter((m) => m.kind !== 'promoted' || m === lastRise);
  const ranked = kept.map((m, at) => ({ m, at })).sort((a, b) => weight(b.m) - weight(a.m) || a.at - b.at);
  return ranked
    .slice(0, TOLD)
    // By the round each is told at: the way out, won or lost in the round just played, before what that round's end brought.
    .sort((a, b) => milestoneRound(a.m) - milestoneRound(b.m) || a.at - b.at)
    .map((entry) => entry.m);
}

export interface Told {
  words: Words;
  /** Translates the `epilogue` section. */
  t: Translate;
  life: LifeDef;
  view: GameView;
  story: readonly Milestone[];
  score: number;
  bankruptcies: number;
}

/**
 * A life told in three short paragraphs: where it began, what happened, and how it ended.
 * Every fact comes from the game; this only chooses which to tell and puts them in order.
 */
export function epilogue({ words, t, life, view, story, score, bankruptcies }: Told): string[] {
  const { content, text, names, fmt } = words;
  const start = life.start;
  const job = start.life?.career;
  const opening = t(job ? 'opening.job' : 'opening.none', {
    age: ageAt(content, 0),
    city: names.cities[start.cityId],
    cash: fmt.money(start.cash),
    job: job ? text.careers[job.id].levels[job.level] : '',
  });

  const told = chapters(story);
  const middle = told.length === 0 ? t('quiet') : told.map((m) => sentence(m, words, (key, values) => t(`told.${key}`, values))).join(' ');

  const p = view.player;
  const worth = netWorth(p);
  const escaped = p.escapedAtRound !== null;
  // The ending a life earned: free, ruined, rich, or simply through.
  const ending = escaped ? 'free' : worth < 0 || (bankruptcies > 0 && realNetWorth(view) < 10_000_000) ? 'broke' : realNetWorth(view) >= 100_000_000 ? 'rich' : 'through';
  const closing = t(`closing.${ending}`, { age: ageAt(content, view.round), city: names.cities[p.cityId], worth: fmt.money(worth), score: fmt.number(score) });

  return [opening, middle, closing];
}
