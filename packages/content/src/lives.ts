import type { StartConfig } from '@ratrace/engine';
import { usd } from './money';

/** How a life is unlocked. The interface checks these against the player's history. */
export type Unlock = 'default' | 'finish_one_life' | 'net_worth_1m' | 'three_cities';

export interface LifeDef {
  id: string;
  unlock: Unlock;
  start: StartConfig;
}

/**
 * Six starting lives (spec section 4). A perk or a handicap is either a number in the start
 * or a flag: `layoff_proof` is read by cards, `unstable_pay` and `cheap_mortgage` by the engine,
 * `share_plan` and `bilingual` by cards.
 */
export const lives: LifeDef[] = [
  {
    // Cannot be laid off and is paid well for night shifts; the ladder tops out low, and a flat of her own must wait.
    id: 'nurse',
    unlock: 'default',
    start: {
      cityId: 'madrid',
      cash: usd(3_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: { lifeId: 'nurse', career: { id: 'healthcare', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3, rentTier: 0, flags: ['layoff_proof'] },
    },
  },
  {
    // Well paid, with a share plan and a head start in finance, and a student loan to clear.
    id: 'engineer',
    unlock: 'default',
    start: {
      cityId: 'madrid',
      cash: usd(2_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [{ kind: 'personalLoan', principal: usd(18_000), fixedRateBp: 600, roundsLeft: 5 }],
      life: { lifeId: 'engineer', career: { id: 'tech', level: 0 }, careerSkill: 0, financeSkill: 1, focus: 3, flags: ['share_plan'] },
    },
  },
  {
    // A job for life and a cheaper mortgage; raises come slowly.
    id: 'civil_servant',
    unlock: 'default',
    start: {
      cityId: 'madrid',
      cash: usd(5_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: {
        lifeId: 'civil_servant', career: { id: 'public', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3,
        flags: ['layoff_proof', 'cheap_mortgage'],
      },
    },
  },
  {
    // Four focus points; pay that swings every round, and nothing in the bank.
    id: 'rider',
    unlock: 'finish_one_life',
    start: {
      cityId: 'madrid',
      cash: 0,
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [],
      life: { lifeId: 'rider', career: { id: 'service', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 4, rentTier: 0, flags: ['unstable_pay'] },
    },
  },
  {
    // Cash and a flat on day one; a comfortable lifestyle that cannot be cut, and no skills.
    id: 'heir',
    unlock: 'net_worth_1m',
    start: {
      cityId: 'madrid',
      cash: usd(60_000),
      salaryAnnual: 0,
      lifestyleTier: 2,
      debts: [],
      life: {
        lifeId: 'heir', career: { id: 'service', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3, minLifestyleTier: 2,
        properties: [{ typeId: 'flat', rented: false }],
      },
    },
  },
  {
    // Four focus points and a second language; little cash, and money sent home every year.
    id: 'newcomer',
    unlock: 'three_cities',
    start: {
      cityId: 'london',
      cash: usd(1_500),
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [],
      life: {
        lifeId: 'newcomer', career: { id: 'service', level: 0 }, careerSkill: 2, financeSkill: 0, focus: 4, rentTier: 0,
        recurring: [{ tag: 'remittance', kind: 'expense', annual: usd(2_400), roundsLeft: null }],
        flags: ['bilingual'],
      },
    },
  },
];
