import type { CardDef, Effects } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/**
 * Content 1.50: the troubles of a fortune. A loss of $5,000 is nothing to someone with millions, so late
 * in a rich life the cards stopped mattering. These are dealt only from about a million in start-of-game
 * dollars, each once in a life, and what they cost is a share of what the player has, so they bite at any
 * fortune. All but the gala leave a choice that needs no cash at hand, so one whose money is all invested
 * is dealt them too; the gala asks for a pledge, and only of someone with the cash to make it.
 */
const RICH = usd(1_000_000);

/**
 * Once a life, and likelier than an everyday card: a fortune is held for the last half dozen rounds or so,
 * and in them the rich should meet two or three of these, not one, and not one a round.
 */
const ONCE = { weight: 15, once: true } as const;

/** What a divorce in the papers costs: a share of everything, most of which a prenup protects. */
const split = (pct: number): Effects => ({
  partner: null,
  clearFlags: ['married', 'cohabiting'],
  cashNetWorthPct: -pct,
  protection: { flag: 'prenup', coverPct: 80 },
});

export const richCards: CardDef[] = [
  // Someone the player has never met says the fortune is partly theirs. Settling is dear; a trial is a coin toss,
  // fairer for a negotiator and fairer still for a lawyer who takes the case themselves.
  card('rich_lawsuit', 'luck', { ...ONCE, when: { minNetWorth: RICH } }, [
    { effects: { cashNetWorthPct: -4 } },
    { outcomes: [{ weight: 50, effects: { cashNetWorthPct: -1, status: 1 } }, { weight: 50, effects: { cashNetWorthPct: -9 } }] },
    { when: { minSkills: { negotiation: 2 } }, effects: { focus: 1, cashNetWorthPct: -2 } },
    { when: { careers: ['law'] }, effects: { focus: 1 }, outcomes: [{ weight: 80, effects: { status: 2 } }, { weight: 20, effects: { cashNetWorthPct: -8 } }] },
  ]),
  // An old photo at the wrong party goes round. Waiting costs standing; a PR firm costs money and now and then makes it worse.
  card('rich_scandal', 'lifestyle', { ...ONCE, when: { minNetWorth: RICH } }, [
    { effects: { status: -6 } },
    { effects: { cashNetWorthPct: -2 }, outcomes: [{ weight: 70, effects: { status: -1 } }, { weight: 30, effects: { status: -5 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: { status: 1 } }, { weight: 50, effects: { status: -9 } }] },
  ]),
  // The office's unit for large fortunes. Opening the books settles everything hidden too; fighting may end in nothing, or in more.
  card('rich_tax_squad', 'tax', { ...ONCE, when: { minNetWorth: RICH } }, [
    { effects: { cashNetWorthPct: -2, amnesty: { pct: 100 }, protection: { flag: 'tax_advisor', coverPct: 50 } } },
    { effects: { cashNetWorthPct: -1 }, outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { cashNetWorthPct: -2, suspicion: 30 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { cashNetWorthPct: -5, suspicion: 40 } }] },
  ]),
  // The partner in the business has been paying himself twice. Trusting him is free until it is not.
  card('rich_partner_swindle', 'business', { ...ONCE, when: { hasBusiness: true, minNetWorth: RICH } }, [
    { outcomes: [{ weight: 50, effects: {} }, { weight: 50, effects: { businessesPct: -35 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 60, effects: { cashNetWorthPct: -1 } }, { weight: 40, effects: { cashNetWorthPct: -1, businessesPct: -10 } }] },
    { when: { minSkills: { management: 2 } }, effects: { focus: 2 }, outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { businessesPct: -10 } }] },
  ]),
  // A divorce for the papers: settled quietly, fought in court, or a last try at saving it. A prenup keeps most of it.
  card('rich_divorce', 'family', { ...ONCE, weight: 8, when: { partner: true, minNetWorth: RICH } }, [
    { effects: split(15) },
    { outcomes: [{ weight: 50, effects: { ...split(8), status: -2 } }, { weight: 50, effects: { ...split(30), status: -4 } }] },
    { effects: { focus: 1 }, outcomes: [{ weight: 55, effects: { status: 1 } }, { weight: 45, effects: split(18) }] },
  ]),
  // The charity gala: passing is noticed, and a wing with one's name on it far more.
  card('rich_gala', 'lifestyle', { ...ONCE, when: { minNetWorth: RICH } }, [
    { effects: { status: -3 } },
    { effects: { cashNetWorthPct: -2, status: 4 } },
    { effects: { cashNetWorthPct: -6, status: 10 } },
  ]),
  // A great-uncle nobody knew leaves a castle, and his debts, which the lawyers size to the heir's own fortune.
  // Sold at once it is cash; kept, it is a property of the player's, free, let for weddings, and sold whenever
  // the player likes: its standing and its upkeep last as long as it is owned.
  card('rich_uncle_castle', 'family', { ...ONCE, when: { minNetWorth: RICH } }, [
    {},
    { outcomes: [{ weight: 60, effects: { cashNetWorthPct: 4 } }, { weight: 40, effects: { cashNetWorthPct: -3 } }] },
    {
      effects: { property: { typeId: 'castle', pricePct: 100, downPct: 100, rented: true, inherited: true } },
      outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { cashNetWorthPct: -3 } }],
    },
  ]),
  // The skipper takes the boat out for a party of his own and puts it on the rocks, with guests aboard.
  card('rich_yacht_rocks', 'lifestyle', { ...ONCE, when: { items: ['sea_sailboat'], minNetWorth: RICH } }, [
    { effects: { cashNetWorthPct: -2 } },
    { outcomes: [{ weight: 50, effects: { status: -1 } }, { weight: 50, effects: { cashNetWorthPct: -4, status: -3 } }] },
  ]),
  // A letter that knows where the children go to school: bodyguards for a few years, or the risk.
  card('rich_threat', 'lifestyle', { ...ONCE, when: { minNetWorth: RICH } }, [
    { outcomes: [{ weight: 75, effects: {} }, { weight: 25, effects: { cashNetWorthPct: -5, status: -3 } }] },
    { effects: { status: 2, recurring: [yearly('bodyguards', 'expense', 25_000, 3)] } },
  ]),
  // The masterpiece on the wall is a fake: kept quiet, fought over with the gallery, or given away for what it is.
  card('rich_fake_art', 'lifestyle', { ...ONCE, when: { ownsLadder: 'art', minNetWorth: RICH } }, [
    { outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { status: -4 } }] },
    { effects: { cashNetWorthPct: -1 }, outcomes: [{ weight: 50, effects: { cashNetWorthPct: 2, status: 1 } }, { weight: 50, effects: { status: -2 } }] },
    { effects: { status: 2 } },
  ]),
  // A larger rival wants the business, at a price, and makes life hard for whoever says no.
  card('rich_hostile_bid', 'business', { ...ONCE, when: { hasBusiness: true, minNetWorth: RICH } }, [
    { outcomes: [{ weight: 60, effects: {} }, { weight: 40, effects: { businessesPct: -15 } }] },
    { effects: { sellBusiness: { pricePct: 140 } } },
    { effects: { cashNetWorthPct: -2, businessesPct: 10 } },
  ]),
];
