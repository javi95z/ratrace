import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';
import { TRAINING_BOND } from './extra';

/** A private employer in tech or finance comes with a share plan, and without a public servant's job for life. */
/**
 * A life changes trade once at most, by a card: after one, no card offers another. Each is rarer than
 * most cards, and the best-paid trades ask for the skill they need, or for a price.
 */
const CHANGED = 'changed_career';
const SWITCH = { once: true, weight: 5 } as const;
/** Starting again at the bottom of a better-paid trade: the first round is paid as a trainee. */
const TRAINEE = { salaryBoostPct: -30 };
const NEW_EMPLOYER = { setFlags: ['share_plan', CHANGED], clearFlags: ['layoff_proof'] };
/** A new trade with no share plan and no job for life: what is left behind on the way into one. */
const FRESH_START = { setFlags: [CHANGED], clearFlags: ['layoff_proof', 'share_plan'] };
const CAREERS = ['healthcare', 'tech', 'public', 'service', 'finance', 'medicine', 'law', 'education', 'influencer', 'hospitality', 'sales'];
/** Every career but the one named: who a way into it is offered to. */
const outside = (...ids: string[]) => CAREERS.filter((id) => !ids.includes(id));

export const careerCards: CardDef[] = [
  card('career_raise', 'career', { cooldown: 3, when: { employed: true } }, [
    {},
    { outcomes: [{ weight: 50, effects: { salaryModPct: 4 } }, { weight: 40, effects: {} }, { weight: 10, effects: { status: -2 } }] },
    // The same case, made by someone who can bargain: they are offered only the better way of making it.
    { when: { unless: { minSkills: { negotiation: 2 } } }, effects: { focus: 1, skills: { negotiation: 1 } }, outcomes: [{ weight: 70, effects: { salaryModPct: 5 } }, { weight: 30, effects: {} }] },
    // Someone who has learnt to bargain comes with figures nobody can wave away.
    { when: { minSkills: { negotiation: 2 } }, effects: { focus: 1, skills: { negotiation: 1 } }, outcomes: [{ weight: 80, effects: { salaryModPct: 7 } }, { weight: 20, effects: { salaryModPct: 3 } }] },
  ]),
  card('career_competitor_offer', 'career', { cooldown: 5, when: { notRecentFlag: TRAINING_BOND, employed: true, minRound: 2 } }, [
    {},
    { effects: { salaryModPct: 6, careerSkill: -1 } },
    { outcomes: [{ weight: 50, effects: { salaryModPct: 4 } }, { weight: 35, effects: {} }, { weight: 15, effects: { salaryModPct: -3 } }] },
  ]),
  card('career_relocation', 'career', { once: true, when: { employed: true, minLevel: 1, notCities: ['london'] } }, [
    {},
    { effects: { job: { levelDelta: 1 }, moveCity: 'london', cash: usd(4_000), skills: { languages: 1 } } },
  ]),
  // An employer with offices abroad sends someone with a rung behind them: a transfer costs the career nothing,
  // and pays the move. No bonus on top: a cheap city is reward enough.
  card('career_transfer_east', 'career', { once: true, when: { employed: true, minLevel: 1, minRound: 3, notCities: ['tokyo', 'moscow'] } }, [
    {},
    { when: { careers: ['tech', 'sales', 'finance', 'hospitality'] }, effects: { moveCity: 'tokyo', salaryModPct: 5, skills: { languages: 1 } } },
    { when: { careers: ['tech', 'finance', 'public', 'education'] }, effects: { moveCity: 'moscow', salaryModPct: 3, skills: { languages: 1 } } },
  ]),
  card('career_transfer_west', 'career', { once: true, when: { employed: true, minLevel: 1, minRound: 3, notCities: ['mexico_city', 'zurich'] } }, [
    {},
    { effects: { moveCity: 'mexico_city', skills: { languages: 1 } } },
    { when: { careers: ['finance', 'medicine', 'law', 'tech'] }, effects: { moveCity: 'zurich', salaryModPct: 4 } },
  ]),
  card('career_overtime_crunch', 'career', { cooldown: 3, when: { employed: true } }, [
    { outcomes: [{ weight: 80, effects: {} }, { weight: 20, effects: { salaryModPct: -2 } }] },
    { effects: { focus: 1, cashSalaryPct: 12, careerSkill: 1 } },
  ]),
  // Content 1.50: it marks the round (`laid_off`), so the boss's layoffs never come in the same one.
  card('career_layoff', 'career', { cooldown: 6, risk: 'job', when: { employed: true, notFlags: ['layoff_proof'], regimes: ['slowdown', 'recession'], notRecentFlag: { flag: 'laid_off', rounds: 1 } } }, [
    { effects: { salaryBoostPct: -40, cashSalaryPct: 25, salaryModPct: -5, setFlags: ['laid_off'] } },
    { effects: { focus: 1, setFlags: ['laid_off'] }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { salaryBoostPct: -50, cashSalaryPct: 10, salaryModPct: -5 } }] },
    { effects: { focus: 2, salaryBoostPct: -50, cashSalaryPct: 25, careerSkill: 3, setFlags: ['laid_off'] } },
  ]),
  // From 50 a firm looks again at who it pays most: a step down, a way out with a cheque, or a fight for the post.
  // Whoever answers nothing keeps a job, a rung lower. A post nobody can be dismissed from is never in question.
  card('career_restructuring', 'career', { weight: 8, cooldown: 6, risk: 'job', when: { employed: true, minRound: 14, notFlags: ['layoff_proof'] } }, [
    { effects: { job: { levelDelta: -1 }, salaryModPct: -8 } },
    { effects: { job: { leave: true }, cashSalaryPct: 150 } },
    { effects: { focus: 1 }, outcomes: [{ weight: 55, effects: {} }, { weight: 45, effects: { job: { leave: true }, cashSalaryPct: 100 } }] },
  ]),
  card('career_toxic_boss', 'career', { cooldown: 6, when: { employed: true } }, [
    { effects: { focus: 1 } },
    { outcomes: [{ weight: 50, effects: { status: 2 } }, { weight: 50, effects: { salaryModPct: -4 } }] },
    { effects: { salaryBoostPct: -10, careerSkill: 1 } },
  ]),
  card('career_switch', 'career', { ...SWITCH, when: { careers: ['healthcare', 'public', 'service', 'tech'], maxRound: 12, notFlags: [CHANGED] } }, [
    {},
    { when: { minFinanceSkill: 2 }, effects: { focus: 2, careerSkill: -5, job: { career: 'finance', level: 0 }, ...TRAINEE, ...NEW_EMPLOYER } },
    {
      effects: { focus: 1, cash: usd(-4_000) },
      outcomes: [{ weight: 60, effects: { job: { career: 'finance', level: 0 }, ...TRAINEE, ...NEW_EMPLOYER } }, { weight: 40, effects: {} }],
    },
  ]),
  // The two doors that open onto a street: the firm that takes clerks, and the market where anyone can sell or serve.
  card('career_law_firm', 'career', { ...SWITCH, when: { careers: outside('law', 'medicine'), maxRound: 8, notFlags: [CHANGED] } }, [
    {},
    { when: { minSkills: { negotiation: 2 } }, effects: { focus: 2, careerSkill: -6, job: { career: 'law', level: 0 }, ...TRAINEE, ...FRESH_START } },
    {
      effects: { focus: 1, cash: usd(-6_000) },
      outcomes: [{ weight: 55, effects: { job: { career: 'law', level: 0 }, careerSkill: -3, ...TRAINEE, ...FRESH_START } }, { weight: 45, effects: {} }],
    },
  ]),
  card('career_market', 'career', { ...SWITCH, when: { careers: outside('sales', 'medicine', 'law', 'finance'), maxRound: 12, notFlags: [CHANGED] } }, [
    {},
    { effects: { focus: 1, careerSkill: -4, job: { career: 'sales', level: 0 }, ...FRESH_START } },
  ]),
  // A way into each of the other newer careers, each with a scene of its own.
  card('career_bar', 'career', { ...SWITCH, when: { careers: outside('hospitality', 'medicine', 'law', 'finance'), maxRound: 12, notFlags: [CHANGED] } }, [
    {},
    { effects: { focus: 1, careerSkill: -4, job: { career: 'hospitality', level: 0 }, ...FRESH_START } },
  ]),
  card('career_teaching', 'career', { ...SWITCH, when: { careers: outside('education', 'medicine', 'law', 'finance'), maxRound: 12, notFlags: [CHANGED] } }, [
    {},
    { effects: { focus: 2, careerSkill: -4, job: { career: 'education', level: 0 }, setFlags: ['layoff_proof', CHANGED], clearFlags: ['share_plan'] } },
  ]),
  // An audience is for the young: the door closes at thirty-two.
  card('career_creator', 'career', { ...SWITCH, when: { careers: ['service', 'hospitality', 'sales', 'tech', 'healthcare', 'public', 'education'], maxRound: 5, notFlags: [CHANGED] } }, [
    {},
    { when: { minSkills: { network: 2 } }, effects: { focus: 2, careerSkill: -6, job: { career: 'influencer', level: 0 }, ...TRAINEE, ...FRESH_START } },
  ]),
  // The better-paid job nobody without a car can get to.
  card('career_out_of_town', 'career', { cooldown: 6, when: { employed: true, ownsLadder: 'car', minRound: 1 } }, [
    {},
    { effects: { focus: 1, salaryModPct: 7 } },
    { outcomes: [{ weight: 55, effects: { salaryModPct: 10 } }, { weight: 45, effects: {} }] },
  ]),
  card('career_big_offer', 'career', { once: true, when: { notRecentFlag: TRAINING_BOND, employed: true, minLevel: 1, minRound: 3 } }, [
    {},
    { effects: { focus: 1, salaryModPct: 10, status: 6 } },
    { outcomes: [{ weight: 60, effects: { salaryModPct: 15, status: 6 } }, { weight: 40, effects: {} }] },
  ]),
  card('career_shares_vs_salary', 'career', { cooldown: 8, when: { careers: ['tech', 'finance'] } }, [
    { effects: { salaryModPct: 4 } },
    // Worth about what the raise is over the years left, on average, with everything riding on the company.
    { outcomes: [{ weight: 25, effects: { cashSalaryPct: 200 } }, { weight: 45, effects: { cashSalaryPct: 60 } }, { weight: 30, effects: {} }] },
  ]),
  // The boss says yes to home before the rung would: only for someone not already working from it.
  card('career_remote_work', 'career', { once: true, when: { careers: ['tech', 'finance', 'public'], minRound: 1, notFlags: ['remote_work'], remote: false } }, [
    {},
    { effects: { setFlags: ['remote_work'], workMode: 'remote' } },
    { outcomes: [{ weight: 40, effects: { salaryModPct: 4 } }, { weight: 60, effects: {} }] },
  ]),
  // A boss on their way to a rival who wants to take the player along: more pay, if the new place holds.
  card('career_boss_leaves', 'career', { once: true, when: { employed: true, minLevel: 1, minRound: 2 } }, [
    {},
    { outcomes: [{ weight: 60, effects: { salaryModPct: 12, status: 2 } }, { weight: 40, effects: { salaryModPct: -5 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { salaryModPct: 5 } }, { weight: 50, effects: { status: -1 } }] },
  ]),
  card('career_become_manager', 'career', { once: true, when: { employed: true, minLevel: 1 } }, [
    { effects: { careerSkill: 1 } },
    { effects: { focus: 1, salaryModPct: 5, status: 3 } },
  ]),
  card('career_headhunter', 'career', { cooldown: 6, when: { notRecentFlag: TRAINING_BOND, employed: true, minLevel: 2 } }, [
    {},
    { effects: { focus: 1 }, outcomes: [{ weight: 45, effects: { salaryModPct: 8 } }, { weight: 55, effects: {} }] },
    { when: { notCities: ['new_york'] }, effects: { moveCity: 'new_york', salaryModPct: 6, cash: usd(5_000) } },
  ]),
];

