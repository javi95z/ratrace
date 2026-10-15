import type { CardDef, CardOutcome } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/** The flag a serious illness leaves, which the engine reads when health cover is asked for. */
const ILL = 'had_illness';

export const healthCards: CardDef[] = [
  // Not before the fourth year: a player needs a chance to have bought insurance first. An illness is
  // on the record for good: no insurer takes on health cover for it afterwards.
  // The public system and its waiting list are for someone without cover; with it, the private clinic is near enough free.
  card('health_illness', 'health', { weight: 6, cooldown: 6, risk: 'health', when: { minRound: 2 } }, [
    { effects: { focus: 1, cash: usd(-14_000), protection: { insurance: 'health', coverPct: 90 }, setFlags: [ILL] } },
    { when: { uninsured: 'health' }, effects: { focus: 2, cash: usd(-1_500), setFlags: [ILL] } },
    // Life cover pays out on a serious illness.
    { when: { insured: 'life' }, effects: { focus: 2, cash: usd(9_000), setFlags: [ILL] } },
  ]),
  card('health_burnout', 'health', { cooldown: 6, risk: 'health', when: { employed: true, minRound: 3, notFlags: ['fit'] } }, [
    { effects: { focus: 2 } },
    { effects: { salaryBoostPct: -10 } },
    { effects: { focus: 1, cash: usd(-2_500) } },
  ]),
  card('health_dental', 'health', { cooldown: 5, risk: 'health' }, [
    { effects: { cash: usd(-2_200), protection: { insurance: 'health', coverPct: 50 } } },
    { outcomes: [{ weight: 65, effects: { cash: usd(-700) } }, { weight: 35, effects: { cash: usd(-3_200) } }] },
  ]),
  // Money buys the time back; waiting costs it; playing on is a gamble; a fit body heals on its own.
  card('health_injury', 'health', { cooldown: 6, risk: 'health' }, [
    { effects: { cash: usd(-1_800), protection: { insurance: 'health', coverPct: 80 } } },
    { effects: { focus: 2 } },
    { outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { focus: 3, skills: { health: -2 } } }] },
    { when: { minSkills: { health: 2 } }, effects: { focus: 1 } },
  ]),
  card('health_gym_habit', 'health', { when: { notFlags: ['fit'], notItems: ['member_gym'] } }, [
    {},
    { effects: { focus: 1, buyItem: { itemId: 'member_gym', pricePct: 100 }, setFlags: ['fit'], skills: { health: 2 } } },
  ]),
];

/** Odds of a Christmas lottery ticket, per hundred thousand. About sixty cents of every dollar comes back. */
const lottery = (stake: number): CardOutcome[] => [
  { weight: 89_600, effects: {} },
  { weight: 9_500, effects: { cash: usd(stake) } },
  { weight: 800, effects: { cash: usd(stake * 5) } },
  { weight: 80, effects: { cash: usd(stake * 50) } },
  { weight: 18, effects: { cash: usd(stake * 600) } },
  { weight: 2, effects: { cash: usd(stake * 16_000) } },
];

