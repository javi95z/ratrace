import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory';
import { ResilientStore } from './resilient';
import { newProfile } from './types';
import type { FinishedRun, SavedGame } from './types';

const game = (updatedAt: number) => ({ format: 1, gameId: 'g', log: [], history: [], updatedAt }) as unknown as SavedGame;
const run = (runId: string, finishedAt: number) => ({ format: 1, runId, finishedAt }) as unknown as FinishedRun;

/** A device store that can be told to refuse, and counts what it was asked. */
function device() {
  const primary = new MemoryStore();
  const real = { saveGame: primary.saveGame, loadGame: primary.loadGame, addRun: primary.addRun, clearGame: primary.clearGame, saveProfile: primary.saveProfile, listRuns: primary.listRuns };
  const down = { writes: false, reads: false };
  const refuse = () => Promise.reject(new Error('disk full'));
  primary.saveGame = (g) => (down.writes ? refuse() : real.saveGame(g));
  primary.addRun = (r) => (down.writes ? refuse() : real.addRun(r));
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
    await store.saveProfile({ format: 1, settings: { reducedMotion: true } });
    expect(store.degraded).toBe(true);
    expect(await store.listRuns()).toEqual([run('a', 10)]);
    expect((await store.loadProfile()).settings.reducedMotion).toBe(true);

    down.writes = false;
    await store.saveGame(game(2));
    expect(store.degraded).toBe(false);
    expect(changes).toEqual([true, false]);
    expect(await primary.loadGame()).toEqual(game(2));
    expect(await primary.listRuns()).toEqual([run('a', 10)]);
    expect((await new ResilientStore(Object.assign(new MemoryStore(), primary)).loadGame())).toEqual(game(2));
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

  it('starts with a default profile either way', async () => {
    expect(await new ResilientStore(new MemoryStore()).loadProfile()).toEqual(newProfile());
    const { down, store } = device();
    down.reads = true;
    expect(await store.loadProfile()).toEqual(newProfile());
  });
});
