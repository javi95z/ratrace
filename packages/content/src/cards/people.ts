import type { CardDef, CardOption, Effects } from '@ratrace/engine';
import { metFlag } from '../people';
import type { PersonId } from '../people';
import { card, usd, yearly } from './build';

/**
 * Content 1.50: the people who come back (`people.ts`). Each story is a few cards that remember: the first is dealt like any other,
 * the next ones only once the flags of the one before are set, a round or more ago (the hand is drawn before its cards are answered),
 * and so likely then that they come within a round or two. The player's own three, the cousin, the ex and the classmate of the paper,
 * step in through a card each, named in its words by `{rival:<who>}`, which the interface fills.
 */

/**
 * How likely a story's first card is: like an everyday card, so a life meets some of the people and not all of them, two or three
 * with the parents (`pnpm --filter @ratrace/balance exec tsx src/people.ts`). Each story's first card is dealt over a different stretch
 * of a life (the coin to the young, the adviser to anyone with savings), and is weighed from this to meet a third of lives or so.
 */
const MEET = 8;
/** How likely a story's next card is once it is due: high enough to come within a round or two. */
const NEXT = 150;
/**
 * The parents come in every life, by age. Met in seven lives in ten (a weight of 20), the indexer topped more lives, not fewer (300 seeds:
 * 39.8 % against 37.7 %; at 14, 41.9 %): its cards cost every strategy, and fewer of them left the indexer ahead more often.
 */
const FAMILY = 400;

/** Every option of a person's card sets that they were met, whatever else it does. */
function person(who: PersonId, options: CardOption[]): CardOption[] {
  return options.map((option) => ({ ...option, effects: { ...option.effects, setFlags: [metFlag(who), ...(option.effects?.setFlags ?? [])] } }));
}

/** The person liked it: warm, and no longer cold. And the other way. */
const warm = (who: PersonId, ...flags: string[]): Effects => ({ setFlags: [`${who}_warm`, ...flags], clearFlags: [`${who}_cold`] });
const cold = (who: PersonId, ...flags: string[]): Effects => ({ setFlags: [`${who}_cold`, ...flags], clearFlags: [`${who}_warm`] });

/** Due once this flag has been set a round ago or more: never in the round that set it. */
const after = (flag: string, rounds = 1) => ({ flags: [flag], notRecentFlag: { flag, rounds } });