export const educationCards: CardDef[] = [
  card('edu_masters', 'education', { once: true, when: { employed: true, maxRound: 8 } }, [
    {},
    { effects: { focus: 2, cash: usd(-12_000), careerSkill: 4, status: 3 } },
    { effects: { focus: 2, loan: usd(12_000), cash: usd(-12_000), careerSkill: 4, status: 3 } },
  ]),
  card('edu_finance_course', 'education', { when: { maxFinanceSkill: 1 } }, [
    {},
    { effects: { focus: 1, cash: usd(-900), financeSkill: 1 } },
  ]),
  card('edu_finance_book', 'education', { cooldown: 3, when: { maxFinanceSkill: 0 } }, [
    {},
    { effects: { focus: 1, cash: usd(-25) }, outcomes: [{ weight: 70, effects: { financeSkill: 1 } }, { weight: 30, effects: {} }] },
  ]),
  card('edu_mba', 'education', { once: true, when: { employed: true, minRound: 2, maxRound: 10, notItems: ['edu_mba'] } }, [
    {},
    { effects: { focus: 2, buyItem: { itemId: 'edu_mba', pricePct: 100 }, careerSkill: 5, salaryModPct: 6 } },
    { effects: { focus: 2, loan: usd(95_000), buyItem: { itemId: 'edu_mba', pricePct: 100 }, careerSkill: 5, salaryModPct: 6 } },
  ]),
  card('edu_bootcamp', 'education', { ...SWITCH, when: { careers: ['healthcare', 'public', 'service', 'finance'], maxRound: 10, notFlags: [CHANGED] } }, [
    {},
    { effects: { focus: 2, cash: usd(-7_000), careerSkill: -4, job: { career: 'tech', level: 0 }, ...TRAINEE, ...NEW_EMPLOYER } },
  ]),
  card('edu_language', 'education', { once: true, when: { notFlags: ['bilingual'] } }, [
    {},
    { effects: { focus: 1, cash: usd(-600), careerSkill: 1, status: 1, setFlags: ['bilingual'], skills: { languages: 3 } } },
  ]),
];