export const luckCards: CardDef[] = [
  card('luck_lottery', 'luck', { cooldown: 2, when: { employed: true } }, [
    {},
    { effects: { cash: usd(-25) }, outcomes: lottery(25) },
    { effects: { cash: usd(-250) }, outcomes: lottery(250) },
  ]),
  card('luck_car_breakdown', 'luck', { when: { ownsLadder: 'car' } }, [
    { effects: { cash: usd(-1_600) } },
    { outcomes: [{ weight: 60, effects: { cash: usd(-700) } }, { weight: 40, effects: { cash: usd(-2_400) } }] },
  ]),
  card('luck_tax_refund', 'luck', { cooldown: 5 }, [
    { effects: { cash: usd(900) } },
    { effects: { pension: usd(1_100) } },
  ]),
  card('luck_stolen_phone', 'luck', { cooldown: 6, when: { ownsLadder: 'tech' } }, [
    { effects: { cash: usd(-1_100), protection: { insurance: 'home', coverPct: 80 } } },
    { effects: { status: -1 } },
  ]),
  card('luck_bonus', 'luck', { when: { employed: true } }, [
    { effects: { cashSalaryPct: 8 } },
    { outcomes: [{ weight: 40, effects: { salaryModPct: 3 } }, { weight: 60, effects: { cashSalaryPct: 4 } }] },
  ]),
  card('luck_phishing', 'luck', { cooldown: 6 }, [
    { outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { cash: usd(-2_500) } }] },
    { effects: { focus: 1 } },
  ]),
  card('luck_speeding_fine', 'luck', { when: { ownsLadder: 'car' } }, [
    { effects: { cash: usd(-300) } },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { cash: usd(-450) } }] },
  ]),
  card('luck_betting_app', 'luck', { cooldown: 5 }, [
    {},
    { effects: { cash: usd(-200) }, outcomes: [{ weight: 45, effects: { cash: usd(380) } }, { weight: 55, effects: {} }] },
    { effects: { cash: usd(-2_000) }, outcomes: [{ weight: 40, effects: { cash: usd(3_800) } }, { weight: 60, effects: {} }] },
  ]),
];

export const laterLifeCards: CardDef[] = [
  card('late_porsche', 'laterLife', { once: true, when: { minRound: 9, maxRound: 15, notItems: ['car_porsche_911'] } }, [
    {},
    { effects: { buyItem: { itemId: 'car_porsche_911', pricePct: 100 } } },
    { effects: { loan: usd(150_000), buyItem: { itemId: 'car_porsche_911', pricePct: 100 } } },
  ]),
  card('late_university', 'laterLife', { once: true, when: { minChildren: 1, minRound: 11 } }, [
    { effects: { recurring: [yearly('university', 'expense', 3_000, 2)] } },
    { effects: { recurring: [yearly('university', 'expense', 16_000, 2)], status: 4 } },
    { effects: { status: -2 } },
  ]),
  // Offered in the last six years only: three and a half years of pay, and some standing, for at most six of work.
  card('late_early_retirement', 'laterLife', { once: true, when: { employed: true, minRound: 17 } }, [
    {},
    { effects: { retire: true, cashSalaryPct: 350, status: 6 } },
  ]),
  // Giving in life: a little now for a home of their own, or half of what is saved. The gift tax is paid now,
  // and what is given still counts as the family's.
  card('late_gift', 'laterLife', { once: true, when: { minChildren: 1, minRound: 17 } }, [
    {},
    { effects: { gift: { liquidPct: 20 }, status: 4 } },
    { effects: { gift: { liquidPct: 50 }, status: 8 } },
  ]),
  // What becomes of a business at the end of a working life: kept, sold whole to a buyer, or handed to the children.
  card('late_business_handover', 'laterLife', { once: true, when: { hasBusiness: true, minRound: 17 } }, [
    {},
    { effects: { sellBusiness: { pricePct: 100 } } },
    { when: { minChildren: 1 }, effects: { gift: { business: true }, status: 6 } },
  ]),
  // Ageing parents: someone has to look after them.
  card('late_parents_care', 'laterLife', { once: true, when: { minRound: 14, maxRound: 19 } }, [
    { effects: { status: -3 } },
    { effects: { recurring: [yearly('parents_care', 'expense', 14_000, 3)] } },
    { effects: { focus: 2, salaryBoostPct: -15, status: 3 } },
  ]),
  card('late_downsizing', 'laterLife', { once: true, when: { ownsHome: true, minRound: 13 } }, [
    {},
    { effects: { sellHome: true, cash: usd(-3_000) } },
  ]),
  card('late_will', 'laterLife', { once: true, when: { minRound: 10 } }, [
    {},
    { effects: { cash: usd(-1_200), setFlags: ['will'], status: 2 } },
  ]),
];
