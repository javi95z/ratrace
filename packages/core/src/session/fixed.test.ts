import { describe, expect, it } from 'vitest';
import { fixedDeps, fixedSessions, memoryDevice } from './fixed';
import type { SavedGame } from './types';

describe('a device of memory, with nothing in it that changes', () => {
  it('makes ids, seeds and a clock that are the same in every run: the ones every screen\'s tests begin their lives with', () => {
    const deps = fixedDeps();
    expect([deps.newId(), deps.newSeed(), deps.now(), deps.now(), deps.newId(), deps.newSeed()]).toEqual(['id-1', 'screen-seed-1', 1_001, 1_002, 'id-2', 'screen-seed-2']);
  });

  it('begins a life on a device of its own, and the life is the same whenever it is begun', async () => {
    const [a, b] = [memoryDevice(), memoryDevice()];
    await fixedSessions(a).start('engineer');
    await fixedSessions(b).start('engineer');
    expect(await a.loadGame()).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-1', lifeId: 'engineer', updatedAt: 1_001 });
    expect(await a.loadGame()).toEqual(await b.loadGame());
    expect(((await a.loadGame()) as SavedGame).log).toEqual([]);
  });

  it('keeps what is put on one device off the others', async () => {
    const [a, b] = [memoryDevice(), memoryDevice()];
    await fixedSessions(a).start('nurse');
    expect(await b.loadGame()).toBeNull();
  });
});
