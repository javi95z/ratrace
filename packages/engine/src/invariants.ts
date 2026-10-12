import { stateHash } from './hash';
import type { Content, GameState } from './types';

/** Lists every broken rule. An empty list means the state is sound. */
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
    if (!Number.isInteger(value) || value < 0 || Object.is(value, -0)) {
      breaks.push(`${name} is not a non-negative whole number: ${value}`);
    }
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

  return breaks;
}

export function assertInvariants(content: Content, state: GameState): void {
  const breaks = findInvariantBreaks(content, state);
  if (breaks.length > 0) {
    throw new Error(`invariant broken at round ${state.round} (state ${stateHash(state)}): ${breaks.join('; ')}`);
  }
}
