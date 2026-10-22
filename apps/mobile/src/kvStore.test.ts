import { bots, content, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { settleRank } from '@ratrace/core/session/profile';
import { ResilientStore } from '@ratrace/core/session/resilient';
import { readRun } from '@ratrace/core/session/runs';
import type { FinishedRun } from '@ratrace/core/session/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The phone keeps each finished life under a key of its own (`ratrace:run:<id>`), with an index of their ids, oldest first (`ratrace:runs:index`),
 * where it once kept every life in one value (`ratrace:runs`), read and written whole each time a life ended. These hold the store to that: what it
 * writes, in what order, what it reads, and what a phone killed half way through a write finds when it opens again.
 */

/** The phone's key-value store: its values, every call made of it in order, and the power cut after so many more writes. */
const device = vi.hoisted(() => ({
  values: new Map<string, string>(),
  calls: [] as Array<{ op: 'get' | 'set' | 'remove' | 'keys'; key?: string; value?: string }>,
  writesLeft: Number.POSITIVE_INFINITY,
}));
vi.mock('expo-sqlite/kv-store', () => {
  const write = () => {
    if (device.writesLeft <= 0) throw new Error('the app was killed');
    device.writesLeft -= 1;
  };
  return {
    default: {
      getItem: async (key: string) => {
        device.calls.push({ op: 'get', key });
        return device.values.get(key) ?? null;
      },
      setItem: async (key: string, value: string) => {
        write();
        device.calls.push({ op: 'set', key, value });
        device.values.set(key, value);
      },
      removeItem: async (key: string) => {
        write();
        device.calls.push({ op: 'remove', key });
        device.values.delete(key);
      },
      getAllKeys: async () => {
        device.calls.push({ op: 'keys' });
        return [...device.values.keys()];
      },
      getItemSync: (key: string) => device.values.get(key) ?? null,
      setItemSync: (key: string, value: string) => void device.values.set(key, value),
      removeItemSync: (key: string) => void device.values.delete(key),
    },
  };
});

const { KvStore } = await import('./kvStore');

const OLD = 'ratrace:runs';
const INDEX = 'ratrace:runs:index';
const keyOf = (id: string) => `ratrace:run:${id}`;

beforeEach(() => {
  device.values.clear();
  device.calls.length = 0;
  device.writesLeft = Number.POSITIVE_INFINITY;
});

/** A finished life, as the store hands it back. */
const life = (runId: string, finishedAt: number): FinishedRun => readRun({ runId, lifeId: 'nurse', finishedAt, score: finishedAt % 997, history: [1, 2, 3] })!;
const ids = (runs: readonly FinishedRun[]) => runs.map((run) => run.runId);
const indexed = () => JSON.parse(device.values.get(INDEX) ?? 'null') as string[] | null;
const writes = () => device.calls.filter((call) => call.op !== 'get' && call.op !== 'keys');
/** What a phone that kept its lives the old way holds: every life in one value, by id, in the order they were added. */
const oldWay = (runs: readonly FinishedRun[]) => device.values.set(OLD, JSON.stringify(Object.fromEntries(runs.map((run) => [run.runId, run]))));

describe('a finished life', () => {
  it('is written under its own key, and its id at the end of the index; the lives are listed latest first', async () => {
    const store = new KvStore();
    await store.addRun(life('a', 300));
    await store.addRun(life('b', 100));
    await store.addRun(life('c', 200));
    expect(JSON.parse(device.values.get(keyOf('b'))!)).toEqual(life('b', 100));
    expect(indexed()).toEqual(['a', 'b', 'c']);
    expect(ids(await store.listRuns())).toEqual(['a', 'c', 'b']);
    // Read again from the phone, by a store that has read nothing yet: the same.
    expect(ids(await new KvStore().listRuns())).toEqual(['a', 'c', 'b']);
    expect(device.values.has(OLD)).toBe(false);
  });

  it('written again (a finished life is saved with each step after its last) is the one life, and the index is not written again', async () => {
    const store = new KvStore();
    await store.addRun(life('a', 1));
    device.calls.length = 0;
    await store.addRun({ ...life('a', 1), score: 42 });
    expect(writes()).toEqual([{ op: 'set', key: keyOf('a'), value: JSON.stringify({ ...life('a', 1), score: 42 }) }]);
    expect((await store.listRuns()).map((run) => run.score)).toEqual([42]);
    expect(indexed()).toEqual(['a']);
  });

  it('removed, has its key taken away first and then its id from the index; one it does not have changes nothing', async () => {
    const store = new KvStore();
    for (const [id, at] of [['a', 1], ['b', 2], ['c', 3]] as const) await store.addRun(life(id, at));
    device.calls.length = 0;
    await store.removeRun('b');
    expect(writes()).toEqual([
      { op: 'remove', key: keyOf('b') },
      { op: 'set', key: INDEX, value: JSON.stringify(['a', 'c']) },
    ]);
    expect(ids(await store.listRuns())).toEqual(['c', 'a']);
    device.calls.length = 0;
    await store.removeRun('nobody');
    expect(writes()).toEqual([{ op: 'remove', key: keyOf('nobody') }]);
    expect(ids(await new KvStore().listRuns())).toEqual(['c', 'a']);
  });

  it('that cannot be read is left out of the list, and kept: one bad record does not take the others down', async () => {
    const store = new KvStore();
    await store.addRun(life('a', 1));
    await store.addRun(life('b', 2));
    device.values.set(keyOf('a'), '{not json');
    expect(ids(await new KvStore().listRuns())).toEqual(['b']);
    expect(device.values.get(keyOf('a'))).toBe('{not json');
    expect(indexed()).toEqual(['a', 'b']);
  });
});

describe('the lives a phone kept the old way, in one value', () => {
  const kept = [life('first', 10), life('second', 30), life('third', 20)];

  it('are each moved to a key of their own on the first read, then the index is written, and the old value is taken away last', async () => {
    oldWay(kept);
    const store = new KvStore();
    expect(ids(await store.listRuns())).toEqual(['second', 'third', 'first']);
    expect(writes().map(({ op, key }) => `${op} ${key}`)).toEqual([
      `set ${keyOf('first')}`,
      `set ${keyOf('second')}`,
      `set ${keyOf('third')}`,
      `set ${INDEX}`,
      `remove ${OLD}`,
    ]);
    // Oldest first, as they were added.
    expect(indexed()).toEqual(['first', 'second', 'third']);
    for (const run of kept) expect(JSON.parse(device.values.get(keyOf(run.runId))!)).toEqual(run);
    expect(device.values.has(OLD)).toBe(false);
    // Once only: read again, nothing is written.
    device.calls.length = 0;
    await new KvStore().listRuns();
    expect(writes()).toEqual([]);
  });

  it('are all there, once each, whichever write the app was killed at: the next start finishes the move', async () => {
    // Three lives, the index, the old value taken away: five writes, and the app killed before each of them in turn.
    for (let killedAt = 0; killedAt <= 4; killedAt++) {
      device.values.clear();
      oldWay(kept);
      device.writesLeft = killedAt;
      await expect(new KvStore().listRuns(), `killed before write ${killedAt + 1}`).rejects.toThrow('the app was killed');
      // Nothing is lost while it is half done: whatever the index does not name yet is still in the old value.
      const old = device.values.has(OLD) ? Object.keys(JSON.parse(device.values.get(OLD)!) as object) : [];
      expect(new Set([...(indexed() ?? []), ...old]), `killed before write ${killedAt + 1}`).toEqual(new Set(['first', 'second', 'third']));
      device.writesLeft = Number.POSITIVE_INFINITY;
      expect(ids(await new KvStore().listRuns()), `opened after write ${killedAt}`).toEqual(['second', 'third', 'first']);
      expect(indexed()).toEqual(['first', 'second', 'third']);
      expect(device.values.has(OLD)).toBe(false);
      expect([...device.values.keys()].filter((key) => key.startsWith('ratrace:run:')).sort()).toEqual([keyOf('first'), keyOf('second'), keyOf('third')]);
    }
  });

  it('that cannot be read (a value cut short) are none: the old value is taken away, and the list is not refused on every read', async () => {
    // The lives kept with it are lost either way (no life can be read out of it); keeping it would throw on every list, and no life would ever show.
    device.values.set(OLD, '{"first": {"runId": "fir');
    await new KvStore().addRun(life('later', 40));
    expect(ids(await new KvStore().listRuns())).toEqual(['later']);
    expect(device.values.has(OLD)).toBe(false);
    // Read again, it is gone: nothing more is written.
    device.calls.length = 0;
    expect(ids(await new KvStore().listRuns())).toEqual(['later']);
    expect(writes()).toEqual([]);
  });

  it('are none, and no write, on a phone that never finished a life', async () => {
    expect(await new KvStore().listRuns()).toEqual([]);
    expect(writes()).toEqual([]);
  });
});

describe('a write cut short', () => {
  it('of a life added (its key written, the index not): the life is taken in on the next start, last', async () => {
    const store = new KvStore();
    await store.addRun(life('a', 1));
    device.writesLeft = 1;
    await expect(store.addRun(life('b', 2))).rejects.toThrow('the app was killed');
    expect(indexed()).toEqual(['a']);
    device.writesLeft = Number.POSITIVE_INFINITY;
    expect(ids(await new KvStore().listRuns())).toEqual(['b', 'a']);
    expect(indexed()).toEqual(['a', 'b']);
  });

  it('of a life removed (its key taken away, the index not): it stays gone, and the index is mended', async () => {
    const store = new KvStore();
    await store.addRun(life('a', 1));
    await store.addRun(life('b', 2));
    device.writesLeft = 1;
    await expect(store.removeRun('a')).rejects.toThrow('the app was killed');
    device.writesLeft = Number.POSITIVE_INFINITY;
    expect(ids(await new KvStore().listRuns())).toEqual(['b']);
    expect(indexed()).toEqual(['b']);
  });

  it('leaves the store that saw it fail reading the phone again, not what it thought it had written', async () => {
    const store = new KvStore();
    await store.addRun(life('a', 1));
    device.writesLeft = 0;
    await expect(store.addRun(life('b', 2))).rejects.toThrow('the app was killed');
    device.writesLeft = Number.POSITIVE_INFINITY;
    expect(ids(await store.listRuns())).toEqual(['a']);
  });
});

describe('the lives read once', () => {
  it('are held: listed again, only the index is read, to see that nothing else wrote meanwhile', async () => {
    const store = new KvStore();
    for (let i = 0; i < 5; i++) await store.addRun(life(`l${i}`, i));
    await new KvStore().listRuns();
    const fresh = new KvStore();
    await fresh.listRuns();
    device.calls.length = 0;
    await fresh.listRuns();
    expect(device.calls).toEqual([{ op: 'get', key: INDEX }]);
  });

  it('are read again when another store on the phone has written (the timing probe puts lives with its own)', async () => {
    const app = new KvStore();
    await app.addRun(life('a', 1));
    expect(ids(await app.listRuns())).toEqual(['a']);
    const other = new KvStore();
    await other.addRun(life('b', 2));
    await other.removeRun('a');
    expect(ids(await app.listRuns())).toEqual(['b']);
  });

  it('are handed out as copies: what a caller does to one is not what the store holds, its log neither', async () => {
    const store = new KvStore();
    const logged = { ...life('a', 1), log: [{ picks: [0, 1], orders: [] }] };
    await store.addRun(logged);
    const [first] = await store.listRuns();
    first.score = -1;
    first.history.push(99);
    first.log[0].picks.push(7);
    first.log.push({ picks: [], orders: [] });
    expect(await store.listRuns()).toEqual([logged]);
    // Each list is made anew: no two hand out the same life.
    const [one] = await store.listRuns();
    const [two] = await store.listRuns();
    expect(one).not.toBe(two);
    expect(one.log).not.toBe(two.log);
  });

  it('tell their ids without reading a life: those the list shows, as lives are added and removed', async () => {
    const store = new KvStore();
    for (const id of ['a', 'b', 'c']) await store.addRun(life(id, id.charCodeAt(0)));
    device.values.set(keyOf('bad'), '{"not":"a life"');
    device.values.set(INDEX, JSON.stringify(['a', 'b', 'c', 'bad']));
    const fresh = new KvStore();
    // The bad record is kept, and not counted: the list does not show it.
    expect((await fresh.runIds()).sort()).toEqual(['a', 'b', 'c']);
    expect(ids(await fresh.listRuns()).sort()).toEqual(['a', 'b', 'c']);
    device.calls.length = 0;
    expect((await fresh.runIds()).sort()).toEqual(['a', 'b', 'c']);
    expect(device.calls).toEqual([{ op: 'get', key: INDEX }]);
    await fresh.addRun(life('d', 9));
    await fresh.removeRun('a');
    expect((await fresh.runIds()).sort()).toEqual(['b', 'c', 'd']);
  });
});

describe('the step that ends a life, with 63 lives on the phone', () => {
  it('writes the one life and the index, never the list, and reads no other life', async () => {
    // 63 lives a phone has finished, as this store keeps them.
    const before = new KvStore();
    for (let i = 0; i < 63; i++) await before.addRun({ ...life(`kept-${i}`, 1_000 + i), log: Array.from({ length: 20 }, () => ({ picks: [0, 1, 0], orders: [] })) });
    let n = 0;
    const store = new ResilientStore(new KvStore());
    const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(n += 1)}`, newSeed: () => 'kv-store-seed', now: () => 10_000 + n });
    const saver = bots.find((bot) => bot.id === 'saver')!;
    const session = await sessions.start('nurse');
    const atFinances = async () => {
      while (session.view().phase === 'cards') await session.answerCard(saver.pick(content, session.view()));
    };
    await atFinances();
    while (session.view().round < content.rounds - 1 && !session.view().finished) {
      await session.playRound({ orders: saver.orders(content, session.view()) });
      await atFinances();
    }
    // The last round: playing it ends the life.
    device.calls.length = 0;
    await session.playRound({ orders: saver.orders(content, session.view()) });
    expect(session.view().finished).toBe(true);
    const step = [...device.calls];
    const [ended] = (await new KvStore().listRuns()).filter((run) => !run.runId.startsWith('kept-'));
    const ofLives = step.filter((call) => call.op !== 'get' && call.key?.startsWith('ratrace:run'));
    // The life just ended is written under its key (again with each save of the step), and the index once, with its id.
    expect(new Set(ofLives.map(({ op, key }) => `${op} ${key}`))).toEqual(new Set([`set ${keyOf(ended.runId)}`, `set ${INDEX}`]));
    expect(ofLives.filter((call) => call.key === INDEX)).toHaveLength(1);
    // No write holds any of the 63.
    for (const call of step) expect(call.value?.includes('"runId":"kept-') ?? false, call.key).toBe(false);
    // Read: the index, to see that nobody else wrote; never one of the 63.
    expect(step.filter((call) => call.op === 'get' && call.key?.startsWith('ratrace:run:'))).toEqual([]);
    expect(ids(await new KvStore().listRuns())).toHaveLength(64);
  });

  it('as the phone stacks its stores, a step that does not end the life lists no life: it counts them by the index', async () => {
    const before = new KvStore();
    for (let i = 0; i < 63; i++) await before.addRun(life(`kept-${i}`, 1_000 + i));
    let n = 0;
    const kv = new KvStore();
    const listed = vi.spyOn(kv, 'listRuns');
    const store = new ResilientStore(kv, () => {}, { freshReads: true });
    const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(n += 1)}`, newSeed: () => 'kv-store-seed', now: () => 10_000 + n });
    const session = await sessions.start('nurse');
    // The profile counted the 63 into its rank as the game opened, as the phone's provider does.
    await settleRank(store);
    listed.mockClear();
    device.calls.length = 0;
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
    expect(session.view().finished).toBe(false);
    expect(listed).not.toHaveBeenCalled();
    expect(device.calls.filter((call) => call.op === 'get' && call.key?.startsWith('ratrace:run:'))).toEqual([]);
  });
});
