import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory';
import { ResilientStore } from './resilient';
import { newProfile } from './types';
import type { SavedGame } from './types';

const game = { format: 1, gameId: 'g', log: [], history: [] } as unknown as SavedGame;

describe('ResilientStore', () => {
  it('uses the device database while it works', async () => {
    const primary = new MemoryStore();
    const store = new ResilientStore(primary);
    await store.saveGame(game);
    expect(await primary.loadGame()).toEqual(game);
    expect(await store.loadGame()).toEqual(game);
    expect(store.degraded).toBe(false);
  });

  it('falls back to memory the first time the database refuses, says so once, and keeps working', async () => {
    const primary = new MemoryStore();
    primary.loadGame = () => Promise.reject(new Error('blocked'));
    primary.saveGame = () => Promise.reject(new Error('blocked'));
    const failures: unknown[] = [];
    const store = new ResilientStore(primary, (error) => failures.push(error));

    expect(await store.loadGame()).toBeNull();
    expect(store.degraded).toBe(true);
    await store.saveGame(game);
    expect(await store.loadGame()).toEqual(game);
    await store.saveProfile({ format: 1, settings: { reducedMotion: true } });
    expect((await store.loadProfile()).settings.reducedMotion).toBe(true);
    expect(await store.listRuns()).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(String(failures[0])).toContain('blocked');
  });

  it('starts with a default profile either way', async () => {
    expect(await new ResilientStore(new MemoryStore()).loadProfile()).toEqual(newProfile());
  });
});
