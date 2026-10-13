import type { StartConfig } from '@ratrace/engine';
import { usd } from './money';

/** Badges that open a life by being earned once, in any life. */
export type BadgeUnlock = 'mba' | 'escaped' | 'bankrupt' | 'sold_business' | 'crypto_winter';

/** How a life is unlocked. The interface checks these against the player's history. */
export type Unlock = 'default' | 'finish_one_life' | 'net_worth_1m' | 'three_cities' | BadgeUnlock;

export interface LifeDef {
  id: string;
  unlock: Unlock;
  start: StartConfig;
}

/**
 * Eleven starting lives: the six of spec section 4, then five that each open with a badge. A perk or a handicap is either a number in the start
 * or a flag: `layoff_proof` is read by cards, `unstable_pay` and `cheap_mortgage` by the engine,
 * `share_plan`, `bilingual` and `has_business` by cards.
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
  {
    // The steepest ladder and every market open; a lifestyle that cannot be cut and a loan from the business school.
    id: 'banker',
    unlock: 'mba',
    start: {
      cityId: 'london',
      cash: usd(4_000),
      salaryAnnual: 0,
      lifestyleTier: 2,
      debts: [{ kind: 'personalLoan', principal: usd(40_000), fixedRateBp: 600, roundsLeft: 6 }],
      life: { lifeId: 'banker', career: { id: 'finance', level: 0 }, careerSkill: 0, financeSkill: 2, focus: 3, minLifestyleTier: 2 },
    },
  },
  {
    // Cannot be laid off and ends up very well paid; two focus points, and the longest loan of any life.
    id: 'doctor',
    unlock: 'escaped',
    start: {
      cityId: 'madrid',
      cash: usd(1_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [{ kind: 'personalLoan', principal: usd(60_000), fixedRateBp: 500, roundsLeft: 8 }],
      life: { lifeId: 'doctor', career: { id: 'medicine', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 2, rentTier: 0, flags: ['layoff_proof'] },
    },
  },
  {
    // Two rungs up the ladder already; nothing in the bank, and a debt at a rate that hurts.
    id: 'comeback',
    unlock: 'bankrupt',
    start: {
      cityId: 'madrid',
      cash: 0,
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [{ kind: 'personalLoan', principal: usd(30_000), fixedRateBp: 1_400, roundsLeft: 6 }],
      life: { lifeId: 'comeback', career: { id: 'service', level: 2 }, careerSkill: 10, financeSkill: 1, focus: 3, rentTier: 0 },
    },
  },
  {
    // A small business that pays from day one and can be sold; the day job that keeps it going pays little.
    id: 'founder',
    unlock: 'sold_business',
    start: {
      cityId: 'madrid',
      cash: usd(3_000),
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [],
      life: {
        lifeId: 'founder', career: { id: 'service', level: 0 }, careerSkill: 0, financeSkill: 2, focus: 3, rentTier: 0,
        businesses: [{ typeId: 'shop', capital: usd(40_000) }],
      },
    },
  },
  {
    // Twenty thousand in one coin and every market open; almost no cash, and low pay in a dear city.
    id: 'crypto_kid',
    unlock: 'crypto_winter',
    start: {
      cityId: 'singapore',
      cash: usd(1_000),
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [],
      life: {
        lifeId: 'crypto_kid', career: { id: 'service', level: 0 }, careerSkill: 0, financeSkill: 2, focus: 3, rentTier: 0,
        holdings: [{ assetId: 'bitcoin', value: usd(20_000) }],
      },
    },
  },
];
