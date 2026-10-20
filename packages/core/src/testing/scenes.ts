import { bots, content } from '@ratrace/content';
import type { Bot, Locale } from '@ratrace/content';
import type { GameView } from '@ratrace/engine';
import { createGameStore } from '../game/store';
import type { GameStore, Stage } from '../game/store';
import { fixedSessions, memoryDevice } from '../session/fixed';
import type { MemoryStore } from '../session/fixed';
import type { PlayerStore, Sessions } from '../session/types';

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
  { name: 'play-news-r1', locale: 'en' },
  { name: 'play-cards-r1', locale: 'en' },
  { name: 'play-finance-r6', locale: 'en' },
];

/**
 * How far a scene's life is played. `round` is the player's: the first round is 1, as the HUD counts it. A life at
 * `news` is at the news of its round, with nothing answered. `cards` is a hand left half answered, which is what a
 * saved life can show of the cards: the card on screen is the second, and the first is answered (a game opens on its
 * next card, and the result of the last one is gone with the page). `finance` has the round's cards all answered
 * and the round not played.
 */
interface Reach {
  life: string;
  round: number;
  stage: Extract<Stage, 'news' | 'cards' | 'finance'>;
}

/** What each scene's store holds: the life to begin and how far to play it, or null for a device with no life. */
const PLANS: Readonly<Record<string, Reach | null>> = {
  'home-new': null,
  'home-continue': { life: 'nurse', round: 3, stage: 'news' },
  'play-news-r1': { life: 'engineer', round: 1, stage: 'news' },
  'play-cards-r1': { life: 'engineer', round: 1, stage: 'cards' },
  'play-finance-r6': { life: 'engineer', round: 6, stage: 'finance' },
};

/** The bot that plays every scene's life up to the scene: it studies, works, pays the card and saves, and never gambles. */
const PLAYER_ID = 'saver';

function mustBe(name: string, game: GameStore, stage: Stage): void {
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
  return store;
}

/**
 * What a client gives its game to draw a scene on: the scene's store behind sessions of their own (with the ids, seeds
 * and clock the screens' tests use, so a life begun on the scene is the same on either client), and no tap ever too
 * soon. Nothing but memory: no database of the device, no cloud.
 */
export function sceneServices(store: MemoryStore): { sessions: Sessions; store: PlayerStore; tapGuardMs: number } {
  return { sessions: fixedSessions(store), store, tapGuardMs: 0 };
}
