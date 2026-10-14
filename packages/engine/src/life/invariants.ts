import { isCount, isRecurring, isWhole } from '../checks';
import { SKILLS } from '../types';
import type { Content, GameView } from '../types';
import { INSURANCE_KINDS } from './derive';

/** Every broken rule about the player's life, the hand and the phase. */
export function lifeBreaks(content: Content, state: GameView): string[] {
  const p = state.player;
  const life = p.life;
  const breaks: string[] = [];

  if (life.career !== null) {
    const career = content.careers.find((c) => c.id === life.career?.id);
    if (!career) breaks.push(`life.career is not a known career: ${life.career.id}`);
    else if (!isCount(life.career.level) || life.career.level >= career.levels.length) {
      breaks.push(`life.career level ${life.career.level} does not exist in ${career.id}`);
    }
  }

  const counts = ['baseSalaryAnnual', 'careerSkill', 'investedRounds', 'financePoints', 'focusBase', 'focusBonus', 'focusUsed', 'partnerSettling', 'partnerSalaryPct', 'legacy'] as const;
  for (const field of counts) {
    if (!isCount(life[field])) breaks.push(`life.${field} is not a non-negative whole number: ${life[field]}`);
  }
  for (const field of ['salaryModPct', 'salaryBoostPct', 'bonusStatus'] as const) {
    if (!isWhole(life[field])) breaks.push(`life.${field} is not a whole number: ${life[field]}`);
  }
  if (![0, 1, 2, 3].includes(life.financeSkill)) breaks.push(`life.financeSkill is not 0, 1, 2 or 3: ${life.financeSkill}`);
  if (typeof life.skills !== 'object' || life.skills === null) breaks.push('life.skills is not a record');
  else {
    for (const skill of SKILLS) {
      if (!isCount(life.skills[skill])) breaks.push(`life.skills.${skill} is not a non-negative whole number: ${life.skills[skill]}`);
    }
  }
  const evasion = life.evasion;
  if (typeof evasion !== 'object' || evasion === null) breaks.push('life.evasion is not a record');
  else {
    if (!content.evasion.blackPcts.includes(evasion.blackPct)) breaks.push(`life.evasion.blackPct is not a share the rules allow: ${evasion.blackPct}`);
    if (typeof evasion.shell !== 'boolean' || typeof evasion.hideCrypto !== 'boolean') breaks.push('life.evasion needs shell and hideCrypto to be true or false');
    if (!(isCount(evasion.suspicion) && evasion.suspicion <= 100)) breaks.push(`life.evasion.suspicion is not a whole number from 0 to 100: ${evasion.suspicion}`);
    if (!Array.isArray(evasion.evaded) || evasion.evaded.some((entry) => !isCount(entry.round) || !isCount(entry.amount) || entry.amount === 0)) breaks.push('life.evasion.evaded holds something other than rounds and positive amounts');
  }
  if (!content.cities.some((city) => city.id === life.homeCityId)) breaks.push(`life.homeCityId is not a known city: ${life.homeCityId}`);
  if (life.rentTier !== 0 && life.rentTier !== 1) breaks.push(`life.rentTier is not 0 or 1: ${life.rentTier}`);
  if (![0, 1, 2, 3].includes(life.minLifestyleTier)) {
    breaks.push(`life.minLifestyleTier is not 0, 1, 2 or 3: ${life.minLifestyleTier}`);
  } else if (p.lifestyleTier < life.minLifestyleTier) {
    breaks.push(`lifestyleTier ${p.lifestyleTier} is below the floor of the life, ${life.minLifestyleTier}`);
  }

  if (typeof life.partner !== 'boolean') breaks.push('life.partner is not true or false');
  if (!Array.isArray(life.children)) breaks.push('life.children is not a list');
  else {
    for (const left of life.children) {
      if (!(isCount(left) && left >= 1)) breaks.push(`life.children holds something other than rounds left: ${left}`);
    }
  }
  for (const kind of INSURANCE_KINDS) {
    if (typeof life.insurance[kind] !== 'boolean') breaks.push(`life.insurance.${kind} is not true or false`);
  }
  // Health cover has the round it was taken out in, and only health cover held has one.
  if (life.insurance.health === true ? !isCount(life.healthCoverSince) : life.insurance.health === false && life.healthCoverSince !== null) breaks.push(`life.healthCoverSince does not match the health cover: ${life.healthCoverSince}`);
  if (life.retiredAtRound !== null && !isCount(life.retiredAtRound)) breaks.push(`life.retiredAtRound is not a round: ${life.retiredAtRound}`);

  const owned = new Set<string>();
  for (const held of life.items) {
    const item = content.items.find((i) => i.id === held.itemId);
    if (!item) {
      breaks.push(`item ${held.itemId} is not in the content`);
      continue;
    }
    if (owned.has(item.id)) {
      breaks.push(`item ${item.id} is owned twice`);
      continue;
    }
    if (held.used !== undefined && typeof held.used !== 'boolean') breaks.push(`item ${item.id} has a used mark that is not true or false`);
    if (held.used === true && (item.kind !== 'durable' || content.life.used[item.ladder] === undefined)) breaks.push(`item ${item.id} is marked used, and nothing of its kind is sold second hand`);
    if (held.noInvoice !== undefined && (held.noInvoice !== true || !content.evasion.noInvoiceLadders.includes(item.ladder))) breaks.push(`item ${item.id} is marked bought without an invoice, and it is not sold that way`);
    owned.add(item.id);
    if (!isCount(held.age)) breaks.push(`item ${item.id} has an age that is not a non-negative whole number: ${held.age}`);
    if (!isCount(held.paid)) breaks.push(`item ${item.id} was paid for with something that is not a non-negative whole number: ${held.paid}`);
    if (!isCount(held.value)) breaks.push(`item ${item.id} value is not a non-negative whole number: ${held.value}`);
    else {
      const shaped =
        item.kind === 'durable'
          ? held.roundsLeft === null
          : item.kind === 'membership'
            ? held.roundsLeft === null && held.value === 0
            : isCount(held.roundsLeft) && held.roundsLeft >= 1 && held.value === 0;
      if (!shaped) breaks.push(`item ${item.id} has the wrong shape for ${item.kind === 'experience' ? 'an' : 'a'} ${item.kind}`);
    }
    if (!life.collection.includes(item.id)) breaks.push(`item ${item.id} is owned but not in the collection`);
  }
  for (const id of life.collection) {
    if (!content.items.some((i) => i.id === id)) breaks.push(`collection holds an unknown item: ${id}`);
  }

  const tags = new Set<string>();
  life.recurring.forEach((entry, i) => {
    const valid = isRecurring(entry);
    if (!valid) breaks.push(`life.recurring entry ${i} is not valid`);
    else if (tags.has(entry.tag)) breaks.push(`life.recurring has two entries tagged ${entry.tag}`);
    tags.add(entry.tag);
  });
  for (const [flag, round] of Object.entries(life.flags)) {
    if (!isCount(round)) breaks.push(`life.flags.${flag} is not a round number: ${round}`);
  }
  for (const [cardId, round] of Object.entries(life.seen)) {
    if (!content.cards.some((card) => card.id === cardId)) breaks.push(`life.seen names an unknown card: ${cardId}`);
    else if (!isCount(round)) breaks.push(`life.seen.${cardId} is not a round number: ${round}`);
  }

  if (life.movingTo !== null) {
    if (!content.cities.some((city) => city.id === life.movingTo)) breaks.push(`life.movingTo is not a known city: ${life.movingTo}`);
    else if (life.movingTo === p.cityId) breaks.push('life.movingTo is the city the player already lives in');
  }

  if (state.phase !== 'cards' && state.phase !== 'finance') breaks.push(`phase is neither cards nor finance: ${state.phase}`);
  if (!Array.isArray(state.hand)) breaks.push('hand is not a list');
  else {
    const inHand = new Set<string>();
    for (const cardId of state.hand) {
      if (!content.cards.some((card) => card.id === cardId)) breaks.push(`hand holds an unknown card: ${cardId}`);
      else if (inHand.has(cardId)) breaks.push(`hand holds ${cardId} twice`);
      inHand.add(cardId);
    }
    const answered: unknown = state.answered;
    if (state.finished === true && state.hand.length > 0) breaks.push('the game is finished but a hand is still drawn');
    else if (state.phase === 'cards' && state.hand.length === 0) breaks.push('phase is cards but the hand is empty');
    else if (!isCount(answered) || answered > state.hand.length) breaks.push(`answered is ${String(answered)} but the hand holds ${state.hand.length} cards`);
    else if (state.phase === 'cards' && answered === state.hand.length) breaks.push('phase is cards but every card is answered');
    else if (state.phase === 'finance' && answered < state.hand.length) breaks.push('phase is finance but a card is still unanswered');
  }

  return breaks;
}
