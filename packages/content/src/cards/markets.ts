import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

export const investingCards: CardDef[] = [
  card('inv_hot_tip', 'investing', {}, [
    {},
    { effects: { invest: { assetId: 'tesla', amount: usd(2_000) } } },
    { effects: { invest: { assetId: 'tesla', amount: usd(10_000) } } },
  ]),
  card('inv_share_plan', 'investing', { cooldown: 5, when: { employed: true, flags: ['share_plan'] } }, [
    {},
    { effects: { invest: { assetId: 'microsoft', amount: usd(3_000), bonusPct: 15 } } },
    { effects: { invest: { assetId: 'microsoft', amount: usd(9_000), bonusPct: 15 } } },
  ]),
  card('inv_memecoin', 'investing', { when: { minRound: 1 } }, [
    {},
    { effects: { invest: { assetId: 'dogecoin', amount: usd(1_000) } } },
    { effects: { invest: { assetId: 'dogecoin', amount: usd(8_000) } } },
  ]),
  card('inv_friend_startup', 'investing', { cooldown: 6, when: { minRound: 2 } }, [
    {},
    {
      effects: { cash: usd(-5_000) },
      outcomes: [{ weight: 8, effects: { cash: usd(60_000) } }, { weight: 22, effects: { cash: usd(8_000) } }, { weight: 70, effects: {} }],
    },
    { effects: { focus: 1, careerSkill: 1, status: 1 } },
  ]),
  card('inv_ipo_hype', 'investing', { cooldown: 5, when: { regimes: ['expansion', 'boom'] } }, [
    {},
    {
      effects: { cash: usd(-4_000) },
      outcomes: [{ weight: 35, effects: { cash: usd(6_500) } }, { weight: 40, effects: { cash: usd(3_600) } }, { weight: 25, effects: { cash: usd(1_500) } }],
    },
  ]),
  card('inv_ponzi', 'investing', { once: true }, [
    {},
    { effects: { cash: usd(-3_000) }, outcomes: [{ weight: 35, effects: { cash: usd(4_500) } }, { weight: 65, effects: {} }] },
    { effects: { cash: usd(-20_000) }, outcomes: [{ weight: 20, effects: { cash: usd(30_000) } }, { weight: 80, effects: {} }] },
  ]),
  card('inv_exchange_freeze', 'investing', { cooldown: 8, when: { holds: 'crypto' } }, [
    { outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { lose: { what: 'crypto', pct: 40 } } }] },
    { effects: { lose: { what: 'crypto', pct: 10 } } },
  ]),
  card('inv_offplan_dubai', 'investing', { once: true, when: { minNetWorth: usd(80_000) } }, [
    {},
    {
      effects: { cash: usd(-30_000) },
      outcomes: [{ weight: 50, effects: { cash: usd(42_000) } }, { weight: 30, effects: { cash: usd(30_000) } }, { weight: 20, effects: { cash: usd(6_000) } }],
    },
  ]),
  card('inv_guru_course', 'investing', { once: true }, [
    {},
    { effects: { cash: usd(-2_500) }, outcomes: [{ weight: 20, effects: { financeSkill: 1 } }, { weight: 80, effects: {} }] },
  ]),
  card('inv_crowdfunding', 'investing', { cooldown: 6, when: { minFinanceSkill: 1 } }, [
    {},
    {
      effects: { cash: usd(-5_000), recurring: [yearly('crowdfunding', 'passive', 800, 4)] },
      outcomes: [{ weight: 85, effects: {} }, { weight: 15, effects: { endRecurring: ['crowdfunding'] } }],
    },
  ]),
];

