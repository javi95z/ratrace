import { stateHash } from './hash';
import type { Content, GameState } from './types';
import { DEBT_KINDS } from './validate';

const isCount = (x: unknown): boolean => typeof x === 'number' && Number.isInteger(x) && x >= 0 && !Object.is(x, -0);

/**
 * Lists every broken rule. An empty list means the state is sound.
 * `applyRound` runs this on the state it is given and on the state it returns,
 * so a corrupt save or a bug in a system that writes to the player is caught at once.
 */
export function findInvariantBreaks(content: Content, state: GameState): string[] {
  const p = state.player;
  const breaks: string[] = [];

  const money: Array<[string, number]> = [
    ['cash', p.cash],
    ['deposit', p.deposit],
    ['pension', p.pension],
  ];
  for (const [id, held] of Object.entries(p.positions)) {
    money.push([`position ${id} value`, held.value], [`position ${id} basis`, held.basis]);
  }
  for (const property of p.properties) {
    money.push([`property ${property.id} value`, property.value], [`property ${property.id} basis`, property.basis]);
  }
  for (const debt of p.debts) money.push([`debt ${debt.id} principal`, debt.principal]);

  for (const [name, value] of money) {
    if (!isCount(value)) breaks.push(`${name} is not a non-negative whole number: ${value}`);
  }
  for (const debt of p.debts) {
    if (debt.principal === 0) breaks.push(`debt ${debt.id} is fully paid but still listed`);
  }
  for (const [id, held] of Object.entries(p.positions)) {
    if (held.value === 0) breaks.push(`position ${id} is empty but still listed`);
    if (!content.assets.some((a) => a.id === id)) breaks.push(`position ${id} is not a known asset`);
  }
  for (const property of p.properties) {
    if (property.mortgageId !== null && !p.debts.some((d) => d.id === property.mortgageId)) {
      breaks.push(`property ${property.id} points at a missing mortgage`);
    }
  }
  if (!Number.isInteger(state.round) || state.round < 0 || state.round > content.rounds) {
    breaks.push(`round ${state.round} is out of range`);
  }
  if (state.finished !== (state.round >= content.rounds)) breaks.push('finished flag does not match the round');

  if (![0, 1, 2, 3].includes(p.lifestyleTier)) breaks.push(`lifestyleTier is not 0, 1, 2 or 3: ${p.lifestyleTier}`);
  if (!content.cities.some((city) => city.id === p.cityId)) breaks.push(`city ${p.cityId} is not in the content`);
  const counts: Array<[string, number]> = [
    ['salaryAnnual', p.salaryAnnual],
    ['extraExpensesAnnual', p.extraExpensesAnnual],
    ['extraPassiveAnnual', p.extraPassiveAnnual],
    ['statusPoints', p.statusPoints],
    ['nextId', p.nextId],
    ['passiveStreak', p.passiveStreak],
    ['bankruptUntilRound', p.bankruptUntilRound],
  ];
  for (const [name, value] of counts) {
    if (!isCount(value)) breaks.push(`${name} is not a non-negative whole number: ${value}`);
  }
  if (p.escapedAtRound !== null && (!isCount(p.escapedAtRound) || p.escapedAtRound > content.rounds)) {
    breaks.push(`escapedAtRound is neither null nor a round number: ${p.escapedAtRound}`);
  }
  for (const debt of p.debts) {
    if (!DEBT_KINDS.includes(debt.kind)) breaks.push(`debt ${debt.id} has an unknown kind`);
    if (!isCount(debt.roundsLeft)) breaks.push(`debt ${debt.id} roundsLeft is not a non-negative whole number: ${debt.roundsLeft}`);
  }
  for (const property of p.properties) {
    if (!content.cities.some((city) => city.id === property.cityId)) breaks.push(`property ${property.id} is in an unknown city`);
    if (!content.propertyTypes.some((type) => type.id === property.typeId)) breaks.push(`property ${property.id} has an unknown type`);
  }
  if (state.timeline.length !== content.rounds + 1) {
    breaks.push(`timeline has ${state.timeline.length} states, expected ${content.rounds + 1}`);
  }

  return breaks;
}

export function assertInvariants(content: Content, state: GameState): void {
  let breaks: string[];
  try {
    breaks = findInvariantBreaks(content, state);
  } catch {
    throw new Error('invariant broken: the state is not a game state');
  }
  if (breaks.length > 0) {
    throw new Error(`invariant broken at round ${state.round} (state ${stateHash(state)}): ${breaks.join('; ')}`);
  }
}
