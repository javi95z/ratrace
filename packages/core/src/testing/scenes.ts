import { bots, content } from '@ratrace/content';
import type { Bot, Locale } from '@ratrace/content';
import type { GameView } from '@ratrace/engine';
import { createGameStore } from '../game/store';
import type { GameStore, RoundActions, RoundState, Stage } from '../game/store';
import { fixedSessions, memoryDevice } from '../session/fixed';
import type { MemoryStore } from '../session/fixed';
import { newProfile, SAVE_FORMAT } from '../session/types';
import type { PlayerStore, SavedGame, Sessions } from '../session/types';

/**
 * Scenes: named game states, built the same way for every client, so the web and the phone can each be shot at the
 * same state and the two pictures compared (the parity check of the phone's app, as the kit page is for its pieces).
 *
 * A scene is a store, not a screen: the game is begun on it, played to a round and a stage, and each client opens it
 * as it opens the one on its device. What a client draws of it is its own registry's business (the web's page at
 * `/kit/scene`, the app's route `/scene`).
 */
export interface Scene {
  /** `<screen>-<state>`: the screen is drawn, the state is told by the rest (`play-finance-r6`: the finances of the sixth round). */
  readonly name: string;
  readonly locale: Locale;
  /**
   * A sheet shown open over the screen. A client draws it with the screen's own sheet component given its open state,
   * never by a tap: the shots are taken from a link, which cannot tap.
   */
  readonly sheet?: string;
}

/** Every scene the shots take, in the order they are listed. Each screen's task adds its own. */
export const SCENES: readonly Scene[] = [
  { name: 'home-new', locale: 'en' },
  { name: 'home-continue', locale: 'en' },
  { name: 'home-settings', locale: 'en', sheet: 'settings' },
  { name: 'home-lost-newer', locale: 'en' },
  { name: 'new-first', locale: 'en' },
  { name: 'new-unlocked', locale: 'en' },
  { name: 'new-locked', locale: 'en' },
  { name: 'new-replace', locale: 'en', sheet: 'replace' },
  { name: 'play-news-r1', locale: 'en' },
  { name: 'play-cards-r1', locale: 'en' },
  { name: 'play-finance-r6', locale: 'en' },
  { name: 'play-outcome-r1', locale: 'en' },
  { name: 'play-resolve-r6', locale: 'en' },
  { name: 'challenge-practice', locale: 'en' },
  { name: 'legal', locale: 'en' },
];

/** The screen a scene is drawn on: the first word of its name (`play-finance-r6` is drawn on `play`; a scene of a page with only one state is that word: `legal`). Each client has a registry of them. */
export const screenOf = (scene: Scene): string => scene.name.split('-')[0];

/**
 * The day every scene is drawn on, in milliseconds: Thursday 22 October 2026, noon UTC, three and a half days from either edge of its
 * week. Whatever a screen reads of the date (the week's challenge, the days left of it) is then the same in every shot,
 * whenever it is taken and wherever the shooting machine is. The web's shot sets the browser's clock to it; the app's
 * services answer it as their clock (`Services.now`).
 */
export const SCENE_NOW = Date.UTC(2026, 9, 22, 12, 0, 0);

/** One thing done to the round on screen once the game is open: what the player does, by the round store's own name for it. */
export type Step =
  | { action: 'leaveNews' }
  /** The card on screen is answered with this option, or the saver's choice. */
  | { action: 'pick'; option?: number }
  | { action: 'afterCard' }
  /** The saver's orders for the round are put in the basket, one after another. */
  | { action: 'orders' }
  | { action: 'play' }
  | { action: 'next' };

