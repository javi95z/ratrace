import { content, lives, rarityOf, weekOf } from '@ratrace/content';
import { previewCard, stateHash } from '@ratrace/engine';
import { cardRarity } from '../game/present';
import { describe, expect, it, vi } from 'vitest';
import { createGameStore } from '../game/store';
import { fixedSessions, memoryDevice } from '../session/fixed';
import type { MemoryStore } from '../session/fixed';
import { newProfile, SAVE_FORMAT } from '../session/types';
import type { SavedGame } from '../session/types';
import { GUIDE_READ, PAGE_TURN_HELD_MS, runScene, SCENE_NOW, SCENES, sceneServices, sceneStore, screenOf, SHINE_HELD_MS, turnOf } from './scenes';
import { FIRSTS, TIPS } from '../game/guide';

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

describe('the scenes of the cards', () => {
  /** A scene's game as a client has it once the scene's steps are taken: the card waiting, and the choices it shows (those that can be taken). */
  async function waiting(name: string) {
    const game = createGameStore({ sessions: fixedSessions(await sceneStore(name)), content });
    await game.getState().boot();
    await runScene(name, game);
    const state = game.getState();
    const view = state.view as NonNullable<typeof state.view>;
    const cardId = view.hand[view.answered];
    const previews = previewCard(content, view, cardId);
    return { state, cardId, def: content.cards.find((card) => card.id === cardId)!, shown: previews.filter((preview) => preview.available).length, hidden: previews.filter((preview) => !preview.available).length };
  }

  it('play-cards-r1 is the second card of the engineer\'s first round, the office lottery: three choices, pressed, never swiped', async () => {
    const r1 = await waiting('play-cards-r1');
    expect(r1).toMatchObject({ cardId: 'luck_lottery', shown: 3, hidden: 0 });
    expect(r1.state).toMatchObject({ stage: 'cards', busy: false, picked: null });
  });

  it('play-cards-legendary is a legendary card with two choices, to be swiped: the appointment, the second card of the engineer\'s third round', async () => {
    const legendary = await waiting('play-cards-legendary');
    expect(legendary).toMatchObject({ cardId: 'red_appointment', shown: 2 });
    expect(cardRarity(legendary.def)).toBe('legendary');
    expect(roundOf(legendary.state)).toBe(3);
    // The life of the first fixed seed, played by the saver: the first two rounds whole, then one card of the third.
    expect(await saveOf(await sceneStore('play-cards-legendary'))).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-1', lifeId: 'engineer' });
  });

  it('play-cards-three is a card with three choices shown and a fourth the player cannot take, not shown: asking for a raise, on screen-seed-3', async () => {
    const three = await waiting('play-cards-three');
    expect(three).toMatchObject({ cardId: 'career_raise', shown: 3, hidden: 1 });
    expect(roundOf(three.state)).toBe(1);
    expect(await saveOf(await sceneStore('play-cards-three'))).toMatchObject({ seed: 'screen-seed-3' });
  });

  it('play-cards-ru-360 is, in Russian on a phone 360 wide, a card of long choices, one with the tag of the trade that opens it: the AI boom of screen-seed-10\'s second round', async () => {
    expect(SCENES.find((scene) => scene.name === 'play-cards-ru-360')).toEqual({ name: 'play-cards-ru-360', locale: 'ru', width: 360 });
    const ru = await waiting('play-cards-ru-360');
    expect(ru).toMatchObject({ cardId: 'world_ai_boom', shown: 3 });
    expect(ru.def.options[2].when?.careers).toBeDefined();
    expect(roundOf(ru.state)).toBe(2);
    // The world of screen-seed-10 has its crisis later: this round has none, so nothing of one is under the Hud.
    expect(ru.state.view?.timeline[ru.state.view.round].crisis ?? null).toBeNull();
  });

  it('are drawn for a player who has read the guide, but the first: the card and its choices are the whole stage (play-cards-r1 keeps the tip under them)', async () => {
    for (const name of ['play-cards-legendary', 'play-cards-three', 'play-cards-ru-360']) expect(GUIDE_READ.has(name), name).toBe(true);
    expect(GUIDE_READ.has('play-cards-r1')).toBe(false);
  });

  it('hold the shine of a rare card where the kit\'s pages of motion hold it, and its sparks at their end, so a shot sees one moment of it', () => {
    expect(SHINE_HELD_MS).toEqual({ holo: 2050, glint: 665, spark: 600 });
  });
});