export const taxCards: CardDef[] = [
  card('tax_advisor', 'tax', { cooldown: 5, when: { minRound: 2, notFlags: ['tax_advisor'] } }, [
    {},
    { effects: { cash: usd(-1_500), setFlags: ['tax_advisor'] }, outcomes: [{ weight: 60, effects: { cash: usd(2_500) } }, { weight: 40, effects: {} }] },
  ]),
  card('tax_pension_topup', 'tax', { when: { employed: true } }, [
    {},
    { effects: { cash: usd(-2_000), pension: usd(4_000) } },
    { effects: { cash: usd(-6_000), pension: usd(12_000) } },
  ]),
  card('tax_optimise', 'tax', {}, [
    {},
    { effects: { focus: 1, cashSalaryPct: 4 } },
  ]),
  card('tax_audit', 'tax', { weight: 6, cooldown: 6, when: { minRound: 3 } }, [
    { effects: { cashSalaryPct: -8, protection: { flag: 'tax_advisor', coverPct: 80 } } },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { cashSalaryPct: -12 } }] },
  ]),
  card('tax_undeclared', 'tax', { cooldown: 6 }, [
    { effects: { cash: usd(2_000) } },
    { outcomes: [{ weight: 75, effects: { cash: usd(4_500) } }, { weight: 25, effects: { cash: usd(-4_000) } }] },
  ]),
  card('tax_residency', 'tax', { once: true, when: { minNetWorth: usd(250_000), notCities: ['dubai'] } }, [
    {},
    { effects: { moveCity: 'dubai', cash: usd(-8_000) } },
    { effects: { cash: usd(-1_500), setFlags: ['tax_advisor'], financeSkill: 1 } },
  ]),
];

