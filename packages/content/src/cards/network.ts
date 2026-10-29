import type { CardDef } from '@ratrace/engine';
import { card, usd, yearly } from './build';

/**
 * Content 1.53: what knowing the right people brings. Three cards come only to the best connected (network at its
 * top level), and one already to the well connected: the doors a contact opens, each with a price in money, in
 * focus or in risk, so that none of them is taken without thinking.
 */
export const networkCards: CardDef[] = [
  // A dinner where the money talks: listening is a pleasant evening; their private round costs a twentieth of
  // everything and comes back about four times over, or not at all. Only someone with the cash at hand may join.
  card('network_investors', 'investing', { when: { minSkills: { network: 3 }, minRound: 2 } }, [
    { effects: { status: 1 } },
    { effects: { cashNetWorthPct: -5 }, outcomes: [{ weight: 30, effects: { cashNetWorthPct: 20 } }, { weight: 70, effects: {} }] },
  ]),
  // A seat on a company's board: a fee every year for good and the standing of it, and a meeting that takes a
  // point of focus every round, as the next rung of the on-call job does.
  card('network_board_seat', 'career', { once: true, when: { minSkills: { network: 3 }, minRound: 3 } }, [
    {},
    { effects: { recurring: [yearly('board_seat', 'passive', 15_000, null)], status: 3, focusBase: -1 } },
  ]),
  // A block of new shares placed with a few chosen buyers, below the market: a fifth more than what is paid, and the
  // swings of a chipmaker after. Two sizes, the larger only for someone with the cash for it.
  card('network_listing', 'investing', { cooldown: 16, when: { minSkills: { network: 3 }, minRound: 1 } }, [
    {},
    { effects: { invest: { assetId: 'nvidia', amount: usd(10_000), bonusPct: 20 } } },
    { effects: { invest: { assetId: 'nvidia', amount: usd(40_000), bonusPct: 20 } } },
  ]),
  // A contact puts the player's name forward for the post above theirs. Thanking them keeps the contact warm; the
  // interview takes a point of focus and lands the rung more often than not. Never offered on the last rungs, where
  // there is none above in some careers.
  card('network_referral', 'career', { when: { employed: true, maxLevel: 2, minSkills: { network: 2 }, minRound: 1 } }, [
    { effects: { skills: { network: 1 } } },
    { effects: { focus: 1 }, outcomes: [{ weight: 60, effects: { job: { levelDelta: 1 } } }, { weight: 40, effects: {} }] },
  ]),
];
