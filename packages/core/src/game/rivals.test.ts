import { content, lives } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { applyRound, createGame, viewOf } from '@ratrace/engine';
import type { GameState, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { rivalAside, rivalNeedle, rivalNews, rivalScore, rivalsOf, RIVAL_STATUS, showsOf } from './rivals';
import type { Rival } from './rivals';

const timeline = createGame({ content, start: lives[0].start }, 'rivals').timeline;
const history = timeline.map((_, r) => 10_000_00 + r * 20_000_00);

describe('rivals', () => {
  it('live a whole life beside the player, the same each time for one life and another for the next', () => {
    const rivals = rivalsOf(content, timeline, history, 'madrid', 'a', 6);
    expect(rivals.map((rival) => rival.id)).toEqual(['classmate', 'cousin', 'ex']);
    for (const rival of rivals) {
      expect(rival.worth).toHaveLength(timeline.length);
      expect(rival.worth.every((worth) => Number.isSafeInteger(worth) && worth >= 0)).toBe(true);
      expect(rival.name).toBeGreaterThanOrEqual(0);
      expect(rival.name).toBeLessThan(6);
    }
    // The classmate starts where the player did; the cousin with more.
    expect(rivals[0].worth[0]).toBe(history[0]);
    expect(rivals[1].worth[0]).toBeGreaterThan(history[0]);
    expect(rivalsOf(content, timeline, history, 'madrid', 'a', 6)).toEqual(rivals);
    expect(rivalsOf(content, timeline, history, 'madrid', 'b', 6)).not.toEqual(rivals);
  });

  it('only know the rounds already played', () => {
    const early = rivalsOf(content, timeline.slice(0, 5), history.slice(0, 5), 'madrid', 'a', 6);
    const whole = rivalsOf(content, timeline, history, 'madrid', 'a', 6);
    for (let i = 0; i < 3; i++) expect(early[i].worth).toEqual(whole[i].worth.slice(0, 5));
  });

  it('make the paper when one overtakes the player, and say nothing in the first round', () => {
    const rivals = rivalsOf(content, timeline, history, 'madrid', 'a', 6);
    expect(rivalNews(rivals, history, 0)).toBeNull();
    const rich = { ...rivals[2], worth: rivals[2].worth.map((worth, r) => (r === 3 ? history[3] + 1 : 0)), surprises: {} };
    expect(rivalNews([rich], history, 3)).toEqual({ rival: rich, story: 'passedYou' });
  });
});

/** The rival of a kind among the three. */
const of = (rivals: Rival[], id: Rival['id']) => rivals.find((rival) => rival.id === id) as Rival;

describe('rivals who keep up', () => {
  it('see what the player bought that shows, in the round it was bought, and keep seeing it there', () => {
    const start = lives.find((life) => life.id === 'engineer')?.start ?? lives[0].start;
    let game: GameState = createGame({ content, start: { ...start, cash: 500_000_00 } }, 'shows');
    const play = (orders: Order[]) => {
      game = applyRound(content, game, { orders }).state;
    };
    play([
      { type: 'buyItem', itemId: 'car_bmw_m3' },
      { type: 'buyItem', itemId: 'travel_safari' },
      { type: 'buyItem', itemId: 'watch_rolex', used: true },
      { type: 'buyItem', itemId: 'tech_laptop' },
    ]);
    const first = showsOf(content, viewOf(game), []);
    expect(first).toEqual([
      { round: 1, itemId: 'car_bmw_m3' },
      { round: 1, itemId: 'travel_safari' },
      { round: 1, itemId: 'watch_rolex' },
    ]);
    play([{ type: 'buyItem', itemId: 'fashion_birkin' }]);
    const home: Milestone = { round: 2, kind: 'home', typeId: 'flat' };
    // The safari is over, the rest is still seen where it was bought, and the first home comes from the story of the life.
    expect(showsOf(content, viewOf(game), [home])).toEqual([
      { round: 1, itemId: 'car_bmw_m3' },
      { round: 1, itemId: 'watch_rolex' },
      { round: 2, itemId: 'fashion_birkin' },
      { round: 2, typeId: 'flat' },
    ]);
  });

  it('every few rounds, buy one a notch better than what the player bought since they last looked, and pay for it: the ex a car, the cousin a trip, the classmate a home', () => {
    // A life that starts with enough to keep a car.
    const well = history.map((worth) => worth + 300_000_00);
    const plain = rivalsOf(content, timeline, well, 'madrid', 'a', 6);
    const shows = [
      { round: 3, itemId: 'car_bmw_m3' },
      { round: 3, itemId: 'watch_casio' },
      { round: 4, itemId: 'travel_safari' },
      { round: 5, typeId: 'flat' },
    ];
    const keeping = rivalsOf(content, timeline, well, 'madrid', 'a', 6, shows);
    /** The one round a rival kept up, at most three rounds after the player bought. */
    const when = (rival: Rival, bought: number) => {
      const rounds = Object.keys(rival.copies).map(Number);
      expect(rounds).toHaveLength(1);
      expect(rounds[0]).toBeGreaterThanOrEqual(bought);
      expect(rounds[0]).toBeLessThan(bought + 3);
      return rounds[0];
    };
    const ex = of(keeping, 'ex');
    const c = when(ex, 3);
    // The watch was too cheap to notice: the car is what they keep up with.
    expect(ex.copies[c]).toEqual({ round: c, itemId: 'car_porsche_911' });
    expect(ex.worth[c]).toBeLessThan(of(plain, 'ex').worth[c]);
    expect(ex.worth.slice(0, c)).toEqual(of(plain, 'ex').worth.slice(0, c));
    // A car is kept, and counts round after round; a trip for its rounds only.
    expect(ex.status[c - 1]).toBe(RIVAL_STATUS.ex);
    expect(ex.status[c]).toBe(RIVAL_STATUS.ex + 22);
    expect(ex.status.at(-1)).toBe(RIVAL_STATUS.ex + 22);
    expect(ex.sold).toEqual({});
    const cousin = of(keeping, 'cousin');
    const t = when(cousin, 4);
    expect(cousin.copies[t]).toEqual({ round: t, itemId: 'travel_maldives' });
    expect(cousin.status[t]).toBe(RIVAL_STATUS.cousin + 9);
    expect(cousin.status[t + 2]).toBe(RIVAL_STATUS.cousin);
    const classmate = of(keeping, 'classmate');
    const h = when(classmate, 5);
    const copy = classmate.copies[h];
    const typeId = 'typeId' in copy ? copy.typeId : '';
    const status = (id: string) => content.propertyTypes.find((type) => type.id === id)?.status ?? 0;
    expect(status(typeId)).toBeGreaterThan(status('flat'));
    // Their score counts the standing they bought, lived with as the player's is.
    expect(rivalScore(content, ex, timeline.length - 1)).toBeGreaterThan(rivalScore(content, { ...ex, status: ex.status.map(() => RIVAL_STATUS.ex) }, timeline.length - 1));
    expect(rivalAside(keeping, c)).toMatchObject({ kind: 'copy' });
    expect(rivalsOf(content, timeline, well, 'madrid', 'a', 6, shows)).toEqual(keeping);
  });

  it('match the top of a ladder with the same thing, and sell it once it ruins them', () => {
    const poor = timeline.map(() => 1_000_00);
    const rivals = rivalsOf(content, timeline, poor, 'bangkok', 'a', 6, [{ round: 1, itemId: 'car_lamborghini_aventador' }]);
    const ex = of(rivals, 'ex');
    expect(Object.values(ex.copies).map((copy) => ('itemId' in copy ? copy.itemId : ''))).toEqual(['car_lamborghini_aventador']);
    const sold = Object.entries(ex.sold);
    expect(sold).toHaveLength(1);
    expect(sold[0][1]).toBe('car_lamborghini_aventador');
    const after = Number(sold[0][0]);
    expect(after).toBeGreaterThan(Number(Object.keys(ex.copies)[0]));
    expect(ex.status[after]).toBe(RIVAL_STATUS.ex);
    expect(rivalAside(rivals, after)).toMatchObject({ rival: ex, kind: 'sold', itemId: 'car_lamborghini_aventador' });
  });

  it('let one of them get lucky when the player leads all three by far, back within reach and never past, twice a life at most', () => {
    const rich = timeline.map((_, r) => 10_000_00 + r * 2_000_000_00);
    const rivals = rivalsOf(content, timeline, rich, 'madrid', 'a', 6);
    const lucky = rivals.flatMap((rival) => Object.entries(rival.caughtUp).map(([r, how]) => ({ rival, r: Number(r), how })));
    expect(lucky.length).toBeGreaterThanOrEqual(1);
    expect(lucky.length).toBeLessThanOrEqual(2);
    for (const { rival, r, how } of lucky) {
      expect(['inheritance', 'startup', 'coin']).toContain(how);
      expect(rival.worth[r]).toBeLessThan(rich[r]);
      expect(rival.worth[r]).toBeGreaterThanOrEqual(rich[r] * 0.6);
      expect(rivalAside(rivals, r)).toMatchObject({ rival, kind: 'catchUp', how });
    }
    if (lucky.length === 2) expect(Math.abs(lucky[1].r - lucky[0].r)).toBeGreaterThanOrEqual(4);
    // A player a little ahead, or not yet rich, makes nobody lucky.
    expect(rivalsOf(content, timeline, history, 'madrid', 'a', 6).every((rival) => Object.keys(rival.caughtUp).length === 0)).toBe(true);
    expect(rivalsOf(content, timeline, rich, 'madrid', 'a', 6)).toEqual(rivals);
  });
});

describe('rivals who needle', () => {
  const start = lives.find((life) => life.id === 'engineer')?.start ?? lives[0].start;
  const rivals = rivalsOf(content, timeline, history, 'madrid', 'a', 6);
  /** The game at round `r`, with the player's life as given. */
  const at = (r: number, life: Partial<GameState['player']['life']> = {}) => {
    const game = createGame({ content, start }, 'needle');
    return { ...viewOf(game), round: r, player: { ...game.player, life: { ...game.player.life, ...life } } };
  };
  /** Over many lives, what a fall makes them say. */
  const said = (r: number, life: Partial<GameState['player']['life']>, story: Milestone[] = [], worth = history) =>
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((key) => rivalNeedle(content, rivalsOf(content, timeline, worth, 'madrid', key, 6), at(r, life), worth, story));

  it('say nothing in the first round, or of a life going well', () => {
    expect(rivalNeedle(content, rivals, at(0), history, [])).toBeNull();
    expect(said(2, {}).every((needle) => needle === null)).toBe(true);
  });

  it('remark on a fall now and then, the same each time, and on the worst one first', () => {
    const jailed = said(6, { jailRounds: 1, focusLost: 2 });
    expect(jailed.some((needle) => needle === null)).toBe(true);
    expect(jailed.filter((needle) => needle !== null).every((needle) => needle?.fall === 'jail')).toBe(true);
    expect(jailed.some((needle) => needle !== null)).toBe(true);
    expect(said(6, { jailRounds: 1, focusLost: 2 })).toEqual(jailed);
    const broke = said(6, {}, [{ round: 6, kind: 'bankrupt' }]);
    expect(broke.filter((needle) => needle !== null).every((needle) => needle?.fall === 'bankrupt')).toBe(true);
    expect(said(6, { seen: { crime_trial: 5 } }).some((needle) => needle?.fall === 'trial')).toBe(true);
    expect(said(6, { focusLost: 2 }).some((needle) => needle?.fall === 'burnout')).toBe(true);
    const crash = history.map((worth, r) => (r === 6 ? worth / 2 : worth));
    expect(said(6, {}, [], crash).some((needle) => needle?.fall === 'drop')).toBe(true);
  });

  it('ask a player of thirty still renting when they will buy, once in a while', () => {
    const renting = said(4, {});
    expect(renting.some((needle) => needle?.fall === 'renting')).toBe(true);
    expect(renting.filter((needle) => needle !== null).length).toBeLessThan(renting.length);
  });
});