describe('the scenes of the front door beyond its first two, the challenge page and the legal page', () => {
  it('home-settings is the front door of a life in progress with its settings open: the very store of home-continue, and the sheet the screen opens', async () => {
    expect(await saveOf(await sceneStore('home-settings'))).toEqual(await saveOf(await sceneStore('home-continue')));
    expect(SCENES.find((scene) => scene.name === 'home-settings')?.sheet).toBe('settings');
    // Only a scene that names a sheet has one.
    expect(SCENES.filter((scene) => scene.sheet !== undefined).map((scene) => scene.name)).toEqual(['home-settings', 'new-replace', 'hud-cash', 'hud-flow', 'hud-race', 'hud-status-ru', 'hud-jailed', 'hud-crisis-details', 'amount-savings']);
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

describe('the scenes of the play screen\'s own: the news, the guide, a fault and the calendar', () => {
  it('play-news-r1 and play-news-r6 are the news of the engineer\'s first and sixth rounds, for a player who has read every tip: the paper is the whole stage', async () => {
    const first = await opened(await sceneStore('play-news-r1'));
    expect(first).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news' });
    expect(roundOf(first)).toBe(1);
    const sixth = await opened(await sceneStore('play-news-r6'));
    expect(sixth).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news' });
    expect(roundOf(sixth)).toBe(6);
    expect(sixth.view).toMatchObject({ phase: 'cards', answered: 0 });
    // Every tip of a first life and every note of a first time, read: the guide says nothing (not even on a page under development, which shows tips to veterans).
    const read = [...TIPS.map((tip) => tip.id), ...FIRSTS.map((first) => first.id)];
    for (const name of ['play-news-r1', 'play-news-r6', 'play-pageturn']) {
      expect(GUIDE_READ.has(name), name).toBe(true);
      const { guide } = await (await sceneStore(name)).loadProfile();
      expect(guide, name).toEqual({ seen: read, off: false });
    }
  });

  it('play-guide-r1 is the news of the engineer\'s first round for someone new: the first tip of the guide is due', async () => {
    expect(await saveOf(await sceneStore('play-guide-r1'))).toEqual(await saveOf(await sceneStore('play-news-r1')));
    expect(await (await sceneStore('play-guide-r1')).loadProfile()).toEqual(newProfile());
    expect(GUIDE_READ.has('play-guide-r1')).toBe(false);
  });

  it('play-fault is a life the game cannot go on with: the orders kept for its round cannot be read back, so the round cannot be judged, and the game opens on its fault', async () => {
    const store = await sceneStore('play-fault');
    // The life itself is sound: the engineer at the finances of the first round.
    expect(await opened(store)).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'finance', fault: false });
    const services = sceneServices(store, 'play-fault');
    const told = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const game = createGameStore({ sessions: services.sessions, content, ...(services.basket ? { basket: services.basket } : {}) });
      await game.getState().boot();
      expect(game.getState()).toMatchObject({ status: 'playing', stage: 'finance', fault: true });
      expect(told.mock.calls.map((call) => call[0])).toEqual(['the round could not be previewed:']);
    } finally {
      told.mockRestore();
    }
    // No other scene is given a basket of its own.
    for (const { name } of SCENES.filter((scene) => scene.name !== 'play-fault')) expect(sceneServices(store, name).basket, name).toBeUndefined();
  });

  it('play-pageturn is the news of the engineer\'s second round, with the page of the calendar turning from the first age to the second, held at one moment of its run', async () => {
    const state = await opened(await sceneStore('play-pageturn'));
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news' });
    expect(roundOf(state)).toBe(2);
    expect(turnOf({ name: 'play-pageturn', locale: 'en' })).toEqual({ from: 22, to: 24 });
    for (const scene of SCENES.filter((one) => one.name !== 'play-pageturn')) expect(turnOf(scene), scene.name).toBeUndefined();
    // The middle of a step of the torn page's run (its steps are 70 ms from 270) and well inside one of the new page's (100 ms each).
    expect(PAGE_TURN_HELD_MS).toBe(445);
  });
});

describe('the scenes of the HUD', () => {
  it('hud-news-r1, hud-cash, hud-race and hud-status-ru are the news of the engineer\'s first round, play-news-r1\'s very store, each with what it opens', async () => {
    const first = await saveOf(await sceneStore('play-news-r1'));
    for (const name of ['hud-news-r1', 'hud-cash', 'hud-race', 'hud-status-ru']) expect(await saveOf(await sceneStore(name)), name).toEqual(first);
    const sheets = Object.fromEntries(SCENES.filter((scene) => scene.name.startsWith('hud-')).map((scene) => [scene.name, scene.sheet]));
    expect(sheets).toEqual({ 'hud-news-r1': undefined, 'hud-cash': 'cash', 'hud-flow': 'flow', 'hud-race': 'ratRace', 'hud-status-ru': 'status', 'hud-jailed': 'jail', 'hud-crisis': undefined, 'hud-crisis-details': 'crisis' });
  });

  it('hud-status-ru and play-cards-ru-360 are drawn in Russian, on a phone 360 wide: every other scene on the shots\' own 402', () => {
    const ru = SCENES.find((scene) => scene.name === 'hud-status-ru');
    expect(ru).toMatchObject({ locale: 'ru', width: 360 });
    expect(SCENES.filter((scene) => scene.width !== undefined).map((scene) => scene.name)).toEqual(['play-cards-ru-360', 'hud-status-ru']);
  });

  it('hud-flow is the finances of the sixth round (the compact HUD), play-finance-r6\'s very store', async () => {
    expect(await saveOf(await sceneStore('hud-flow'))).toEqual(await saveOf(await sceneStore('play-finance-r6')));
  });

  it('hud-jailed is a life in prison: the nurse of screen-seed-15, wrongly accused in her eighth round, who went to court and lost, at the finances of that round', async () => {
    const store = await sceneStore('hud-jailed');
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', lifeId: 'nurse', stage: 'finance' });
    expect(roundOf(state)).toBe(8);
    // In for the rest of the round: a sentence of one round is served at its end.
    expect(state.view?.player.life.jailRounds).toBe(1);
    const save = (await saveOf(store)) as SavedGame;
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-15' });
    // The accusation was the third card of the round, answered with its first option (to court); every other card as the saver answers it.
    expect(state.view?.hand[2]).toBe('crime_wrongly_accused');
    expect(save.log[7].picks[2]).toBe(0);
  });

  it('hud-crisis is a life whose world has a crisis, at its second year, at the finances (where the strip of the crisis hangs under the HUD)', async () => {
    const store = await sceneStore('hud-crisis');
    const save = (await saveOf(store)) as SavedGame;
    // The first of the fixed seeds whose world has a crisis early in a life (the tenth); the life is still the first the device begins, with its id.
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-10', lifeId: 'engineer' });
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', stage: 'finance' });
    expect(roundOf(state)).toBe(6);
    expect(state.view?.timeline[state.view.round].crisis).toEqual({ id: 'crash', year: 2, of: 3 });
  });

  it('hud-crisis-details is the same life, with the whole of the crisis open from its strip', async () => {
    expect(await saveOf(await sceneStore('hud-crisis-details'))).toEqual(await saveOf(await sceneStore('hud-crisis')));
  });

  it('hud-race and hud-crisis are drawn with motion left out, as a player can set it: a shot catches no loop half way (the wheel, the lamp of a crisis)', async () => {
    for (const name of ['hud-race', 'hud-crisis', 'hud-crisis-details']) expect((await (await sceneStore(name)).loadProfile()).settings.reducedMotion, name).toBe(true);
    for (const name of ['hud-news-r1', 'hud-cash', 'play-guide-r1']) expect(await (await sceneStore(name)).loadProfile(), name).toEqual(newProfile());
    expect((await (await sceneStore('play-news-r1')).loadProfile()).settings).toEqual(newProfile().settings);
  });
});

describe('the scenes of an amount and of a badge', () => {
  it('amount-savings is the finances of the engineer\'s sixth round (play-finance-r6\'s very store), with the sheet that moves cash to savings open', async () => {
    expect(await saveOf(await sceneStore('amount-savings'))).toEqual(await saveOf(await sceneStore('play-finance-r6')));
    expect(SCENES.find((scene) => scene.name === 'amount-savings')).toEqual({ name: 'amount-savings', locale: 'en', sheet: 'save' });
    const state = await opened(await sceneStore('amount-savings'));
    // There is cash to move: the sheet has an amount to choose.
    expect(state.view?.player.cash).toBeGreaterThan(0);
  });

  it('celebrate-legendary is a legendary badge earned in a real life: the engineer of screen-seed-74 meets MrFeast, the first card of the second round, and takes his challenge', async () => {
    const store = await sceneStore('celebrate-legendary');
    const save = (await saveOf(store)) as SavedGame;
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-74', lifeId: 'engineer' });
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', stage: 'news' });
    expect(roundOf(state)).toBe(2);
    expect(state.view?.hand[0]).toBe('celeb_mrfeast');
    // Nothing legendary is earned before it.
    expect((await store.loadProfile()).badges.celeb_mrfeast).toBeUndefined();
    // The game opened on it, the paper read and the card answered (to play along): the badge of meeting him is the step's to show, legendary.
    const game = createGameStore({ sessions: fixedSessions(store), content });
    await game.getState().boot();
    await runScene('celebrate-legendary', game);
    expect(game.getState().stage).toBe('outcome');
    expect(game.getState().earned).toContain('celeb_mrfeast');
    expect(rarityOf('celeb_mrfeast')).toBe('legendary');
    expect(game.getState().earned.filter((id) => rarityOf(id) === 'legendary')).toEqual(['celeb_mrfeast']);
    // He paid out (the three in a hundred): the first hundred thousand comes with it, a common badge beside the legendary one.
    expect(game.getState().earned).toEqual(['first_100k', 'celeb_mrfeast']);
    // Drawn with motion left out, as a player can set it: the medal stands where its turn ends, and no spark is caught in flight.
    expect((await (await sceneStore('celebrate-legendary')).loadProfile()).settings.reducedMotion).toBe(true);
  });

  it('celebrate-earned is the same step, its legendary sheet taken in: the very store, still', async () => {
    expect(await saveOf(await sceneStore('celebrate-earned'))).toEqual(await saveOf(await sceneStore('celebrate-legendary')));
    expect(await (await sceneStore('celebrate-earned')).loadProfile()).toEqual(await (await sceneStore('celebrate-legendary')).loadProfile());
    expect(SCENES.find((scene) => scene.name === 'celebrate-earned')).toEqual({ name: 'celebrate-earned', locale: 'en' });
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
      'play-cards-legendary',
      'play-cards-three',
      'play-cards-ru-360',
      'play-finance-r6',
      'play-outcome-r1',
      'play-resolve-r6',
      'play-news-r6',
      'play-guide-r1',
      'play-fault',
      'play-pageturn',
      'hud-news-r1',
      'hud-cash',
      'hud-flow',
      'hud-race',
      'hud-status-ru',
      'hud-jailed',
      'hud-crisis',
      'hud-crisis-details',
      'amount-savings',
      'celebrate-legendary',
      'celebrate-earned',
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
    expect(new Set(SCENES.map(screenOf))).toEqual(new Set(['home', 'new', 'play', 'hud', 'amount', 'celebrate', 'challenge', 'legal']));
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
