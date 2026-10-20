import { content, lives, weekOf } from '@ratrace/content';
import { stateHash } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { createGameStore } from '../game/store';
import { fixedSessions, memoryDevice } from '../session/fixed';
import type { MemoryStore } from '../session/fixed';
import { newProfile, SAVE_FORMAT } from '../session/types';
import type { SavedGame } from '../session/types';
import { runScene, SCENE_NOW, SCENES, sceneServices, sceneStore, screenOf } from './scenes';

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

describe('the scenes of the front door beyond its first two, the challenge page and the legal page', () => {
  it('home-settings is the front door of a life in progress with its settings open: the very store of home-continue, and the sheet the screen opens', async () => {
    expect(await saveOf(await sceneStore('home-settings'))).toEqual(await saveOf(await sceneStore('home-continue')));
    expect(SCENES.find((scene) => scene.name === 'home-settings')?.sheet).toBe('settings');
    // Only a scene that names a sheet has one.
    expect(SCENES.filter((scene) => scene.sheet !== undefined).map((scene) => scene.name)).toEqual(['home-settings', 'new-replace']);
  });

  it('home-lost-newer is a life saved by a newer version of the game: the device holds it, this one cannot open it, and it is kept', async () => {
    const store = await sceneStore('home-lost-newer');
    const save = await saveOf(store);
    expect(save).not.toBeNull();
    expect((save as unknown as { format: number }).format).toBe(SAVE_FORMAT + 1);
    expect(save?.lifeId).toBe('nurse');
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'none', lost: 'newer', view: null });
    // A life a newer version wrote is that version's to go on with: opening the game does not throw it away.
    expect(await saveOf(store)).toEqual(save);
  });

  it('the challenge page and the legal page are drawn on a device with no life, as the front door of someone new is', async () => {
    for (const name of ['challenge-practice', 'legal']) {
      const store = await sceneStore(name);
      expect(await saveOf(store), name).toBeNull();
      expect(await opened(store), name).toMatchObject({ status: 'none', lost: null, view: null });
    }
  });
});

describe('the scenes of the page where a life is chosen', () => {
  it('new-first is a device with nothing on it: the three lives to begin with, and the seventeen to unlock', async () => {
    const store = await sceneStore('new-first');
    expect(await saveOf(store)).toBeNull();
    expect(await opened(store)).toMatchObject({ status: 'none', lost: null, view: null });
    expect((await store.loadProfile()).unlocked).toEqual({});
    expect(await store.listRuns()).toEqual([]);
  });

  it('new-unlocked is the same device with two lives the player has earned, which are locked lives of the game and are listed once each', async () => {
    const store = await sceneStore('new-unlocked');
    expect(await saveOf(store)).toBeNull();
    const { unlocked } = await store.loadProfile();
    expect(Object.keys(unlocked)).toEqual(['rider', 'heir']);
    for (const id of Object.keys(unlocked)) expect(lives.find((life) => life.id === id)?.unlock, id).not.toBe('default');
    // The rest of the profile is a new player's: nothing else is earned.
    expect(await store.loadProfile()).toEqual({ ...newProfile(), unlocked });
    // And the very same profile on every build of the scene.
    expect((await (await sceneStore('new-unlocked')).loadProfile()).unlocked).toEqual(unlocked);
  });

  it('new-locked is the device of someone new, and the page shows the list of what is locked open; new-replace is a life in progress, with the question of ending it open', async () => {
    expect(await saveOf(await sceneStore('new-locked'))).toBeNull();
    expect(await (await sceneStore('new-locked')).loadProfile()).toEqual(newProfile());
    expect(await saveOf(await sceneStore('new-replace'))).toEqual(await saveOf(await sceneStore('home-continue')));
    expect(SCENES.find((scene) => scene.name === 'new-replace')?.sheet).toBe('replace');
    expect(SCENES.find((scene) => scene.name === 'new-locked')?.sheet).toBeUndefined();
    const state = await opened(await sceneStore('new-replace'));
    expect(state).toMatchObject({ status: 'playing', lifeId: 'nurse', stage: 'news' });
  });
});

