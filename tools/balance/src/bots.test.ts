import { bots, content, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, viewOf } from '@ratrace/engine';
import type { Bot } from '@ratrace/content';
import type { GameState, GameView, RejectReason } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { slow } from './slow';
import { playLife } from './simulate';

const bot = (id: string): Bot => {
  const found = bots.find((b) => b.id === id);
  if (!found) throw new Error(`no bot ${id}`);
  return found;
};

/**
 * Plays a life and hands the caller every state a bot is asked about: before each card, and once
 * in the finance phase. Returns every refusal.
 */
function watch(b: Bot, lifeId: string, seed: string, see: (state: GameState) => void = () => {}): RejectReason[] {
  const life = lives.find((l) => l.id === lifeId);
  if (!life) throw new Error(`no life ${lifeId}`);
  const refused: RejectReason[] = [];
  let state = createGame({ content, start: life.start }, seed);
  while (!state.finished) {
    while (state.phase === 'cards') {
      see(state);
      state = applyCard(content, state, b.pick(content, viewOf(state))).state;
    }
    see(state);
    const result = applyRound(content, state, { orders: b.orders(content, viewOf(state)) });
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

  it('play every life to the end without writing an order the game cannot read', { timeout: slow(60_000) }, () => {
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

  it('decide from a view alone: the same view of two different games gets the same answer', () => {
    // Two games that look alike today and differ in everything a player cannot see: the seed, the
    // dice and every world to come. A bot handed the full game could tell them apart.
    const decide = (b: Bot, view: GameView) => (view.phase === 'cards' ? b.pick(content, view) : b.orders(content, view));
    for (const b of bots) {
      let asked = 0;
      watch(b, 'engineer', 'no-peeking', (state) => {
        const other: GameState = structuredClone(state);
        other.seed = 'another-seed';
        const now = other.timeline[other.round];
        for (let r = other.round + 1; r < other.timeline.length; r++) other.timeline[r] = { ...now, round: r };
        expect(viewOf(other), `${b.id} round ${state.round}`).toEqual(viewOf(state));
        expect(decide(b, viewOf(other)), `${b.id} round ${state.round}`).toEqual(decide(b, viewOf(state)));
        asked += 1;
      });
      expect(asked, b.id).toBeGreaterThan(content.rounds);
    }
  });

  it('are never handed the seed or the dice', () => {
    const seen: GameView[] = [];
    const spy: Bot = {
      id: 'spy',
      pick: (_content, view) => {
        seen.push(view);
        return 0;
      },
      orders: (_content, view) => {
        seen.push(view);
        return [];
      },
    };
    const result = playLife(content, lives[0], 'spy', spy);
    expect(seen.length).toBeGreaterThan(content.rounds);
    for (const view of seen) {
      expect(Object.hasOwn(view, 'seed')).toBe(false);
      expect(Object.hasOwn(view, 'rng')).toBe(false);
      expect(view.timeline).toHaveLength(view.round + 1);
    }
    expect(result.state.finished).toBe(true);
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
        if (state.phase === 'finance') sells += b.orders(content, viewOf(state)).filter((o) => o.type === 'sell').length;
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

    // The gambler is the indexer's twin: it never borrows and never sells a coin, and once it may buy coins it holds nothing else.
    const COINS = ['bitcoin', 'ethereum', 'dogecoin'];
    const gambler = bot('gambler');
    let allIn = 0;
    const refused = watch(gambler, 'engineer', 'strategy', (state) => {
      if (state.phase !== 'finance') return;
      const orders = gambler.orders(content, viewOf(state));
      expect(orders.filter((o) => o.type === 'borrow'), `round ${state.round}`).toEqual([]);
      expect(orders.filter((o) => o.type === 'sell' && COINS.includes(o.assetId)), `round ${state.round}`).toEqual([]);
      expect(orders.filter((o) => o.type === 'setLifestyle' && o.tier > state.player.life.minLifestyleTier), `round ${state.round}`).toEqual([]);
      const held = Object.keys(state.player.positions);
      if (held.length > 0 && held.every((id) => COINS.includes(id))) allIn += 1;
    });
    expect(allIn).toBeGreaterThan(5);
    expect(refused).toEqual([]);
    // It waits until it is allowed to buy coins: whatever life it starts from, it is never turned away for want of finance skill.
    for (const life of ['nurse', 'civil_servant']) {
      expect(watch(gambler, life, 'strategy').filter((reason) => reason === 'needs-finance-skill'), life).toEqual([]);
    }

    let items = 0;
    watch(bot('chaser'), 'engineer', 'strategy', (state) => {
      items = Math.max(items, state.player.life.collection.length);
    });
    expect(items).toBeGreaterThan(10);
  });
});
