import { bots, content, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { stateHash } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { installClone, jsonClone } from './clone';

/*
 * The phone clones the game's data through JSON (clone.ts). These hold that it is the same game: whole lives, played by the balance tool's bots,
 * give the same view at every step and the same end with the JSON clone as with the engine's own; and the JSON clone takes the place of the one a
 * runtime put there (Expo's, written in JavaScript).
 */

const native = globalThis.structuredClone;
afterEach(() => {
  Object.defineProperty(globalThis, 'structuredClone', { value: native, writable: true, configurable: true, enumerable: true });
});

/** Every view of a whole life, one after each move, as their hashes (and the views themselves, to be compared whole). */
async function live(lifeId: string, botId: string, seed: string): Promise<{ hashes: string[]; views: GameView[]; resumed: string }> {
  let n = 0;
  const sessions = new LocalSessions(new MemoryStore(), content, lives, { newId: () => `id-${(n += 1)}`, newSeed: () => seed, now: () => 0 });
  const bot = bots.find((one) => one.id === botId)!;
  const session = await sessions.start(lifeId);
  const views: GameView[] = [session.view()];
  while (!session.view().finished) {
    while (session.view().phase === 'cards' && !session.view().finished) {
      await session.answerCard(bot.pick(content, session.view()));
      views.push(session.view());
    }
    if (session.view().finished) break;
    await session.playRound({ orders: bot.orders(content, session.view()) });
    views.push(session.view());
  }
  const again = await sessions.resume();
  return { hashes: views.map((view) => stateHash(view)), views, resumed: again.session ? stateHash(again.session.view()) : String(again.lost) };
}

describe('the JSON clone', () => {
  it('plays the same lives as the engine\'s own clone: the same view after every card and every round, and the same life opened again', async () => {
    const cases: Array<[string, string, string]> = [
      ['nurse', 'saver', 'a'.repeat(64)],
      ['engineer', 'gambler', 'b1'.repeat(32)],
      ['civil_servant', 'landlord', '0f'.repeat(32)],
      ['nurse', 'random', '7c'.repeat(32)],
    ];
    for (const [lifeId, botId, seed] of cases) {
      const before = await live(lifeId, botId, seed);
      Object.defineProperty(globalThis, 'structuredClone', { value: jsonClone, writable: true, configurable: true, enumerable: true });
      const after = await live(lifeId, botId, seed);
      Object.defineProperty(globalThis, 'structuredClone', { value: native, writable: true, configurable: true, enumerable: true });
      expect(after.hashes, `${lifeId} by ${botId}`).toEqual(before.hashes);
      expect(after.views, `${lifeId} by ${botId}`).toEqual(before.views);
      expect(after.resumed).toBe(before.resumed);
      expect(before.views.at(-1)?.finished).toBe(true);
    }
  }, 120_000);

  it('copies plain data whole, and gives back what it was given for nothing', () => {
    const value = { a: 1, b: [1, { c: 'x' }], d: { e: null, f: true } };
    const copy = jsonClone(value);
    expect(copy).toEqual(value);
    expect(copy).not.toBe(value);
    expect(copy.b[1]).not.toBe(value.b[1]);
    expect(jsonClone(undefined)).toBeUndefined();
  });
});

describe('installClone', () => {
  it('takes the place of a clone a runtime put there lazily, as Expo\'s runtime does on the phone, without loading it', () => {
    let asked = 0;
    const theirs = <T,>(value: T): T => value;
    Object.defineProperty(globalThis, 'structuredClone', {
      get: () => {
        asked += 1;
        return theirs;
      },
      configurable: true,
      enumerable: true,
    });
    installClone();
    expect(globalThis.structuredClone).toBe(jsonClone);
    expect(asked).toBe(0);
  });
});
