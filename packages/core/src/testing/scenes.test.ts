import { content } from '@ratrace/content';
import { stateHash } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { createGameStore } from '../game/store';
import { fixedSessions, memoryDevice } from '../session/fixed';
import type { MemoryStore } from '../session/fixed';
import type { SavedGame } from '../session/types';
import { SCENES, sceneServices, sceneStore } from './scenes';

const saveOf = async (store: MemoryStore) => (await store.loadGame()) as SavedGame | null;

/** What a client makes of a scene's save: the round store of the game, opened on it as the game does when a page opens. */
async function opened(store: MemoryStore) {
  const game = createGameStore({ sessions: fixedSessions(store), content });
  await game.getState().boot();
  return game.getState();
}

/** A scene's round, as the player counts it: the first round is 1 (`view.round` counts from 0). */
const roundOf = (state: Awaited<ReturnType<typeof opened>>) => (state.view?.round ?? -1) + 1;

describe('a scene is the same game state for whoever builds it', () => {
  it('gives saves with the same state hash on two calls, and everything else the store holds alike', async () => {
    for (const { name } of SCENES) {
      const [a, b] = [await sceneStore(name), await sceneStore(name)];
      const [x, y] = [await saveOf(a), await saveOf(b)];
      expect(x === null ? null : stateHash(x.state), name).toBe(y === null ? null : stateHash(y.state));
      expect(x, name).toEqual(y);
      expect(await a.loadProfile(), name).toEqual(await b.loadProfile());
      expect(await a.listRuns(), name).toEqual(await b.listRuns());
    }
  });

  it('begins the first life as the screens\' tests do: the id, the seed and the clock that never change', async () => {
    const save = await saveOf(await sceneStore('play-news-r1'));
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-1', updatedAt: 1_001 });
  });

  it('is quick enough to build in a test: a life played five rounds in', async () => {
    const began = performance.now();
    await sceneStore('play-finance-r6');
    expect(performance.now() - began).toBeLessThan(2_000);
  });
});

describe('the scenes of the front door and the play screen', () => {
  it('home-new is a device with no life in progress, and nothing earned', async () => {
    const store = await sceneStore('home-new');
    expect(await saveOf(store)).toBeNull();
    expect(await opened(store)).toMatchObject({ status: 'none', lost: null, view: null });
    expect(await store.listRuns()).toEqual([]);
  });

  it('home-continue is a life in progress, a few rounds in, at the news of a round', async () => {
    const state = await opened(await sceneStore('home-continue'));
    expect(state).toMatchObject({ status: 'playing', lifeId: 'nurse', stage: 'news' });
    expect(roundOf(state)).toBe(3);
    expect(state.view?.phase).toBe('cards');
    expect(state.view?.answered).toBe(0);
  });

  it('play-news-r1 is the news of the first round of the engineer', async () => {
    const state = await opened(await sceneStore('play-news-r1'));
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news' });
    expect(roundOf(state)).toBe(1);
    expect(state.view).toMatchObject({ phase: 'cards', answered: 0 });
    expect(state.history).toHaveLength(1);
  });

  it('play-cards-r1 is a hand of the first round half answered: a game opens on its next card', async () => {
    const store = await sceneStore('play-cards-r1');
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'cards' });
    expect(roundOf(state)).toBe(1);
    expect(state.view).toMatchObject({ phase: 'cards', answered: 1 });
    expect(state.view?.hand.length).toBeGreaterThan(1);
    expect((await saveOf(store))?.log[0].picks).toHaveLength(1);
  });

  it('play-finance-r6 is the finances of the sixth round, five rounds played with the saver\'s orders', async () => {
    const store = await sceneStore('play-finance-r6');
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'finance', orders: [] });
    expect(roundOf(state)).toBe(6);
    expect(state.view?.phase).toBe('finance');
    expect(state.history).toHaveLength(6);
    const save = await saveOf(store);
    // Rounds 1 to 5 are played, with the orders the saver wrote (it studies, works and saves, so none is empty); the sixth has all its cards answered and no round played.
    expect(save?.log.slice(0, 5).map((entry) => entry.orders !== null && entry.orders.length > 0)).toEqual([true, true, true, true, true]);
    expect(save?.log[5]?.orders ?? null).toBeNull();
    expect(save?.log[5]?.picks).toHaveLength(state.view?.hand.length ?? -1);
  });
});

describe('the list of scenes', () => {
  it('names each scene <screen>-<state>, once, in a language the game speaks', () => {
    expect(new Set(SCENES.map((scene) => scene.name)).size).toBe(SCENES.length);
    for (const scene of SCENES) {
      expect(scene.name, scene.name).toMatch(/^[a-z]+(-[a-z0-9]+)+$/);
      expect(['en', 'es', 'ru']).toContain(scene.locale);
    }
    expect(SCENES.map((scene) => scene.name)).toEqual(['home-new', 'home-continue', 'play-news-r1', 'play-cards-r1', 'play-finance-r6']);
  });

  it('builds every scene it lists, and refuses a name it does not', async () => {
    for (const { name } of SCENES) await expect(sceneStore(name), name).resolves.toHaveProperty('loadGame');
    await expect(sceneStore('play-nowhere-r9')).rejects.toThrow('unknown scene: play-nowhere-r9');
  });
});

describe('what a client draws a scene with', () => {
  it('gives the scene\'s store behind sessions that open the scene\'s own life, and no tap is ever too soon', async () => {
    const store = await sceneStore('play-finance-r6');
    const services = sceneServices(store);
    expect(services).toMatchObject({ store, tapGuardMs: 0 });
    const resumed = await services.sessions.resume();
    expect(resumed.session?.lifeId).toBe('engineer');
    expect(resumed.session?.view().round).toBe(5);
  });

  it('keeps nothing of a scene beyond its store: another scene\'s is another device', async () => {
    const [a, b] = [await sceneStore('play-news-r1'), memoryDevice()];
    await sceneServices(b).sessions.start('nurse');
    expect(((await a.loadGame()) as SavedGame).lifeId).toBe('engineer');
    expect(((await b.loadGame()) as SavedGame).lifeId).toBe('nurse');
  });
});
