import { bots, content, lives } from '@ratrace/content';
import type { OlderRules } from '@ratrace/core/session/legacy';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { FinishedRun, Profile } from '@ratrace/core/session/types';
import { stateHash } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installClone, jsonClone } from './clone';
import { loadBundledRules } from './game/olderRules';
import { OLDER, olderLife } from './testing/olderLife';

// The fixture's module also writes a life where the phone keeps it (the device's database, not loaded here): only its life is used.
vi.mock('./kvStore', () => ({ KvStore: class {} }));

/*
 * The phone clones the game's data through JSON (clone.ts). These hold that it is the same game: whole lives, played by the balance tool's bots,
 * give the same view at every step and the same end with the JSON clone as with the engine's own; and the JSON clone takes the place of the one a
 * runtime put there (Expo's, written in JavaScript).
 */

const native = globalThis.structuredClone;
afterEach(() => {
  Object.defineProperty(globalThis, 'structuredClone', { value: native, writable: true, configurable: true, enumerable: true });
});

/** What a whole life leaves: every view of it, one after each move, as their hashes and whole; the life opened again; the profile and the finished lives saved. */
interface Lived {
  hashes: string[];
  views: GameView[];
  resumed: string;
  profile: Profile;
  runs: FinishedRun[];
}

/** A whole life played by a bot, from its start, or (`older`) from a save of an older bundle's rules one round in, played with first choices and no orders. */
async function live(lifeId: string, botId: string, seed: string, older?: OlderRules): Promise<Lived> {
  let n = 0;
  const store = new MemoryStore();
  if (older) await store.saveGame(olderLife(older, 0));
  const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(n += 1)}`, newSeed: () => seed, now: () => 0, loadRules: loadBundledRules });
  const bot = bots.find((one) => one.id === botId)!;
  const session = older ? (await sessions.resume()).session! : await sessions.start(lifeId);
  if (older) expect(session.rules).toBe(OLDER.engine);
  const views: GameView[] = [session.view()];
  while (!session.view().finished) {
    while (session.view().phase === 'cards' && !session.view().finished) {
      await session.answerCard(older ? 0 : bot.pick(content, session.view()));
      views.push(session.view());
    }
    if (session.view().finished) break;
    await session.playRound({ orders: older ? [] : bot.orders(content, session.view()) });
    views.push(session.view());
  }
  const again = await sessions.resume();
  return { hashes: views.map((view) => stateHash(view)), views, resumed: again.session ? stateHash(again.session.view()) : String(again.lost), profile: await store.loadProfile(), runs: await store.listRuns() };
}

/** The same life played with the engine's clone, then with the JSON clone: both, to be compared. */
async function bothWays(play: () => Promise<Lived>): Promise<[Lived, Lived]> {
  const before = await play();
  Object.defineProperty(globalThis, 'structuredClone', { value: jsonClone, writable: true, configurable: true, enumerable: true });
  try {
    return [before, await play()];
  } finally {
    Object.defineProperty(globalThis, 'structuredClone', { value: native, writable: true, configurable: true, enumerable: true });
  }
}

/** That both ways are the same life: every view, the life opened again, and what it left saved (the profile, the finished lives). */
function alike([before, after]: [Lived, Lived], what: string) {
  expect(after.hashes, what).toEqual(before.hashes);
  expect(after.views, what).toEqual(before.views);
  expect(after.resumed, what).toBe(before.resumed);
  expect(before.views.at(-1)?.finished, what).toBe(true);
  expect(after.profile, what).toEqual(before.profile);
  expect(after.runs, what).toEqual(before.runs);
  // Something was saved to compare: the life is among the finished, and the profile counted it.
  expect(before.runs, what).toHaveLength(1);
  expect(Object.keys(before.profile.badges).length, what).toBeGreaterThan(0);
}

describe('the JSON clone', () => {
  it('plays the same lives as the engine\'s own clone: the same view after every card and every round, and the same life opened again', async () => {
    const cases: Array<[string, string, string]> = [
      ['nurse', 'saver', 'a'.repeat(64)],
      ['engineer', 'gambler', 'b1'.repeat(32)],
      ['civil_servant', 'landlord', '0f'.repeat(32)],
      ['nurse', 'random', '7c'.repeat(32)],
    ];
    for (const [lifeId, botId, seed] of cases) alike(await bothWays(() => live(lifeId, botId, seed)), `${lifeId} by ${botId}`);
  }, 120_000);

  it('plays a life begun under an older bundle\'s rules to its end the same way, and leaves the same profile and finished lives', async () => {
    const rules = (await loadBundledRules(OLDER)) as OlderRules;
    alike(await bothWays(() => live('nurse', 'saver', 'c'.repeat(64), rules)), `nurse under ${OLDER.engine}/${OLDER.content}`);
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
    expect(asked).toBe(0);
    // The game's plain data goes through JSON: a copy, and theirs never read.
    const value = { a: [1, { b: 'c' }] };
    const copy = globalThis.structuredClone(value);
    expect(copy).toEqual(value);
    expect(copy).not.toBe(value);
    expect(asked).toBe(0);
  });

  it('leaves to the clone that was there what JSON cannot copy, as a library asks it: a buffer moved from one stream to another, bytes', () => {
    const seen: Array<[unknown, unknown]> = [];
    const theirs = (value: unknown, options?: unknown) => {
      seen.push([value, options]);
      return value;
    };
    Object.defineProperty(globalThis, 'structuredClone', { get: () => theirs, configurable: true, enumerable: true });
    installClone();
    // Expo's streams (the web streams polyfill), where Hermes has no `ArrayBuffer.prototype.transfer`.
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    expect(globalThis.structuredClone(buffer, { transfer: [buffer] })).toBe(buffer);
    const bytes = new Uint8Array([4, 5]);
    expect(globalThis.structuredClone(bytes)).toBe(bytes);
    expect(seen).toEqual([
      [buffer, { transfer: [buffer] }],
      [bytes, undefined],
    ]);
    // JSON would have made the buffer an empty object.
    expect(jsonClone(buffer)).toEqual({});
  });
});
