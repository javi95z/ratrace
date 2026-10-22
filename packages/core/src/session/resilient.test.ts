import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory';
import { ResilientStore } from './resilient';
import { newProfile } from './types';
import type { FinishedRun, SavedGame } from './types';

const game = (updatedAt: number) => ({ format: 1, gameId: 'g', log: [], history: [], updatedAt }) as unknown as SavedGame;
const run = (runId: string, finishedAt: number) => ({ format: 1, runId, lifeId: 'nurse', finishedAt }) as unknown as FinishedRun;

/** A device store that can be told to refuse, and counts what it was asked. */
function device() {
  const primary = new MemoryStore();
  const real = { saveGame: primary.saveGame, loadGame: primary.loadGame, addRun: primary.addRun, removeRun: primary.removeRun, clearGame: primary.clearGame, saveProfile: primary.saveProfile, listRuns: primary.listRuns };
  const down = { writes: false, reads: false };
  const refuse = () => Promise.reject(new Error('disk full'));
  primary.saveGame = (g) => (down.writes ? refuse() : real.saveGame(g));
  primary.addRun = (r) => (down.writes ? refuse() : real.addRun(r));
  primary.removeRun = (id) => (down.writes ? refuse() : real.removeRun(id));
  primary.clearGame = () => (down.writes ? refuse() : real.clearGame());
  primary.saveProfile = (p) => (down.writes ? refuse() : real.saveProfile(p));
  primary.loadGame = () => (down.reads ? refuse() : real.loadGame());
  primary.listRuns = () => (down.reads ? refuse() : real.listRuns());
  const changes: boolean[] = [];
  const errors: unknown[] = [];
  const store = new ResilientStore(primary, (degraded, error) => {
    changes.push(degraded);
    if (error !== undefined) errors.push(error);
  });
  return { primary: { ...real }, down, store, changes, errors };
}

