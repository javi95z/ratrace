import type { Cents } from './money';
import type { PlayerState } from './types';

/** Everything the player owns outside the pension, at full value. Status items count at what they would sell for. */
export function ownedOutsidePension(p: PlayerState): Cents {
  let owned = p.cash + p.deposit;
  for (const held of Object.values(p.positions)) owned += held.value;
  for (const property of p.properties) owned += property.value;
  for (const item of p.life.items) owned += item.value;
  return owned;
}

export function totalOwed(p: PlayerState): Cents {
  let owed = 0;
  for (const debt of p.debts) owed += debt.principal;
  return owed;
}