/**
 * How far a scene's life is played. `round` is the player's: the first round is 1, as the HUD counts it. A life at
 * `news` is at the news of its round, with nothing answered. `cards` is a hand left half answered, which is what a
 * saved life can show of the cards: the card on screen is the second, and the first is answered (a game opens on its
 * next card, and the result of the last one is gone with the page). `finance` has the round's cards all answered
 * and the round not played.
 *
 * A save cannot show the result of a card or the ledger of a round: those are only on screen until the player goes on.
 * A scene of those has `then`, the steps the player takes once the game is open on the save (`runScene`, run by every
 * client on its own game), and `ends`, the stage they come to.
 */
type Reach = {
  life: string;
  round: number;
  stage: Extract<Stage, 'news' | 'cards' | 'finance'>;
  /** The life is then saved as a newer version of the game would have saved it, which this one cannot open (and keeps). */
  newer?: true;
} & ({ then?: undefined; ends?: undefined } | { then: readonly Step[]; ends: Stage });

/** What each scene's store holds: the life to begin and how far to play it, or null for a device with no life. */
const PLANS: Readonly<Record<string, Reach | null>> = {
  'home-new': null,
  'home-continue': { life: 'nurse', round: 3, stage: 'news' },
  'home-settings': { life: 'nurse', round: 3, stage: 'news' },
  'home-lost-newer': { life: 'nurse', round: 1, stage: 'news', newer: true },
  'new-first': null,
  'new-unlocked': null,
  'new-locked': null,
  'new-replace': { life: 'nurse', round: 3, stage: 'news' },
  'play-news-r1': { life: 'engineer', round: 1, stage: 'news' },
  'play-cards-r1': { life: 'engineer', round: 1, stage: 'cards' },
  'play-finance-r6': { life: 'engineer', round: 6, stage: 'finance' },
  'play-outcome-r1': { life: 'engineer', round: 1, stage: 'news', then: [{ action: 'leaveNews' }, { action: 'pick' }], ends: 'outcome' },
  'play-resolve-r6': { life: 'engineer', round: 6, stage: 'finance', then: [{ action: 'orders' }, { action: 'play' }], ends: 'resolve' },
  'challenge-practice': null,
  legal: null,
};

/**
 * The lives a scene's player has unlocked, by the scene's name (a profile, not a life: a scene with none is a new player's).
 * The page where a life is chosen draws the open lives from it.
 */
const UNLOCKED: Readonly<Record<string, readonly string[]>> = {
  'new-unlocked': ['rider', 'heir'],
};

/** The bot that plays every scene's life up to the scene: it studies, works, pays the card and saves, and never gambles. */
const PLAYER_ID = 'saver';

function mustBe(name: string, game: SceneGame, stage: Stage): void {
  const at = game.getState().stage;
  if (at !== stage) throw new Error(`scene ${name}: expected the ${stage}, found the ${at}`);
}

/** Answers the card on screen with the bot's choice, which the bot makes from the view alone, as any player would. */
async function answerNext(name: string, game: GameStore, bot: Bot): Promise<void> {
  mustBe(name, game, 'cards');
  await game.getState().pick(bot.pick(content, game.getState().view as GameView));
  mustBe(name, game, 'outcome');
}

/** Reads the news, answers every card of the round, and comes to its finances. */
async function toFinances(name: string, game: GameStore, bot: Bot): Promise<void> {
  game.getState().leaveNews();
  while (game.getState().stage === 'cards') {
    await answerNext(name, game, bot);
    game.getState().afterCard();
  }
  mustBe(name, game, 'finance');
}

/**
 * The store of a scene: a life begun on the first fixed seed and played with the saver, through the round store the
 * game plays through, to the round and stage the scene names. A scene with no life is an empty device.
 */