describe('ResilientStore', () => {
  it('uses the device database while it works', async () => {
    const { primary, store, changes } = device();
    await store.saveGame(game(1));
    expect(await primary.loadGame()).toEqual(game(1));
    expect(await store.loadGame()).toEqual(game(1));
    expect(store.degraded).toBe(false);
    expect(changes).toEqual([]);
  });

  it('is not behind while a write is merely on its way: only a refusal is', async () => {
    // A screen drawn in the middle of a write once read this as "not saving", and kept saying so.
    const primary = new MemoryStore();
    const save = primary.saveGame;
    let letThrough = () => {};
    primary.saveGame = async (g) => {
      await new Promise<void>((resolve) => (letThrough = resolve));
      return save(g);
    };
    const changes: boolean[] = [];
    const store = new ResilientStore(primary, (degraded) => changes.push(degraded));
    const writing = store.saveGame(game(1));
    await Promise.resolve();
    expect(store.degraded).toBe(false);
    // What is on its way is already what the game reads back.
    expect(await store.loadGame()).toEqual(game(1));
    // Nor when a second write is made before the first has landed: the device is busy, not failing.
    const next = store.saveGame(game(2));
    letThrough();
    await writing;
    expect(store.degraded).toBe(false);
    letThrough();
    await next;
    expect(store.degraded).toBe(false);
    expect(changes).toEqual([]);
    expect(await primary.loadGame()).toEqual(game(2));
  });

  it('never fails the game: a write the device refuses is kept, and says so once', async () => {
    const { primary, down, store, changes, errors } = device();
    await store.saveGame(game(1));
    down.writes = true;
    await store.saveGame(game(2));
    await store.saveGame(game(3));
    expect(store.degraded).toBe(true);
    expect(changes).toEqual([true]);
    expect(String(errors[0])).toContain('disk full');
    // What this visit wrote is what it reads back, although the device still holds the older record.
    expect(await store.loadGame()).toEqual(game(3));
    expect(await primary.loadGame()).toEqual(game(1));
  });

  it('offers the device what it refused with every later write, and recovers when it takes it', async () => {
    const { primary, down, store, changes } = device();
    down.writes = true;
    await store.saveGame(game(1));
    await store.addRun(run('a', 10));
    await store.saveProfile({ ...newProfile(), settings: { reducedMotion: true, sound: true } });
    expect(store.degraded).toBe(true);
    expect((await store.listRuns()).map((r) => r.runId)).toEqual(['a']);
    expect((await store.loadProfile()).settings.reducedMotion).toBe(true);

    down.writes = false;
    await store.saveGame(game(2));
    expect(store.degraded).toBe(false);
    expect(changes).toEqual([true, false]);
    expect(await primary.loadGame()).toEqual(game(2));
    expect((await primary.listRuns()).map((r) => r.runId)).toEqual(['a']);
    expect((await new ResilientStore(Object.assign(new MemoryStore(), primary)).loadGame())).toEqual(game(2));
  });

  it('takes a finished life out, on the device when it can and in what this visit reads back when it cannot', async () => {
    const { primary, down, store } = device();
    await store.addRun(run('a', 10));
    await store.addRun(run('b', 20));
    await store.removeRun('a');
    expect((await primary.listRuns()).map((r) => r.runId)).toEqual(['b']);
    // The device refuses: the life is gone from what the game reads all the same, and from the device once it takes writes again.
    down.writes = true;
    await store.addRun(run('c', 30));
    await store.removeRun('b');
    await store.removeRun('c');
    expect(store.degraded).toBe(true);
    expect((await store.listRuns()).map((r) => r.runId)).toEqual([]);
    down.writes = false;
    await store.addRun(run('d', 40));
    expect(store.degraded).toBe(false);
    expect((await primary.listRuns()).map((r) => r.runId)).toEqual(['d']);
    expect((await store.listRuns()).map((r) => r.runId)).toEqual(['d']);
  });

  it('keeps what was done to the finished lives in the order it was done, whatever the device was doing meanwhile', async () => {
    const { primary, down, store } = device();
    // Taken out and put back: it is there. Put in and taken out: it is not.
    down.writes = true;
    await store.addRun(run('a', 10));
    await store.removeRun('a');
    await store.addRun(run('a', 11));
    await store.addRun(run('b', 20));
    await store.removeRun('b');
    expect((await store.listRuns()).map((r) => [r.runId, r.finishedAt])).toEqual([['a', 11]]);
    down.writes = false;
    // Three more in one breath, while the device is still taking the ones before: none is lost or doubled.
    await Promise.all([store.addRun(run('c', 30)), store.removeRun('a'), store.addRun(run('e', 50))]);
    expect((await primary.listRuns()).map((r) => r.runId)).toEqual(['e', 'c']);
    expect((await store.listRuns()).map((r) => r.runId)).toEqual(['e', 'c']);
  });

  it('remembers that the game was cleared, too', async () => {
    const { primary, down, store } = device();
    await store.saveGame(game(1));
    down.writes = true;
    await store.clearGame();
    expect(await store.loadGame()).toBeNull();
    expect(await primary.loadGame()).toEqual(game(1));
    down.writes = false;
    await store.addRun(run('b', 5));
    expect(await primary.loadGame()).toBeNull();
    expect(store.degraded).toBe(false);
  });

  it('plays on from memory when the database cannot even be read', async () => {
    const { down, store, changes } = device();
    down.reads = true;
    down.writes = true;
    expect(await store.loadGame()).toBeNull();
    expect(await store.listRuns()).toEqual([]);
    expect(store.degraded).toBe(true);
    await store.saveGame(game(4));
    expect(await store.loadGame()).toEqual(game(4));
    await store.addRun(run('c', 2));
    await store.addRun(run('d', 9));
    expect((await store.listRuns()).map((r) => r.runId)).toEqual(['d', 'c']);
    expect(changes).toEqual([true]);
  });

  it('remembers what it read, so a device that then stops answering does not turn a full profile into an empty one', async () => {
    const primary = new MemoryStore();
    const full = { ...newProfile(), badges: { millionaire: { at: 5, gameId: 'g' } }, gallery: ['watch_rolex'] };
    await primary.saveProfile(full);
    const load = primary.loadProfile;
    const store = new ResilientStore(primary);
    expect(await store.loadProfile()).toEqual(full);
    primary.loadProfile = () => Promise.reject(new Error('gone'));
    expect(await store.loadProfile()).toEqual(full);
    // And a write made while it could not be read does not put a fresh profile over the full one.
    primary.loadProfile = load;
    expect((await primary.loadProfile()).badges).toEqual(full.badges);
  });

  it('hands back copies, so nothing kept changes behind its back', async () => {
    const { down, store } = device();
    down.writes = true;
    const mine = game(1);
    await store.saveGame(mine);
    (mine as { updatedAt: number }).updatedAt = 99;
    const read = (await store.loadGame()) as SavedGame;
    expect(read.updatedAt).toBe(1);
    (read as { updatedAt: number }).updatedAt = 77;
    expect(((await store.loadGame()) as SavedGame).updatedAt).toBe(1);
  });

  it('copies the lives the device gives by default, and hands them on as they come when the device makes them anew (`freshReads`)', async () => {
    // A device that gives the same objects each time it is asked, as a store that held them would.
    const held = [run('a', 1), run('b', 2)];
    const primary = Object.assign(new MemoryStore(), { listRuns: async () => held });
    const copied = await new ResilientStore(primary).listRuns();
    expect(copied).toEqual([held[1], held[0]]);
    expect(copied[0]).not.toBe(held[1]);
    const fresh = new ResilientStore(primary, () => {}, { freshReads: true });
    const handed = await fresh.listRuns();
    expect(handed[0]).toBe(held[1]);
    expect(handed[1]).toBe(held[0]);
    // What it holds itself, a life the device has not taken yet, is copied all the same: a change to what was read is not its own.
    primary.addRun = () => Promise.reject(new Error('disk full'));
    await fresh.addRun(run('c', 3));
    const withPending = await fresh.listRuns();
    expect(withPending.map((one) => one.runId)).toEqual(['c', 'b', 'a']);
    (withPending[0] as { lifeId: string }).lifeId = 'changed';
    expect((await fresh.listRuns())[0].lifeId).toBe('nurse');
  });

  it('tells the ids of the finished lives only where the device does, with what it has not taken yet done to them', async () => {
    expect(new ResilientStore(new MemoryStore()).runIds).toBeUndefined();
    const primary = new MemoryStore();
    await primary.addRun(run('a', 1));
    await primary.addRun(run('b', 2));
    const asked = { lists: 0 };
    const telling = Object.assign(primary, {
      runIds: async () => ['a', 'b'],
      listRuns: async () => {
        asked.lists += 1;
        return [];
      },
    });
    const store = new ResilientStore(telling, () => {}, { freshReads: true });
    expect((await store.runIds!()).sort()).toEqual(['a', 'b']);
    telling.addRun = () => Promise.reject(new Error('disk full'));
    telling.removeRun = () => Promise.reject(new Error('disk full'));
    await store.addRun(run('c', 3));
    await store.removeRun('a');
    expect((await store.runIds!()).sort()).toEqual(['b', 'c']);
    // No life was read to tell them.
    expect(asked.lists).toBe(0);
  });

  it('starts with a default profile either way', async () => {
    expect(await new ResilientStore(new MemoryStore()).loadProfile()).toEqual(newProfile());
    const { down, store } = device();
    down.reads = true;
    expect(await store.loadProfile()).toEqual(newProfile());
  });
});
