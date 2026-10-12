import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalStore } from './indexeddb';
import { MemoryStore } from './memory';
import { newProfile } from './types';
import type { FinishedRun, PlayerStore, SavedGame } from './types';

const game = (over: Partial<SavedGame> = {}): SavedGame =>
  ({ format: 1, gameId: 'g', engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], history: [1], bankruptcies: 0, state: { round: 0 }, updatedAt: 1, ...over }) as SavedGame;
const run = (runId: string, finishedAt: number): FinishedRun =>
  ({ format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt, score: 300, netWorth: 5, status: 1, escapedAtRound: null, bankruptcies: 0, history: [1, 5], verified: false });

let n = 0;
const stores: Array<[string, () => PlayerStore]> = [
  ['MemoryStore', () => new MemoryStore()],
  ['LocalStore', () => new LocalStore(`ratrace-test-${(n += 1)}`)],
];

describe.each(stores)('%s', (_name, make) => {
  it('starts empty, with a default profile', async () => {
    const store = make();
    expect(await store.loadGame()).toBeNull();
    expect(await store.listRuns()).toEqual([]);
    expect(await store.loadProfile()).toEqual(newProfile());
  });

  it('keeps the game in progress, replaces it and clears it', async () => {
    const store = make();
    await store.saveGame(game());
    expect(await store.loadGame()).toEqual(game());
    await store.saveGame(game({ gameId: 'g2', updatedAt: 2 }));
    expect(await store.loadGame()).toEqual(game({ gameId: 'g2', updatedAt: 2 }));
    await store.clearGame();
    expect(await store.loadGame()).toBeNull();
  });

  it('hands back copies, so nothing stored changes behind its back', async () => {
    const store = make();
    const saved = game();
    await store.saveGame(saved);
    saved.history.push(99);
    const loaded = (await store.loadGame()) as SavedGame;
    expect(loaded.history).toEqual([1]);
    loaded.history.push(7);
    expect(((await store.loadGame()) as SavedGame).history).toEqual([1]);
  });

  it('lists finished lives, the latest first, and keeps one record per life', async () => {
    const store = make();
    await store.addRun(run('a', 10));
    await store.addRun(run('b', 30));
    await store.addRun(run('c', 20));
    await store.addRun({ ...run('a', 10), score: 999 });
    const runs = await store.listRuns();
    expect(runs.map((r) => r.runId)).toEqual(['b', 'c', 'a']);
    expect(runs[2].score).toBe(999);
  });

  it('keeps the profile', async () => {
    const store = make();
    await store.saveProfile({ format: 1, settings: { reducedMotion: true } });
    expect(await store.loadProfile()).toEqual({ format: 1, settings: { reducedMotion: true } });
  });
});

describe('LocalStore', () => {
  it('still has everything when the page is opened again', async () => {
    const first = new LocalStore('ratrace-test-reopen');
    await first.saveGame(game());
    await first.addRun(run('a', 10));
    await first.saveProfile({ format: 1, settings: { reducedMotion: true } });
    const second = new LocalStore('ratrace-test-reopen');
    expect(await second.loadGame()).toEqual(game());
    expect(await second.listRuns()).toHaveLength(1);
    expect((await second.loadProfile()).settings.reducedMotion).toBe(true);
  });

  it('repairs a profile that is not one', async () => {
    const store = new LocalStore('ratrace-test-profile');
    await store.saveProfile('nonsense' as never);
    expect(await store.loadProfile()).toEqual(newProfile());
    await store.saveProfile({ format: 1, settings: {} } as never);
    expect(await store.loadProfile()).toEqual(newProfile());
  });
});
