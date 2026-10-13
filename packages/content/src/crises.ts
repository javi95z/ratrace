import type { CrisisDef } from '@ratrace/engine';

/**
 * Three crises with a name. A game has at most one, and most games have none (see `world.crisisChancePct`).
 *
 * Each lasts a few rounds in a row. A round of a crisis first changes the world the player wakes
 * up in (the regime, rates, inflation), and then weighs on what that round's investments return.
 * The last round of each is the way out, so a player who holds through it gets some of it back:
 * a crisis punishes panic and debt, not patience.
 */
export const crises: CrisisDef[] = [
  {
    // Markets fall hard and at once, homes follow, and central banks cut. Then the rebound.
    id: 'crash',
    weight: 40,
    phases: [
      { regime: 'recession', cryptoPhase: 'winter', rateBp: -100, equityBp: -1_500, propertyBp: -600 },
      { regime: 'recession', rateBp: -100, equityBp: -600, propertyBp: -500 },
      { regime: 'recovery', equityBp: 900 },
    ],
  },
  {
    // Prices run away and rates chase them: cash and bonds melt, gold shines, growth stalls.
    id: 'energy',
    weight: 35,
    phases: [
      { regime: 'slowdown', inflationBp: 350, rateBp: 100, equityBp: -500, goldBp: 700 },
      { regime: 'slowdown', inflationBp: 250, rateBp: 100, equityBp: -400, goldBp: 500, propertyBp: -300 },
      { regime: 'recovery', inflationBp: -100, goldBp: -300 },
    ],
  },
  {
    // Lenders stop trusting governments: borrowing costs jump, and whatever was bought on credit falls.
    id: 'debt',
    weight: 25,
    phases: [
      { regime: 'recession', rateBp: 200, equityBp: -700, propertyBp: -700 },
      { regime: 'slowdown', rateBp: 100, equityBp: -200, propertyBp: -500 },
    ],
  },
];