export async function sceneStore(name: string): Promise<MemoryStore> {
  if (!Object.hasOwn(PLANS, name)) throw new Error(`unknown scene: ${name}`);
  const store = memoryDevice();
  await unlock(store, name);
  const reach = PLANS[name];
  if (reach === null) return store;
  const bot = bots.find((candidate) => candidate.id === PLAYER_ID) as Bot;
  const game = createGameStore({ sessions: fixedSessions(store), content });
  await game.getState().start(reach.life);
  // The rounds before the scene's, played whole: the cards answered, the saver's orders put in the basket, the round played.
  for (let round = 1; round < reach.round; round++) {
    await toFinances(name, game, bot);
    for (const order of bot.orders(content, game.getState().view as GameView)) game.getState().addOrder(order);
    await game.getState().play();
    mustBe(name, game, 'resolve');
    game.getState().next();
    mustBe(name, game, 'news');
  }
  if (reach.stage === 'finance') await toFinances(name, game, bot);
  else if (reach.stage === 'cards') {
    // One card answered, the others waiting: the game on the device then opens on the next.
    game.getState().leaveNews();
    await answerNext(name, game, bot);
    if (game.getState().view?.phase !== 'cards') throw new Error(`scene ${name}: the hand had no second card`);
  }
  if (reach.newer) await asNewer(store);
  return store;
}

/** The lives a scene's player has unlocked, written to the profile as the game writes them: when, and in which life. */
async function unlock(store: MemoryStore, name: string): Promise<void> {
  const ids = UNLOCKED[name];
  if (ids === undefined) return;
  const unlocked = Object.fromEntries(ids.map((id, i) => [id, { at: 1_000 + i, gameId: `earned-${i + 1}` }]));
  await store.saveProfile({ ...newProfile(), unlocked });
}

/** The life on a device, saved again as a newer version of the game would save it: in a format this one does not know how to read. */
async function asNewer(store: MemoryStore): Promise<void> {
  const saved = (await store.loadGame()) as SavedGame;
  await store.saveGame({ ...saved, format: SAVE_FORMAT + 1 } as unknown as SavedGame);
}

/** The round store of a game, as a scene's script needs it: its state as it is now, each time asked. */
export type SceneGame = { getState(): RoundState & RoundActions };

/** Takes one step, as the player would, with the saver's choices where the step has none. */
async function take(name: string, game: SceneGame, bot: Bot, step: Step): Promise<void> {
  const state = game.getState();
  if (state.view === null) throw new Error(`scene ${name}: no life is open`);
  switch (step.action) {
    case 'leaveNews':
      return state.leaveNews();
    case 'pick':
      return await state.pick(step.option ?? bot.pick(content, state.view));
    case 'afterCard':
      return state.afterCard();
    case 'orders':
      for (const order of bot.orders(content, state.view)) game.getState().addOrder(order);
      return;
    case 'play':
      return await state.play();
    case 'next':
      return state.next();
  }
}

/**
 * Takes the steps a scene goes on with once the game is open on its store, on the game of the client that draws it:
 * the same steps, with the same choices, on every client. Nothing for a scene that is only a save. The stage they
 * come to is checked, so a script that did not land where the scene says (the game was not at the scene's start) is
 * told, with the scene's name.
 */
export async function runScene(name: string, game: SceneGame): Promise<void> {
  if (!Object.hasOwn(PLANS, name)) throw new Error(`unknown scene: ${name}`);
  const reach = PLANS[name];
  if (reach === null || reach.then === undefined) return;
  const bot = bots.find((candidate) => candidate.id === PLAYER_ID) as Bot;
  try {
    for (const step of reach.then) await take(name, game, bot, step);
  } catch (error) {
    // The game refused a step (the engine's own words): whose script it was is what the one who reads it needs.
    if (error instanceof Error && error.message.startsWith(`scene ${name}:`)) throw error;
    throw new Error(`scene ${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  mustBe(name, game, reach.ends);
}

/**
 * What a client gives its game to draw a scene on: the scene's store behind sessions of their own (with the ids, seeds
 * and clock the screens' tests use, so a life begun on the scene is the same on either client), and no tap ever too
 * soon. Nothing but memory: no database of the device, no cloud.
 */
export function sceneServices(store: MemoryStore): { sessions: Sessions; store: PlayerStore; tapGuardMs: number } {
  return { sessions: fixedSessions(store), store, tapGuardMs: 0 };
}