export const peopleCards: CardDef[] = [
  // The brother-in-law and his coin: in early, it goes five times up; held, it most often vanishes and now and then goes twenty.
  // Out, he boasts at dinner. Either way his own goes, and he comes for a loan, which he pays back or not.
  card('inlaw_coin', 'investing', { once: true, weight: MEET, when: { minRound: 1, maxRound: 14 } }, person('inlaw', [
    { effects: { setFlags: ['inlaw_out'] } },
    { effects: { cash: usd(-2_000), ...warm('inlaw', 'inlaw_in') } },
    { when: { minFinanceSkill: 1 }, effects: cold('inlaw', 'inlaw_out') },
  ])),
  card('inlaw_moon', 'investing', { once: true, weight: NEXT, when: after('inlaw_in') }, person('inlaw', [
    { outcomes: [{ weight: 85, effects: { setFlags: ['inlaw_held', 'inlaw_bubble'] } }, { weight: 15, effects: { cash: usd(40_000), setFlags: ['inlaw_jackpot'] } }] },
    { effects: { cash: usd(10_000), setFlags: ['inlaw_sold', 'inlaw_bubble'] } },
    { effects: { cash: usd(5_000) }, outcomes: [{ weight: 85, effects: { setFlags: ['inlaw_held', 'inlaw_bubble'] } }, { weight: 15, effects: { cash: usd(20_000), setFlags: ['inlaw_jackpot'] } }] },
  ])),
  card('inlaw_dinner', 'family', { once: true, weight: NEXT, when: after('inlaw_out') }, person('inlaw', [
    { effects: { setFlags: ['inlaw_bubble'] } },
    { effects: { cash: usd(-3_000), setFlags: ['inlaw_bubble'] }, outcomes: [{ weight: 80, effects: {} }, { weight: 20, effects: { cash: usd(9_000) } }] },
    { effects: { status: -1, ...cold('inlaw', 'inlaw_bubble') } },
  ])),
  card('inlaw_rug', 'investing', { once: true, weight: NEXT, when: after('inlaw_bubble') }, person('inlaw', [
    { effects: { setFlags: ['inlaw_broke'] } },
    { effects: { focus: 1, ...warm('inlaw', 'inlaw_broke') } },
  ])),
  card('inlaw_loan', 'family', { once: true, weight: NEXT, when: after('inlaw_broke') }, person('inlaw', [
    { effects: cold('inlaw') },
    { effects: { cash: usd(-5_000), ...warm('inlaw', 'inlaw_owes') } },
    { effects: { cash: usd(-1_000), ...warm('inlaw') } },
  ])),
  card('inlaw_repay', 'family', { once: true, weight: NEXT, when: after('inlaw_owes', 2) }, person('inlaw', [
    { effects: { clearFlags: ['inlaw_owes'] }, outcomes: [{ weight: 60, effects: { cash: usd(5_000), setFlags: ['inlaw_repaid'] } }, { weight: 40, effects: { cash: usd(2_000), setFlags: ['inlaw_owes'] } }] },
    { effects: { status: 1, setFlags: ['inlaw_warm', 'inlaw_forgiven'], clearFlags: ['inlaw_cold', 'inlaw_owes'] } },
  ])),

  // The boss: a weekend covered is remembered, with a rung abroad (no bonus on top: the rung is the reward, and no tax haven) and, in a recession's layoffs, her word; asked twice in vain, she stops asking.
  card('boss_weekend', 'career', { soon: true, cooldown: 3, weight: MEET - 2, when: { employed: true, minRound: 1, notFlags: ['boss_covered', 'boss_cold'] } }, person('boss', [
    { effects: { setFlags: ['boss_declined'], onceMore: { boss_declined: 'boss_cold' } } },
    { effects: { focus: 1, careerSkill: 1, ...warm('boss', 'boss_covered') } },
  ])),
  card('boss_offer', 'career', { once: true, weight: NEXT, when: { employed: true, ...after('boss_covered', 2) } }, person('boss', [
    {},
    { when: { notCities: ['london'] }, effects: { job: { levelDelta: 1 }, moveCity: 'london', setFlags: ['boss_moved'] } },
    { when: { cities: ['london'] }, effects: { job: { levelDelta: 1 }, moveCity: 'new_york', setFlags: ['boss_moved'] } },
  ])),
  // Never in the round another layoff came (`laid_off`, set by both): a hand may hold both, and the second is then taken back.
  card('boss_layoffs', 'career', { once: true, weight: NEXT / 2, when: { employed: true, flags: ['boss_met'], notFlags: ['layoff_proof'], regimes: ['recession'], notRecentFlag: { flag: 'laid_off', rounds: 1 } } }, person('boss', [
    { effects: { setFlags: ['laid_off'] }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { salaryBoostPct: -40, cashSalaryPct: 25, salaryModPct: -5 } }] },
    { when: { flags: ['boss_warm'] }, effects: { status: 1, setFlags: ['boss_protected', 'laid_off'] } },
    { effects: { salaryBoostPct: -40, cashSalaryPct: 40, salaryModPct: -5, setFlags: ['laid_off'] } },
  ])),

  // The landlord, while the player rents: a tenant who is no trouble pays the rises and is offered the flat at a friend's price.
  // The tenancy is counted from the damp (`landlord_since`): every other card of his sets `landlord_met` again. It is in one city
  // (`landlord_here`, which a move lets go of): he does not follow the player to another.
  card('landlord_damp', 'housing', { once: true, weight: MEET, when: { ownsHome: false, minRound: 1 } }, person('landlord', [
    { effects: { status: -1, ...warm('landlord', 'landlord_since', 'landlord_here') } },
    { effects: { focus: 1, ...cold('landlord', 'landlord_since', 'landlord_here') }, outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { status: -1 } }] },
    { effects: { cash: usd(-1_500), ...warm('landlord', 'landlord_since', 'landlord_here') } },
  ])),
  card('landlord_raise', 'housing', { soon: true, cooldown: 3, weight: NEXT / 3, when: { ownsHome: false, notFlags: ['landlord_left'], ...after('landlord_since', 2), flags: ['landlord_since', 'landlord_here'] } }, person('landlord', [
    { effects: { cash: usd(-1_800), ...warm('landlord', 'landlord_paid') } },
    { effects: { focus: 1 }, outcomes: [{ weight: 60, effects: { cash: usd(-600) } }, { weight: 40, effects: { cash: usd(-1_800), ...cold('landlord') } }] },
    { effects: { cash: usd(-1_200), setFlags: ['landlord_left'] } },
  ])),
  card('landlord_sale', 'housing', { once: true, weight: NEXT, when: { ownsHome: false, flags: ['landlord_warm', 'landlord_here'], notFlags: ['landlord_left'], notCities: ['singapore'], notRecentFlag: { flag: 'landlord_since', rounds: 3 } } }, person('landlord', [
    {},
    { effects: { property: { typeId: 'flat', pricePct: 80, downPct: 20, rented: false }, setFlags: ['landlord_sold'] } },
    { effects: { property: { typeId: 'flat', pricePct: 80, downPct: 100, rented: false }, setFlags: ['landlord_sold'] } },
  ])),

  // A friend's startup: a first cheque, a second, and two years on the news, which is most often a closing; then, maybe, a second idea.
  card('founder_pitch', 'investing', { once: true, weight: MEET, when: { minRound: 2, maxRound: 14 } }, person('founder', [
    {},
    { effects: { cash: usd(-5_000), ...warm('founder', 'founder_in') } },
    { effects: { focus: 1, skills: { network: 1 }, ...warm('founder') } },
  ])),
  card('founder_more', 'investing', { once: true, weight: NEXT, when: after('founder_in') }, person('founder', [
    { effects: { setFlags: ['founder_closed'] } },
    { effects: { cash: usd(-5_000), setFlags: ['founder_more'] } },
  ])),
  card('founder_exit', 'investing', { once: true, weight: NEXT, when: after('founder_more', 2) }, person('founder', [
    {
      outcomes: [
        { weight: 62, effects: { setFlags: ['founder_closed'] } },
        { weight: 28, effects: { cash: usd(20_000), setFlags: ['founder_sold'] } },
        { weight: 10, effects: { cash: usd(100_000), setFlags: ['founder_rich'] } },
      ],
    },
    { effects: { cash: usd(5_000), setFlags: ['founder_out'] } },
  ])),
  card('founder_second', 'investing', { once: true, weight: NEXT, when: after('founder_closed', 2) }, person('founder', [
    {},
    { effects: { cash: usd(-3_000) }, outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { cash: usd(15_000), setFlags: ['founder_won'] } }] },
    { effects: { focus: 1, skills: { network: 1 }, ...warm('founder') } },
  ])),

  // The bank's adviser: a "guaranteed" fund whose fee runs every year, and the bank's own insurance on a mortgage. A word in time saves it.
  card('advisor_fund', 'investing', { once: true, weight: MEET - 4, when: { minRound: 2, minNetWorth: usd(15_000) } }, person('advisor', [
    { effects: cold('advisor') },
    { effects: { invest: { assetId: 'treasury_short', amount: usd(10_000) }, recurring: [yearly('fund_fee', 'expense', 400, null)], ...warm('advisor', 'advisor_fund') } },
    { when: { minFinanceSkill: 2 }, effects: { invest: { assetId: 'msci_world', amount: usd(10_000) }, ...cold('advisor') } },
  ])),
  card('advisor_insurance', 'housing', { once: true, weight: MEET - 3, when: { hasMortgage: true } }, person('advisor', [
    { effects: cold('advisor') },
    { effects: { recurring: [yearly('bank_insurance', 'expense', 900, 10)], ...warm('advisor', 'advisor_insurance') } },
    { effects: { recurring: [yearly('outside_insurance', 'expense', 350, 10)], ...cold('advisor') } },
  ])),

  // The parents, in every life: help with a first home, care in their old age, and what they leave. Their story costs, whatever is
  // chosen: a care home its fees, caring for them a part of a year's pay as well; and what they leave as often brings debts.
  card('parents_help', 'family', { once: true, weight: FAMILY, when: { ownsHome: false, minRound: 1, maxRound: 5 } }, person('parents', [
    { effects: { status: 1, setFlags: ['parents_proud'] } },
    { effects: { cash: usd(6_000), setFlags: ['parents_helped'] } },
  ])),
  card('parents_care', 'family', { once: true, weight: FAMILY, when: { minRound: 9, maxRound: 14 } }, person('parents', [
    { effects: { recurring: [yearly('care_home', 'expense', 6_000, 4)], setFlags: ['parents_home'] } },
    { effects: { focus: 1, salaryBoostPct: -30, recurring: [yearly('parents_care', 'expense', 1_500, 4)], ...warm('parents', 'parents_cared') } },
  ])),
  card('parents_inheritance', 'laterLife', { once: true, weight: FAMILY, when: { minRound: 15 } }, person('parents', [
    {},
    // As it comes, debts and all: the estate, or debts beyond it, which the heir pays.
    { when: { unless: { flags: ['parents_warm'] } }, outcomes: [{ weight: 60, effects: { cash: usd(30_000) } }, { weight: 40, effects: { cash: usd(-10_000), setFlags: ['parents_debts'] } }] },
    // Someone who knows their papers knows there are no debts: the sure way of accepting it, in place of both blind ones.
    // It keeps its place, and the inventory comes last: a life under older rules reads its options' words by their place.
    { when: { flags: ['parents_warm'] }, effects: { cash: usd(30_000) } },
    // With the benefit of inventory: the notary's fee, then the debts paid only as far as the estate goes, never past it.
    { when: { unless: { flags: ['parents_warm'] } }, effects: { cash: usd(-2_000) }, outcomes: [{ weight: 60, effects: { cash: usd(30_000) } }, { weight: 40, effects: { setFlags: ['parents_debts'] } }] },
  ])),

  // The player's own people, of the paper: the cousin's wedding, the ex's new car, the classmate's firm.
  card('cousin_wedding', 'family', { once: true, weight: MEET, when: { minRound: 2, maxRound: 10 } }, [
    { effects: { status: -1 } },
    { effects: { cash: usd(-400) } },
    { effects: { cash: usd(-2_500), status: 3 } },
  ]),
  card('ex_new_car', 'lifestyle', { once: true, weight: MEET, when: { minRound: 3, maxRound: 12 } }, [
    {},
    { effects: { buyItem: { itemId: 'car_tesla_model_3', pricePct: 100 } } },
    { effects: { cash: usd(-600), status: 1 } },
  ]),
  card('classmate_job', 'career', { once: true, weight: MEET, when: { employed: true, minRound: 3, maxRound: 14 } }, [
    {},
    // A friend's firm is a bet: most often a better job, now and then a firm in trouble a year later.
    // Someone who can bargain is offered only the job at their price.
    { when: { unless: { minSkills: { negotiation: 2 } } }, outcomes: [{ weight: 70, effects: { salaryModPct: 12, status: 1 } }, { weight: 30, effects: { salaryModPct: -5 } }] },
    { when: { minSkills: { negotiation: 2 } }, effects: { salaryModPct: 15 } },
  ]),
  // The people, deeper (cards-54): the classmate's new flat, the cousin's yacht, a visit from the parents, the founder's bell, the boss's retirement.
  card('classmate_housewarming', 'housing', { once: true, weight: MEET, when: { ownsHome: false, minRound: 3, maxRound: 14 } }, [
    { effects: { cash: usd(-50) } },
    // The flats seen teach what a flat is worth; the classmate's lesson is how one is saved for.
    { effects: { focus: 1, skills: { negotiation: 1 } } },
    { when: { maxFinanceSkill: 1 }, effects: { focus: 1, financeSkill: 1 } },
  ]),
  card('cousin_yacht', 'lifestyle', { once: true, weight: MEET, when: { minRound: 4, maxRound: 14 } }, [
    { effects: { status: -1 } },
    { effects: { cash: usd(-1_500), status: 1 } },
    { effects: { cash: usd(-2_200), status: 3 } },
  ]),
  card('parents_visit', 'family', { once: true, weight: MEET, when: { minRound: 3, maxRound: 8 } }, person('parents', [
    { effects: { cash: usd(-300) } },
    { effects: { cash: usd(400), status: -1 } },
    { effects: { focus: 1, ...warm('parents') } },
  ])),
  // The bell rings only for the founder whose second company made it, two rounds on.
  card('founder_bell', 'investing', { once: true, weight: NEXT, when: after('founder_won', 2) }, person('founder', [
    { effects: warm('founder') },
    {
      effects: { cash: usd(-3_000) },
      outcomes: [
        { weight: 55, effects: { cash: usd(1_800) } },
        { weight: 35, effects: { cash: usd(4_000) } },
        { weight: 10, effects: { cash: usd(10_000) } },
      ],
    },
    { when: { employed: true }, outcomes: [{ weight: 60, effects: { salaryModPct: 10, status: 1 } }, { weight: 40, effects: {} }] },
  ])),
  // The boss retires late in a life, and leaves her contacts to whoever covered for her.
  card('boss_retire', 'career', { once: true, weight: NEXT, when: { flags: ['boss_warm'], minRound: 15 } }, person('boss', [
    {},
    { when: { employed: true }, effects: { careerSkill: 1, skills: { network: 1 } } },
    { when: { hasBusiness: true }, effects: { focus: 1, businessesPct: 10 } },
  ])),
];
