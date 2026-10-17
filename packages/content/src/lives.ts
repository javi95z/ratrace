import type { StartConfig } from '@ratrace/engine';
import { usd } from './money';

/** Badges that open a life by being earned once, in any life. */
export type BadgeUnlock =
  | 'world_tour'
  | 'swiss_banker'
  | 'five_asset_classes'
  | 'family_of_four'
  | 'mba'
  | 'escaped'
  | 'bankrupt'
  | 'sold_business'
  | 'crypto_winter'
  | 'first_luxury_watch'
  | 'index_only'
  | 'status_100'
  | 'first_share'
  | 'bought_the_dip';

/** How a life is unlocked. The interface checks these against the player's history. */
export type Unlock = 'default' | 'finish_one_life' | 'net_worth_1m' | 'three_cities' | BadgeUnlock;

export interface LifeDef {
  id: string;
  unlock: Unlock;
  start: StartConfig;
  /**
   * The ISO week from which the weekly challenge may deal this life. A life added after the
   * challenges began waits for the next week, so a week already under way is never changed.
   */
  challengeFrom?: string;
}

/**
 * Twenty starting lives: the six of spec section 4, five that each open with a badge, one for each of the five newer careers,
 * each opened by a badge too, and one for each of the four cities added since. A perk or a handicap is either a number in the start
 * or a flag: `layoff_proof` is read by cards, `unstable_pay` and `cheap_mortgage` by the engine,
 * `share_plan`, `bilingual` and `has_business` by cards.
 *
 * The three first lives begin in Madrid, where the game is learnt; the rest are spread over the six
 * cities, each where its trade is at home. Dubai and Singapore tax gains lightly and make any life
 * easier, so the lives that begin there are the ones that need it: the heir, the teacher, and the
 * crypto kid on low pay.
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
      cityId: 'tokyo',
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
      cityId: 'bangkok',
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
      cityId: 'dubai',
      cash: usd(60_000),
      salaryAnnual: 0,
      lifestyleTier: 2,
      debts: [],
      life: {
        lifeId: 'heir', career: { id: 'service', level: 0 }, careerSkill: 0, financeSkill: 0, skills: { network: 3 }, focus: 3, minLifestyleTier: 2,
        properties: [{ typeId: 'flat', rented: false }],
      },
    },
  },
  {
    // Four focus points and a second language; little cash, and money sent home for the first rounds.
    id: 'newcomer',
    unlock: 'three_cities',
    start: {
      cityId: 'london',
      cash: usd(3_500),
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [],
      life: {
        lifeId: 'newcomer', career: { id: 'service', level: 0 }, careerSkill: 2, financeSkill: 0, skills: { languages: 6 }, focus: 4, rentTier: 0,
        recurring: [{ tag: 'remittance', kind: 'expense', annual: usd(2_400), roundsLeft: 5 }],
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
      cityId: 'zurich',
      cash: usd(1_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [{ kind: 'personalLoan', principal: usd(90_000), fixedRateBp: 500, roundsLeft: 8 }],
      life: { lifeId: 'doctor', career: { id: 'medicine', level: 0 }, careerSkill: 0, financeSkill: 0, skills: { health: 3 }, focus: 2, rentTier: 0, flags: ['layoff_proof'] },
    },
  },
  {
    // Two rungs up the ladder already; nothing in the bank, and a debt at a rate that hurts.
    id: 'comeback',
    unlock: 'bankrupt',
    start: {
      cityId: 'moscow',
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
      cityId: 'new_york',
      cash: usd(3_000),
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [],
      life: {
        lifeId: 'founder', career: { id: 'service', level: 0 }, careerSkill: 0, financeSkill: 2, skills: { management: 3 }, focus: 3, rentTier: 0,
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
  {
    // The tallest ladder in the game, climbed slowly and from under a student loan.
    id: 'lawyer',
    unlock: 'first_luxury_watch',
    start: {
      cityId: 'new_york',
      cash: usd(1_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [{ kind: 'personalLoan', principal: usd(80_000), fixedRateBp: 600, roundsLeft: 8 }],
      life: { lifeId: 'lawyer', career: { id: 'law', level: 0 }, careerSkill: 0, financeSkill: 1, skills: { negotiation: 3 }, focus: 3 },
    },
  },
  {
    // A job for life that leaves the afternoons free: a point of focus more every round, and pay that never goes far.
    id: 'teacher',
    unlock: 'index_only',
    start: {
      cityId: 'singapore',
      cash: usd(4_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: { lifeId: 'teacher', career: { id: 'education', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3, flags: ['layoff_proof'] },
    },
  },
  {
    // Status from the first day and money soon after, on a clock: from thirty-four the audience moves on.
    id: 'influencer',
    unlock: 'status_100',
    start: {
      cityId: 'dubai',
      cash: usd(500),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: { lifeId: 'influencer', career: { id: 'influencer', level: 0 }, careerSkill: 0, financeSkill: 0, skills: { network: 3 }, focus: 3, rentTier: 0 },
    },
  },
  {
    // The best overtime in the game and four points of focus to spend on it; the pay itself starts lowest of all.
    id: 'waiter',
    unlock: 'first_share',
    start: {
      cityId: 'bangkok',
      cash: usd(800),
      salaryAnnual: 0,
      lifestyleTier: 0,
      debts: [],
      life: { lifeId: 'waiter', career: { id: 'hospitality', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 4, rentTier: 0 },
    },
  },
  {
    // Paid by the economy: a quarter more in a boom, a quarter less in a recession.
    id: 'salesperson',
    unlock: 'bought_the_dip',
    start: {
      cityId: 'mexico_city',
      cash: usd(2_500),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: { lifeId: 'salesperson', career: { id: 'sales', level: 0 }, careerSkill: 0, financeSkill: 0, skills: { negotiation: 3 }, focus: 3 },
    },
  },
  {
    // A job for life at a maker of robots, and the overtime that comes with it; a flat the size of a parking space.
    id: 'robotics_engineer',
    unlock: 'world_tour',
    challengeFrom: '2026-W43',
    start: {
      cityId: 'tokyo',
      cash: usd(6_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: { lifeId: 'robotics_engineer', career: { id: 'tech', level: 0 }, careerSkill: 1, financeSkill: 1, focus: 3, rentTier: 0, flags: ['layoff_proof'] },
    },
  },
  {
    // Good pay for a cheap city and a flat tax, in a currency that swings with the oil price.
    id: 'programmer',
    unlock: 'five_asset_classes',
    challengeFrom: '2026-W43',
    start: {
      cityId: 'moscow',
      cash: usd(2_000),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: { lifeId: 'programmer', career: { id: 'tech', level: 0 }, careerSkill: 0, financeSkill: 1, focus: 3, rentTier: 0, flags: ['unstable_pay'] },
    },
  },
  {
    // Runs a kitchen from the first day, in the cheapest city in the game; the pay starts low and the hours are long.
    id: 'chef',
    unlock: 'family_of_four',
    challengeFrom: '2026-W43',
    start: {
      cityId: 'mexico_city',
      cash: usd(1_500),
      salaryAnnual: 0,
      lifestyleTier: 1,
      debts: [],
      life: { lifeId: 'chef', career: { id: 'hospitality', level: 0 }, careerSkill: 2, financeSkill: 0, skills: { management: 3 }, focus: 4, rentTier: 0 },
    },
  },
  {
    // The best-paid desk in the dearest city, with the clients' manners to keep up from the start.
    id: 'private_banker',
    unlock: 'swiss_banker',
    challengeFrom: '2026-W43',
    start: {
      cityId: 'zurich',
      cash: usd(8_000),
      salaryAnnual: 0,
      lifestyleTier: 2,
      debts: [],
      life: { lifeId: 'private_banker', career: { id: 'finance', level: 0 }, careerSkill: 0, financeSkill: 2, skills: { network: 3 }, focus: 3, minLifestyleTier: 2 },
    },
  },
];
