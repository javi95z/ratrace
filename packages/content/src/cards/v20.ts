import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/** Content 1.48: cards of the everyday, so that a few lives in a row do not meet the same ones. */
export const v20Cards: CardDef[] = [
  // A classic left in a barn: sold as it is, or brought back, which costs before it pays.
  card('luck_barn_car', 'luck', { once: true, when: { minRound: 3 } }, [
    { effects: { cash: usd(6_000) } },
    { effects: { cash: usd(-12_000) }, outcomes: [{ weight: 60, effects: { cash: usd(38_000) } }, { weight: 40, effects: { cash: usd(9_000) } }] },
    { effects: { cash: usd(-12_000), status: 4, recurring: [yearly('classic_car', 'expense', 800, null)] } },
  ]),
  // A friend's shakes, sold to friends: it pays almost nobody, and costs a friendship or two.
  card('life_mlm', 'lifestyle', { once: true, when: { minRound: 1 } }, [
    {},
    { effects: { cash: usd(-2_500) }, outcomes: [{ weight: 15, effects: { cash: usd(6_000) } }, { weight: 85, effects: { cash: usd(300) } }] },
    { effects: { cash: usd(-2_500), status: -2 }, outcomes: [{ weight: 40, effects: { cash: usd(4_500) } }, { weight: 60, effects: { status: -1 } }] },
  ]),
  // Madrid only: squatters in the flat that was let. Paying them is quick; the courts are slow.
  card('house_squatters', 'housing', { once: true, when: { cities: ['madrid'], landlord: true } }, [
    { effects: { cash: usd(-1_500), recurring: [yearly('squatters', 'expense', 6_000, 1)] } },
    { effects: { cash: usd(-8_000) } },
    { effects: { cash: usd(-4_000) }, outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { cash: usd(-3_000), status: -2 } }] },
  ]),
  // Panels on the roof: money now, a smaller bill for good.
  card('house_solar', 'housing', { once: true, when: { ownsHome: true } }, [
    {},
    { effects: { cash: usd(-9_000), recurring: [yearly('solar', 'passive', 1_400, null)] } },
    { effects: { cash: usd(-15_000), recurring: [yearly('solar', 'passive', 2_000, null)], status: 1 } },
  ]),
  // The family house in the village, left to the player: sold cheap, kept for summers, or let to visitors.
  card('fam_village_house', 'family', { once: true, when: { minRound: 4 } }, [
    { effects: { cash: usd(15_000) } },
    { effects: { cash: usd(-20_000), status: 4, recurring: [yearly('village_house', 'expense', 1_200, null)] } },
    { effects: { cash: usd(-25_000), recurring: [yearly('village_house', 'passive', 3_500, null)] } },
  ]),
  // The company the player works for goes public: their shares can be sold on the first day, or held.
  card('career_company_ipo', 'career', { once: true, when: { employed: true, careers: ['tech', 'finance'], minLevel: 1 } }, [
    { effects: { cashSalaryPct: 40 } },
    { outcomes: [{ weight: 45, effects: { cashSalaryPct: 120 } }, { weight: 35, effects: { cashSalaryPct: 40 } }, { weight: 20, effects: { cashSalaryPct: 10 } }] },
    { effects: { cashSalaryPct: 20 }, outcomes: [{ weight: 50, effects: { cashSalaryPct: 50 } }, { weight: 50, effects: { cashSalaryPct: 10 } }] },
  ]),
  // Two years of works outside the door: fewer customers, whatever the owner does.
  card('biz_metro_works', 'business', { once: true, when: { hasBusiness: true } }, [
    { effects: { businessesPct: -25 } },
    { effects: { businessesPct: -25, focus: 1 }, outcomes: [{ weight: 40, effects: { cash: usd(8_000) } }, { weight: 60, effects: {} }] },
    { effects: { cash: usd(-3_000), businessesPct: -10 } },
  ]),
  // A strike: going in is noticed by the boss, staying out by everyone else.
  card('career_strike', 'career', { once: true, when: { employed: true, minRound: 2 } }, [
    { effects: { status: -1 }, outcomes: [{ weight: 50, effects: { salaryModPct: 2 } }, { weight: 50, effects: {} }] },
    { effects: { cashSalaryPct: -5, skills: { network: 1 } }, outcomes: [{ weight: 50, effects: { salaryModPct: 4 } }, { weight: 50, effects: {} }] },
    { effects: { focus: 1, cashSalaryPct: -5, skills: { network: 1, negotiation: 1 } }, outcomes: [{ weight: 40, effects: { salaryModPct: 6 } }, { weight: 60, effects: { salaryModPct: -2 } }] },
  ]),
  // Twenty years on, the old class meets: to look the part, or to tell it as it is.
  card('life_school_reunion', 'lifestyle', { once: true, when: { minRound: 4 } }, [
    {},
    { effects: { cash: usd(-4_000), status: 3 } },
    { effects: { skills: { network: 1 } }, outcomes: [{ weight: 30, effects: { salaryModPct: 5 } }, { weight: 70, effects: {} }] },
  ]),
  // A child who wants to stream: almost always nothing, now and then a fortune.
  card('fam_child_streamer', 'family', { once: true, when: { minChildren: 1, minRound: 6 } }, [
    {},
    { effects: { cash: usd(-2_500) }, outcomes: [{ weight: 5, effects: { cash: usd(60_000), status: 3 } }, { weight: 95, effects: {} }] },
    { effects: { cash: usd(-2_500), focus: 1, skills: { management: 1 } }, outcomes: [{ weight: 12, effects: { cash: usd(60_000), status: 3 } }, { weight: 88, effects: {} }] },
  ]),
  // The stag or hen party falls to the player to organise.
  card('life_stag_party', 'lifestyle', { when: { maxRound: 10 } }, [
    { effects: { status: -1 } },
    { effects: { cash: usd(-800), skills: { network: 1 } } },
    { effects: { cash: usd(-6_000), status: 3, skills: { network: 2 } } },
  ]),
  // A post about a lesson learnt goes round the professional network: offers, contacts, or a cringe for good.
  card('career_linkedin_post', 'career', { once: true, when: { employed: true, minRound: 2 } }, [
    {},
    { outcomes: [{ weight: 25, effects: { salaryModPct: 6, skills: { network: 1 } } }, { weight: 50, effects: { skills: { network: 1 } } }, { weight: 25, effects: { status: -2 } }] },
  ]),
  // Asked onto a podcast about money, for knowing about money: standing and contacts, and a clip that may live on.
  card('life_podcast', 'lifestyle', { once: true, when: { minFinanceSkill: 2, minRound: 3 } }, [
    {},
    { effects: { status: 2, skills: { network: 1 } }, outcomes: [{ weight: 80, effects: {} }, { weight: 20, effects: { status: -3 } }] },
    { effects: { focus: 1, status: 2, skills: { network: 1 } }, outcomes: [{ weight: 95, effects: {} }, { weight: 5, effects: { status: -3 } }] },
  ]),
  // An AI agent is tried out on the player's desk work: learning to run it, or being run over by it.
  card('career_ai_agent', 'career', { once: true, when: { employed: true, careers: ['tech', 'finance', 'law', 'sales', 'public', 'education'], minRound: 2 } }, [
    { outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { salaryModPct: -6 } }] },
    { effects: { focus: 1, careerSkill: 2, salaryModPct: 3 } },
    { effects: { focus: 1, skills: { negotiation: 1 } }, outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { salaryModPct: -3 } }] },
  ]),
  // Weekends for an app: money now, paid for in health; with a car of one's own, more money and a risk on the road.
  card('life_gig_apps', 'lifestyle', { cooldown: 12, when: { minRound: 1, maxRound: 14 } }, [
    {},
    { effects: { cash: usd(5_000), skills: { health: -1 } } },
    { when: { ownsLadder: 'car' }, effects: { cash: usd(8_000), skills: { health: -1 } }, outcomes: [{ weight: 80, effects: {} }, { weight: 20, effects: { cash: usd(-2_500) } }] },
  ]),
  // Copying a trader from social media who shows 400% a year: sometimes good, often not, sometimes gone with the money.
  card('inv_copy_trading', 'investing', { once: true, when: { minNetWorth: usd(15_000) } }, [
    {},
    // On average a little less comes back than went in: the trader's fee, and the ones who vanish.
    { effects: { cash: usd(-2_000) }, outcomes: [{ weight: 20, effects: { cash: usd(7_000) } }, { weight: 40, effects: { cash: usd(1_000) } }, { weight: 40, effects: {} }] },
    { effects: { cash: usd(-15_000) }, outcomes: [{ weight: 20, effects: { cash: usd(52_500) } }, { weight: 40, effects: { cash: usd(7_500) } }, { weight: 40, effects: {} }] },
  ]),
  // The email is taken over and the photos and papers held to ransom.
  card('luck_hacked', 'luck', { once: true, when: { minRound: 1 } }, [
    { effects: { cash: usd(-400), status: -1 } },
    { effects: { cash: usd(-1_500) }, outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { status: -1 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { status: -2 } }] },
  ]),
  // A partner's father adds the player to a group that trades on an anonymous guru's signals. Saying no is not free either.
  card('fam_signal_group', 'family', { once: true, when: { partner: true, minRound: 2 } }, [
    {},
    { effects: { status: -1 } },
    { effects: { cash: usd(-3_000) }, outcomes: [{ weight: 25, effects: { cash: usd(8_000) } }, { weight: 75, effects: { cash: usd(600) } }] },
  ]),
  // Working from home, renting in the city: a house an hour out, with fibre, at under half the price of one in town.
  // It is in the same market as the city, so it follows the city's prices; it stands for less, being far from everything.
  card('house_remote_outskirts', 'housing', { once: true, when: { remote: true, ownsHome: false, minRound: 2 } }, [
    {},
    { effects: { property: { typeId: 'house', pricePct: 45, downPct: 20, rented: false }, skills: { health: 1 }, status: -6 } },
  ]),
];
