import type { CardDef, Effects } from '@ratrace/engine';
import { card, usd, yearly } from './build';

export const housingCards: CardDef[] = [
  card('house_rent_hike', 'housing', { cooldown: 3, when: { ownsHome: false } }, [
    { effects: { recurring: [yearly('rent_hike', 'expense', 1_200, 2)] } },
    { effects: { focus: 1 }, outcomes: [{ weight: 55, effects: {} }, { weight: 45, effects: { recurring: [yearly('rent_hike', 'expense', 1_200, 2)] } }] },
  ]),
  card('house_first_flat', 'housing', { once: true, when: { ownsHome: false, minRound: 1, maxRound: 9 } }, [
    {},
    { effects: { property: { typeId: 'studio', pricePct: 100, downPct: 10, rented: false } } },
    { effects: { cash: usd(15_000), property: { typeId: 'flat', pricePct: 100, downPct: 10, rented: false } } },
  ]),
  card('house_landlord_sells', 'housing', { cooldown: 6, when: { ownsHome: false } }, [
    { effects: { cash: usd(-1_500) } },
    { effects: { property: { typeId: 'flat', pricePct: 92, downPct: 20, rented: false } } },
  ]),
  card('house_refinance', 'housing', { when: { hasMortgage: true } }, [
    {},
    { effects: { cash: usd(-800), refinance: 'fixed' } },
    { effects: { cash: usd(-800), refinance: 'variable' } },
  ]),
  card('house_tenant_default', 'housing', { cooldown: 5, when: { landlord: true } }, [
    { effects: { cash: usd(-4_000), protection: { insurance: 'liability', coverPct: 75 } } },
    { effects: { cash: usd(-1_500) }, outcomes: [{ weight: 65, effects: { cash: usd(2_000) } }, { weight: 35, effects: { cash: usd(-2_500) } }] },
  ]),
  card('house_renovation', 'housing', { cooldown: 6, when: { ownsHome: true } }, [
    { effects: { cash: usd(-800) } },
    // A renovation adds a little less than it costs, whatever the home is worth. The rest is the status.
    { effects: { cash: usd(-18_000), homeValue: usd(14_000), status: 2 } },
    { effects: { cash: usd(-45_000), homeValue: usd(38_000), status: 5 } },
  ]),
  card('house_flood', 'housing', { weight: 6, cooldown: 8, when: { ownsHome: true } }, [
    { effects: { cash: usd(-7_000), protection: { insurance: 'home', coverPct: 90 } } },
    { effects: { focus: 1, cash: usd(-2_500), protection: { insurance: 'home', coverPct: 90 } } },
  ]),
  card('house_move_in', 'housing', { weight: 40, cooldown: 2, when: { flags: ['dating'], partner: false } }, [
    {},
    { effects: { partner: { salaryPct: 85 }, clearFlags: ['dating'], setFlags: ['cohabiting'] } },
  ]),
];

