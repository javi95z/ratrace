import type { AssetDef, MarketParams } from '@ratrace/engine';

/**
 * Twenty assets. Returns are per round of two years, in basis points.
 * Every equity shares the class mean of the regime; beta scales how hard the class shock hits,
 * drift sets the long-run difference between archetypes, and yield is paid out as taxable income.
 *
 * Finance skill: funds need none, bonds, gold and single stocks need 1, crypto needs 2 (spec 3.6).
 */
export const assets: AssetDef[] = [
  // Government bonds: coupon follows the policy rate; price falls when rates rise.
  // Bills are paid back within the round: the rate of the day, a little under it, and a price that never moves.
  { id: 'treasury_bills', class: 'bond', betaPct: 100, idioVolBp: 0, yieldBp: 0, durationYears: 0, yieldSpreadBp: -25 },
  { id: 'treasury_short', class: 'bond', betaPct: 100, idioVolBp: 0, yieldBp: 0, durationYears: 2, yieldSpreadBp: 0 },
  { id: 'treasury_long', class: 'bond', betaPct: 100, idioVolBp: 100, yieldBp: 0, durationYears: 9, yieldSpreadBp: 80 },
  { id: 'bund', class: 'bond', betaPct: 100, idioVolBp: 100, yieldBp: 0, durationYears: 7, yieldSpreadBp: -50 },

  // Index funds.
  { id: 'sp500', class: 'equity', betaPct: 100, idioVolBp: 300, yieldBp: 140, driftBp: 100 },
  { id: 'msci_world', class: 'equity', betaPct: 95, idioVolBp: 250, yieldBp: 180 },
  // Rent without a landlord's worries: property companies that pay most of it out, and swing with the market.
  { id: 'reit', class: 'equity', betaPct: 110, idioVolBp: 700, yieldBp: 380, driftBp: -100 },
  // Small companies: more to gain in a boom, more to lose in a recession.
  { id: 'small_caps', class: 'equity', betaPct: 130, idioVolBp: 900, yieldBp: 120, driftBp: 150 },

  // Growth.
  { id: 'apple', class: 'equity', betaPct: 115, idioVolBp: 1_500, yieldBp: 50, driftBp: 150 },
  { id: 'microsoft', class: 'equity', betaPct: 105, idioVolBp: 1_300, yieldBp: 80, driftBp: 150 },
  { id: 'nvidia', class: 'equity', betaPct: 170, idioVolBp: 3_000, yieldBp: 0, driftBp: 300 },
  { id: 'amazon', class: 'equity', betaPct: 135, idioVolBp: 2_000, yieldBp: 0, driftBp: 150 },
  // Meme: wild, no income, and it can lose nine tenths in a round.
  { id: 'tesla', class: 'equity', betaPct: 190, idioVolBp: 3_800, yieldBp: 0, driftBp: 300, crashChancePct: 2 },
  // Cyclical.
  { id: 'inditex', class: 'equity', betaPct: 110, idioVolBp: 1_500, yieldBp: 300, driftBp: -150 },
  { id: 'lvmh', class: 'equity', betaPct: 120, idioVolBp: 1_600, yieldBp: 180 },
  { id: 'ferrari', class: 'equity', betaPct: 100, idioVolBp: 1_500, yieldBp: 80, driftBp: 150 },
  // Dividend.
  { id: 'santander', class: 'equity', betaPct: 140, idioVolBp: 2_000, yieldBp: 500, driftBp: -600 },
  // Defensive.
  { id: 'coca_cola', class: 'equity', betaPct: 55, idioVolBp: 800, yieldBp: 320, driftBp: -250 },

  // Crypto follows its own cycle.
  { id: 'bitcoin', class: 'crypto', betaPct: 100, idioVolBp: 1_500, yieldBp: 0, minFinanceSkill: 2 },
  { id: 'ethereum', class: 'crypto', betaPct: 125, idioVolBp: 2_200, yieldBp: 0, minFinanceSkill: 2 },
  { id: 'dogecoin', class: 'crypto', betaPct: 160, idioVolBp: 3_500, yieldBp: 0, crashChancePct: 8, minFinanceSkill: 2 },

  { id: 'gold', class: 'gold', betaPct: 100, idioVolBp: 600, yieldBp: 0, minFinanceSkill: 1 },
];

export const market: MarketParams = {
  regimeTransitions: {
    // About one round in eight is a recession, close to the share of the years since the war.
    expansion: [['expansion', 47], ['boom', 25], ['slowdown', 25], ['recession', 3]],
    boom: [['boom', 25], ['slowdown', 55], ['recession', 15], ['expansion', 5]],
    slowdown: [['recession', 28], ['expansion', 47], ['slowdown', 25]],
    recession: [['recovery', 75], ['recession', 25]],
    recovery: [['expansion', 65], ['boom', 15], ['recovery', 20]],
  },
  cryptoTransitions: {
    accumulation: [['accumulation', 40], ['bull', 55], ['winter', 5]],
    bull: [['mania', 45], ['bull', 30], ['winter', 25]],
    mania: [['winter', 75], ['mania', 15], ['bull', 10]],
    winter: [['accumulation', 60], ['winter', 40]],
  },
  equityMeanBp: { expansion: 1_400, boom: 2_400, slowdown: 300, recession: -2_200, recovery: 1_800 },
  // A winter takes more than half, as the real ones did, but the cycle climbs: held through it, coins
  // gain a few percent a year with wild swings, and enormously for whoever times it.
  cryptoMeanBp: { accumulation: 2_500, bull: 10_000, mania: 20_000, winter: -5_500 },
  goldMeanBp: { expansion: 300, boom: 0, slowdown: 600, recession: 1_400, recovery: 200 },
  classVolBp: { equity: 1_400, crypto: 2_500, gold: 900 },
  rateDriftBp: { expansion: 50, boom: 100, slowdown: -25, recession: -150, recovery: -25 },
  rateNoiseBp: 40,
  inflationTargetBp: { expansion: 220, boom: 380, slowdown: 250, recession: 80, recovery: 180 },
  inflationNoiseBp: 80,
  depositSpreadBp: 150,
  recessionWinterChancePct: 40,
  start: { regime: 'expansion', cryptoPhase: 'accumulation', policyRateBp: 250, inflationBp: 220 },
};
