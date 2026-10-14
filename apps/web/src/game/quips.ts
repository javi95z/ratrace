import { START_AGE } from '@ratrace/content';
import { homeOf, netWorth, realNetWorth } from '@ratrace/engine';
import type { Content, GameEvent, GameView } from '@ratrace/engine';

/**
 * The jokes the game tells about a life: a line from the bank and one from the family after each
 * round, the obituary at the end, a word from the tax adviser and a review of each business. Each
 * is picked from how the life stands, by rules alone, so the same life always hears the same.
 * None of it changes anything: it is said, not played.
 */

const usd = (dollars: number) => dollars * 100;
const ageOf = (content: Content, view: GameView) => START_AGE + view.round * content.yearsPerRound;
const inRoom = (content: Content, view: GameView) => homeOf(view.player, content) === null && view.player.life.rentTier === 0;
const cars = (view: GameView) => view.player.life.items.filter((owned) => owned.itemId.startsWith('car_')).length;

/** What the rat in the wheel wears: a tracksuit while living frugally, a tuxedo once rich or living lavishly, else the suit. */
export function ratOutfit(view: GameView): 'tracksuit' | 'suit' | 'tuxedo' {
  if (view.player.lifestyleTier === 0) return 'tracksuit';
  if (view.player.lifestyleTier === 3 || realNetWorth(view) >= usd(1_000_000)) return 'tuxedo';
  return 'suit';
}

/** What the bank says after a round, or nothing: a draw on the card first, then a bad two years, idle cash, and wealth. */
export function bankQuip(before: GameView, after: GameView, events: readonly GameEvent[]): string | null {
  if (events.some((e) => e.kind === 'ledger' && e.line === 'creditCardDraw' && e.amount !== 0)) return 'card';
  const was = netWorth(before.player);
  if (was > 0 && netWorth(after.player) * 10 < was * 7) return 'fell';
  if (realNetWorth(after) >= usd(1_000_000)) return 'rich';
  if (after.player.cash * after.timeline[0].priceLevel >= usd(50_000) * after.timeline[after.round].priceLevel) return 'idle';
  return null;
}

/**
 * What is said of the player at the family's Christmas dinner. Of all that could be said, the
 * round picks one, so that a life which stays the same is not told the same thing twice running.
 */
export function familyQuip(content: Content, before: GameView, after: GameView): string {
  const p = after.player;
  const age = ageOf(content, after);
  const newCar = p.life.items.some((owned) => owned.itemId.startsWith('car_') && !before.player.life.items.some((was) => was.itemId === owned.itemId));
  const said = [
    ...(inRoom(content, after) && age >= 26 ? ['room'] : []),
    ...(p.lifestyleTier === 0 ? ['frugal'] : []),
    ...(newCar ? ['car'] : []),
    ...(p.lifestyleTier === 3 ? ['lavish'] : []),
    ...(!p.life.partner && age >= 30 ? ['single'] : []),
    ...(p.life.children.length >= 2 ? ['kids'] : []),
    ...(realNetWorth(after) >= usd(1_000_000) ? ['rich'] : []),
  ];
  return said.length === 0 ? 'plain' : said[after.round % said.length];
}

/** The one dry line the obituary gives a life, by the first thing it is remembered for. */
export function obituary(content: Content, view: GameView, bankruptcies: number): { key: string; n?: number } {
  const p = view.player;
  const real = realNetWorth(view);
  if (netWorth(p) < 0 || bankruptcies > 0) return { key: 'broke' };
  if (p.escapedAtRound !== null) return { key: 'free' };
  if (cars(view) >= 3) return { key: 'cars', n: cars(view) };
  if (p.lifestyleTier === 0 && real >= usd(1_000_000)) return { key: 'miser' };
  if (inRoom(content, view)) return { key: 'room' };
  if (p.life.items.length >= 10) return { key: 'things' };
  if (real >= usd(10_000_000)) return { key: p.life.children.length > 0 ? 'heirs' : 'alone' };
  return { key: 'plain' };
}

/** What the tax adviser says, by how suspicious the tax office will be once the round is played. */
export function adviserQuip(suspicion: number): string {
  if (suspicion <= 0) return 'clean';
  if (suspicion < 25) return 'low';
  if (suspicion < 50) return 'mid';
  if (suspicion < 75) return 'high';
  return 'max';
}

/** The stars a business is given online: none look after one that nobody runs, and a loss shows. */
export function reviewStars(business: { neglected: boolean; manager: boolean; profit: number }): 1 | 2 | 3 | 4 | 5 {
  if (business.neglected) return 1;
  if (business.profit < 0) return 2;
  if (business.manager) return 3;
  return business.profit > 0 ? 5 : 4;
}
