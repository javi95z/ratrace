import type { CardDef } from '@ratrace/engine';
import { card, usd } from './build';

/**
 * The wrong side of the law: small cheats that pay until they do not, a trial when something is
 * found, and prison, with its own cards, for whoever loses it. A charge is a flag that a card or a
 * large inspection sets; the trial is dealt as soon as it can be, and settles it.
 */
const CHARGED = 'charged';

export const crimeCards: CardDef[] = [
  // The trial: the state's lawyer and the dice, a good lawyer and better dice, or a deal that costs friends.
  card('crime_trial', 'tax', { weight: 200, cooldown: 0, when: { flags: [CHARGED] } }, [
    { effects: { clearFlags: [CHARGED] }, outcomes: [{ weight: 40, effects: {} }, { weight: 60, effects: { jail: { rounds: 2 } } }] },
    { effects: { cash: usd(-25_000), clearFlags: [CHARGED] }, outcomes: [{ weight: 75, effects: {} }, { weight: 25, effects: { jail: { rounds: 1 } } }] },
    { effects: { clearFlags: [CHARGED], cashNetWorthPct: -10, status: -4, skills: { network: -2 } } },
  ]),
  card('crime_wrongly_accused', 'luck', { weight: 2, once: true, when: { minRound: 3 } }, [
    { outcomes: [{ weight: 70, effects: { setFlags: ['acquitted_innocent'] } }, { weight: 30, effects: { jail: { rounds: 1 } } }] },
    { effects: { cash: usd(-8_000), setFlags: ['acquitted_innocent'] } },
  ]),

  // Inside: a cellmate who knows the markets, the noodle economy, and a library with time to read in it.
  card('crime_jail_cellmate', 'luck', { weight: 10, cooldown: 2, soon: true, when: { inJail: true } }, [
    {},
    { effects: { financeSkill: 1 } },
  ]),
  card('crime_jail_commissary', 'lifestyle', { weight: 10, cooldown: 2, soon: true, when: { inJail: true } }, [
    { effects: { cash: usd(-300) } },
    { outcomes: [{ weight: 70, effects: { cash: usd(1_500) } }, { weight: 30, effects: { jail: { rounds: 2 } } }] },
  ]),
  card('crime_jail_library', 'education', { weight: 10, cooldown: 2, soon: true, when: { inJail: true } }, [
    {},
    { effects: { skills: { languages: 2 } } },
    { effects: { careerSkill: 2 } },
  ]),
  // Out again, the story is worth something to someone.
  card('crime_memoirs', 'business', { weight: 8, once: true, when: { flags: ['ex_convict'] } }, [
    {},
    { effects: { focus: 1 }, outcomes: [{ weight: 30, effects: { cash: usd(25_000), status: 3 } }, { weight: 70, effects: { cash: usd(2_000) } }] },
  ]),

  // Small cheats.
  card('crime_fake_mba', 'education', { weight: 3, once: true, when: { employed: true, notItems: ['edu_mba'], minRound: 1 } }, [
    {},
    { effects: { status: 3, salaryModPct: 3, setFlags: ['fake_degree'] } },
  ]),
  card('crime_fake_mba_found', 'career', { weight: 6, once: true, when: { flags: ['fake_degree'], employed: true } }, [
    { outcomes: [{ weight: 40, effects: { clearFlags: ['fake_degree'] } }, { weight: 60, effects: { job: { leave: true }, status: -6, clearFlags: ['fake_degree'] } }] },
    { effects: { status: -3, salaryModPct: -3, clearFlags: ['fake_degree'] } },
  ]),
  card('crime_ham_smuggling', 'lifestyle', { weight: 3, cooldown: 8, when: { minRound: 1 } }, [
    {},
    { outcomes: [{ weight: 75, effects: { cash: usd(3_000) } }, { weight: 25, effects: { cash: usd(-2_500) } }] },
  ]),
  card('crime_memecoin', 'investing', { weight: 2, once: true, when: { minRound: 2 } }, [
    {},
    {
      effects: { focus: 1 },
      outcomes: [{ weight: 45, effects: { cash: usd(30_000) } }, { weight: 35, effects: { cash: usd(30_000), setFlags: [CHARGED] } }, { weight: 20, effects: { cash: usd(-3_000) } }],
    },
  ]),
  card('crime_illegal_betting', 'luck', { weight: 3, cooldown: 8, when: { minRound: 1 } }, [
    {},
    { effects: { cash: usd(-2_000) }, outcomes: [{ weight: 50, effects: { cash: usd(8_000) } }, { weight: 30, effects: {} }, { weight: 20, effects: { setFlags: [CHARGED] } }] },
  ]),
  card('crime_enchufe', 'career', { weight: 2, once: true, when: { cities: ['madrid', 'moscow', 'mexico_city'], notFlags: [CHARGED] } }, [
    {},
    { outcomes: [{ weight: 80, effects: { job: { career: 'public', level: 1 } } }, { weight: 20, effects: { setFlags: [CHARGED] } }] },
  ]),
  card('crime_insider_tip', 'investing', { weight: 3, once: true, when: { minNetWorth: usd(20_000) } }, [
    {},
    {
      effects: { cash: usd(-10_000) },
      // The deal goes through; it goes through and the regulator notices you sold in a hurry; or there was no deal, and the shares fall.
      outcomes: [{ weight: 50, effects: { cash: usd(30_000) } }, { weight: 25, effects: { cash: usd(18_000), setFlags: [CHARGED] } }, { weight: 25, effects: { cash: usd(6_000) } }],
    },
  ]),
  // A business that takes cash can wash what is hidden: the slate is clean, and the office looks harder.
  card('crime_laundering', 'business', { weight: 4, cooldown: 6, when: { hasBusiness: true, evading: true } }, [
    {},
    { effects: { launder: { feePct: 15 }, suspicion: 25 } },
  ]),
];
