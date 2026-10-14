import { PRICE_LEVEL_START } from '../rates';
import { netWorth } from '../selectors';
import type { Condition, Content, GameLimits, PlayerState, SkillId, WorldState, WorldTrigger } from '../types';
import { homeOf } from './derive';
import { hasFlag } from './flags';
import { levelOfPoints } from './skills';

/** Where and when something is being decided. */
export interface Situation {
  content: Content;
  /** The world of the current round. */
  world: WorldState;
  round: number;
  /** What the game may not do; none when left out. */
  limits?: GameLimits;
}

/** True when every part of the condition holds for the player. No condition always holds. */
export function conditionHolds(when: Condition | undefined, p: PlayerState, at: Situation): boolean {
  if (when === undefined) return true;
  const { content, world, round } = at;
  const life = p.life;

  if (when.minRound !== undefined && round < when.minRound) return false;
  if (when.maxRound !== undefined && round > when.maxRound) return false;
  if (when.cities !== undefined && !when.cities.includes(p.cityId)) return false;
  if (when.notCities !== undefined && when.notCities.includes(p.cityId)) return false;

  const job = life.career;
  if (when.employed !== undefined && when.employed !== (job !== null)) return false;
  if (when.careers !== undefined && (job === null || !when.careers.includes(job.id))) return false;
  if (when.minLevel !== undefined && (job === null || job.level < when.minLevel)) return false;
  if (when.maxLevel !== undefined && (job === null || job.level > when.maxLevel)) return false;

  if (when.partner !== undefined && when.partner !== life.partner) return false;
  if (when.minChildren !== undefined && life.children.length < when.minChildren) return false;
  if (when.maxChildren !== undefined && life.children.length > when.maxChildren) return false;

  if (when.ownsHome !== undefined && when.ownsHome !== (homeOf(p, content) !== null)) return false;
  if (when.landlord !== undefined && when.landlord !== p.properties.some((x) => x.rented)) return false;
  if (when.hasBusiness !== undefined && when.hasBusiness !== p.businesses.length > 0) return false;
  if (when.hasMortgage !== undefined) {
    const mortgaged = p.debts.some((d) => d.kind === 'mortgageFixed' || d.kind === 'mortgageVariable');
    if (when.hasMortgage !== mortgaged) return false;
  }

  if (when.minNetWorth !== undefined || when.maxNetWorth !== undefined) {
    const real = Math.floor((netWorth(p) * PRICE_LEVEL_START) / world.priceLevel);
    if (when.minNetWorth !== undefined && real < when.minNetWorth) return false;
    if (when.maxNetWorth !== undefined && real > when.maxNetWorth) return false;
  }
  if (when.minFinanceSkill !== undefined && life.financeSkill < when.minFinanceSkill) return false;
  if (when.maxFinanceSkill !== undefined && life.financeSkill > when.maxFinanceSkill) return false;
  if (when.minSkills !== undefined) {
    for (const [skill, level] of Object.entries(when.minSkills) as Array<[SkillId, number]>) {
      if (levelOfPoints(life.skills[skill], content) < level) return false;
    }
  }

  if (when.flags !== undefined && !when.flags.every((flag) => hasFlag(life.flags, flag))) return false;
  if (when.notFlags !== undefined && when.notFlags.some((flag) => hasFlag(life.flags, flag))) return false;

  if (when.holds !== undefined) {
    const kind = when.holds;
    const held =
      kind === 'deposit'
        ? p.deposit > 0
        : content.assets.some((asset) => asset.class === kind && Object.hasOwn(p.positions, asset.id));
    if (!held) return false;
  }
  if (when.ownsLadder !== undefined) {
    const ladder = when.ownsLadder;
    const owned = life.items.some((x) => content.items.some((item) => item.id === x.itemId && item.ladder === ladder));
    if (!owned) return false;
  }
  if (when.lacksLadder !== undefined) {
    const ladder = when.lacksLadder;
    if (life.items.some((x) => content.items.some((item) => item.id === x.itemId && item.ladder === ladder))) return false;
  }
  if (when.notItems !== undefined && life.items.some((x) => when.notItems?.includes(x.itemId))) return false;
  if (when.insured !== undefined && !life.insurance[when.insured]) return false;

  if (when.regimes !== undefined && !when.regimes.includes(world.regime)) return false;
  if (when.cityPropertyReturnAtMostBp !== undefined) {
    if ((world.propertyReturnBp[p.cityId] ?? 0) > when.cityPropertyReturnAtMostBp) return false;
  }
  return true;
}

/**
 * True when every part of the trigger holds between the previous world state and this one.
 * A world card with no trigger never appears.
 */
export function triggerHolds(trigger: WorldTrigger | undefined, prev: WorldState, now: WorldState): boolean {
  if (trigger === undefined) return false;
  if (trigger.regimeBegan !== undefined) {
    if (now.regime === prev.regime || !trigger.regimeBegan.includes(now.regime)) return false;
  }
  if (trigger.regimes !== undefined && !trigger.regimes.includes(now.regime)) return false;
  if (trigger.cryptoBegan !== undefined) {
    if (now.cryptoPhase === prev.cryptoPhase || !trigger.cryptoBegan.includes(now.cryptoPhase)) return false;
  }
  const rateChange = now.policyRateBp - prev.policyRateBp;
  if (trigger.rateChangeAtLeastBp !== undefined && rateChange < trigger.rateChangeAtLeastBp) return false;
  if (trigger.rateChangeAtMostBp !== undefined && rateChange > trigger.rateChangeAtMostBp) return false;
  if (trigger.inflationAtLeastBp !== undefined && now.inflationBp < trigger.inflationAtLeastBp) return false;
  if (trigger.anyPropertyReturnAtMostBp !== undefined) {
    const limit = trigger.anyPropertyReturnAtMostBp;
    if (!Object.values(now.propertyReturnBp).some((ret) => ret <= limit)) return false;
  }
  if (trigger.taxReform !== undefined) {
    const reformed = Object.keys(now.taxShiftBp).some((cityId) => now.taxShiftBp[cityId] !== prev.taxShiftBp[cityId]);
    if (trigger.taxReform !== reformed) return false;
  }
  if (trigger.crisis !== undefined) {
    if (now.crisis === null || now.crisis.id !== trigger.crisis.id || now.crisis.year !== trigger.crisis.year) return false;
  }
  return true;
}
