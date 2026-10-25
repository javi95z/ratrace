import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/**
 * The famous, as parodies: Elon Mosk, Ronald Grump, Vladimir Poutine and the rest. Each comes once
 * in a life at most, and rarely (a legendary card), with a choice that is a real one: a fortune or a
 * fool, a status or a bill. Saying no is always free. Whoever plays along is marked, and a badge
 * says they met them.
 */
const met = (who: string) => `met_${who}`;

/** The famous, in the order their portraits, scenes and badges are drawn. */
export const CELEBS = ['mosk', 'grump', 'poutine', 'bufe', 'bozos', 'zuckerbot', 'puertas', 'nakamoro', 'kardashion', 'mrfeast', 'ronalgo', 'swiftly', 'bellfort', 'ortiga'] as const;
export type CelebId = (typeof CELEBS)[number];

/** Rare, and once a life. */
const RARE = { weight: 2, cooldown: 0, once: true } as const;

export const celebCards: CardDef[] = [
  // He offers three times what the business is worth, in a reply to a post; half the time he takes it back in another.
  card('celeb_mosk', 'business', { ...RARE, when: { hasBusiness: true, minRound: 2 } }, [
    {},
    // The badge is for the sale, not for the handshake.
    { outcomes: [{ weight: 50, effects: { sellBusiness: { pricePct: 300 }, setFlags: [met('mosk')] } }, { weight: 50, effects: { cash: usd(-4_000) } }] },
  ]),
  // A flat at thirty percent over the one next door, for the name on the building, which may not stay.
  card('celeb_grump', 'housing', { ...RARE, when: { minRound: 2, minNetWorth: usd(250_000) } }, [
    {},
    {
      effects: { property: { typeId: 'flat', pricePct: 130, downPct: 25, rented: false }, setFlags: [met('grump')] },
      outcomes: [{ weight: 80, effects: { status: 8 } }, { weight: 20, effects: {} }],
    },
  ]),
  // A yacht well below its price (never below what it would sell for at once), and a chance it is frozen at the quay and dear to get back.
  card('celeb_poutine', 'lifestyle', { ...RARE, when: { minRound: 3, minNetWorth: usd(300_000), notItems: ['sea_sailboat'] } }, [
    {},
    {
      effects: { buyItem: { itemId: 'sea_sailboat', pricePct: 75 }, setFlags: [met('poutine')] },
      outcomes: [{ weight: 70, effects: {} }, { weight: 30, effects: { cash: usd(-60_000) } }],
    },
  ]),
  // One question over lunch: how he did it, which teaches; or what to buy, which buys it.
  card('celeb_bufe', 'investing', { ...RARE, when: { minRound: 1 } }, [
    {},
    { when: { maxFinanceSkill: 2 }, effects: { focus: 1, financeSkill: 1, setFlags: [met('bufe')] } },
    { effects: { invest: { assetId: 'msci_world', amount: usd(5_000) }, setFlags: [met('bufe')] } },
  ]),
  // Every doorstep in the country, for thirty percent of each sale; or he copies the best of it.
  card('celeb_bozos', 'business', { ...RARE, when: { hasBusiness: true, minRound: 2 } }, [
    {},
    { effects: { setFlags: [met('bozos')] }, outcomes: [{ weight: 60, effects: { businessesPct: 30 } }, { weight: 40, effects: { businessesPct: -15 } }] },
  ]),
  // A plot in a virtual world: nine times in ten, nobody ever comes.
  card('celeb_zuckerbot', 'investing', { ...RARE, when: { minRound: 2 } }, [
    {},
    { effects: { cash: usd(-20_000), setFlags: [met('zuckerbot')] }, outcomes: [{ weight: 10, effects: { cash: usd(90_000) } }, { weight: 90, effects: {} }] },
  ]),
  // The jar at the gala: passing it on is seen; a tenth of everything is seen far more.
  card('celeb_puertas', 'lifestyle', { ...RARE, when: { minRound: 3, minNetWorth: usd(100_000) } }, [
    { effects: { status: -2 } },
    { effects: { cashNetWorthPct: -10, status: 12, setFlags: [met('puertas')] } },
    { effects: { cash: usd(-1_000), status: 2 } },
  ]),
  // An old coin wallet and every password ever used: rarely, a fortune.
  card('celeb_nakamoro', 'luck', { ...RARE, when: { minRound: 2 } }, [
    {},
    { effects: { focus: 1, setFlags: [met('nakamoro')] }, outcomes: [{ weight: 8, effects: { cash: usd(120_000) } }, { weight: 92, effects: {} }] },
  ]),
  // Money for a photo with a bottle of water: a little dignity for anyone, a star's fee for an influencer.
  card('celeb_kardashion', 'lifestyle', { ...RARE, when: { minRound: 1 } }, [
    {},
    { effects: { cash: usd(6_000), status: -3, setFlags: [met('kardashion')] } },
    { when: { careers: ['influencer'] }, effects: { cash: usd(25_000), status: 4, setFlags: [met('kardashion')] } },
  ]),
  // A week in a circle of light: three in a hundred win a fortune; the rest are a clip millions laugh at.
  card('celeb_mrfeast', 'luck', { ...RARE, when: { minRound: 1 } }, [
    {},
    { effects: { focus: 1, setFlags: [met('mrfeast')] }, outcomes: [{ weight: 3, effects: { cash: usd(250_000) } }, { weight: 97, effects: { status: -3 } }] },
  ]),
  // Money in an underwear line: a cheque every year, or boxes of stock.
  card('celeb_ronalgo', 'investing', { ...RARE, when: { minRound: 2 } }, [
    {},
    {
      effects: { cash: usd(-15_000), setFlags: [met('ronalgo')] },
      outcomes: [{ weight: 40, effects: { recurring: [yearly('ronalgo_line', 'passive', 3_000, null)] } }, { weight: 60, effects: {} }],
    },
  ]),
  // Two tickets, dear: a night to talk about for months, or sold on for more, if they are real.
  card('celeb_swiftly', 'lifestyle', { ...RARE, when: { minRound: 1 } }, [
    {},
    { effects: { cash: usd(-1_500), status: 5, setFlags: [met('swiftly')] } },
    { effects: { cash: usd(-1_500), setFlags: [met('swiftly')] }, outcomes: [{ weight: 60, effects: { cash: usd(4_000) } }, { weight: 40, effects: {} }] },
  ]),
  // A stock that "only goes up", sold on the phone in a minute: nearly always, a company that is not there.
  card('celeb_bellfort', 'investing', { ...RARE, when: { minRound: 1 } }, [
    {},
    { effects: { cash: usd(-8_000), setFlags: [met('bellfort')] }, outcomes: [{ weight: 5, effects: { cash: usd(40_000) } }, { weight: 95, effects: {} }] },
  ]),
  // A great store opens across the street: hold on with fewer customers, or take his name over the door.
  card('celeb_ortiga', 'business', { ...RARE, when: { hasBusiness: true, minRound: 2 } }, [
    { effects: { businessesPct: -10, setFlags: [met('ortiga')] } },
    { effects: { cash: usd(-20_000), businessesPct: 20, setFlags: [met('ortiga')] } },
  ]),
];
