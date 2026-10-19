import { content, lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { createGameStore } from '@ratrace/core/game/store';

async function inFinance() {
  let ids = 0;
  const sessions = new LocalSessions(new MemoryStore(), content, lives, { newId: () => `id-${(ids += 1)}`, newSeed: () => 'join-seed', now: () => 0 });
  const game = createGameStore({ sessions, content });
  const get = game.getState;
  await get().start('engineer');
  get().leaveNews();
  while (get().stage === 'cards') {
    await get().pick(0);
    get().afterCard();
  }
  return get;
}

describe('orders of the same kind on the same thing', () => {
  it('are one order of their sum, where the first stood', async () => {
    const get = await inFinance();
    const fund = 'sp500';
    expect(get().addOrder({ type: 'depositIn', amount: 100_00 })).toBe(true);
    expect(get().addOrder({ type: 'focus', action: 'studyCareer' })).toBe(true);
    expect(get().addOrder({ type: 'depositIn', amount: 50_00 })).toBe(true);
    expect(get().addOrder({ type: 'buy', assetId: fund, amount: 30_00 })).toBe(true);
    expect(get().addOrder({ type: 'buy', assetId: fund, amount: 20_00 })).toBe(true);
    expect(get().orders).toEqual([
      { type: 'depositIn', amount: 150_00 },
      { type: 'focus', action: 'studyCareer' },
      { type: 'buy', assetId: fund, amount: 50_00 },
    ]);
  });

  it('stay apart when they are on different things', async () => {
    const get = await inFinance();
    expect(get().addOrder({ type: 'depositIn', amount: 100_00 })).toBe(true);
    expect(get().addOrder({ type: 'depositOut', amount: 50_00 })).toBe(true);
    expect(get().orders).toHaveLength(2);
  });

  it('are refused as one when the sum is more than there is', async () => {
    const get = await inFinance();
    const cash = get().preview?.player.cash ?? 0;
    expect(get().addOrder({ type: 'depositIn', amount: 100_00 })).toBe(true);
    expect(get().addOrder({ type: 'depositIn', amount: cash * 10 })).toBe(false);
    expect(get().refusal).toBe('not-enough-cash');
    expect(get().orders).toEqual([{ type: 'depositIn', amount: 100_00 }]);
  });
});
