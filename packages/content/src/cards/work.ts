import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

const BUSINESSES = ['bar', 'shop', 'app'];

/** A private employer in tech or finance comes with a share plan, and without a public servant's job for life. */
const NEW_EMPLOYER = { setFlags: ['share_plan'], clearFlags: ['layoff_proof'] };

export const careerCards: CardDef[] = [
  card('career_raise', 'career', { cooldown: 3, when: { employed: true } }, [
    {},
    { outcomes: [{ weight: 50, effects: { salaryModPct: 4 } }, { weight: 40, effects: {} }, { weight: 10, effects: { status: -2 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 70, effects: { salaryModPct: 5 } }, { weight: 30, effects: {} }] },
  ]),
  card('career_competitor_offer', 'career', { cooldown: 5, when: { employed: true, minRound: 2 } }, [
    {},
    { effects: { salaryModPct: 6, careerSkill: -1 } },
    { outcomes: [{ weight: 50, effects: { salaryModPct: 4 } }, { weight: 35, effects: {} }, { weight: 15, effects: { salaryModPct: -3 } }] },
  ]),
  card('career_relocation', 'career', { once: true, when: { employed: true, minLevel: 1, notCities: ['london'] } }, [
    {},
    { effects: { job: { levelDelta: 1 }, moveCity: 'london', cash: usd(4_000) } },
  ]),
  card('career_overtime_crunch', 'career', { cooldown: 3, when: { employed: true } }, [
    { outcomes: [{ weight: 80, effects: {} }, { weight: 20, effects: { salaryModPct: -2 } }] },
    { effects: { focus: 1, cashSalaryPct: 12, careerSkill: 1 } },
  ]),
  card('career_layoff', 'career', { cooldown: 6, when: { employed: true, notFlags: ['layoff_proof'], regimes: ['slowdown', 'recession'] } }, [
    { effects: { salaryBoostPct: -40, cashSalaryPct: 25, salaryModPct: -5 } },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { salaryBoostPct: -50, cashSalaryPct: 10, salaryModPct: -5 } }] },
    { effects: { focus: 2, salaryBoostPct: -50, cashSalaryPct: 25, careerSkill: 3 } },
  ]),
  card('career_toxic_boss', 'career', { cooldown: 6, when: { employed: true } }, [
    { effects: { focus: 1 } },
    { outcomes: [{ weight: 50, effects: { status: 2 } }, { weight: 50, effects: { salaryModPct: -4 } }] },
    { effects: { salaryBoostPct: -10, careerSkill: 1 } },
  ]),
  card('career_switch', 'career', { once: true, when: { careers: ['healthcare', 'public', 'service', 'tech'], maxRound: 12 } }, [
    {},
    { effects: { focus: 2, careerSkill: -5, job: { career: 'finance', level: 0 }, ...NEW_EMPLOYER } },
    {
      effects: { focus: 1, cash: usd(-4_000) },
      outcomes: [{ weight: 60, effects: { job: { career: 'finance', level: 0 }, ...NEW_EMPLOYER } }, { weight: 40, effects: {} }],
    },
  ]),
  card('career_big_offer', 'career', { once: true, when: { employed: true, minLevel: 1, minRound: 3 } }, [
    {},
    { effects: { focus: 1, salaryModPct: 10, status: 6 } },
    { outcomes: [{ weight: 60, effects: { salaryModPct: 15, status: 6 } }, { weight: 40, effects: {} }] },
  ]),
  card('career_shares_vs_salary', 'career', { cooldown: 8, when: { careers: ['tech', 'finance'] } }, [
    { effects: { salaryModPct: 4 } },
    // Worth about what the raise is over the years left, on average, with everything riding on the company.
    { outcomes: [{ weight: 25, effects: { cashSalaryPct: 200 } }, { weight: 45, effects: { cashSalaryPct: 60 } }, { weight: 30, effects: {} }] },
  ]),
  card('career_remote_work', 'career', { once: true, when: { careers: ['tech', 'finance', 'public'], minRound: 1, notFlags: ['remote_work'] } }, [
    {},
    { effects: { setFlags: ['remote_work'], salaryModPct: 3, careerSkill: -1 } },
    { outcomes: [{ weight: 40, effects: { salaryModPct: 4 } }, { weight: 60, effects: {} }] },
  ]),
  card('career_become_manager', 'career', { once: true, when: { employed: true, minLevel: 1 } }, [
    { effects: { careerSkill: 1 } },
    { effects: { focus: 1, salaryModPct: 5, status: 3 } },
  ]),
  card('career_headhunter', 'career', { cooldown: 6, when: { employed: true, minLevel: 2 } }, [
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
  card('edu_bootcamp', 'education', { once: true, when: { careers: ['healthcare', 'public', 'service', 'finance'], maxRound: 10 } }, [
    {},
    { effects: { focus: 2, cash: usd(-7_000), careerSkill: -4, job: { career: 'tech', level: 0 }, ...NEW_EMPLOYER } },
  ]),
  card('edu_language', 'education', { once: true, when: { notFlags: ['bilingual'] } }, [
    {},
    { effects: { focus: 1, cash: usd(-600), careerSkill: 1, status: 1, setFlags: ['bilingual'] } },
  ]),
];

export const businessCards: CardDef[] = [
  card('biz_freelance_gig', 'business', { cooldown: 2 }, [
    {},
    { effects: { focus: 1, cash: usd(2_500), careerSkill: 1 } },
  ]),
  card('biz_self_employed', 'business', { once: true, when: { employed: true, minLevel: 1, minFinanceSkill: 1 } }, [
    {},
    {
      effects: { focus: 2, setFlags: ['self_employed'] },
      outcomes: [{ weight: 40, effects: { salaryModPct: 15 } }, { weight: 35, effects: { salaryModPct: 4 } }, { weight: 25, effects: { salaryModPct: -10 } }],
    },
  ]),
  card('biz_bar', 'business', { cooldown: 8, when: { minFinanceSkill: 2, minRound: 2, notFlags: ['has_business'] } }, [
    {},
    {
      effects: { focus: 1, cash: usd(-40_000), setFlags: ['has_business'] },
      outcomes: [
        { weight: 35, effects: { recurring: [yearly('bar', 'passive', 14_000, null)] } },
        { weight: 35, effects: { recurring: [yearly('bar', 'passive', 5_000, null)] } },
        { weight: 30, effects: { clearFlags: ['has_business'] } },
      ],
    },
    {
      effects: { cash: usd(-15_000) },
      outcomes: [{ weight: 50, effects: { recurring: [yearly('bar_stake', 'passive', 2_500, null)] } }, { weight: 50, effects: {} }],
    },
  ]),
  card('biz_online_shop', 'business', { cooldown: 6, when: { minFinanceSkill: 2, notFlags: ['has_business'] } }, [
    {},
    {
      effects: { focus: 2, cash: usd(-6_000), setFlags: ['has_business'] },
      outcomes: [
        { weight: 30, effects: { recurring: [yearly('shop', 'passive', 9_000, null)] } },
        { weight: 40, effects: { recurring: [yearly('shop', 'passive', 2_500, null)] } },
        { weight: 30, effects: { clearFlags: ['has_business'] } },
      ],
    },
  ]),
  card('biz_airbnb', 'business', { cooldown: 6, when: { ownsHome: true } }, [
    {},
    { effects: { recurring: [yearly('spare_room', 'passive', 3_600, 3)], status: -1 } },
  ]),
  card('biz_app', 'business', { cooldown: 8, when: { careers: ['tech'], minFinanceSkill: 2, notFlags: ['has_business'] } }, [
    {},
    {
      effects: { focus: 2, cash: usd(-3_000), setFlags: ['has_business'] },
      outcomes: [
        { weight: 15, effects: { recurring: [yearly('app', 'passive', 30_000, null)] } },
        { weight: 30, effects: { recurring: [yearly('app', 'passive', 4_000, null)] } },
        { weight: 55, effects: { clearFlags: ['has_business'], careerSkill: 2 } },
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
  card('biz_acquisition', 'business', { cooldown: 6, when: { flags: ['has_business'] } }, [
    {},
    { effects: { cash: usd(90_000), endRecurring: BUSINESSES, clearFlags: ['has_business'], setFlags: ['sold_business'], status: 4 } },
    {
      outcomes: [
        { weight: 40, effects: { cash: usd(140_000), endRecurring: BUSINESSES, clearFlags: ['has_business'], setFlags: ['sold_business'], status: 4 } },
        { weight: 60, effects: {} },
      ],
    },
  ]),
];
