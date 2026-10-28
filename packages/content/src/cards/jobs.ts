import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/**
 * Content 1.52: four cards for each of the four careers added last, dealt only to someone working in it. Each tells the lesson of its
 * trade: a pilot's licence and a job the economy can ground, an architect's pay that follows the building cycle, an estate agent's
 * commission and the market they know from the inside, and a soldier's safe pay and early pension.
 */
const OWN = { weight: 14 } as const;

export const jobCards: CardDef[] = [
  // The yearly medical finds a murmur. A specialist who clears it costs money, which health cover mostly pays; without one, the licence waits.
  card('aviation_medical', 'career', { ...OWN, when: { careers: ['aviation'], minLevel: 1, minRound: 2 } }, [
    { effects: { job: { levelDelta: -1 }, salaryBoostPct: -30 } },
    { effects: { cash: usd(-8_000), protection: { insurance: 'health', coverPct: 75 } } },
  ]),
  // The pilots strike over pay. Flying through it keeps the pay and costs the colleagues' regard; striking costs a round's pay and may win a raise for good.
  card('aviation_strike', 'career', { ...OWN, when: { careers: ['aviation'], minRound: 1 } }, [
    { effects: { status: -2 } },
    { effects: { salaryBoostPct: -30 }, outcomes: [{ weight: 60, effects: { salaryModPct: 4 } }, { weight: 40, effects: {} }] },
  ]),
  // The airline opens a base at one of the two hubs of the east and asks who will move with the job: the move is paid, and so is the base.
  card('aviation_base_abroad', 'career', { ...OWN, once: true, when: { careers: ['aviation'], minLevel: 1 } }, [
    {},
    { when: { notCities: ['dubai'] }, effects: { moveCity: 'dubai', salaryModPct: 10 } },
    { when: { notCities: ['singapore'] }, effects: { moveCity: 'singapore', salaryModPct: 10 } },
  ]),
  // A recession grounds the fleet. Leave on half pay waits for the planes to fly again; the cargo airline pays less for good, and never grounds anyone.
  card('aviation_grounded', 'career', { ...OWN, when: { careers: ['aviation'], regimes: ['recession'], notFlags: ['layoff_proof'] } }, [
    { effects: { salaryBoostPct: -50 } },
    { effects: { salaryModPct: -12, setFlags: ['layoff_proof'] } },
  ]),
  // The architect draws a house for themselves, and pays the builder what a client would not: the trade's discount.
  card('construction_own_house', 'housing', { ...OWN, once: true, when: { careers: ['construction'], minLevel: 1, minRound: 3, ownsHome: false } }, [
    {},
    { effects: { focus: 1, property: { typeId: 'house', pricePct: 80, downPct: 20, rented: false } } },
  ]),
  // A developer will not pay the invoice. Letting it go loses the fee; a lawsuit costs a round and money, and is won more often than not.
  card('construction_unpaid', 'career', { ...OWN, when: { careers: ['construction'], minRound: 1 } }, [
    { effects: { cashSalaryPct: -15 } },
    { effects: { focus: 1, cash: usd(-2_000) }, outcomes: [{ weight: 60, effects: { cashSalaryPct: 25 } }, { weight: 40, effects: { cashSalaryPct: -15 } }] },
  ]),
  // A balcony the architect signed has cracked. Paying for the repair at once costs money; a fight over who is to blame may cost more, in money and in name.
  card('construction_collapse', 'career', { ...OWN, when: { careers: ['construction'], minLevel: 1 } }, [
    { effects: { cashSalaryPct: -20, status: -3 } },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { status: -1 } }, { weight: 50, effects: { cashSalaryPct: -40, status: -5 } }] },
  ]),
  // A celebrity wants a villa. It makes a name and pays a fee, and takes a round's focus.
  card('construction_famous_client', 'career', { ...OWN, once: true, when: { careers: ['construction'], minLevel: 1 } }, [
    {},
    { effects: { focus: 1, status: 6, cashSalaryPct: 40 } },
  ]),
  // A flat not yet listed, to let: bought before the market sees it, at the price it will not be sold at again.
  card('realestate_off_market', 'investing', { ...OWN, when: { careers: ['realestate'], minLevel: 1, minRound: 2 } }, [
    {},
    { effects: { property: { typeId: 'flat', pricePct: 85, downPct: 20, rented: true } } },
  ]),
  // A seller who must sell this month: the investor client pays a commission for the tip, or the agent buys it to live in.
  card('realestate_hurried_seller', 'housing', { ...OWN, when: { careers: ['realestate'], minRound: 1 } }, [
    {},
    { effects: { cash: usd(5_000) } },
    { when: { ownsHome: false }, effects: { property: { typeId: 'flat', pricePct: 80, downPct: 15, rented: false } } },
  ]),
  // Everyone at the agency says the top is near. Selling the home at it, or holding on.
  card('realestate_bubble', 'housing', { ...OWN, when: { careers: ['realestate'], regimes: ['boom'], ownsHome: true } }, [
    {},
    { effects: { sellHome: true } },
  ]),
  // Both buyer and seller would pay a fee, if neither knew of the other's. Now and then one finds out, and it is a fine and a name.
  card('realestate_double_fee', 'career', { ...OWN, when: { careers: ['realestate'], minLevel: 1 } }, [
    {},
    { effects: { cashSalaryPct: 30 }, outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { cashSalaryPct: -50, status: -4 } }] },
  ]),
  // Six months on a mission abroad: a bonus and standing, and the chance of coming back hurt. A refusal is noted.
  card('military_mission', 'career', { ...OWN, when: { careers: ['military'], minRound: 1 } }, [
    { effects: { status: -2 } },
    { effects: { cash: usd(12_000), status: 3 }, outcomes: [{ weight: 80, effects: {} }, { weight: 20, effects: { skills: { health: -3 } } }] },
  ]),
  // Twenty years of service: a pension for life from the day one leaves, worth about half the pay, and a civilian post to go with it.
  card('military_twenty_years', 'career', { ...OWN, once: true, when: { careers: ['military'], minRound: 10 } }, [
    {},
    { effects: { recurring: [yearly('army_pension', 'passive', 14_000, null)], job: { career: 'public', level: 1 } } },
  ]),
  // The army moves the unit to another city, and pays the move; asking to stay costs a round of the career.
  card('military_posting', 'career', { ...OWN, once: true, when: { careers: ['military'], minRound: 2 } }, [
    { effects: { careerSkill: -2 } },
    { when: { notCities: ['dubai'] }, effects: { moveCity: 'dubai', skills: { languages: 1 } } },
    { when: { notCities: ['london'] }, effects: { moveCity: 'london', skills: { languages: 1 } } },
  ]),
  // A private security firm abroad wants the officer: much more pay for good, in a trade that wears the body and the name.
  card('military_contractor', 'career', { ...OWN, once: true, when: { careers: ['military'], minLevel: 2 } }, [
    {},
    { effects: { salaryModPct: 60, status: -3, skills: { health: -3 }, clearFlags: ['layoff_proof'] } },
  ]),
];
