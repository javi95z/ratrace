import { content, lives, names } from '@ratrace/content';
import { applyCard, applyRound, createGame } from '@ratrace/engine';
import type { GameState, LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../../../supabase/functions/_shared/game/index.ts';
import { assetName, ASSET_NAMES, marketMover, MIN_MOVE_BP, moverOf, moverOfState } from '../../../supabase/functions/_shared/market.ts';
import type { MarketRow } from '../../../supabase/functions/_shared/market.ts';
import { noticeOf } from '../../../supabase/functions/_shared/notice.ts';

const held = (value: number) => ({ value, basis: value });

describe('which held asset moved', () => {
  it('picks the biggest move among what is held, from 5% up, either way', () => {
    const positions = { bitcoin: held(100), gold: held(900), sp500: held(50) };
    expect(moverOf(positions, { bitcoin: 1_240, gold: -300, sp500: 100 })).toEqual({ assetId: 'bitcoin', percent: 12 });
    expect(moverOf(positions, { bitcoin: 100, gold: -950, sp500: 499 })).toEqual({ assetId: 'gold', percent: -10 });
    expect(moverOf(positions, { bitcoin: 499, gold: -499, sp500: 0 })).toBeNull();
    expect(moverOf(positions, { gold: -MIN_MOVE_BP })).toEqual({ assetId: 'gold', percent: -5 });
  });

  it('ignores what is not held, and breaks a tie by the bigger holding, then by the name', () => {
    expect(moverOf({ gold: held(0), sp500: held(10) }, { bitcoin: 5_000, gold: 5_000, sp500: 100 })).toBeNull();
    expect(moverOf({ gold: held(10), apple: held(20) }, { gold: 800, apple: -800 })).toEqual({ assetId: 'apple', percent: -8 });
    expect(moverOf({ b: held(10), a: held(10) }, { a: 800, b: 800 })).toEqual({ assetId: 'a', percent: 8 });
  });

  it('trusts no shape', () => {
    for (const bad of [null, undefined, 3, 'x', [], { gold: null }, { gold: { value: 'big' } }]) expect(moverOf(bad, { gold: 9_000 })).toBeNull();
    expect(moverOf({ gold: held(5) }, null)).toBeNull();
    expect(moverOf({ gold: held(5) }, { gold: Number.NaN })).toBeNull();
    expect(moverOf({ gold: held(5) }, { gold: 'a lot' })).toBeNull();
  });
});

describe('what a life says of its market', () => {
  const world = (bp: number) => ({ assetReturnBp: { bitcoin: bp } });
  const life = (round: number, over: Record<string, unknown> = {}) => ({ round, finished: false, player: { positions: { bitcoin: held(10) } }, timeline: [world(0), world(1_000), world(-700), world(9_999)], ...over });

  it('reads the world the player is in, never the next round', () => {
    expect(moverOfState(life(1))).toEqual({ assetId: 'bitcoin', percent: 10 });
    expect(moverOfState(life(2))).toEqual({ assetId: 'bitcoin', percent: -7 });
    // The next round is a +100% rally; round 0 has nothing to say, and the last timeline entry is never reached.
    expect(moverOfState(life(0))).toBeNull();
    const quiet = life(1, { timeline: [world(0), world(100), world(9_999)] });
    expect(moverOfState(quiet)).toBeNull();
  });

  it('says nothing of a life that is over or cannot be read', () => {
    expect(moverOfState(life(1, { finished: true }))).toBeNull();
    expect(moverOfState(life(9))).toBeNull();
    expect(moverOfState(null)).toBeNull();
    expect(moverOfState({ round: 1 })).toBeNull();
  });
});

describe('a ranked life, played again by the server', () => {
  const crypto = lives.find((one) => one.id === 'crypto_kid');
  if (!crypto) throw new Error('the content has no crypto kid');
  const current = Object.values(GAMES).at(-1);
  if (!current) throw new Error('no game bundled');

  /** Plays rounds with the first answer of every card and no orders, giving the log and every state on the way. */
  function play(seed: string, rounds: number) {
    let state: GameState = createGame({ content, start: crypto!.start }, seed);
    const log: LoggedRound[] = [];
    const states: GameState[] = [state];
    let picks: number[] = [];
    while (log.length < rounds && !state.finished) {
      if (state.phase === 'cards') {
        state = applyCard(content, state, 0).state;
        picks.push(0);
      } else {
        state = applyRound(content, state, { orders: [] }).state;
        log.push({ picks, orders: [] });
        picks = [];
        states.push(state);
      }
    }
    return { log, states };
  }
  const row = (log: LoggedRound[], over: Partial<MarketRow> = {}): MarketRow => ({ game_id: 'g-1', life_id: 'crypto_kid', engine_version: current.ENGINE_VERSION, content_version: current.CONTENT_VERSION, challenge: null, log, ...over });

  it('tells what the engine itself shows at the player\'s round, for many seeds and rounds', () => {
    let rises = 0;
    let falls = 0;
    let quiet = 0;
    for (let s = 0; s < 6; s++) {
      const { log, states } = play(`market-${s}`, 8);
      for (let round = 1; round <= log.length; round++) {
        const state = states[round];
        const bp = state.timeline[round].assetReturnBp.bitcoin;
        const holds = (state.player.positions.bitcoin?.value ?? 0) > 0;
        const told = marketMover(GAMES, row(log.slice(0, round)), `market-${s}`);
        if (holds && Math.abs(bp) >= MIN_MOVE_BP) {
          expect(told).toEqual({ assetId: 'bitcoin', percent: Math.round(bp / 100) });
          if (bp > 0) rises += 1;
          else falls += 1;
        } else if (!holds) expect(told?.assetId).not.toBe('bitcoin');
        else {
          expect(told).toBeNull();
          quiet += 1;
        }
      }
    }
    // The seeds above move both ways and sometimes sit still, or the check proves little.
    expect([rises > 0, falls > 0, quiet > 0]).toEqual([true, true, true]);
  });

  it('is not moved by the market of the round to come', () => {
    const { log } = play('market-1', 6);
    for (let round = 1; round <= 5; round++) {
      const state = current.replayLog(current.content, crypto.start, 'market-1', log.slice(0, round)) as unknown as GameState;
      const now = marketMover(GAMES, row(log.slice(0, round)), 'market-1');
      const future = structuredClone(state);
      for (const key of Object.keys(future.timeline[round + 1].assetReturnBp)) future.timeline[round + 1].assetReturnBp[key] = 9_000;
      expect(moverOfState(future)).toEqual(moverOfState(state));
      expect(now).toEqual(moverOfState(state)?.assetId && assetName(moverOfState(state)!.assetId, 'en') ? moverOfState(state) : null);
    }
  });

  it('says nothing for a life it cannot play: unknown versions, a bad log, a bad life, a life not begun', () => {
    const { log } = play('market-1', 3);
    expect(marketMover(GAMES, row(log, { engine_version: '0.0.1' }), 'market-1')).toBeNull();
    expect(marketMover(GAMES, row([{ picks: ['x'], orders: [] }] as unknown as LoggedRound[]), 'market-1')).toBeNull();
    expect(marketMover(GAMES, row('not a log' as unknown as LoggedRound[]), 'market-1')).toBeNull();
    expect(marketMover(GAMES, row(log, { life_id: 'nobody' }), 'market-1')).toBeNull();
    expect(marketMover(GAMES, row([]), 'market-1')).toBeNull();
  });
});

describe('what the notice says', () => {
  it('names the move in each language, and opens the game', () => {
    expect(noticeOf('en', { kind: 'marketMoved', asset: 'bitcoin', percent: 12 })).toEqual({
      title: 'Your market moved',
      body: 'Your Bitcoin rose 12% in your last round. Come and see where you stand.',
      url: '/en/play',
      tag: 'market-moved',
    });
    expect(noticeOf('en', { kind: 'marketMoved', asset: 'gold', percent: -8 }).body).toBe('Your Gold fell 8% in your last round. Come and see where you stand.');
    expect(noticeOf('es', { kind: 'marketMoved', asset: 'gold', percent: -8 })).toEqual({
      title: 'Tu mercado se ha movido',
      body: 'Tu Oro ha bajado un 8% en tu última ronda. Pasa a ver cómo estás.',
      url: '/es/play',
      tag: 'market-moved',
    });
    expect(noticeOf('es', { kind: 'marketMoved', asset: 'bitcoin', percent: 12 }).body).toContain('Tu Bitcoin ha subido un 12%');
    expect(noticeOf('ru', { kind: 'marketMoved', asset: 'gold', percent: -8 })).toMatchObject({ body: 'Золото: −8% за твой последний раунд. Загляни, посмотри, как дела.', url: '/ru/play' });
    expect(noticeOf('ru', { kind: 'marketMoved', asset: 'bitcoin', percent: 12 }).body).toContain('Bitcoin: +12%');
    expect(noticeOf('fr', { kind: 'marketMoved', asset: 'bitcoin', percent: 12 }).title).toBe('Your market moved');
  });

  it('names every asset of the game as the game does, in every language', () => {
    for (const lang of ['en', 'es', 'ru'] as const) {
      expect(Object.keys(ASSET_NAMES[lang]).sort()).toEqual(content.assets.map((asset) => asset.id).sort());
      for (const asset of content.assets) expect(assetName(asset.id, lang)).toBe(names[lang].assets[asset.id].name);
    }
    expect(assetName('__proto__', 'en')).toBeNull();
    expect(assetName('nope', 'ru')).toBeNull();
  });
});
