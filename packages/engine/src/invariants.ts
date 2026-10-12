import { isCount } from './checks';
import { stateHash } from './hash';
import { deriveExpenses, derivePassive, deriveSalary, deriveStatus } from './life/derive';
import { lifeBreaks } from './life/invariants';
import type { Content, GameState, GameView } from './types';
import { DEBT_KINDS } from './validate';


/**
 * Lists every broken rule. An empty list means the state is sound.
 * `applyRound` runs this on the state it is given and on the state it returns,
 * so a corrupt save or a bug in a system that writes to the player is caught at once.
 */
export function findInvariantBreaks(content: Content, state: GameState): string[] {
  return breaksOf(content, state, state);
}

/**
 * The same check for a view, which has no seed and no saved random stream, and whose timeline
 * stops at the current round. `previewRound` and `previewCard` run this on what they are given.
 */
export function findViewBreaks(content: Content, view: GameView): string[] {
  return breaksOf(content, view, null);
}

/** `whole` is the full game when there is one to check, and null when only a view is at hand. */
function breaksOf(content: Content, state: GameView, whole: GameState | null): string[] {
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
    ['statusSum', p.statusSum],
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
  const states = state.timeline.length;
  if (whole !== null) {
    if (states !== content.rounds + 1) breaks.push(`timeline has ${states} states, expected ${content.rounds + 1}`);
  } else if (states !== state.round + 1 && states !== content.rounds + 1) {
    breaks.push(`timeline has ${states} states, expected ${state.round + 1} or ${content.rounds + 1}`);
  }

  breaks.push(...lifeBreaks(content, state));
  if (whole !== null) {
    const saved: unknown = whole.rng.cards;
    const isStream = Array.isArray(saved) && saved.length === 4 && saved.every((x) => isCount(x) && x <= 0xffff_ffff);
    if (!isStream) breaks.push('rng.cards is not a saved random stream');
  }

  if (breaks.length === 0) {
    const derived: Array<[string, number, number]> = [
      ['salaryAnnual', p.salaryAnnual, deriveSalary(p, content)],
      ['extraExpensesAnnual', p.extraExpensesAnnual, deriveExpenses(p, content)],
      ['extraPassiveAnnual', p.extraPassiveAnnual, derivePassive(p)],
      ['statusPoints', p.statusPoints, deriveStatus(p, content)],
    ];
    for (const [name, value, expected] of derived) {
      if (value !== expected) breaks.push(`${name} is out of step with the life: ${value}, expected ${expected}`);
    }
  }

  return breaks;
}

function assertNone(state: GameView, find: () => string[]): void {
  let breaks: string[];
  try {
    breaks = find();
  } catch {
    throw new Error('invariant broken: the state is not a game state');
  }
  if (breaks.length > 0) {
    throw new Error(`invariant broken at round ${state.round} (state ${stateHash(state)}): ${breaks.join('; ')}`);
  }
}

export function assertInvariants(content: Content, state: GameState): void {
  assertNone(state, () => findInvariantBreaks(content, state));
}

export function assertViewInvariants(content: Content, view: GameView): void {
  assertNone(view, () => findViewBreaks(content, view));
}