export const lifestyleCards: CardDef[] = [
  card('life_sports_car', 'lifestyle', { cooldown: 6, when: { employed: true, minRound: 2, notItems: ['car_bmw_m3'] } }, [
    {},
    { effects: { buyItem: { itemId: 'car_vw_golf_gti', pricePct: 85 } } },
    { effects: { loan: usd(95_000), buyItem: { itemId: 'car_bmw_m3', pricePct: 100 } } },
  ]),
  card('life_ibiza', 'lifestyle', { cooldown: 3 }, [
    {},
    { effects: { buyItem: { itemId: 'travel_ibiza', pricePct: 100 } } },
    { effects: { buyItem: { itemId: 'travel_ibiza', pricePct: 100 }, cash: usd(-3_000), status: 2 } },
  ]),
  card('life_new_phone', 'lifestyle', { cooldown: 3, when: { notItems: ['tech_phone'] } }, [
    {},
    { effects: { buyItem: { itemId: 'tech_phone', pricePct: 100 } } },
  ]),
  card('life_wedding_abroad', 'lifestyle', { cooldown: 5 }, [
    { effects: { cash: usd(-150), status: -1 } },
    { effects: { cash: usd(-1_800), status: 1 } },
    { effects: { cash: usd(-4_500), status: 3 } },
  ]),
  card('life_rolex_call', 'lifestyle', { cooldown: 8, when: { minNetWorth: usd(30_000), notItems: ['watch_rolex'] } }, [
    {},
    { effects: { buyItem: { itemId: 'watch_rolex', pricePct: 100 } } },
    { effects: { cash: usd(1_500) } },
  ]),
  card('life_upgrade', 'lifestyle', {}, [
    {},
    { effects: { buyItem: { itemId: 'travel_business_class', pricePct: 40 } } },
  ]),
  card('life_designer_sale', 'lifestyle', {}, [
    {},
    { effects: { buyItem: { itemId: 'fashion_loafers', pricePct: 60 } } },
    { effects: { buyItem: { itemId: 'fashion_duffel', pricePct: 60 } } },
  ]),
  card('life_car_finance', 'lifestyle', { cooldown: 6, when: { employed: true, lacksLadder: 'car' } }, [
    {},
    { effects: { buyItem: { itemId: 'car_toyota_corolla', pricePct: 100 } } },
    { effects: { loan: usd(48_000), buyItem: { itemId: 'car_tesla_model_3', pricePct: 100 } } },
  ]),
  // Where a member is known, the people who hire and the people with a deal to offer are at the next table.
  card('life_club_contacts', 'lifestyle', { cooldown: 5, when: { ownsLadder: 'membership', minRound: 1 } }, [
    {},
    { when: { employed: true }, effects: { skills: { network: 1 } }, outcomes: [{ weight: 60, effects: { salaryModPct: 6 } }, { weight: 40, effects: {} }] },
    { effects: { cash: usd(-5_000) }, outcomes: [{ weight: 45, effects: { recurring: [yearly('club_deal', 'passive', 1_200, null)] } }, { weight: 55, effects: {} }] },
    // Someone well known there can ask to meet the one who decides.
    { when: { employed: true, minSkills: { network: 2 } }, outcomes: [{ weight: 50, effects: { job: { levelDelta: 1 } } }, { weight: 50, effects: { salaryModPct: 2 } }] },
  ]),
  card('life_bottle_service', 'lifestyle', { cooldown: 3 }, [
    {},
    { effects: { cash: usd(-900) }, outcomes: [{ weight: 30, effects: { status: 2 } }, { weight: 70, effects: {} }] },
    { effects: { cash: usd(-3_500), status: 2 } },
  ]),
  card('life_black_friday', 'lifestyle', { cooldown: 3 }, [
    {},
    { effects: { buyItem: { itemId: 'tech_console', pricePct: 70 } } },
    { effects: { buyItem: { itemId: 'tech_laptop', pricePct: 75 } } },
  ]),
];

/** What a divorce costs: a share of net worth, most of which a prenup protects. */
const split = (pct: number): Effects => ({
  partner: null,
  clearFlags: ['married', 'cohabiting'],
  cashNetWorthPct: -pct,
  protection: { flag: 'prenup', coverPct: 80 },
});

