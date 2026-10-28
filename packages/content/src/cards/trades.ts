import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';
import { TRAINING_BOND } from './extra';

/**
 * Content 1.52: three cards for each of the eleven careers the game had before the four added last (healthcare's third still to come),
 * dealt only to someone working in it. Money is counted in a share of the player's own pay wherever it can be, so a card weighs the
 * same in Bangkok as in Zurich.
 */
const OWN = { weight: 14 } as const;
/** A round of layoffs, marked as the trade's other layoffs mark it, so two never come in the same round. */
const LAID_OFF = { flag: 'laid_off', rounds: 1 };

export const tradeCards: CardDef[] = [
  // A night in A&E ends with a blow. Carrying on wears the nerves; a report may be heard; a ward is calmer, and pays no nights.
  card('healthcare_assault', 'career', { ...OWN, when: { careers: ['healthcare'], minRound: 1 } }, [
    { effects: { skills: { health: -1 } } },
    { effects: { focus: 1 }, outcomes: [{ weight: 70, effects: { status: 2 } }, { weight: 30, effects: {} }] },
    { effects: { salaryModPct: -4, skills: { health: 2 } } },
  ]),
  // Two big hospitals elsewhere offer a post for good, better paid: the move is theirs to arrange.
  card('healthcare_post_away', 'career', { ...OWN, once: true, when: { careers: ['healthcare'], minRound: 2 } }, [
    {},
    { when: { notCities: ['madrid'] }, effects: { moveCity: 'madrid', salaryModPct: 8, setFlags: ['layoff_proof'] } },
    { when: { notCities: ['london'] }, effects: { moveCity: 'london', salaryModPct: 8, setFlags: ['layoff_proof'] } },
  ]),
  // Options of a company that may list: a little for sure now, or three times as much if the listing comes.
  card('tech_stock_options', 'career', { ...OWN, when: { careers: ['tech'], flags: ['share_plan'], minRound: 2 } }, [
    { effects: { cashSalaryPct: 20 } },
    { outcomes: [{ weight: 30, effects: { cashSalaryPct: 60 } }, { weight: 70, effects: {} }] },
  ]),
  // A fifth of the staff must go, volunteers first. Staying may cost pay; the payoff is half a year's pay and a few months looking for the next desk.
  card('tech_layoffs', 'career', { ...OWN, when: { careers: ['tech'], minLevel: 1, regimes: ['slowdown', 'recession'], notFlags: ['layoff_proof'], notRecentFlag: LAID_OFF } }, [
    { effects: { setFlags: ['laid_off'] }, outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { salaryModPct: -8 } }] },
    { effects: { cashSalaryPct: 50, salaryBoostPct: -40, setFlags: ['laid_off'], clearFlags: ['share_plan'] } },
  ]),
  // A firm in New York pays far more, a rung down to start; or the offer is shown to the boss.
  card('tech_new_york', 'career', { ...OWN, once: true, when: { notRecentFlag: TRAINING_BOND, careers: ['tech'], minLevel: 1, notCities: ['new_york'] } }, [
    {},
    { effects: { moveCity: 'new_york', salaryModPct: 20, job: { levelDelta: -1 } } },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { salaryModPct: 8 } }, { weight: 50, effects: {} }] },
  ]),
  // The exam for the senior corps: two rounds of evenings in one, and few places.
  card('public_exam', 'career', { ...OWN, when: { careers: ['public'], maxLevel: 2, minRound: 1 } }, [
    {},
    { effects: { focus: 2 }, outcomes: [{ weight: 45, effects: { job: { levelDelta: 1 }, status: 3 } }, { weight: 55, effects: {} }] },
  ]),
  // In hard times the state cuts its servants' pay. A strike costs its unpaid days, and stops the cut half the time.
  card('public_pay_cut', 'career', { ...OWN, when: { careers: ['public'], regimes: ['slowdown', 'recession'] } }, [
    { effects: { salaryModPct: -3 } },
    { effects: { salaryBoostPct: -8 }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { salaryModPct: -3 } }] },
  ]),
  // An international body takes civil servants into its offices, with an allowance for the first years: a round's pay and a fifth on top.
  card('public_abroad', 'career', { ...OWN, once: true, when: { careers: ['public'], minLevel: 1, minRound: 2 } }, [
    {},
    { when: { notCities: ['madrid'] }, effects: { moveCity: 'madrid', salaryBoostPct: 20, careerSkill: 2 } },
    { when: { notCities: ['moscow'] }, effects: { moveCity: 'moscow', salaryBoostPct: 20, careerSkill: 2 } },
  ]),
  // The rider's app pays less per order. Another app may pay what the old one did, or cut too.
  card('service_app_cut', 'career', { ...OWN, when: { careers: ['service'], maxLevel: 0 } }, [
    { effects: { salaryModPct: -6 } },
    { effects: { focus: 1 }, outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { salaryModPct: -6 } }] },
  ]),
  // The riders strike. Riding through it pays double orders and costs the others' regard; striking costs a round's tenth, and may win a better rate.
  card('service_strike', 'career', { ...OWN, when: { careers: ['service'], maxLevel: 0, minRound: 1 } }, [
    { effects: { salaryBoostPct: 10, status: -2 } },
    { effects: { salaryBoostPct: -10 }, outcomes: [{ weight: 50, effects: { salaryModPct: 5 } }, { weight: 50, effects: {} }] },
  ]),
  // The next rung at once, for someone who answers the phone at any hour: a point of focus less every round.
  card('service_on_call', 'career', { ...OWN, once: true, when: { careers: ['service'], minLevel: 1, maxLevel: 3 } }, [
    {},
    { effects: { job: { levelDelta: 1 }, focusBase: -1, status: 2 } },
  ]),
  // The bonus in cash, or in the bank's own shares, which may double or halve.
  card('finance_bonus', 'career', { ...OWN, when: { careers: ['finance'], minRound: 1 } }, [
    { effects: { cashSalaryPct: 30 } },
    { outcomes: [{ weight: 60, effects: { cashSalaryPct: 60 } }, { weight: 40, effects: { cashSalaryPct: 15 } }] },
  ]),
  // A client lets slip a takeover. Trading on it pays, until the regulator looks: a fine, a name and the career.
  card('finance_insider', 'career', { ...OWN, once: true, when: { careers: ['finance'], minRound: 2 } }, [
    { effects: { status: 1 } },
    { effects: { cashSalaryPct: 50 }, outcomes: [{ weight: 75, effects: {} }, { weight: 25, effects: { cashSalaryPct: -80, status: -6, job: { leave: true } } }] },
  ]),
  // A bigger bank buys the player's. A smaller title and more pay, or a payoff for leaving work for good.
  card('finance_merger', 'career', { ...OWN, once: true, when: { careers: ['finance'], minLevel: 1, minRound: 8 } }, [
    { effects: { job: { levelDelta: -1 }, salaryModPct: 10 } },
    { effects: { job: { leave: true }, cashSalaryPct: 150, clearFlags: ['share_plan'] } },
  ]),
  // A family sues over a diagnosis. A settlement costs money; the court may clear the doctor, or cost more in money and name.
  card('medicine_negligence', 'career', { ...OWN, when: { careers: ['medicine'], minRound: 1 } }, [
    { effects: { cashSalaryPct: -20 } },
    { effects: { focus: 1 }, outcomes: [{ weight: 65, effects: { status: 2 } }, { weight: 35, effects: { cashSalaryPct: -50, status: -4 } }] },
  ]),
  // A place to train as a specialist, before the rung of one: two points of focus for experience and pay.
  card('medicine_specialty', 'career', { ...OWN, once: true, when: { careers: ['medicine'], maxLevel: 1, maxRound: 10 } }, [
    {},
    { effects: { focus: 2, careerSkill: 4, salaryModPct: 6 } },
  ]),
  // A private clinic pays a fifth more, and is no job for life; the public hospital keeps its patients' regard.
  card('medicine_private_clinic', 'career', { ...OWN, once: true, when: { notRecentFlag: TRAINING_BOND, careers: ['medicine'], minLevel: 1 } }, [
    { effects: { status: 2 } },
    { effects: { salaryModPct: 20, status: -2, clearFlags: ['layoff_proof'] } },
  ]),
  // A famous defendant: a name made, or a public defeat.
  card('law_big_case', 'career', { ...OWN, when: { careers: ['law'], minLevel: 1 } }, [
    {},
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { status: 6 } }, { weight: 50, effects: { status: -3 } }] },
  ]),
  // A client who pays in cash and wants no receipts: money, and the tax office's attention.
  card('law_cash_client', 'career', { ...OWN, when: { careers: ['law'], minRound: 1 } }, [
    { effects: { status: 1 } },
    { effects: { cashSalaryPct: 30, suspicion: 25 } },
  ]),
  // Two clients would follow an associate into a firm of their own: a quarter of a year's pay to set up, and a share of the profits if they do.
  card('law_own_firm', 'career', { ...OWN, once: true, when: { careers: ['law'], minLevel: 2, maxLevel: 3, minRound: 4 } }, [
    {},
    { effects: { cashSalaryPct: -25 }, outcomes: [{ weight: 55, effects: { recurring: [yearly('own_firm', 'passive', 10_000, null)], status: 3 } }, { weight: 45, effects: { status: -2 } }] },
  ]),
  // The long summer: rest, or a summer's tutoring.
  card('education_summer', 'career', { ...OWN, when: { careers: ['education'], minRound: 1 } }, [
    { effects: { skills: { health: 1 } } },
    { effects: { focus: 1, cashSalaryPct: 15 } },
  ]),
  // A pupil kept at school, famous now, thanks the teacher in public: the pride of it, or the doors it opens.
  card('education_old_pupil', 'career', { ...OWN, once: true, when: { careers: ['education'], minRound: 4 } }, [
    { effects: { status: 2 } },
    { effects: { skills: { network: 2 } } },
  ]),
  // The curriculum changes again. Doing the minimum falls behind; learning it costs a point of focus; a protest may stop it.
  card('education_new_law', 'career', { ...OWN, when: { careers: ['education'], minRound: 1 } }, [
    { effects: { careerSkill: -1 } },
    { effects: { focus: 1, careerSkill: 2 } },
    { outcomes: [{ weight: 30, effects: { status: 3 } }, { weight: 70, effects: { status: -1 } }] },
  ]),
  // A brand of slimming tea pays a fortune for a month of posts, and may take the audience's trust with it.
  card('influencer_dodgy_brand', 'career', { ...OWN, when: { careers: ['influencer'], minRound: 1 } }, [
    { effects: { status: 1 } },
    { effects: { cashSalaryPct: 40 }, outcomes: [{ weight: 65, effects: {} }, { weight: 35, effects: { status: -5 } }] },
  ]),
  // The platform hides the posts. Waiting costs a fifth of a round's pay; paid promotion costs money, and works more often than not.
  card('influencer_shadowban', 'career', { ...OWN, when: { careers: ['influencer'], minRound: 1 } }, [
    { effects: { salaryBoostPct: -20 } },
    { effects: { cashSalaryPct: -15 }, outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { salaryBoostPct: -20 } }] },
  ]),
  // A week of fame: followed up, it may lift the creator a rung; left alone, it leaves a quiet week.
  card('influencer_viral', 'career', { ...OWN, when: { careers: ['influencer'], minLevel: 1, maxLevel: 2 } }, [
    { effects: { skills: { health: 1 } } },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { job: { levelDelta: 1 }, status: 3 } }, { weight: 50, effects: {} }] },
  ]),
  // The guide's inspectors are in town: a season of perfect plates, for a star now and then.
  card('hospitality_star', 'career', { ...OWN, once: true, when: { careers: ['hospitality'], minLevel: 1 } }, [
    {},
    { effects: { focus: 2, skills: { health: -1 } }, outcomes: [{ weight: 30, effects: { status: 8, salaryModPct: 15 } }, { weight: 70, effects: {} }] },
  ]),
  // The cold room fails before an inspection, and the owner will not pay: the manager does, or hides it.
  card('hospitality_inspection', 'career', { ...OWN, when: { careers: ['hospitality'], minLevel: 2 } }, [
    { effects: { cashSalaryPct: -8 } },
    { outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { cashSalaryPct: -25, status: -3 } }] },
  ]),
  // The bar next door is for lease, fittings and all, to someone who knows the trade from the inside: a bar of one's own for a little less than it is worth.
  card('hospitality_next_door', 'business', { ...OWN, once: true, when: { careers: ['hospitality'], minLevel: 2, minRound: 2, hasBusiness: false } }, [
    {},
    { effects: { cash: usd(-35_000), business: { typeId: 'bar', capital: usd(40_000) } } },
  ]),
  // A giant client: half the commission for sure with a colleague, or all of it, now and then, alone.
  card('sales_giant_client', 'career', { ...OWN, when: { careers: ['sales'], minRound: 1 } }, [
    { effects: { cashSalaryPct: 20 } },
    { effects: { focus: 1 }, outcomes: [{ weight: 40, effects: { cashSalaryPct: 80, status: 2 } }, { weight: 60, effects: {} }] },
  ]),
  // The quota doubles. Pushing for it wears the body and may pay; talking it down costs a point of focus, and goes better for someone who can bargain.
  card('sales_quota', 'career', { ...OWN, when: { careers: ['sales'], minRound: 1 } }, [
    { effects: { skills: { health: -1 } }, outcomes: [{ weight: 55, effects: { salaryModPct: 6 } }, { weight: 45, effects: { salaryModPct: -5 } }] },
    { when: { unless: { minSkills: { negotiation: 2 } } }, effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { salaryModPct: 3 } }, { weight: 50, effects: {} }] },
    { when: { minSkills: { negotiation: 2 } }, effects: { focus: 1 }, outcomes: [{ weight: 80, effects: { salaryModPct: 4 } }, { weight: 20, effects: {} }] },
  ]),
  // A competitor wants the player and their clients: more pay and the old firm's grudge, or an offer shown to the boss.
  card('sales_poached', 'career', { ...OWN, once: true, when: { notRecentFlag: TRAINING_BOND, careers: ['sales'], minLevel: 1 } }, [
    {},
    { effects: { salaryModPct: 15, status: -2 } },
    { outcomes: [{ weight: 50, effects: { salaryModPct: 8 } }, { weight: 50, effects: { status: -1 } }] },
  ]),
];
