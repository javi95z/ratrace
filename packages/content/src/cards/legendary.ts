import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/**
 * Content 1.54: the legendary cards. Never in the ordinary draw: a round opens with one only on the rare round the dice allow it
 * (`life.legendaryBp` in rules.ts, about one life in fifty), and a life meets one of them at most. Each is a far bigger prize or dilemma than
 * a card of the everyday, and still a choice: the sure money, the gamble worth about as much (a little more, for the risk), or standing
 * instead of money, which is worth most to whoever already has money. Their weights are only their chances among themselves.
 */
const LEGEND = { legendary: true, once: true, cooldown: 0, weight: 10, when: { minRound: 2 } } as const;

export const legendaryCards: CardDef[] = [
  // A winning lottery ticket in a coat not worn for years: all of it, half of it, or all of it to the children's hospital.
  card('legend_coat_ticket', 'luck', LEGEND, [
    { effects: { cash: usd(200_000) } },
    { effects: { cash: usd(100_000), status: 7 } },
    { effects: { status: 14 } },
  ]),
  // A stranger the player once helped leaves them what he had: his savings, or the guesthouse by the sea that pays a little every year for good.
  card('legend_stranger_will', 'family', LEGEND, [
    { effects: { cash: usd(150_000) } },
    { effects: { status: 3, recurring: [yearly('legend_guesthouse', 'passive', 9_000, null)] } },
  ]),
  // A coin bought as a joke drops a fortune of tokens on the player: sold today, half held, or all of it held for the moon.
  card('legend_airdrop', 'investing', LEGEND, [
    { effects: { cash: usd(120_000) } },
    { effects: { cash: usd(60_000) }, outcomes: [{ weight: 50, effects: { cash: usd(140_000) } }, { weight: 50, effects: {} }] },
    { outcomes: [{ weight: 20, effects: { cash: usd(700_000) } }, { weight: 80, effects: { cash: usd(2_000) } }] },
  ]),
  // A clip of the player dancing at a wedding is seen eighty million times: the fame, the rights sold, or merchandise.
  card('legend_viral', 'lifestyle', LEGEND, [
    { effects: { status: 6 } },
    { effects: { cash: usd(90_000) } },
    { effects: { cash: usd(-20_000) }, outcomes: [{ weight: 45, effects: { cash: usd(260_000), status: 4 } }, { weight: 55, effects: { status: -2 } }] },
  ]),
  // A film star moves in next door: a wave over the fence, her parties sold to a magazine, or her friendship, which takes the evenings a wave never would.
  card('legend_star_neighbour', 'housing', LEGEND, [
    { effects: { status: 3, skills: { network: 1 } } },
    { effects: { cash: usd(70_000), status: -6 } },
    { effects: { focus: 1, status: 9, skills: { network: 1 } } },
  ]),
  // A painting behind a mirror in the attic, perhaps a lost master: sold to a dealer as it is, authenticated and auctioned, or lent to the museum.
  card('legend_attic_painting', 'luck', LEGEND, [
    { effects: { cash: usd(60_000) } },
    { effects: { cash: usd(-10_000) }, outcomes: [{ weight: 25, effects: { cash: usd(300_000) } }, { weight: 75, effects: { cash: usd(10_000) } }] },
    { effects: { status: 10 } },
  ]),
];