export const familyCards: CardDef[] = [
  card('fam_dating', 'family', { weight: 25, cooldown: 2, when: { partner: false, notFlags: ['dating'] } }, [
    {},
    { effects: { focus: 1, cash: usd(-600), setFlags: ['dating'] } },
  ]),
  card('fam_wedding', 'family', { once: true, when: { partner: true, notFlags: ['married'] } }, [
    { effects: { cash: usd(-2_000), setFlags: ['married'], status: 1 } },
    { effects: { cash: usd(-18_000), setFlags: ['married'], status: 5 } },
    { effects: { cash: usd(-45_000), setFlags: ['married'], status: 10 } },
  ]),
  // A couple is asked more often than chance would, and it can come again while the first child is still at home:
  // a family of four is two of these, some years apart. Once in a few hundred lives was no way to earn a badge.
  card('fam_first_child', 'family', { weight: 60, cooldown: 2, when: { partner: true, maxChildren: 1, maxRound: 10 } }, [
    {},
    { effects: { children: 1, lifestyleFloor: 1, status: 8 } },
  ]),
  card('fam_prenup', 'family', { once: true, when: { partner: true, notFlags: ['married', 'prenup'] } }, [
    {},
    { effects: { cash: usd(-1_200), setFlags: ['prenup'] } },
  ]),
  card('fam_sibling_loan', 'family', { cooldown: 6 }, [
    {},
    { effects: { cash: usd(-5_000) }, outcomes: [{ weight: 60, effects: { cash: usd(5_000), status: 1 } }, { weight: 40, effects: { status: 2 } }] },
    { effects: { cash: usd(-2_000), status: 1 } },
  ]),
  card('fam_cosign', 'family', { once: true }, [
    {},
    { outcomes: [{ weight: 72, effects: { status: 1 } }, { weight: 28, effects: { loan: usd(12_000), cash: usd(-12_000) } }] },
  ]),
  card('fam_support_parents', 'family', { once: true, when: { minRound: 5 } }, [
    {},
    { effects: { recurring: [yearly('parents', 'expense', 2_400, 5)], status: 2 } },
    { effects: { recurring: [yearly('parents', 'expense', 6_000, 5)], status: 4 } },
  ]),
  card('fam_inheritance', 'family', { once: true, when: { minRound: 3 } }, [
    { effects: { cash: usd(25_000) } },
    { effects: { cash: usd(25_000), invest: { assetId: 'msci_world', amount: usd(25_000) } } },
    // The money becomes the deposit on a flat to rent out, with less down than a bank asks and no finance skill needed.
    { effects: { cash: usd(25_000), property: { typeId: 'studio', pricePct: 100, downPct: 10, rented: true } } },
  ]),
  card('fam_divorce', 'family', { weight: 5, once: true, when: { partner: true, flags: ['married'], minRound: 4 } }, [
    { effects: split(20) },
    { effects: { cash: usd(-8_000), ...split(12) } },
    { effects: { focus: 2, cash: usd(-3_000) }, outcomes: [{ weight: 55, effects: {} }, { weight: 45, effects: split(20) }] },
  ]),
  card('fam_school', 'family', { once: true, when: { minChildren: 1, minRound: 3 } }, [
    {},
    { effects: { recurring: [yearly('school', 'expense', 7_000, 6)], status: 5 } },
    { effects: { recurring: [yearly('school', 'expense', 16_000, 6)], status: 10 } },
  ]),
];

/**
 * A lodger in the spare room: one who pays and is no trouble, one who stops paying, one who opens
 * doors, and one a partner cannot stand.
 */
export const lodgerCards: CardDef[] = [
  card('lodger_good', 'lifestyle', { weight: 6, cooldown: 6, when: { lodger: true } }, [
    {},
    { outcomes: [{ weight: 70, effects: { cash: usd(2_400) } }, { weight: 30, effects: { endLodger: true } }] },
  ]),
  card('lodger_unpaid', 'lifestyle', { weight: 6, cooldown: 6, when: { lodger: true } }, [
    { outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { cash: usd(-3_000), endLodger: true } }] },
    { effects: { cash: usd(-1_500), endLodger: true } },
  ]),
  card('lodger_friend', 'lifestyle', { weight: 4, once: true, when: { lodger: true } }, [
    { effects: { skills: { network: 1 } } },
    { effects: { skills: { network: 3 }, status: 1 } },
  ]),
  card('lodger_tension', 'lifestyle', { weight: 8, cooldown: 4, when: { lodger: true, partner: true } }, [
    { effects: { endLodger: true } },
    { outcomes: [{ weight: 80, effects: { status: -2 } }, { weight: 20, effects: { partner: null } }] },
  ]),
];