export const businessCards: CardDef[] = [
  card('biz_freelance_gig', 'business', { cooldown: 2 }, [
    {},
    // With a car the client's other site, an hour out of town, is within reach too: the gig is then offered only with both.
    { when: { unless: { ownsLadder: 'car' } }, effects: { focus: 1, cash: usd(2_500), careerSkill: 1 } },
    { when: { ownsLadder: 'car' }, effects: { focus: 1, cash: usd(4_500), careerSkill: 1 } },
  ]),
  card('biz_self_employed', 'business', { once: true, when: { employed: true, minLevel: 1, minFinanceSkill: 1 } }, [
    {},
    // Someone who is a member somewhere starts with people who already know them: the same leap, with better odds, and the only one offered them.
    {
      when: { unless: { ownsLadder: 'membership' } },
      effects: { focus: 2, setFlags: ['self_employed'] },
      outcomes: [{ weight: 40, effects: { salaryModPct: 15 } }, { weight: 35, effects: { salaryModPct: 4 } }, { weight: 25, effects: { salaryModPct: -10 } }],
    },
    {
      when: { ownsLadder: 'membership' },
      effects: { focus: 2, setFlags: ['self_employed'] },
      outcomes: [{ weight: 60, effects: { salaryModPct: 15 } }, { weight: 30, effects: { salaryModPct: 4 } }, { weight: 10, effects: { salaryModPct: -10 } }],
    },
  ]),
  // A business bought through a card is a business like any other from then on: run, grown, neglected or sold in the business tab.
  card('biz_bar', 'business', { cooldown: 8, when: { minFinanceSkill: 2, minRound: 2, hasBusiness: false } }, [
    {},
    {
      effects: { focus: 1, cash: usd(-40_000) },
      outcomes: [
        { weight: 35, effects: { business: { typeId: 'bar', capital: usd(55_000) } } },
        { weight: 35, effects: { business: { typeId: 'bar', capital: usd(35_000) } } },
        { weight: 30, effects: {} },
      ],
    },
    {
      effects: { cash: usd(-15_000) },
      outcomes: [{ weight: 50, effects: { recurring: [yearly('bar_stake', 'passive', 2_500, null)] } }, { weight: 50, effects: {} }],
    },
  ]),
  card('biz_online_shop', 'business', { cooldown: 6, when: { minFinanceSkill: 2, hasBusiness: false } }, [
    {},
    {
      effects: { focus: 2, cash: usd(-6_000) },
      outcomes: [
        { weight: 30, effects: { business: { typeId: 'shop', capital: usd(14_000) } } },
        { weight: 40, effects: { business: { typeId: 'shop', capital: usd(6_000) } } },
        { weight: 30, effects: {} },
      ],
    },
  ]),
  card('biz_airbnb', 'business', { cooldown: 6, when: { ownsHome: true } }, [
    {},
    { effects: { recurring: [yearly('spare_room', 'passive', 3_600, 3)], status: -1 } },
  ]),
  card('biz_app', 'business', { cooldown: 8, when: { careers: ['tech'], minFinanceSkill: 2, hasBusiness: false } }, [
    {},
    {
      effects: { focus: 2, cash: usd(-3_000) },
      outcomes: [
        { weight: 15, effects: { business: { typeId: 'app', capital: usd(45_000) } } },
        { weight: 30, effects: { business: { typeId: 'app', capital: usd(6_000) } } },
        { weight: 55, effects: { careerSkill: 2 } },
      ],
    },
  ]),
  card('biz_cofounder', 'business', { cooldown: 8, when: { minFinanceSkill: 1, minRound: 2 } }, [
    {},
    {
      effects: { cash: usd(-10_000) },
      outcomes: [{ weight: 12, effects: { cash: usd(90_000) } }, { weight: 23, effects: { cash: usd(15_000) } }, { weight: 65, effects: {} }],
    },
    {
      effects: { focus: 2, cash: usd(-5_000), careerSkill: 2 },
      outcomes: [{ weight: 15, effects: { cash: usd(120_000) } }, { weight: 35, effects: { cash: usd(8_000) } }, { weight: 50, effects: {} }],
    },
  ]),
  // A buyer pays for what a business could become, which no sale from the tab ever does: well over what is in it.
  card('biz_acquisition', 'business', { cooldown: 6, when: { hasBusiness: true } }, [
    {},
    { effects: { sellBusiness: { pricePct: 170 }, status: 4 } },
    {
      outcomes: [
        { weight: 40, effects: { sellBusiness: { pricePct: 250 }, status: 4 } },
        { weight: 60, effects: {} },
      ],
    },
  ]),
];
