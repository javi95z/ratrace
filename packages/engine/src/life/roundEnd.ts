import { careerOf, itemOf } from '../lookup';
import { BP, mulDiv } from '../money';
import type { Rng } from '../rng';
import type { Content, FinanceSkill, GameEvent, ItemPerks, PlayerState, RoundTally, WorldState } from '../types';
import { focusBonusOf, perksOf } from './derive';
import { lapsingIn } from './orders';

/**
 * What a move costs beyond its price, as the player lands. Moved by their own choice they start a
 * rung or so down, where nobody knows them yet, and a partner is without pay while they look for
 * work; the rung comes back with the next promotion if the experience is there. A transfer costs
 * none of it. The order and the quote both ask here.
 */
export function landingOf(p: PlayerState, content: Content, transfer: boolean): { level: number | null; rungsLost: number; partnerSettling: number } {
  const job = p.life.career;
  if (transfer) return { level: job ? job.level : null, rungsLost: 0, partnerSettling: p.life.partnerSettling };
  const level = job ? Math.max(0, job.level - content.life.moveRungsLost) : null;
  return {
    level,
    rungsLost: job && level !== null ? job.level - level : 0,
    partnerSettling: p.life.partner ? Math.max(p.life.partnerSettling, content.life.partnerSettlingRounds) : p.life.partnerSettling,
  };
}

/** The chance in percent that a job hunt ends in a raise: the rule's own, and what the player's things add to it. */
export function jobHuntChance(content: Content, perks: Required<ItemPerks>): number {
  return Math.min(100, content.life.jobHuntChancePct + perks.jobHuntPct);
}

/**
 * What a round of living does to the player, once its money has settled:
 * skill from work and study, a promotion, the job-hunt dice, item values, and every clock that counts down.
 * `now` is the world the round was played in and `after` the one it ends in.
 */
export function ageLife(
  p: PlayerState,
  content: Content,
  now: WorldState,
  after: WorldState,
  tally: RoundTally,
  rng: Rng,
  events: GameEvent[],
): void {
  const life = p.life;
  const rules = content.life;
  const perks = perksOf(p, content);

  if (life.career !== null) {
    // What the player owns counts as it stood while the round was lived: before anything fades or lapses.
    life.careerSkill += rules.workSkill + (tally.focusActions.includes('studyCareer') ? rules.studySkill + perks.studySkill : 0);
    const next = careerOf(content, life.career.id).levels[life.career.level + 1];
    if (next !== undefined && life.careerSkill >= next.minSkill) {
      life.career.level += 1;
      events.push({ kind: 'promoted', careerId: life.career.id, level: life.career.level });
    }
  }
  if (tally.focusActions.includes('jobHunt')) {
    const success = rng.chance(jobHuntChance(content, perks));
    if (success) life.salaryModPct += rules.jobHuntRaisePct;
    events.push({ kind: 'jobHunt', success });
  }

  const kept = [];
  for (const owned of life.items) {
    if (owned.roundsLeft !== null) {
      // An experience fades.
      if (owned.roundsLeft > 1) kept.push({ ...owned, roundsLeft: owned.roundsLeft - 1 });
      continue;
    }
    // A durable's resale value moves by its own drift, on top of the general rise in prices.
    const drifted = mulDiv(owned.value, BP + itemOf(content, owned.itemId).resaleDriftBp, BP);
    kept.push({ ...owned, value: mulDiv(drifted, after.priceLevel, now.priceLevel), age: owned.age + 1 });
  }
  life.items = kept;

  life.recurring = life.recurring
    .filter((entry) => entry.roundsLeft === null || entry.roundsLeft > 1)
    .map((entry) => (entry.roundsLeft === null ? entry : { ...entry, roundsLeft: entry.roundsLeft - 1 }));
  life.children = life.children.filter((left) => left > 1).map((left) => left - 1);

  if (Object.keys(p.positions).length > 0 || p.pension > 0) {
    life.investedRounds += 1;
    if (life.investedRounds === rules.financeExperienceRounds && life.financeSkill < 2) {
      life.financeSkill = (life.financeSkill + 1) as FinanceSkill;
      events.push({ kind: 'financeSkill', level: life.financeSkill });
    }
  }
}

/**
 * Turns the page on a round: a pending move happens, and focus and this round's pay boost reset.
 * A move ends the memberships that belong to the city left behind.
 */
export function turnPage(p: PlayerState, content: Content, events: GameEvent[]): void {
  const life = p.life;
  if (life.partnerSettling > 0) life.partnerSettling -= 1;
  if (life.movingTo !== null) {
    p.cityId = life.movingTo;
    life.movingTo = null;
    const landing = landingOf(p, content, life.movingTransfer);
    life.movingTransfer = false;
    if (life.career) life.career.level = landing.level ?? life.career.level;
    life.partnerSettling = landing.partnerSettling;
    events.push({ kind: 'moved', cityId: p.cityId, rungsLost: landing.rungsLost, partnerIdle: landing.partnerSettling > 0 });
    const lapsed = lapsingIn(content, p, p.cityId);
    life.items = life.items.filter((owned) => !lapsed.includes(owned.itemId));
    for (const itemId of lapsed) events.push({ kind: 'lapsed', itemId });
  }
  life.focusUsed = 0;
  // A rest taken shows in the round after: counted now, from what is still held once the old round has closed.
  life.focusBonus = focusBonusOf(p, content);
  life.salaryBoostPct = 0;
}
