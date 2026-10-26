import { badges, content, lives, rarityOf, weekOf } from '@ratrace/content';
import { previewCard, quoteBusinesses, quoteItem, stateHash } from '@ratrace/engine';
import { momentsOf } from '../game/moments';
import { cardRarity } from '../game/present';
import { describe, expect, it, vi } from 'vitest';
import { createGameStore } from '../game/store';
import { fixedSessions, memoryDevice } from '../session/fixed';
import type { MemoryStore } from '../session/fixed';
import { replay } from '../session/save';
import { newProfile, SAVE_FORMAT } from '../session/types';
import type { SavedGame } from '../session/types';
import { GUIDE_READ, livesLived, withUnlocked, PAGE_TURN_HELD_MS, runScene, SCENE_NOW, sceneCloud, SCENES, sceneServices, sceneStore, screenOf, SHINE_HELD_MS, turnOf } from './scenes';
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

  it('play-cards-r1 is the second card of the engineer\'s first round, the betting app: three choices, pressed, never swiped', async () => {
    const r1 = await waiting('play-cards-r1');
    expect(r1).toMatchObject({ cardId: 'luck_betting_app', shown: 3, hidden: 0 });
    expect(r1.state).toMatchObject({ stage: 'cards', busy: false, picked: null });
  });

  it('play-cards-legendary is a legendary card with two choices, to be swiped: the appointment, the second card of the engineer\'s third round on screen-seed-335', async () => {
    const legendary = await waiting('play-cards-legendary');
    expect(legendary).toMatchObject({ cardId: 'red_appointment', shown: 2 });
    expect(cardRarity(legendary.def)).toBe('legendary');
    expect(roundOf(legendary.state)).toBe(3);
    // The first life of the device, on its own seed, played by the saver: the first two rounds whole, then one card of the third.
    expect(await saveOf(await sceneStore('play-cards-legendary'))).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-335', lifeId: 'engineer' });
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

  it('play-cards-city is the relocation to London, the second card of the engineer\'s fourth round on screen-seed-13, the city\'s sheet open beside it', async () => {
    expect(SCENES.find((scene) => scene.name === 'play-cards-city')).toEqual({ name: 'play-cards-city', locale: 'en', sheet: 'city' });
    const city = await waiting('play-cards-city');
    expect(city).toMatchObject({ cardId: 'career_relocation', shown: 2 });
    expect(roundOf(city.state)).toBe(4);
    expect(await saveOf(await sceneStore('play-cards-city'))).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-13', lifeId: 'engineer' });
    // The choice that moves her names the city a client opens the sheet of; she lives elsewhere.
    expect(city.def.options.map((option) => option.effects?.moveCity).filter(Boolean)).toEqual(['london']);
    expect(city.state.view?.player.cityId).not.toBe('london');
    expect(GUIDE_READ.has('play-cards-city')).toBe(true);
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
    expect(SCENES.filter((scene) => scene.sheet !== undefined).map((scene) => scene.name)).toEqual(['home-settings', 'new-replace', 'finance-basket', 'finance-pension', 'finance-buy-stock', 'hud-cash', 'hud-flow', 'hud-race', 'hud-status-ru', 'hud-jailed', 'hud-crisis-details', 'amount-savings', 'finance-move', 'play-cards-city', 'finance-item', 'profile-owned', 'balance-r6', 'end-share', 'records-detail', 'profile-financed', 'settings-account-guest', 'settings-account-member', 'home-offer']);
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

  it('hud-status-ru, play-cards-ru-360 and finance-tabs-ru-360 are drawn in Russian, on a phone 360 wide: every other scene on the shots\' own 402', () => {
    const ru = SCENES.find((scene) => scene.name === 'hud-status-ru');
    expect(ru).toMatchObject({ locale: 'ru', width: 360 });
    expect(SCENES.filter((scene) => scene.width !== undefined).map((scene) => scene.name)).toEqual(['play-cards-ru-360', 'finance-tabs-ru-360', 'hud-status-ru']);
  });

  it('hud-flow is the finances of the sixth round (the compact HUD), play-finance-r6\'s very store', async () => {
    expect(await saveOf(await sceneStore('hud-flow'))).toEqual(await saveOf(await sceneStore('play-finance-r6')));
  });

  it('hud-jailed is a life in prison: the nurse of screen-seed-160, wrongly accused in her eighth round, who went to court and lost, at the finances of that round', async () => {
    const store = await sceneStore('hud-jailed');
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', lifeId: 'nurse', stage: 'finance' });
    expect(roundOf(state)).toBe(8);
    // In for the rest of the round: a sentence of one round is served at its end.
    expect(state.view?.player.life.jailRounds).toBe(1);
    const save = (await saveOf(store)) as SavedGame;
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-160' });
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

  it('celebrate-legendary is a legendary badge earned in a real life: the engineer of screen-seed-271 meets MrFeast, the first card of the second round, and takes his challenge', async () => {
    const store = await sceneStore('celebrate-legendary');
    const save = (await saveOf(store)) as SavedGame;
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-271', lifeId: 'engineer' });
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

describe('the scenes of the finances', () => {
  it('play-finance-r6, finance-basket, finance-pension and finance-tabs-ru-360 are the finances of the engineer\'s sixth round: the very store', async () => {
    const first = await saveOf(await sceneStore('play-finance-r6'));
    for (const name of ['finance-basket', 'finance-pension', 'finance-tabs-ru-360']) expect(await saveOf(await sceneStore(name)), name).toEqual(first);
  });

  it('finance-basket has the saver\'s orders of the round in the basket, put there once the game is open, and its sheet open', async () => {
    expect(SCENES.find((scene) => scene.name === 'finance-basket')).toEqual({ name: 'finance-basket', locale: 'en', sheet: 'basket' });
    const game = createGameStore({ sessions: fixedSessions(await sceneStore('finance-basket')), content });
    await game.getState().boot();
    expect(game.getState().orders).toEqual([]);
    await runScene('finance-basket', game);
    const state = game.getState();
    expect(state).toMatchObject({ stage: 'finance', refusal: null });
    expect(roundOf(state)).toBe(6);
    // The focus of the round (two things done with it) and the cash moved to savings: more than one line, and the cash they leave.
    expect(state.orders.map((order) => order.type)).toEqual(['focus', 'focus', 'depositIn']);
    expect(state.preview?.player.cash).toBeLessThan(state.view?.player.cash ?? 0);
  });

  it('finance-pension has the pension plan\'s sheet open, with room in it this round', async () => {
    expect(SCENES.find((scene) => scene.name === 'finance-pension')).toEqual({ name: 'finance-pension', locale: 'en', sheet: 'pension' });
    const state = await opened(await sceneStore('finance-pension'));
    expect(state.preview?.pensionRoom).toBeGreaterThan(0);
  });

  it('finance-tabs-ru-360 is the row of the tabs in Russian on a phone 360 wide, every tab of a life five rounds in', async () => {
    expect(SCENES.find((scene) => scene.name === 'finance-tabs-ru-360')).toEqual({ name: 'finance-tabs-ru-360', locale: 'ru', width: 360 });
    expect(roundOf(await opened(await sceneStore('finance-tabs-ru-360')))).toBe(6);
  });

  it('finance-market, finance-buy-stock, finance-property, finance-lifestyle, finance-move, finance-shop, finance-item and finance-taxes are play-finance-r6\'s very store, each on the tab it names (finance-buy-stock with Apple\'s sheet open, finance-move with every city\'s, finance-item with a watch\'s); work-panel too', async () => {
    const first = await saveOf(await sceneStore('play-finance-r6'));
    for (const name of ['finance-market', 'finance-buy-stock', 'finance-property', 'finance-lifestyle', 'finance-move', 'work-panel', 'finance-shop', 'finance-item', 'finance-taxes']) expect(await saveOf(await sceneStore(name)), name).toEqual(first);
    const finances = Object.fromEntries(SCENES.filter((scene) => scene.name.startsWith('finance-')).map((scene) => [scene.name, [scene.tab, scene.sheet]]));
    expect(finances).toEqual({
      'finance-basket': [undefined, 'basket'],
      'finance-pension': [undefined, 'pension'],
      'finance-tabs-ru-360': [undefined, undefined],
      'finance-market': ['market', undefined],
      'finance-buy-stock': ['market', 'buy-apple'],
      'finance-property': ['property', undefined],
      'finance-debt': ['debt', undefined],
      'finance-lifestyle': ['lifestyle', undefined],
      'finance-move': ['lifestyle', 'move'],
      'finance-shop': ['shop', undefined],
      'finance-item': ['shop', 'item-watch_omega'],
      'finance-taxes': ['taxes', undefined],
      'finance-business': ['business', undefined],
    });
    // Only a scene of the finances names a tab of them.
    expect(SCENES.filter((scene) => scene.tab !== undefined).map((scene) => scene.name)).toEqual(['finance-market', 'finance-buy-stock', 'finance-property', 'finance-debt', 'finance-lifestyle', 'finance-move', 'finance-shop', 'finance-item', 'finance-taxes', 'finance-business']);
    // Apple is on the engineer's market: a share, open with the Finance the engineer has by then.
    const state = await opened(await sceneStore('finance-buy-stock'));
    expect(content.assets.find((asset) => asset.id === 'apple')?.minFinanceSkill ?? 0).toBeLessThanOrEqual(state.view?.player.life.financeSkill ?? -1);
  });

  it('finance-debt is the engineer\'s first round at the debt tab: the student loan the life begins with, and a personal loan on offer', async () => {
    expect(SCENES.find((scene) => scene.name === 'finance-debt')).toEqual({ name: 'finance-debt', locale: 'en', tab: 'debt' });
    const state = await opened(await sceneStore('finance-debt'));
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'finance' });
    expect(roundOf(state)).toBe(1);
    expect(state.view?.player.debts.map((debt) => debt.kind)).toEqual(['personalLoan']);
  });

  it('finance-item\'s watch is in the engineer\'s reach, every way the shop has of buying it open: new, on instalments, second hand and without an invoice', async () => {
    const state = await opened(await sceneStore('finance-item'));
    const view = state.view;
    if (!view) throw new Error('finance-item is a life in progress');
    const quote = quoteItem(content, view, 'watch_omega');
    expect(quote).toMatchObject({ soldHere: true, forSale: true });
    expect(quote.price).toBeLessThanOrEqual(view.player.cash);
    expect(quote.finance?.lock).toBeNull();
    expect(quote.used?.lock).toBeNull();
    expect(quote.noInvoice?.lock).toBeNull();
    expect(view.player.life.items).toEqual([]);
  });

  it('finance-business is the founder\'s first round: a life the scene\'s player has unlocked, with the shop she begins with, and kinds to open', async () => {
    expect(SCENES.find((scene) => scene.name === 'finance-business')).toEqual({ name: 'finance-business', locale: 'en', tab: 'business' });
    const store = await sceneStore('finance-business');
    expect(Object.keys((await store.loadProfile()).unlocked)).toEqual(['founder']);
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', lifeId: 'founder', stage: 'finance' });
    expect(roundOf(state)).toBe(1);
    expect(state.view?.player.businesses.map((business) => business.typeId)).toEqual(['shop']);
    if (!state.view) throw new Error('finance-business is a life in progress');
    expect(quoteBusinesses(content, state.view).kinds.filter((kind) => kind.lock === null).length).toBeGreaterThan(0);
  });

  it('are drawn for a player who has read the guide: the finances themselves, under the Hud (play-finance-r6 keeps the first tip over the tabs)', () => {
    for (const name of ['finance-basket', 'finance-pension', 'finance-tabs-ru-360', 'finance-market', 'finance-buy-stock', 'finance-property', 'finance-debt', 'finance-lifestyle', 'finance-move', 'finance-shop', 'finance-item', 'finance-taxes', 'finance-business']) expect(GUIDE_READ.has(name), name).toBe(true);
    expect(GUIDE_READ.has('play-finance-r6')).toBe(false);
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
      'finance-basket',
      'finance-pension',
      'finance-tabs-ru-360',
      'finance-market',
      'finance-buy-stock',
      'finance-property',
      'finance-debt',
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
      'celebrate-milestone',
      'celebrate-milestone-banner',
      'challenge-practice',
      'legal',
      'finance-lifestyle',
      'finance-move',
      'play-cards-city',
      'work-panel',
      'finance-shop',
      'finance-item',
      'finance-taxes',
      'finance-business',
      'profile-r6',
      'profile-owned',
      'balance-r6',
      'rivals-r6',
      'end-escaped',
      'end-bankrupt',
      'end-share',
      'end-ru',
      'moment-escape',
      'moment-bankrupt',
      'moment-crisis',
      'records-empty',
      'records-three',
      'records-detail',
      'collection-items',
      'collection-badges',
      'profile-financed',
      'settings-account-guest',
      'settings-account-member',
      'home-offer',
      'home-account-taken',
      'rankings-all',
      'rankings-week',
      'rankings-friends',
      'rankings-challenge',
      'rankings-nickname',
      'player-member',
      'player-editor-body',
      'player-editor-wear',
      'player-editor-scene',
      'player-friend-code',
      'home-member',
      'challenge-attempt',
      'challenge-played',
      'end-standing',
      'new-ranked',
      'room-door',
      'room-lobby-friends',
      'room-lobby-public',
      'room-join-code',
      'room-playing',
      'room-loans',
      'room-resolved',
      'room-end',
      'room-history',
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
    expect(new Set(SCENES.map(screenOf))).toEqual(new Set(['home', 'new', 'play', 'finance', 'hud', 'amount', 'celebrate', 'challenge', 'legal', 'work', 'profile', 'balance', 'rivals', 'end', 'moment', 'records', 'collection', 'settings', 'rankings', 'player', 'room']));
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

describe('the scenes of the profile', () => {
  /** A scene's game, opened on its store and taken through its script, as a client does. */
  async function opened(name: string) {
    const game = createGameStore({ sessions: fixedSessions(await sceneStore(name)), content });
    await game.getState().boot();
    await runScene(name, game);
    return game.getState();
  }

  it('profile-r6, balance-r6 and rivals-r6 are the news of the engineer\'s sixth round: the very store of play-news-r6', async () => {
    const news = await saveOf(await sceneStore('play-news-r6'));
    for (const name of ['profile-r6', 'balance-r6', 'rivals-r6']) expect(await saveOf(await sceneStore(name)), name).toEqual(news);
    const state = await opened('balance-r6');
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news' });
    expect(roundOf(state)).toBe(6);
    // Five rounds played: the start and five bars for the graph of the net worth.
    expect(state.history).toHaveLength(6);
  });

  it('name the sheet their screen opens: none for the profile, the net worth\'s line for the balance, the watch for the things owned', () => {
    expect(SCENES.find((scene) => scene.name === 'profile-r6')).toEqual({ name: 'profile-r6', locale: 'en' });
    expect(SCENES.find((scene) => scene.name === 'balance-r6')).toEqual({ name: 'balance-r6', locale: 'en', sheet: 'netWorth' });
    expect(SCENES.find((scene) => scene.name === 'profile-owned')).toEqual({ name: 'profile-owned', locale: 'en', sheet: 'watch_casio' });
    expect(SCENES.find((scene) => scene.name === 'rivals-r6')).toEqual({ name: 'rivals-r6', locale: 'en' });
  });

  it('profile-owned is the news of the sixth round with three things bought in the fifth, the watch among them', async () => {
    // Begun on the fifth round's finances, the very store of a scene there would be, and taken on by its script.
    const state = await opened('profile-owned');
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news', refusal: null, orders: [] });
    expect(roundOf(state)).toBe(6);
    expect(state.view?.player.life.items.map((owned) => owned.itemId)).toEqual(['watch_casio', 'member_gym', 'tech_phone']);
    // Each the same every time.
    expect(onScreenOf(await opened('profile-owned'))).toBe(onScreenOf(state));
  });

  it('profile-financed is the same news with a car bought on instalments in the fifth round: owned, and a loan still owed on it', async () => {
    expect(SCENES.find((scene) => scene.name === 'profile-financed')).toEqual({ name: 'profile-financed', locale: 'en', sheet: 'car_seat_ibiza' });
    const state = await opened('profile-financed');
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news', refusal: null, orders: [] });
    expect(roundOf(state)).toBe(6);
    expect(state.view?.player.life.items.map((owned) => owned.itemId)).toEqual(['car_seat_ibiza']);
    // What the car's sheet shows on its wine note: a loan for what the share down did not pay.
    const car = quoteItem(content, state.view!, 'car_seat_ibiza');
    expect(car.owed).toBeGreaterThan(0);
    expect(car.paid).not.toBeNull();
    expect(onScreenOf(await opened('profile-financed'))).toBe(onScreenOf(state));
  });
});

/** What a scene's game shows, as a string to compare: the stage, the round and the player. */
const onScreenOf = (state: { stage: string; view: { round: number; player: unknown } | null }) => JSON.stringify([state.stage, state.view?.round, state.view?.player]);

describe('the scenes of the end of a life', () => {
  it('end-escaped is the engineer of screen-seed-335, played by the saver to the end: out of the rat race with the fifteenth round, never bankrupt, and the game opens on its end', async () => {
    const store = await sceneStore('end-escaped');
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'end', bankruptcies: 0 });
    expect(state.view).toMatchObject({ finished: true, round: content.rounds });
    expect(state.view?.player.escapedAtRound).toBe(14);
    expect(await saveOf(store)).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-335', lifeId: 'engineer' });
    // The start and every round: the graph of a whole life.
    expect(state.history).toHaveLength(content.rounds + 1);
    // The life is among the finished ones already, with what it earned: its badges, its rank, the lives it opened.
    const [run] = await store.listRuns();
    expect(run).toMatchObject({ runId: 'id-1', lifeId: 'engineer' });
    const profile = await store.loadProfile();
    expect(profile.rank.lives['id-1']).toBeGreaterThan(0);
    expect(Object.values(profile.unlocked).some((one) => one.gameId === 'id-1')).toBe(true);
    expect(state.badges).toContain('escaped');
  });

  it('end-bankrupt is the nurse of screen-seed-5, played by the chaser to the end: bankrupt with her fourth round, and never out of the rat race', async () => {
    const store = await sceneStore('end-bankrupt');
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', lifeId: 'nurse', stage: 'end', bankruptcies: 3 });
    expect(state.view).toMatchObject({ finished: true });
    expect(state.view?.player.escapedAtRound).toBeNull();
    expect(state.story.find((m) => m.kind === 'bankrupt')?.round).toBe(4);
    expect(await saveOf(store)).toMatchObject({ seed: 'screen-seed-5', lifeId: 'nurse' });
  });

  it('end-share and end-ru are end-escaped\'s very store: the picture to share open over it, and the same end in Russian', async () => {
    const escaped = await saveOf(await sceneStore('end-escaped'));
    for (const name of ['end-share', 'end-ru']) expect(await saveOf(await sceneStore(name)), name).toEqual(escaped);
    expect(SCENES.filter((scene) => scene.name.startsWith('end-'))).toEqual([
      { name: 'end-escaped', locale: 'en' },
      { name: 'end-bankrupt', locale: 'en' },
      { name: 'end-share', locale: 'en', sheet: 'share' },
      { name: 'end-ru', locale: 'ru' },
      { name: 'end-standing', locale: 'en' },
    ]);
    expect(screenOf({ name: 'end-share', locale: 'en' })).toBe('end');
    // And the same end for a member, where its score stands among others' (`sceneCommunity`).
    expect(await saveOf(await sceneStore('end-standing'))).toEqual(escaped);
  });

  it('are drawn with motion left out: the score stands counted, the story risen, the portrait at the end of its line, a rare badge\'s confetti still', async () => {
    for (const name of ['end-escaped', 'end-bankrupt', 'end-share', 'end-ru', 'end-standing']) expect((await (await sceneStore(name)).loadProfile()).settings.reducedMotion, name).toBe(true);
  });
});

describe('the moments of a life: real lives, played to the round a moment stops them in', () => {
  /** A game opened on a scene's store, and the scene's script run on it, as a client does once its game has opened. */
  async function played(name: string) {
    const game = createGameStore({ sessions: fixedSessions(await sceneStore(name)), content });
    await game.getState().boot();
    await runScene(name, game);
    return game.getState();
  }

  it('moment-escape is the ledger of the round the engineer of screen-seed-335 (end-escaped\'s) leaves the rat race in, the fifteenth, played by the saver', async () => {
    const save = (await saveOf(await sceneStore('moment-escape'))) as SavedGame;
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-335', lifeId: 'engineer' });
    const state = await played('moment-escape');
    expect(state).toMatchObject({ status: 'playing', stage: 'resolve', busy: false });
    expect(state.resolved?.before.round).toBe(14);
    expect(state.resolved?.events.some((event) => event.kind === 'escaped')).toBe(true);
    // Out for the first time this round: no round before it left the rat race.
    expect(state.resolved?.before.player.escapedAtRound).toBeNull();
    expect(momentsOf(state)[0]).toMatchObject({ kind: 'escape' });
  });

  it('moment-bankrupt is the ledger of the round the nurse of screen-seed-5 goes bankrupt in, her fourth, played by the chaser, who lives beyond her pay', async () => {
    const save = (await saveOf(await sceneStore('moment-bankrupt'))) as SavedGame;
    expect(save).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-5', lifeId: 'nurse' });
    const state = await played('moment-bankrupt');
    expect(state).toMatchObject({ status: 'playing', stage: 'resolve', busy: false });
    expect(state.resolved?.before.round).toBe(3);
    const broke = state.resolved?.events.find((event) => event.kind === 'bankrupt');
    expect(broke).toBeDefined();
    expect(momentsOf(state)[0]).toMatchObject({ kind: 'bankrupt' });
    // Saved at the finances of that round, with its cards answered as the chaser answers them.
    const saved = await opened(await sceneStore('moment-bankrupt'));
    expect(saved).toMatchObject({ stage: 'finance' });
    expect(roundOf(saved)).toBe(4);
  });

  it('moment-crisis is the news of the round a crisis opens with: the crash of screen-seed-10 (hud-crisis\'s world), in the engineer\'s fifth round, its first year', async () => {
    const store = await sceneStore('moment-crisis');
    expect(await saveOf(store)).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-10', lifeId: 'engineer' });
    const state = await opened(store);
    expect(state).toMatchObject({ status: 'playing', stage: 'news' });
    expect(roundOf(state)).toBe(5);
    expect(state.view?.timeline[state.view.round].crisis).toEqual({ id: 'crash', year: 1, of: 3 });
    expect(momentsOf(state)).toEqual([{ key: '4:crisis', kind: 'crisis', crisisId: 'crash', rounds: 3 }]);
  });

  it('come to the same ledger every time, on any store of the scene', async () => {
    for (const name of ['moment-escape', 'moment-bankrupt']) expect(onScreen(await played(name)), name).toBe(onScreen(await played(name)));
  });

  it('are drawn with motion left out, with the ledger they stand over: its wheel turns for ever, its lines rise and its figures count, and a crisis\'s lamp pulses', async () => {
    for (const name of ['play-resolve-r6', 'moment-escape', 'moment-bankrupt', 'moment-crisis']) expect((await (await sceneStore(name)).loadProfile()).settings.reducedMotion, name).toBe(true);
    // The ledger's save is the finances' all the same: only the profile says to move less.
    expect(await saveOf(await sceneStore('play-resolve-r6'))).toEqual(await saveOf(await sceneStore('play-finance-r6')));
  });
});

describe('the records and the collection: three real lives, each played to its end by a bot', () => {
  const DAY = 86_400_000;

  it('records-empty is a device on which no life has been finished: nothing in progress, nothing earned', async () => {
    const store = await sceneStore('records-empty');
    expect(await store.listRuns()).toEqual([]);
    expect(await saveOf(store)).toBeNull();
    expect(await store.loadProfile()).toEqual(newProfile());
  });

  it('records-three is a device that has lived three lives to the end, a day apart, the latest the day before the scene\'s: a nurse gone bankrupt, a civil servant, an engineer who left the rat race', async () => {
    const store = await sceneStore('records-three');
    const runs = await store.listRuns();
    // The latest first, as the device lists them; each a run of its own, on a day of the scene's week, none of them a life left in progress.
    expect(runs.map((run) => [run.runId, run.lifeId, run.seed])).toEqual([
      ['id-3', 'engineer', 'screen-seed-335'],
      ['id-2', 'civil_servant', 'screen-seed-3'],
      ['id-1', 'nurse', 'screen-seed-5'],
    ]);
    expect(runs.map((run) => new Date(run.finishedAt).toISOString().slice(0, 10))).toEqual(['2026-10-21', '2026-10-20', '2026-10-19']);
    for (const [i, run] of runs.entries()) expect(run.finishedAt - (SCENE_NOW - (i + 1) * DAY), run.runId).toBeLessThan(1_000);
    expect(await saveOf(store)).toBeNull();
    // Played whole, never written by hand: each run's log, played again from its seed, is the life it says it was.
    for (const run of runs) {
      const life = lives.find((one) => one.id === run.lifeId)!;
      const again = replay(content, life.start, run.seed, run.log);
      expect(again.state.finished, run.runId).toBe(true);
      expect(again.history, run.runId).toEqual(run.history);
      expect(again.bankruptcies, run.runId).toBe(run.bankruptcies);
    }
    // Each holds a best: the engineer the best score and the youngest escape, the civil servant (the landlord) the greatest net worth, the nurse (the chaser) the most status.
    const [engineer, servant, nurse] = runs;
    expect(engineer).toMatchObject({ escapedAtRound: 14, bankruptcies: 0 });
    expect(nurse.bankruptcies).toBeGreaterThan(0);
    expect(engineer.score).toBe(Math.max(...runs.map((run) => run.score)));
    expect(servant.netWorth).toBe(Math.max(...runs.map((run) => run.netWorth)));
    expect(nurse.status).toBe(Math.max(...runs.map((run) => run.status)));
    // What they earned and owned is the player's: the badges of all three, and the things the nurse bought.
    const profile = await store.loadProfile();
    for (const run of runs) for (const badge of run.badges) expect(Object.hasOwn(profile.badges, badge), badge).toBe(true);
    expect(profile.gallery.length).toBeGreaterThan(10);
    expect(profile.gallery.length).toBeLessThan(content.items.length);
    expect(Object.keys(profile.badges).length).toBeLessThan(badges.length);
  });

  it('records-detail is the same device, with the sheet of the latest life open: the scene names it by its id, the first line of the list', async () => {
    const scene = SCENES.find((one) => one.name === 'records-detail')!;
    const store = await sceneStore('records-detail');
    const [latest] = await store.listRuns();
    expect(scene.sheet).toBe(latest.runId);
    expect(await store.listRuns()).toEqual(await (await sceneStore('records-three')).listRuns());
  });

  it('collection-items and collection-badges are the same device: what three lives owned and earned, the things\' tab and the badges\'', async () => {
    const three = await sceneStore('records-three');
    for (const name of ['collection-items', 'collection-badges']) {
      const store = await sceneStore(name);
      expect(await store.loadProfile(), name).toEqual(await three.loadProfile());
      expect(await store.listRuns(), name).toEqual(await three.listRuns());
      expect(await saveOf(store), name).toBeNull();
    }
  });

  it('plays the three lives the same every time: played twice, apart from the copy every scene of them is given, they leave the same runs and profile', async () => {
    const [first, second] = [await livesLived('records-three'), await livesLived('records-three')];
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(second?.runs.map((run) => run.runId)).toEqual(['id-3', 'id-2', 'id-1']);
    // And a scene's device holds exactly that, its own copy: what one scene's store is given, no other's shares.
    const [a, b] = [await sceneStore('records-three'), await sceneStore('collection-badges')];
    expect(await a.listRuns()).toEqual(first?.runs);
    expect(await a.loadProfile()).toEqual(first?.profile);
    await a.removeRun('id-3');
    expect((await b.listRuns()).map((run) => run.runId)).toEqual(['id-3', 'id-2', 'id-1']);
    expect(await livesLived('records-empty')).toBeNull();
  });

  it('keeps what the lives unlocked when a scene unlocks more: the scene\'s lives are added to the profile, never written over it', async () => {
    const lived = (await livesLived('records-three'))!;
    const earned = Object.keys(lived.profile.unlocked);
    expect(earned.length).toBeGreaterThan(0);
    const both = withUnlocked(lived.profile, ['heir', earned[0]]);
    // Everything else the lives left is as it was; the life they unlocked keeps when and where it was earned.
    expect({ ...both, unlocked: lived.profile.unlocked }).toEqual(lived.profile);
    expect(both.unlocked[earned[0]]).toEqual(lived.profile.unlocked[earned[0]]);
    expect(Object.keys(both.unlocked).sort()).toEqual([...new Set([...earned, 'heir'])].sort());
    // On a new player's profile it is the unlocks alone, as new-unlocked has them.
    expect(withUnlocked(newProfile(), ['rider', 'heir'])).toEqual({ ...newProfile(), unlocked: { rider: { at: 1_000, gameId: 'earned-1' }, heir: { at: 1_001, gameId: 'earned-2' } } });
  });

  it('opens on no life in progress, as the game does once a life\'s last screen is left', async () => {
    expect(await opened(await sceneStore('records-three'))).toMatchObject({ status: 'none', view: null });
  });
});

describe('the scenes of the account', () => {
  it('are the life of home-continue under an account that is who each says, and stays so: a picture, with nothing of a network', async () => {
    for (const name of ['settings-account-guest', 'settings-account-member', 'home-offer', 'home-account-taken']) {
      expect(await saveOf(await sceneStore(name)), name).toEqual(await saveOf(await sceneStore('home-continue')));
      const { account, saves } = sceneCloud(name);
      expect(account, name).toBeDefined();
      // The same answer each time it is asked (a screen reads it as an external store), and never a change to hear of.
      expect(account!.state(), name).toBe(account!.state());
      expect(saves!.status(), name).toBe('saved');
      await expect(account!.keepWithGoogle(), name).resolves.toBe(false);
      await expect(account!.signOut(), name).resolves.toBe(false);
      await expect(saves!.takeOffer(), name).resolves.toBe(false);
    }
    expect(sceneCloud('settings-account-guest').account!.state()).toEqual({ kind: 'guest', userId: 'scene-player', notice: null });
    expect(sceneCloud('settings-account-member').account!.state()).toEqual({ kind: 'member', userId: 'scene-player', email: 'ana.garcia@example.com' });
    expect(sceneCloud('home-account-taken').account!.state()).toEqual({ kind: 'guest', userId: 'scene-player', notice: 'joining' });
    expect(sceneCloud('home-offer').saves!.offer()).toEqual({ gameId: 'scene-elsewhere', lifeId: 'engineer', round: 4, cityId: 'madrid' });
    expect(sceneCloud('settings-account-member').saves!.offer()).toBeNull();
    // The two of the settings open the front door's settings; the offer's question is open; the word of being taken in blinks, and is held still.
    expect(SCENES.filter((scene) => scene.name.startsWith('settings-')).map((scene) => scene.sheet)).toEqual(['settings', 'settings']);
    expect(SCENES.find((scene) => scene.name === 'home-offer')?.sheet).toBe('offer');
    expect((await (await sceneStore('home-account-taken')).loadProfile()).settings.reducedMotion).toBe(true);
  });

  it('gives the scenes of the game online a member, with nothing waiting in the account, and home-member home-continue\'s life', async () => {
    for (const name of ['home-member', 'challenge-attempt', 'challenge-played', 'end-standing', 'new-ranked']) {
      expect(sceneCloud(name).account!.state(), name).toEqual({ kind: 'member', userId: 'scene-player', email: 'ana.garcia@example.com' });
      expect(sceneCloud(name).saves!.offer(), name).toBeNull();
    }
    expect(await saveOf(await sceneStore('home-member'))).toEqual(await saveOf(await sceneStore('home-continue')));
  });

  it('gives every other scene no cloud: nobody signed in, as before', async () => {
    const online = ['settings-account-guest', 'settings-account-member', 'home-offer', 'home-account-taken', 'home-member', 'challenge-attempt', 'challenge-played', 'end-standing', 'new-ranked'];
    for (const { name } of SCENES.filter((scene) => !online.includes(scene.name))) {
      expect(sceneCloud(name), name).toEqual({});
    }
    const services = sceneServices(await sceneStore('home-offer'), 'home-offer');
    expect(services.account?.state().kind).toBe('member');
    expect(services.saves?.offer()?.lifeId).toBe('engineer');
    expect(sceneServices(await sceneStore('home-continue'), 'home-continue').account).toBeUndefined();
  });
});