describe('the list of scenes', () => {
  it('names each scene <screen> or <screen>-<state>, once, in a language the game speaks', () => {
    expect(new Set(SCENES.map((scene) => scene.name)).size).toBe(SCENES.length);
    for (const scene of SCENES) {
      expect(scene.name, scene.name).toMatch(/^[a-z]+(-[a-z0-9]+)*$/);
      expect(['en', 'es', 'ru']).toContain(scene.locale);
    }
    expect(SCENES.map((scene) => scene.name)).toEqual([
      'home-new',
      'home-continue',
      'home-settings',
      'home-lost-newer',
      'new-first',
      'new-unlocked',
      'new-locked',
      'new-replace',
      'play-news-r1',
      'play-cards-r1',
      'play-finance-r6',
      'play-outcome-r1',
      'play-resolve-r6',
      'challenge-practice',
      'legal',
    ]);
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

describe('the screen a scene is drawn on', () => {
  it('is the first word of its name', () => {
    expect(screenOf({ name: 'play-finance-r6', locale: 'en' })).toBe('play');
    expect(screenOf({ name: 'home-new', locale: 'es' })).toBe('home');
    expect(screenOf({ name: 'legal', locale: 'en' })).toBe('legal');
    expect(new Set(SCENES.map(screenOf))).toEqual(new Set(['home', 'new', 'play', 'challenge', 'legal']));
  });
});

describe('the day a scene is drawn on', () => {
  const DAY = 86_400_000;

  it('is a fixed instant in the middle of a week: Thursday noon in UTC, three and a half days from either edge of its week', () => {
    const at = new Date(SCENE_NOW);
    expect([at.getUTCDay(), at.getUTCHours(), at.getUTCMinutes(), at.getUTCSeconds(), at.getUTCMilliseconds()]).toEqual([4, 12, 0, 0, 0]);
    // The week, the challenge and the days left are the same for anyone drawing the scene within two days of noon, whatever their time zone.
    for (const shift of [-3.5 * DAY, -DAY, DAY, 3.5 * DAY - 1]) expect(weekOf(SCENE_NOW + shift), String(shift)).toBe(weekOf(SCENE_NOW));
    expect(weekOf(SCENE_NOW - 3.5 * DAY - 1)).not.toBe(weekOf(SCENE_NOW));
    expect(weekOf(SCENE_NOW + 3.5 * DAY)).not.toBe(weekOf(SCENE_NOW));
  });
});

/** Everything of the round on screen that a step could have left different: what a scene's script is judged by. */
const onScreen = (state: Awaited<ReturnType<typeof opened>>) =>
  stateHash({ stage: state.stage, view: state.view, cardEvents: state.cardEvents, offered: state.offered, resolved: state.resolved, earned: state.earned, history: state.history, story: state.story });

describe('scenes that go on after the game is open: the result of a card, the ledger of a round', () => {
  /** A game opened on a scene's store, and the scene's script run on it, as a client does once its game has opened. */
  async function played(name: string) {
    const game = createGameStore({ sessions: fixedSessions(await sceneStore(name)), content });
    await game.getState().boot();
    await runScene(name, game);
    return game.getState();
  }

  it('saves the life where the script starts: the very store of the scene it goes on from', async () => {
    expect(await saveOf(await sceneStore('play-outcome-r1'))).toEqual(await saveOf(await sceneStore('play-news-r1')));
    expect(await saveOf(await sceneStore('play-resolve-r6'))).toEqual(await saveOf(await sceneStore('play-finance-r6')));
    expect(await opened(await sceneStore('play-outcome-r1'))).toMatchObject({ stage: 'news' });
    expect(await opened(await sceneStore('play-resolve-r6'))).toMatchObject({ stage: 'finance' });
  });

  it('play-outcome-r1 is the result of the first card of the first round, answered with the saver\'s choice', async () => {
    const state = await played('play-outcome-r1');
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'outcome', pending: false, busy: false });
    expect(roundOf(state)).toBe(1);
    expect(state.view?.answered).toBe(1);
    expect(state.cardEvents.some((event) => event.kind === 'card')).toBe(true);
    expect(state.offered?.cardId).toBe(state.view?.hand[0]);
  });

  it('play-resolve-r6 is the ledger of the sixth round, played with the saver\'s orders', async () => {
    const state = await played('play-resolve-r6');
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'resolve', busy: false, orders: [] });
    expect(state.resolved?.before.round).toBe(5);
    expect(state.view?.round).toBe(6);
    expect(state.history).toHaveLength(7);
    expect(state.resolved?.events.length).toBeGreaterThan(0);
  });

  it('comes to the same result every time, on any store of the scene', async () => {
    for (const name of ['play-outcome-r1', 'play-resolve-r6']) expect(onScreen(await played(name)), name).toBe(onScreen(await played(name)));
    expect(onScreen(await played('play-outcome-r1'))).not.toBe(onScreen(await played('play-resolve-r6')));
  });

  it('does nothing for a scene with no script, and refuses one that is not a scene', async () => {
    const game = createGameStore({ sessions: fixedSessions(await sceneStore('play-news-r1')), content });
    await game.getState().boot();
    const before = onScreen(game.getState());
    await runScene('play-news-r1', game);
    await runScene('home-new', game);
    expect(onScreen(game.getState())).toBe(before);
    await expect(runScene('play-nowhere-r9', game)).rejects.toThrow('unknown scene: play-nowhere-r9');
  });

  it('names the scene when its script did not land where it says, or could not be taken', async () => {
    // The script of the first card's result, on a game that is at the finances of the sixth round: it lands nowhere.
    const finances = createGameStore({ sessions: fixedSessions(await sceneStore('play-finance-r6')), content });
    await finances.getState().boot();
    await expect(runScene('play-outcome-r1', finances)).rejects.toThrow('scene play-outcome-r1: expected the outcome, found the finance');
    // The ledger's script, on a game at the news: the round cannot be planned before its cards are answered.
    const news = createGameStore({ sessions: fixedSessions(await sceneStore('play-news-r1')), content });
    await news.getState().boot();
    await expect(runScene('play-resolve-r6', news)).rejects.toThrow(/^scene play-resolve-r6: /);
    // And with no life open at all there is nothing to go on from.
    const empty = createGameStore({ sessions: fixedSessions(memoryDevice()), content });
    await empty.getState().boot();
    await expect(runScene('play-outcome-r1', empty)).rejects.toThrow('scene play-outcome-r1: no life is open');
  });
});
