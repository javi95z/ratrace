import { careerOf, itemOf } from '../lookup';
import { BP, mulDiv } from '../money';
import type { Rng } from '../rng';
import type { Content, GameEvent, ItemPerks, PlayerState, RoundTally, WorldState } from '../types';
import { focusBonusOf, perksOf } from './derive';
import { lapsingIn } from './orders';
import { addFinancePoints, addSkillPoints, learnSkills, skillLevel } from './skills';

/**
 * What a move costs beyond its price, as the player lands. Moved by their own choice they start a
 * rung or so down, where nobody knows them yet, and a partner is without pay while they look for
 * work; the rung comes back with the next promotion if the experience is there. A transfer costs
 * none of it. The order and the quote both ask here.
 */
export function landingOf(p: PlayerState, content: Content, transfer: boolean): { level: number | null; rungsLost: number; partnerSettling: number } {
  const job = p.life.career;
  if (transfer) return { level: job ? job.level : null, rungsLost: 0, partnerSettling: p.life.partnerSettling };
  // Someone who speaks the language is known for what they can do from the first day, and their partner too.
  const languages = skillLevel(p, 'languages', content);
  const rules = content.life.skills;
  const lost = languages >= rules.languagesKeepRungFrom ? 0 : content.life.moveRungsLost;
  const level = job ? Math.max(0, job.level - lost) : null;
  return {
    level,
    rungsLost: job && level !== null ? job.level - level : 0,
    partnerSettling: p.life.partner && languages < rules.languagesPartnerFrom ? Math.max(p.life.partnerSettling, content.life.partnerSettlingRounds) : p.life.partnerSettling,
  };
}

/**
 * The chance in percent that a job hunt ends in a raise: the rule's own, what the player's things
 * add, and who they know, less what each failed hunt just before it took. Failing again and again
 * says something to the next interviewer too, down to a floor.
 */
export function jobHuntChance(content: Content, perks: Required<ItemPerks>, p: PlayerState): number {
  const full = Math.min(100, content.life.jobHuntChancePct + perks.jobHuntPct + skillLevel(p, 'network', content) * content.life.skills.networkHuntPct);
  const limits = content.life.focusLimits;
  return Math.max(Math.min(full, limits.huntFloorPct), full - p.life.huntMisses * limits.huntMissPct);
}

/**
 * What overtime would do to the body if it is worked this round: the rounds in a row it would make,
 * the health it would cost, and the chance it ends in burnout.
 */
export function overtimeToll(p: PlayerState, content: Content): { streak: number; healthPoints: number; burnoutChancePct: number } {
  const limits = content.life.focusLimits;
  const streak = p.life.overtimeStreak + 1;
  return {
    streak,
    healthPoints: streak >= limits.overtimeTiredFrom ? limits.overtimeHealthPoints : 0,
    burnoutChancePct: streak >= limits.overtimeBurnoutFrom ? limits.burnoutChancePct : 0,
  };
}

/** Career skill a round of study adds now: the rule's and the player's things', up to what is left of the rung's share. */
export function careerStudyOf(p: PlayerState, content: Content, perks: Required<ItemPerks>): number {
  return Math.max(0, Math.min(content.life.studySkill + perks.studySkill, content.life.focusLimits.studyPerRung - p.life.rungStudy));
}

/** The lasting raise a successful job hunt brings, in percent: more for someone who can ask for it. */
export function jobHuntRaise(content: Content, p: PlayerState): number {
  return content.life.jobHuntRaisePct + skillLevel(p, 'negotiation', content) * content.life.skills.negotiationHuntRaisePct;
}

/** What a promotion adds to pay on top of the rung, in percent, for someone who negotiates it. */
export function promotionRaise(content: Content, p: PlayerState): number {
  return skillLevel(p, 'negotiation', content) * content.life.skills.negotiationPromotionPct;
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
  const limits = rules.focusLimits;
  const perks = perksOf(p, content);
  // A burnout's toll was this round's, and a rest after a job hunt counts down with it.
  life.focusLost = 0;
  if (life.huntRest > 0) life.huntRest -= 1;

  if (life.career !== null) {
    // What the player owns counts as it stood while the round was lived: before anything fades or lapses.
    const studied = tally.focusActions.includes('studyCareer') ? careerStudyOf(p, content, perks) : 0;
    life.careerSkill += rules.workSkill + studied;
    life.rungStudy += studied;
    const next = careerOf(content, life.career.id).levels[life.career.level + 1];
    if (next !== undefined && life.careerSkill >= next.minSkill) {
      life.career.level += 1;
      life.rungStudy = 0;
      life.salaryModPct += promotionRaise(content, p);
      events.push({ kind: 'promoted', careerId: life.career.id, level: life.career.level });
    }
  }
  if (tally.focusActions.includes('jobHunt')) {
    const success = rng.chance(jobHuntChance(content, perks, p));
    if (success) {
      life.salaryModPct += jobHuntRaise(content, p);
      life.huntMisses = 0;
      life.huntRest = limits.huntRestRounds;
    } else {
      life.huntMisses += 1;
    }
    events.push({ kind: 'jobHunt', success });
  } else {
    // A round without looking and the next search starts afresh.
    life.huntMisses = 0;
  }

  if (tally.focusActions.includes('overtime')) {
    const toll = overtimeToll(p, content);
    life.overtimeStreak = toll.streak;
    // The dice are thrown only from the round burnout is possible, so a life that never gets there draws the same numbers as before.
    const burnout = toll.burnoutChancePct > 0 && rng.chance(toll.burnoutChancePct);
    const healthLost = Math.min(life.skills.health, toll.healthPoints + (burnout ? limits.burnoutHealthPoints : 0));
    if (healthLost > 0) addSkillPoints(p, content, { health: -healthLost }, events);
    if (burnout) {
      life.focusLost = limits.burnoutFocus;
      life.overtimeStreak = 0;
    }
    if (toll.healthPoints > 0 || burnout) events.push({ kind: 'overworked', streak: toll.streak, healthLost, burnout, focusLost: burnout ? limits.burnoutFocus : 0 });
  } else {
    life.overtimeStreak = 0;
  }

  learnSkills(p, content, tally, events);

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

  // Money sense is learnt like any skill, by a round of living it: with money at work.
  if (Object.keys(p.positions).length > 0 || p.pension > 0) {
    life.investedRounds += 1;
    addFinancePoints(p, content, rules.skills.investingPoints, events);
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
  for (const business of p.businesses) business.tended = false;
  // A rest taken shows in the round after: counted now, from what is still held once the old round has closed.
  life.focusBonus = focusBonusOf(p, content);
  life.salaryBoostPct = 0;
}
