import { content, lives } from '@ratrace/content';
import { applyCards, applyRound, createGame } from '@ratrace/engine';
import type { GameState, RejectReason } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { bots } from './bots';
import type { Bot } from './bots';
import { playLife } from './simulate';

const bot = (id: string): Bot => {
  const found = bots.find((b) => b.id === id);
  if (!found) throw new Error(`no bot ${id}`);
  return found;
};

/** Plays a life and hands every state in the finance phase, and every refusal, to the caller. */
function watch(b: Bot, lifeId: string, seed: string, see: (state: GameState) => void = () => {}): RejectReason[] {
  const life = lives.find((l) => l.id === lifeId);
  if (!life) throw new Error(`no life ${lifeId}`);
  const refused: RejectReason[] = [];
  let state = createGame({ content, start: life.start }, seed);
  while (!state.finished) {
    if (state.phase === 'cards') state = applyCards(content, state, b.picks(content, state)).state;
    see(state);
    const result = applyRound(content, state, { orders: b.orders(content, state) });
    for (const e of result.events) if (e.kind === 'orderRejected') refused.push(e.reason);
    state = result.state;
  }
  return refused;
}

/** Refusals that mean a bot wrote an order the game cannot even read. */
const MALFORMED: RejectReason[] = [
  'bad-order', 'unknown-order', 'too-many-orders', 'bad-amount', 'unknown-asset', 'unknown-item', 'unknown-action',
  'bad-tier', 'unknown-insurance', 'unknown-city', 'unknown-property-type', 'unknown-mortgage-type', 'bad-down-payment',
];

describe('bots', () => {
  it('are six, each with its own name', () => {
    expect(bots.map((b) => b.id)).toEqual(['saver', 'indexer', 'gambler', 'chaser', 'landlord', 'random']);
  });

  it('play every life to the end without writing an order the game cannot read', () => {
    for (const b of bots) {
      for (const life of lives) {
        const refused = watch(b, life.id, 'bots-1');
        expect(refused.filter((reason) => MALFORMED.includes(reason)), `${b.id} as ${life.id}`).toEqual([]);
      }
    }
  });

  it('are refused nothing at all when they are the careful kind', () => {
    for (const id of ['saver', 'indexer']) {
      for (const seed of ['careful-1', 'careful-2', 'careful-3']) {
        expect(watch(bot(id), 'nurse', seed), `${id} ${seed}`).toEqual([]);
      }
    }
  });

  it('play the same life the same way every time', () => {
    const life = lives[0];
    for (const b of bots) {
      const one = playLife(content, life, 'same', b);
      const two = playLife(content, life, 'same', b);
      expect(two.score, b.id).toBe(one.score);
      expect(two.netWorth, b.id).toBe(one.netWorth);
    }
  });

  it('decide from what a player can see: a different future does not change this round', () => {
    for (const b of bots) {
      watch(b, 'engineer', 'no-peeking', (state) => {
        const blind = structuredClone(state);
        const now = blind.timeline[blind.round];
        for (let r = blind.round + 1; r < blind.timeline.length; r++) blind.timeline[r] = { ...now, round: r };
        expect(b.orders(content, blind), `${b.id} round ${state.round}`).toEqual(b.orders(content, state));
      });
    }
  });

  it('keep to their strategy', () => {
    watch(bot('saver'), 'civil_servant', 'strategy', (state) => {
      expect(Object.keys(state.player.positions)).toEqual([]);
      expect(state.player.properties).toEqual([]);
    });
    watch(bot('indexer'), 'civil_servant', 'strategy', (state) => {
      expect(Object.keys(state.player.positions).filter((id) => id !== 'msci_world')).toEqual([]);
    });
    const sold = (b: Bot) => {
      let sells = 0;
      watch(b, 'civil_servant', 'strategy', (state) => {
        sells += b.orders(content, state).filter((o) => o.type === 'sell').length;
      });
      return sells;
    };
    expect(sold(bot('indexer'))).toBe(0);

    let owned = 0;
    let rented = 0;
    watch(bot('landlord'), 'engineer', 'strategy', (state) => {
      owned = Math.max(owned, state.player.properties.length);
      rented = Math.max(rented, state.player.properties.filter((p) => p.rented).length);
    });
    expect(owned).toBeGreaterThan(1);
    expect(rented).toBeGreaterThan(0);

    let coins = false;
    watch(bot('gambler'), 'engineer', 'strategy', (state) => {
      if (['bitcoin', 'ethereum', 'dogecoin'].some((id) => Object.hasOwn(state.player.positions, id))) coins = true;
    });
    expect(coins).toBe(true);

    let items = 0;
    watch(bot('chaser'), 'engineer', 'strategy', (state) => {
      items = Math.max(items, state.player.life.collection.length);
    });
    expect(items).toBeGreaterThan(10);
  });
});
