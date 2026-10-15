import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/**
 * Two cards for each of the ten cities, dealt only to someone living there: what that city is like
 * to live in, more than what it pays. They are rare on purpose, a third as likely as an ordinary
 * card, and each comes at most once in a life.
 */
const CITY = { weight: 3, once: true } as const;

export const cityCards: CardDef[] = [
  // Madrid: a drink that turns into dinner, and a flat that pays its way in August.
  card('city_madrid_cana', 'lifestyle', { ...CITY, when: { cities: ['madrid'] } }, [
    {},
    { effects: { cash: usd(-400), skills: { network: 1 } } },
  ]),
  card('city_madrid_tourist_flat', 'housing', { ...CITY, when: { cities: ['madrid'], ownsHome: true } }, [
    {},
    { effects: { focus: 1, cash: usd(3_000) } },
    { effects: { cash: usd(5_000), suspicion: 15 } },
  ]),

  // London: the Underground on strike, and a club that would have you.
  card('city_london_tube_strike', 'career', { ...CITY, when: { cities: ['london'], employed: true } }, [
    { effects: { cash: usd(-500) } },
    { effects: { focus: 1 } },
  ]),
  card('city_london_club', 'lifestyle', { ...CITY, when: { cities: ['london'], minNetWorth: usd(50_000) } }, [
    {},
    { effects: { cash: usd(-3_000), status: 3, skills: { network: 1 } } },
  ]),

  // New York: a landlord who wants a fifth more, and an investor in the lift.
  card('city_new_york_rent_hike', 'housing', { ...CITY, when: { cities: ['new_york'], ownsHome: false } }, [
    { effects: { cash: usd(-3_000) } },
    { effects: { focus: 1 }, outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { cash: usd(-3_500) } }] },
  ]),
  card('city_new_york_elevator_pitch', 'career', { ...CITY, when: { cities: ['new_york'], employed: true, minLevel: 1 } }, [
    {},
    { effects: { focus: 1 }, outcomes: [{ weight: 25, effects: { salaryModPct: 8, status: 2 } }, { weight: 75, effects: {} }] },
  ]),

  // Dubai: a visa that follows the job, and a golden one that follows the money.
  card('city_dubai_visa', 'career', { ...CITY, when: { cities: ['dubai'], employed: true } }, [
    { effects: { cash: usd(-1_500) } },
    { effects: { focus: 1, cash: usd(-500) } },
  ]),
  card('city_dubai_golden_visa', 'lifestyle', { ...CITY, when: { cities: ['dubai'], minNetWorth: usd(500_000) } }, [
    {},
    { effects: { cash: usd(-15_000), status: 6 } },
  ]),

  // Singapore: the ballot for a flat the state builds, and a fine for chewing gum.
  card('city_singapore_ballot', 'housing', { ...CITY, when: { cities: ['singapore'], ownsHome: false } }, [
    {},
    { outcomes: [{ weight: 25, effects: { property: { typeId: 'flat', pricePct: 60, downPct: 20, rented: false } } }, { weight: 75, effects: {} }] },
  ]),
  card('city_singapore_gum', 'luck', { ...CITY, when: { cities: ['singapore'] } }, [
    { effects: { cash: usd(-700) } },
    { effects: { focus: 1, cash: usd(-200) } },
  ]),

  // Bangkok: the rains, and a bar on the beach.
  card('city_bangkok_flood', 'housing', { ...CITY, when: { cities: ['bangkok'], ownsHome: true } }, [
    { effects: { cash: usd(-3_000), protection: { insurance: 'home', coverPct: 90 } } },
    { effects: { focus: 1, cash: usd(-1_200), protection: { insurance: 'home', coverPct: 90 } } },
  ]),
  card('city_bangkok_beach_bar', 'business', { ...CITY, when: { cities: ['bangkok'], minNetWorth: usd(20_000) } }, [
    {},
    { effects: { cash: usd(-10_000) }, outcomes: [{ weight: 40, effects: { cash: usd(24_000) } }, { weight: 60, effects: {} }] },
  ]),

  // Tokyo: the ground moves, and the boss sings.
  card('city_tokyo_earthquake', 'housing', { ...CITY, when: { cities: ['tokyo'], ownsHome: true } }, [
    { effects: { cash: usd(-9_000), protection: { insurance: 'home', coverPct: 90 } } },
    { effects: { focus: 1, cash: usd(-4_000), protection: { insurance: 'home', coverPct: 90 } } },
  ]),
  card('city_tokyo_karaoke', 'career', { ...CITY, when: { cities: ['tokyo'], employed: true } }, [
    {},
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { careerSkill: 1, salaryModPct: 2 } }, { weight: 50, effects: {} }] },
  ]),

  // Moscow: the rouble falls, and a dacha comes down the family.
  card('city_moscow_rouble', 'career', { ...CITY, when: { cities: ['moscow'], employed: true } }, [
    { effects: { salaryBoostPct: -15 } },
    { effects: { focus: 1, salaryBoostPct: -5 } },
  ]),
  card('city_moscow_dacha', 'family', { ...CITY, when: { cities: ['moscow'] } }, [
    { effects: { cash: usd(8_000) } },
    { effects: { status: 2, skills: { health: 1 } } },
  ]),

  // Mexico City: an inspector with an outstretched hand, and a taquero looking for a partner.
  card('city_mexico_city_mordida', 'tax', { ...CITY, when: { cities: ['mexico_city'] } }, [
    { outcomes: [{ weight: 50, effects: { cash: usd(-2_500) } }, { weight: 50, effects: {} }] },
    { effects: { cash: usd(-500), suspicion: 10 } },
  ]),
  card('city_mexico_city_taqueria', 'business', { ...CITY, when: { cities: ['mexico_city'], minNetWorth: usd(10_000) } }, [
    {},
    { effects: { cash: usd(-6_000), recurring: [yearly('taqueria', 'passive', 1_500, null)] } },
  ]),

  // Zurich: an account with a number for a name, and a vote on the taxes.
  card('city_zurich_numbered_account', 'tax', { ...CITY, when: { cities: ['zurich'], minNetWorth: usd(200_000) } }, [
    {},
    { effects: { cash: usd(-1_500) }, outcomes: [{ weight: 80, effects: { cashNetWorthPct: 2 } }, { weight: 20, effects: { cashNetWorthPct: -3, suspicion: 40 } }] },
  ]),
  card('city_zurich_referendum', 'tax', { ...CITY, when: { cities: ['zurich'] } }, [
    {},
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { cash: usd(3_000) } }, { weight: 50, effects: {} }] },
  ]),
];
