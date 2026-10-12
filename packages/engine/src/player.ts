import type { PlayerState, StartConfig } from './types';

export function newId(p: PlayerState, prefix: string): string {
  p.nextId += 1;
  return `${prefix}-${p.nextId}`;
}

export function newPlayer(start: StartConfig): PlayerState {
  const p: PlayerState = {
    cityId: start.cityId,
    cash: start.cash,
    deposit: 0,
    pension: 0,
    positions: {},
    properties: [],
    debts: [],
    salaryAnnual: start.salaryAnnual,
    lifestyleTier: start.lifestyleTier,
    extraExpensesAnnual: 0,
    extraPassiveAnnual: 0,
    statusPoints: 0,
    nextId: 0,
    passiveStreak: 0,
    escapedAtRound: null,
    bankruptUntilRound: 0,
  };
  for (const debt of start.debts) p.debts.push({ id: newId(p, 'debt'), ...debt });
  return p;
}
