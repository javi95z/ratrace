import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/** A course paid by the employer binds the player to it for this many rounds: no other offer comes meanwhile. */
export const TRAINING_BOND = { flag: 'training_bond', rounds: 2 };

export const moreCareerCards: CardDef[] = [
  // A day less for a fifth less, for good: time is the one thing money cannot buy back.
  card('career_four_day_week', 'career', { once: true, when: { employed: true, minRound: 4 } }, [
    {},
    { effects: { salaryModPct: -20, focusBase: 1 } },
  ]),
];

export const moreEducationCards: CardDef[] = [
  // Paid by the employer, with two years of staying on; or paid by the player, and free to go.
  card('edu_company_course', 'education', { cooldown: 6, when: { employed: true, minRound: 1 } }, [
    {},
    { effects: { focus: 1, careerSkill: 4, setFlags: [TRAINING_BOND.flag] } },
    { effects: { focus: 1, cash: usd(-4_000), careerSkill: 4 } },
  ]),
];

export const moreBusinessCards: CardDef[] = [
  card('biz_rival', 'business', { cooldown: 6, when: { hasBusiness: true } }, [
    { outcomes: [{ weight: 50, effects: { businessesPct: -15 } }, { weight: 50, effects: {} }] },
    { effects: { businessesPct: -8 } },
    { effects: { cash: usd(-6_000), businessesPct: 5 } },
  ]),
  card('biz_viral_review', 'business', { cooldown: 6, when: { hasBusiness: true } }, [
    { outcomes: [{ weight: 50, effects: { businessesPct: 10 } }, { weight: 50, effects: { businessesPct: -10 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 75, effects: { businessesPct: 10 } }, { weight: 25, effects: {} }] },
    { effects: { cash: usd(-1_500), businessesPct: 8, status: -2 } },
  ]),
  card('biz_labour_inspection', 'business', { weight: 6, cooldown: 8, when: { hasBusiness: true } }, [
    { outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { cash: usd(-6_000) } }] },
    { effects: { cash: usd(-1_500) } },
  ]),
];

export const moreInvestingCards: CardDef[] = [
  // The bank's own product: a two-year bond with a fee on the way in. Someone who knows money asks for a fund without one.
  card('inv_bank_product', 'investing', { cooldown: 8, when: { minNetWorth: usd(10_000) } }, [
    {},
    { effects: { cash: usd(-300), invest: { assetId: 'treasury_short', amount: usd(5_000) } } },
    { when: { minFinanceSkill: 2 }, effects: { invest: { assetId: 'msci_world', amount: usd(5_000) } } },
  ]),
  // Three times the market, both ways: a little under even odds of tripling the stake.
  card('inv_leveraged_etf', 'investing', { cooldown: 6, when: { minRound: 2 } }, [
    {},
    { effects: { cash: usd(-3_000) }, outcomes: [{ weight: 45, effects: { cash: usd(9_000) } }, { weight: 55, effects: {} }] },
  ]),
];

export const moreHousingCards: CardDef[] = [
  card('house_noisy_neighbours', 'housing', { cooldown: 6 }, [
    { effects: { focus: 1 } },
    { effects: { cash: usd(-4_000) } },
    { when: { ownsHome: false }, effects: { cash: usd(-1_500) } },
  ]),
  card('house_levy', 'housing', { cooldown: 6, when: { ownsHome: true } }, [
    { effects: { cash: usd(-3_000) } },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { cash: usd(-4_500) } }] },
  ]),
  // A room of one's own home let to a lodger: an income for good, and a stranger in the kitchen.
  card('house_lodger', 'housing', { once: true, when: { ownsHome: true, notFlags: ['lodger'] } }, [
    {},
    { effects: { recurring: [yearly('lodger', 'passive', 6_000, null)], status: -3, setFlags: ['lodger'] } },
  ]),
];

export const moreLifestyleCards: CardDef[] = [
  card('life_bali_wedding', 'lifestyle', { cooldown: 8, when: { minRound: 1 } }, [
    { effects: { status: -1 } },
    { effects: { cash: usd(-4_000), status: 2, skills: { network: 2 } } },
  ]),
];

export const moreFamilyCards: CardDef[] = [
  // A dog is walked every day: health is practised for as long as it lives with the player.
  card('fam_dog', 'family', { cooldown: 8, when: { minRound: 2, notItems: ['pet_dog'] } }, [
    {},
    { effects: { buyItem: { itemId: 'pet_dog', pricePct: 100 } } },
  ]),
  card('fam_partner_startup', 'family', { once: true, when: { partner: true, minRound: 3 } }, [
    { effects: { status: -1 } },
    { effects: { partner: { salaryPct: 0 } }, outcomes: [{ weight: 40, effects: { partner: { salaryPct: 160 } } }, { weight: 60, effects: { partner: { salaryPct: 70 } } }] },
  ]),
];

export const moreTaxCards: CardDef[] = [
  card('tax_no_vat', 'tax', { cooldown: 6, when: { hasBusiness: true } }, [
    {},
    { effects: { cash: usd(2_500), suspicion: 20 } },
  ]),
  // Once in a life: pay a tenth of what the tax office could still claim, and start again with nothing to fear.
  card('tax_amnesty', 'tax', { once: true, when: { evading: true, minRound: 4 } }, [
    {},
    { effects: { amnesty: { pct: 10 } } },
  ]),
];

export const moreLaterLifeCards: CardDef[] = [
  card('late_motorbike', 'laterLife', { once: true, when: { minRound: 8, maxRound: 13, notItems: ['car_motorbike'] } }, [
    {},
    { effects: { buyItem: { itemId: 'car_motorbike', pricePct: 100 } } },
    { effects: { loan: usd(22_000), buyItem: { itemId: 'car_motorbike', pricePct: 100 } } },
  ]),
  card('late_mentor', 'laterLife', { once: true, when: { retired: true } }, [
    {},
    { effects: { focus: 1, status: 3, skills: { network: 2 } } },
  ]),
  // A message from a number nobody knows, in a family member's name. Likelier with age, rarer for someone who knows money.
  card('late_scam_call', 'laterLife', { weight: 6, cooldown: 6, risk: 'scam', when: { minRound: 8, minChildren: 1 } }, [
    { outcomes: [{ weight: 80, effects: {} }, { weight: 20, effects: { status: -2 } }] },
    { outcomes: [{ weight: 85, effects: { cash: usd(-3_000) } }, { weight: 15, effects: { status: 2 } }] },
    { effects: { focus: 1 } },
    { when: { minFinanceSkill: 2 }, effects: {} },
  ]),
];