/** World cards appear when their trigger holds in the world, the same for every player. */
export const worldCards: CardDef[] = [
  card('world_recession', 'world', { weight: 100, cooldown: 3, trigger: { regimeBegan: ['recession'] } }, [
    {},
    { effects: { cash: usd(1_500), status: -2 } },
    { effects: { invest: { assetId: 'msci_world', amount: usd(5_000) } } },
  ]),
  card('world_rate_hike', 'world', { weight: 60, cooldown: 3, trigger: { rateChangeAtLeastBp: 75 } }, [
    {},
    { when: { hasMortgage: true }, effects: { cash: usd(-800), refinance: 'fixed' } },
    { effects: { invest: { assetId: 'treasury_short', amount: usd(5_000) } } },
  ]),
  card('world_rate_cut', 'world', { weight: 60, cooldown: 3, trigger: { rateChangeAtMostBp: -75 } }, [
    {},
    { when: { hasMortgage: true }, effects: { cash: usd(-800), refinance: 'variable' } },
    { effects: { loan: usd(10_000), invest: { assetId: 'sp500', amount: usd(10_000) } } },
  ]),
  card('world_inflation', 'world', { weight: 60, cooldown: 3, trigger: { inflationAtLeastBp: 450 } }, [
    {},
    { when: { employed: true }, effects: { focus: 1 }, outcomes: [{ weight: 55, effects: { salaryModPct: 4 } }, { weight: 45, effects: {} }] },
    { effects: { invest: { assetId: 'gold', amount: usd(4_000) } } },
  ]),
  card('world_crypto_bull', 'world', { weight: 80, cooldown: 3, trigger: { cryptoBegan: ['bull', 'mania'] } }, [
    {},
    { effects: { invest: { assetId: 'bitcoin', amount: usd(3_000) } } },
    { when: { maxFinanceSkill: 1 }, effects: { focus: 1, cash: usd(-500), financeSkill: 1 } },
  ]),
  card('world_crypto_winter', 'world', { weight: 80, cooldown: 3, trigger: { cryptoBegan: ['winter'] } }, [
    {},
    { effects: { invest: { assetId: 'bitcoin', amount: usd(3_000) } } },
  ]),
  card('world_housing_crash', 'world', { weight: 80, trigger: { anyPropertyReturnAtMostBp: -600 }, when: { cityPropertyReturnAtMostBp: -600 } }, [
    {},
    { effects: { property: { typeId: 'studio', pricePct: 85, downPct: 20, rented: false } } },
    { effects: { property: { typeId: 'studio', pricePct: 85, downPct: 25, rented: true } } },
  ]),
  card('world_tech_bubble', 'world', { weight: 80, trigger: { regimeBegan: ['boom'] } }, [
    {},
    { effects: { invest: { assetId: 'nvidia', amount: usd(5_000) } } },
  ]),
  card('world_ai_boom', 'world', { weight: 8, once: true, trigger: { regimes: ['expansion', 'boom'] } }, [
    {},
    { effects: { focus: 1, careerSkill: 2 } },
    { when: { careers: ['tech'] }, outcomes: [{ weight: 50, effects: { salaryModPct: 10 } }, { weight: 50, effects: {} }] },
  ]),
  card('world_pandemic', 'world', { weight: 12, once: true, trigger: { regimes: ['recession'] } }, [
    { effects: { salaryBoostPct: -10 } },
    { effects: { focus: 1, salaryBoostPct: -10, status: 3 } },
    { effects: { salaryBoostPct: -10, invest: { assetId: 'tesla', amount: usd(2_000) } } },
  ]),
  card('world_tax_reform', 'world', { weight: 100, cooldown: 2, trigger: { taxReform: true } }, [
    {},
    { when: { notFlags: ['tax_advisor'] }, effects: { cash: usd(-600), setFlags: ['tax_advisor'] } },
  ]),
  // A crisis deals a card of its own in each of its first two rounds. The weight leaves the quiet round no chance.
  card('crisis_crash_panic', 'world', { weight: 1_000, once: true, trigger: { crisis: { id: 'crash', year: 1 } } }, [
    {},
    { effects: { invest: { assetId: 'msci_world', amount: usd(8_000) } } },
    { effects: { loan: usd(8_000) } },
  ]),
  card('crisis_crash_layoffs', 'world', { weight: 1_000, once: true, trigger: { crisis: { id: 'crash', year: 2 } } }, [
    { outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { salaryModPct: -8 } }] },
    { when: { employed: true }, effects: { salaryModPct: -4 } },
    { effects: { focus: 2, careerSkill: 2 } },
  ]),
  card('crisis_energy_bills', 'world', { weight: 1_000, once: true, trigger: { crisis: { id: 'energy', year: 1 } } }, [
    { effects: { cashSalaryPct: -6 } },
    { effects: { cash: usd(-3_000), status: 1 } },
    { effects: { cashSalaryPct: -6, invest: { assetId: 'gold', amount: usd(4_000) } } },
  ]),
  card('crisis_energy_wages', 'world', { weight: 1_000, once: true, trigger: { crisis: { id: 'energy', year: 2 } } }, [
    {},
    { when: { employed: true }, effects: { focus: 1 }, outcomes: [{ weight: 60, effects: { salaryModPct: 6 } }, { weight: 40, effects: { salaryBoostPct: -10 } }] },
    { effects: { lifestyleFloor: 0, cashSalaryPct: 3 } },
  ]),
  card('crisis_debt_spreads', 'world', { weight: 1_000, once: true, trigger: { crisis: { id: 'debt', year: 1 } } }, [
    {},
    { when: { hasMortgage: true }, effects: { cash: usd(-1_200), refinance: 'fixed' } },
    { effects: { invest: { assetId: 'bund', amount: usd(5_000) } } },
  ]),
  card('crisis_debt_austerity', 'world', { weight: 1_000, once: true, trigger: { crisis: { id: 'debt', year: 2 } } }, [
    { effects: { cashSalaryPct: -4 } },
    { effects: { cashSalaryPct: -4, focus: 1, careerSkill: 1 } },
    { when: { minFinanceSkill: 2 }, effects: { cashSalaryPct: -4, property: { typeId: 'studio', pricePct: 80, downPct: 25, rented: true } } },
  ]),
  card('world_bank_failure', 'world', { weight: 12, once: true, trigger: { regimes: ['slowdown', 'recession'] } }, [
    { outcomes: [{ weight: 85, effects: {} }, { weight: 15, effects: { lose: { what: 'deposit', pct: 15 } } }] },
    { effects: { focus: 1 } },
  ]),
];
