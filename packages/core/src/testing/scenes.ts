import { bots, content } from '@ratrace/content';
import type { Bot, Locale } from '@ratrace/content';
import type { GameView } from '@ratrace/engine';
import type { BasketKeep } from '../game/basket';
import { FIRSTS, TIPS } from '../game/guide';
import { ageAt } from '../game/present';
import { createGameStore } from '../game/store';
import type { GameStore, RoundActions, RoundState, Stage } from '../game/store';
import { fixedSessions, fixedSessionsOn, fixedSessionsWith, memoryDevice } from '../session/fixed';
import type { MemoryStore } from '../session/fixed';
import { newProfile, SAVE_FORMAT } from '../session/types';
import type { FinishedRun, PlayerStore, Profile, SavedGame, Sessions } from '../session/types';

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
  /**
   * The tab of the finances on screen, by its id, where it is not the first (the portfolio): `market`, `property`, `debt`, `lifestyle`, `shop`, `taxes`, `business`. A client opens it as it
   * opens a sheet: given to the screen as its initial state, or pressed by the page once the screen is drawn, before the sheet.
   */
  readonly tab?: string;
  /**
   * The width of the phone the scene is drawn for, where it is not the shots' 402 (a Russian player on a phone 360 wide). The simulator's
   * width cannot be changed, so both clients draw the screen in a box this wide, centred on the shots' screen: the same on either side.
   */
  readonly width?: number;
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
  { name: 'play-cards-legendary', locale: 'en' },
  { name: 'play-cards-three', locale: 'en' },
  { name: 'play-cards-ru-360', locale: 'ru', width: 360 },
  { name: 'play-finance-r6', locale: 'en' },
  { name: 'play-outcome-r1', locale: 'en' },
  { name: 'play-resolve-r6', locale: 'en' },
  { name: 'play-news-r6', locale: 'en' },
  { name: 'play-guide-r1', locale: 'en' },
  { name: 'play-fault', locale: 'en' },
  { name: 'play-pageturn', locale: 'en' },
  { name: 'finance-basket', locale: 'en', sheet: 'basket' },
  { name: 'finance-pension', locale: 'en', sheet: 'pension' },
  { name: 'finance-tabs-ru-360', locale: 'ru', width: 360 },
  { name: 'finance-market', locale: 'en', tab: 'market' },
  { name: 'finance-buy-stock', locale: 'en', tab: 'market', sheet: 'buy-apple' },
  { name: 'finance-property', locale: 'en', tab: 'property' },
  { name: 'finance-debt', locale: 'en', tab: 'debt' },
  { name: 'hud-news-r1', locale: 'en' },
  { name: 'hud-cash', locale: 'en', sheet: 'cash' },
  { name: 'hud-flow', locale: 'en', sheet: 'flow' },
  { name: 'hud-race', locale: 'en', sheet: 'ratRace' },
  { name: 'hud-status-ru', locale: 'ru', sheet: 'status', width: 360 },
  { name: 'hud-jailed', locale: 'en', sheet: 'jail' },
  { name: 'hud-crisis', locale: 'en' },
  { name: 'hud-crisis-details', locale: 'en', sheet: 'crisis' },
  { name: 'amount-savings', locale: 'en', sheet: 'save' },
  { name: 'celebrate-legendary', locale: 'en' },
  { name: 'celebrate-earned', locale: 'en' },
  { name: 'challenge-practice', locale: 'en' },
  { name: 'legal', locale: 'en' },
  { name: 'finance-lifestyle', locale: 'en', tab: 'lifestyle' },
  { name: 'finance-move', locale: 'en', tab: 'lifestyle', sheet: 'move' },
  { name: 'play-cards-city', locale: 'en', sheet: 'city' },
  { name: 'work-panel', locale: 'en' },
  { name: 'finance-shop', locale: 'en', tab: 'shop' },
  { name: 'finance-item', locale: 'en', tab: 'shop', sheet: 'item-watch_omega' },
  { name: 'finance-taxes', locale: 'en', tab: 'taxes' },
  { name: 'finance-business', locale: 'en', tab: 'business' },
  { name: 'profile-r6', locale: 'en' },
  { name: 'profile-owned', locale: 'en', sheet: 'watch_casio' },
  { name: 'balance-r6', locale: 'en', sheet: 'netWorth' },
  { name: 'rivals-r6', locale: 'en' },
  { name: 'end-escaped', locale: 'en' },
  { name: 'end-bankrupt', locale: 'en' },
  { name: 'end-share', locale: 'en', sheet: 'share' },
  { name: 'end-ru', locale: 'ru' },
  { name: 'moment-escape', locale: 'en' },
  { name: 'moment-bankrupt', locale: 'en' },
  { name: 'moment-crisis', locale: 'en' },
  { name: 'records-empty', locale: 'en' },
  { name: 'records-three', locale: 'en' },
  { name: 'records-detail', locale: 'en', sheet: 'id-3' },
  { name: 'collection-items', locale: 'en' },
  { name: 'collection-badges', locale: 'en' },
  { name: 'profile-financed', locale: 'en', sheet: 'car_seat_ibiza' },
  // The rankings of a player signed in, told by the same other players on both clients (`sceneCommunity`): of all time, of the week, among friends
  // (the friends' panel under it), the week's challenge, and the player's name being changed (the web's form in its panel, opened from it).
  { name: 'rankings-all', locale: 'en' },
  { name: 'rankings-week', locale: 'en' },
  { name: 'rankings-friends', locale: 'en' },
  { name: 'rankings-challenge', locale: 'en' },
  { name: 'rankings-nickname', locale: 'en', sheet: 'nickname' },
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
  /** The card on screen is answered with this option, or the choice of the scene's player (the saver, unless it names another). */
  | { action: 'pick'; option?: number }
  | { action: 'afterCard' }
  /** The orders of the scene's player for the round are put in the basket, one after another. */
  | { action: 'orders' }
  | { action: 'play' }
  | { action: 'next' }
  /** These things are bought, an order each, put in the basket one after another (the saver buys none); `financed`, each on instalments. */
  | { action: 'buy'; items: readonly string[]; financed?: boolean };

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
  /** `end`: the life played on from `round` to its last, and over: the game opens on its end. */
  stage: Extract<Stage, 'news' | 'cards' | 'finance' | 'end'>;
  /** The life is then saved as a newer version of the game would have saved it, which this one cannot open (and keeps). */
  newer?: true;
  /** The seed the life is begun on, where the first fixed one's world lacks what the scene needs (`screen-seed-10` has a crisis from the fifth round). */
  seed?: string;
  /**
   * The option taken on a card, by its id, where the scene needs another answer than the saver's (the saver answers every other card as it
   * would): on `screen-seed-15` the nurse is wrongly accused in her eighth round, goes to court and loses, and is in prison for the round.
   */
  picks?: Readonly<Record<string, number>>;
  /**
   * The bot that plays the life, by its id, where it is not the saver (who never goes broke): the chaser lives as grandly as the money lasts, and
   * on `screen-seed-4` the nurse it plays goes bankrupt in her fourth round. It plays every round and every step of the scene.
   */
  player?: string;
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
  // The second card of the engineer's third round is the appointment: a legendary card with two choices, to be swiped.
  'play-cards-legendary': { life: 'engineer', round: 3, stage: 'cards' },
  // On screen-seed-3 the second card of the first round is asking for a raise: three choices the engineer can take, and a fourth, which needs
  // negotiation, not shown.
  'play-cards-three': { life: 'engineer', round: 1, stage: 'cards', seed: 'screen-seed-3' },
  // On screen-seed-10 the second round opens with the AI boom: three choices with long names in Russian, the third there thanks to the engineer's trade.
  'play-cards-ru-360': { life: 'engineer', round: 2, stage: 'news', seed: 'screen-seed-10', then: [{ action: 'leaveNews' }], ends: 'cards' },
  'play-finance-r6': { life: 'engineer', round: 6, stage: 'finance' },
  'play-outcome-r1': { life: 'engineer', round: 1, stage: 'news', then: [{ action: 'leaveNews' }, { action: 'pick' }], ends: 'outcome' },
  'play-resolve-r6': { life: 'engineer', round: 6, stage: 'finance', then: [{ action: 'orders' }, { action: 'play' }], ends: 'resolve' },
  'play-news-r6': { life: 'engineer', round: 6, stage: 'news' },
  'play-guide-r1': { life: 'engineer', round: 1, stage: 'news' },
  'play-fault': { life: 'engineer', round: 1, stage: 'finance' },
  'play-pageturn': { life: 'engineer', round: 2, stage: 'news' },
  // The finances of play-finance-r6's sixth round: the saver's orders in the basket (a focus, the cash to savings), its sheet open.
  'finance-basket': { life: 'engineer', round: 6, stage: 'finance', then: [{ action: 'orders' }], ends: 'finance' },
  // The same, the pension plan's sheet open: nothing in it yet, and room for this round.
  'finance-pension': { life: 'engineer', round: 6, stage: 'finance' },
  // The same, in Russian on a phone 360 wide: the row of the tabs, every tab of a life five rounds in, wider than the phone.
  'finance-tabs-ru-360': { life: 'engineer', round: 6, stage: 'finance' },
  // The same, at the market: what the engineer's Finance opens, by kind, and what each did this round.
  'finance-market': { life: 'engineer', round: 6, stage: 'finance' },
  // The same, the sheet that buys a share open (Apple): once or every round, what it is, and its price since the start of the life.
  'finance-buy-stock': { life: 'engineer', round: 6, stage: 'finance' },
  // The same, at the property tab: nothing owned yet, the homes of London and what is only for letting there.
  'finance-property': { life: 'engineer', round: 6, stage: 'finance' },
  // The engineer's first round, at the debt tab: the loan the life begins with, its way to be repaid, and a personal loan on offer.
  'finance-debt': { life: 'engineer', round: 1, stage: 'finance' },
  'hud-news-r1': { life: 'engineer', round: 1, stage: 'news' },
  'hud-cash': { life: 'engineer', round: 1, stage: 'news' },
  'hud-flow': { life: 'engineer', round: 6, stage: 'finance' },
  'hud-race': { life: 'engineer', round: 1, stage: 'news' },
  'hud-status-ru': { life: 'engineer', round: 1, stage: 'news' },
  'hud-jailed': { life: 'nurse', round: 8, stage: 'finance', seed: 'screen-seed-15', picks: { crime_wrongly_accused: 0 } },
  'hud-crisis': { life: 'engineer', round: 6, stage: 'finance', seed: 'screen-seed-10' },
  'hud-crisis-details': { life: 'engineer', round: 6, stage: 'finance', seed: 'screen-seed-10' },
  'amount-savings': { life: 'engineer', round: 6, stage: 'finance' },
  // On screen-seed-74 the engineer's second round opens with MrFeast's challenge (a legendary card, once a life): taken, the badge of meeting him is legendary.
  'celebrate-legendary': { life: 'engineer', round: 2, stage: 'news', seed: 'screen-seed-74', then: [{ action: 'leaveNews' }, { action: 'pick', option: 1 }], ends: 'outcome' },
  // The same step, its legendary sheet taken in: the small cards of what it earned, in the result of the card.
  'celebrate-earned': { life: 'engineer', round: 2, stage: 'news', seed: 'screen-seed-74', then: [{ action: 'leaveNews' }, { action: 'pick', option: 1 }], ends: 'outcome' },
  'challenge-practice': null,
  legal: null,
  // The finances of play-finance-r6's sixth round, at the way of life: how the engineer works, the round's focus, how and where she lives, her
  // cover and her city.
  'finance-lifestyle': { life: 'engineer', round: 6, stage: 'finance' },
  // The same, the sheet of every city open: each city's year beside hers, the one she lives in at the top.
  'finance-move': { life: 'engineer', round: 6, stage: 'finance' },
  // The engineer's fourth round, its second card the relocation to London (a rung up, the move paid): the city beside hers, opened from the card.
  'play-cards-city': { life: 'engineer', round: 4, stage: 'cards' },
  // The work panel of the profile, for the engineer of play-finance-r6: her job and the next rung, the round's focus, her skills.
  'work-panel': { life: 'engineer', round: 6, stage: 'finance' },
  // The finances of play-finance-r6's sixth round, at the shop: what is in reach of the engineer's cash in London, shelf by shelf.
  'finance-shop': { life: 'engineer', round: 6, stage: 'finance' },
  // The same, the sheet of a watch open (the Omega Speedmaster): its status, what it would resell for, and every way to buy it: new, on instalments,
  // second hand and without an invoice.
  'finance-item': { life: 'engineer', round: 6, stage: 'finance' },
  // The same, at the taxes: the round's tax, what is not declared and what it risks, the cash after the round and the escape test.
  'finance-taxes': { life: 'engineer', round: 6, stage: 'finance' },
  // The founder's first round, at the businesses: the online shop she begins with (its line and its two switches, all of them summed) and what she could open.
  'finance-business': { life: 'founder', round: 1, stage: 'finance' },
  // The player's profile in the engineer's sixth round, at its news: the sheet the portrait opens, over Play.
  'profile-r6': { life: 'engineer', round: 6, stage: 'news' },
  // The same round, with three things bought in the fifth (a watch, the gym, a phone): the profile, and the watch's own sheet over it.
  'profile-owned': { life: 'engineer', round: 5, stage: 'finance', then: [{ action: 'buy', items: ['watch_casio', 'member_gym', 'tech_phone'] }, { action: 'play' }, { action: 'next' }], ends: 'news' },
  // The same round as profile-r6: the line of the balance sheet that is the net worth, opened, with its graph of the five rounds played.
  'balance-r6': { life: 'engineer', round: 6, stage: 'news' },
  // The same round: where the engineer stands among the rivals, the board alone on a page (in the profile it is far down its sheet).
  'rivals-r6': { life: 'engineer', round: 6, stage: 'news' },
  // The engineer of the first fixed seed, played by the saver to the end of the life: out of the rat race with the fifteenth round, never bankrupt.
  'end-escaped': { life: 'engineer', round: 1, stage: 'end' },
  // The nurse of screen-seed-4, played by the chaser to the end of the life: bankrupt with her fourth round, never out of the rat race.
  'end-bankrupt': { life: 'nurse', round: 1, stage: 'end', seed: 'screen-seed-4', player: 'chaser' },
  // end-escaped's life, the picture of it to share open over its end (the share card's sheet).
  'end-share': { life: 'engineer', round: 1, stage: 'end' },
  // end-escaped's life in Russian.
  'end-ru': { life: 'engineer', round: 1, stage: 'end' },
  // The engineer of the first fixed seed, played by the saver, leaves the rat race with the fifteenth round: its ledger, and the moment over it.
  'moment-escape': { life: 'engineer', round: 15, stage: 'finance', then: [{ action: 'orders' }, { action: 'play' }], ends: 'resolve' },
  // The nurse of screen-seed-4, played by the chaser, who lives as grandly as the money lasts: bankrupt with her fourth round.
  'moment-bankrupt': { life: 'nurse', round: 4, stage: 'finance', seed: 'screen-seed-4', player: 'chaser', then: [{ action: 'orders' }, { action: 'play' }], ends: 'resolve' },
  // The engineer of screen-seed-10 (hud-crisis's world): the crash opens with the fifth round, at its news.
  'moment-crisis': { life: 'engineer', round: 5, stage: 'news', seed: 'screen-seed-10' },
  // A device on which no life has been finished yet.
  'records-empty': null,
  // The device of a player who has lived three lives to the end (`LIVED`), and has none in progress: the records, the sheet of the latest life
  // (named by its id, `sheet`), and the collection of what the three earned and owned, its things and its badges.
  'records-three': null,
  'records-detail': null,
  'collection-items': null,
  'collection-badges': null,
  // profile-owned's round, with a car bought on instalments in the fifth (a share down, a loan for the rest): the profile, and the car's own sheet
  // over it, with what is still owed on it (ItemCost's wine note, its words and figure on one baseline).
  'profile-financed': { life: 'engineer', round: 5, stage: 'finance', then: [{ action: 'buy', items: ['car_seat_ibiza'], financed: true }, { action: 'play' }, { action: 'next' }], ends: 'news' },
  // The rankings ask the cloud, not the device: a device with no life, its other players those of the scene (`sceneCommunity`).
  'rankings-all': null,
  'rankings-week': null,
  'rankings-friends': null,
  'rankings-challenge': null,
  'rankings-nickname': null,
};

/**
 * The lives a scene's player has unlocked, by the scene's name (a profile, not a life: a scene with none is a new player's).
 * The page where a life is chosen draws the open lives from it.
 */
const UNLOCKED: Readonly<Record<string, readonly string[]>> = {
  'new-unlocked': ['rider', 'heir'],
  // The founder is a life to unlock: the player of the scene has.
  'finance-business': ['founder'],
};

/** A life lived to its end before a scene: the life, the seed it is begun on, and the bot that plays it. */
type Lived = { life: string; seed: string; player: string };

/**
 * Three lives, each of the lives to begin with, played to their ends one after another, each holding a best: the nurse of screen-seed-4 played by
 * the chaser (moment-bankrupt's), who buys the grandest things the money allows and goes bankrupt in her fourth round, the most status; the civil
 * servant of screen-seed-3 played by the landlord, who buys homes to let, the greatest net worth; the engineer of the first fixed seed played by the
 * saver (moment-escape's), out of the rat race at fifty, the best score.
 */
const THREE_LIVES: readonly Lived[] = [
  { life: 'nurse', seed: 'screen-seed-4', player: 'chaser' },
  { life: 'civil_servant', seed: 'screen-seed-3', player: 'landlord' },
  { life: 'engineer', seed: 'screen-seed-1', player: 'saver' },
];

/** The lives a scene's player has lived to the end before it, by the scene's name, in the order they were lived. */
const LIVED: Readonly<Record<string, readonly Lived[]>> = {
  'records-three': THREE_LIVES,
  'records-detail': THREE_LIVES,
  'collection-items': THREE_LIVES,
  'collection-badges': THREE_LIVES,
};

const DAY = 86_400_000;

/** What the lives a scene's player lived before it leave on a device: its finished lives, the latest first, and the profile. */
export interface LivedDevice {
  runs: FinishedRun[];
  profile: Profile;
}

/**
 * Plays the lives a scene's player has finished before it (`LIVED`), every time it is asked, on a device of their own: one after another, each played
 * to its end by its bot through the round store, as a player would, and let go as the game lets a life go once its last screen is left. Each is
 * begun on its own seed, a day after the one before, the last the day before the scene's (`SCENE_NOW`): a page that tells the day a life ended
 * tells one of the scene's week, as the game would. Gives what they leave on the device (null for a scene with none). The scenes take it once
 * (`livedOnce`); a test plays it twice, to hold that it is the same every time.
 */
export async function livesLived(name: string): Promise<LivedDevice | null> {
  const lived = LIVED[name];
  if (lived === undefined) return null;
  const store = memoryDevice();
  let seed = '';
  let clock = 0;
  const game = createGameStore({ sessions: fixedSessionsWith(store, { newSeed: () => seed, now: () => (clock += 1) }), content });
  for (const [i, one] of lived.entries()) {
    seed = one.seed;
    clock = SCENE_NOW - (lived.length - i) * DAY;
    const bot = playerOf(one);
    await game.getState().start(one.life);
    for (let round = 0; !game.getState().view?.finished; round++) {
      if (round >= content.rounds) throw new Error(`scene ${name}: the ${one.life}'s life did not end`);
      await toFinances(name, game, bot);
      for (const order of bot.orders(content, game.getState().view as GameView)) game.getState().addOrder(order);
      await game.getState().play();
      mustBe(name, game, 'resolve');
      game.getState().next();
    }
    mustBe(name, game, 'end');
    await game.getState().closeFinished(game.getState().gameId as string);
  }
  return { runs: await store.listRuns(), profile: await store.loadProfile() };
}

/**
 * The lives of each list of `LIVED`, played once in a process: three whole lives take a while, and four scenes share them, each built many times
 * by the tests. What they leave is the same every time (`livesLived` is held to it), so a scene's device is given a copy of it.
 */
const livedOnce = new Map<readonly Lived[], Promise<LivedDevice | null>>();

/**
 * Puts on a scene's device the lives its player lived before it (`LIVED`), as `livesLived` leaves them: its finished lives and the profile. The
 * profile is the whole of the player's, so the device must hold nothing yet: anything a scene adds to it (the lives it unlocks, a setting) comes after.
 */
async function liveThrough(store: MemoryStore, name: string): Promise<void> {
  const lived = LIVED[name];
  if (lived === undefined) return;
  if ((await store.listRuns()).length > 0 || JSON.stringify(await store.loadProfile()) !== JSON.stringify(newProfile())) {
    throw new Error(`scene ${name}: its lives are put on a device that already holds something`);
  }
  let once = livedOnce.get(lived);
  if (once === undefined) {
    once = livesLived(name);
    livedOnce.set(lived, once);
    // A play that failed is not kept: the next scene that asks tells the failure again.
    once.catch(() => livedOnce.delete(lived));
  }
  const left = await once;
  if (left === null) return;
  for (const run of left.runs) await store.addRun(run);
  await store.saveProfile(left.profile);
}

/**
 * The scenes drawn with motion left out, as the player can set it (the setting is in the profile, where both clients read it): something on
 * them plays for ever (the rat's wheel, the lamp of a crisis's year), and a shot would catch it at any moment of its run; or plays for longer
 * than the web's shot waits (a legendary badge's medal turning in and its sparks, a second and more), which it would catch half way.
 */
const STILL: ReadonlySet<string> = new Set([
  'hud-race', 'hud-crisis', 'hud-crisis-details', 'celebrate-legendary', 'celebrate-earned',
  // The end of a life: its score counts up, its story rises a paragraph at a time, the portrait walks its line and lights each mark, and a rare badge's
  // confetti falls for ever. Left out, everything stands where it ends, as a shot can see it.
  'end-escaped', 'end-bankrupt', 'end-share', 'end-ru',
  // The ledger (play-resolve-r6) and the moments over it or over the news: the wheel of its title turns for ever, its lines rise one by one, its
  // figures count and its coins fly; a crisis's lamp pulses. Left out, the lines stand risen and the figures where they end, as a shot can see them.
  'play-resolve-r6', 'moment-escape', 'moment-bankrupt', 'moment-crisis',
]);

/**
 * The scenes of a player who has read every tip of the guide and every note of a first time: the stage is drawn as it is, with nothing of the
 * guide over it. (Turning the guide off would not do: a page of the game under development shows the tips all the same, so they can be seen.)
 * Every other scene is someone new, who is shown the tips as they come.
 */
export const GUIDE_READ: ReadonlySet<string> = new Set(['play-news-r1', 'play-news-r6', 'play-pageturn', 'play-cards-legendary', 'play-cards-three', 'play-cards-ru-360', 'finance-basket', 'finance-pension', 'finance-tabs-ru-360', 'finance-market', 'finance-buy-stock', 'finance-property', 'finance-debt',
  'finance-lifestyle',
  'finance-move',
  'play-cards-city',
  'finance-shop',
  'finance-item',
  'finance-taxes',
  'finance-business',
]);

/**
 * The scenes of a game that cannot go on (the play screen's way out, `Fault`): the orders kept for the round cannot be read back, so the
 * round cannot be judged and the game opens on its fault, as it does when the engine of a page will not preview a round. The life itself
 * is sound; what fails is the place the basket is kept, which each client gives its game for the scene (`sceneBasket`).
 */
export const FAULTS: ReadonlySet<string> = new Set(['play-fault']);

/** Where a scene's game keeps the orders of its round, where that is not the game's own memory: nowhere it can read them back from, for a fault. */
export function sceneBasket(name: string): BasketKeep | undefined {
  if (!FAULTS.has(name)) return undefined;
  return {
    load: () => {
      throw new Error(`scene ${name}: the basket cannot be read`);
    },
    save: () => undefined,
  };
}

/**
 * How far into its run the calendar of a turning round is held in a scene of it: the middle of a step of the torn page (its steps are 70 ms
 * each from 270 ms) and well inside one of the new page's (100 ms each), so no engine draws it a step off. The web's scene page holds its two
 * animations there (`HOLD_TURN`), the phone's scene gives it to the calendar (`held`).
 */
export const PAGE_TURN_HELD_MS = 445;

/**
 * How far into its run the shine of a rare card is held in a scene of the play screen, in milliseconds: the rainbow of a legendary card and the band of
 * light of any rare one where the kit's pages of motion hold them (the middle of a step of each, so no engine draws them a step off), and the sparks
 * of a legendary card at the end of their flight (gone: they are only movement). The web's scene page holds its stylesheet's animations there
 * (`HOLD_SHINE`), the phone's scene gives the card the same moments (`HeldShine`). Without it a shot would catch them anywhere in their runs.
 */
export const SHINE_HELD_MS = { holo: 2050, glint: 665, spark: 600 } as const;

/**
 * The calendar a scene draws over its screen, turning from the age of the round before to the age of the scene's own: a round has just been
 * played. Both clients draw it beside the screen, as the screen draws it when the round goes by under it. None for any other scene.
 */
export function turnOf(scene: Scene): { from: number; to: number } | undefined {
  if (scene.name !== 'play-pageturn') return undefined;
  const reach = PLANS[scene.name];
  if (!reach) return undefined;
  return { from: ageAt(content, reach.round - 2), to: ageAt(content, reach.round - 1) };
}

/** The bot that plays every scene's life up to the scene, unless the scene names another (`Reach.player`): it studies, works, pays the card and saves, and never gambles. */
const PLAYER_ID = 'saver';

/** The bot that plays a scene's life (a life lived before it too). */
const playerOf = (plan: { player?: string }): Bot => bots.find((candidate) => candidate.id === (plan.player ?? PLAYER_ID)) as Bot;

function mustBe(name: string, game: SceneGame, stage: Stage): void {
  const at = game.getState().stage;
  if (at !== stage) throw new Error(`scene ${name}: expected the ${stage}, found the ${at}`);
}

/** The saver, taking the scene's own option on the cards the scene names (`Reach.picks`), and its own choice on every other. */
function answering(bot: Bot, picks: Reach['picks']): Bot {
  if (picks === undefined) return bot;
  return { ...bot, pick: (rules, view) => picks[view.hand[view.answered]] ?? bot.pick(rules, view) };
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
  // The lives first, on the empty device (they leave a whole profile); then what the scene unlocks, added to it.
  await liveThrough(store, name);
  await unlock(store, name);
  if (STILL.has(name)) {
    const profile = await store.loadProfile();
    await store.saveProfile({ ...profile, settings: { ...profile.settings, reducedMotion: true } });
  }
  if (GUIDE_READ.has(name)) {
    const profile = await store.loadProfile();
    await store.saveProfile({ ...profile, guide: { seen: [...TIPS.map((tip) => tip.id), ...FIRSTS.map((first) => first.id)], off: false } });
  }
  const reach = PLANS[name];
  if (reach === null) return store;
  const bot = answering(playerOf(reach), reach.picks);
  const game = createGameStore({ sessions: reach.seed === undefined ? fixedSessions(store) : fixedSessionsOn(store, reach.seed), content });
  await game.getState().start(reach.life);
  // The rounds before the scene's, played whole: the cards answered, the player's orders put in the basket, the round played.
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
  if (reach.stage === 'end') await toTheEnd(name, game, bot);
  if (reach.newer) await asNewer(store);
  return store;
}

/** Plays every round left of the life, as the rounds before a scene's are played, until it is over: the game then opens on its end. */
async function toTheEnd(name: string, game: GameStore, bot: Bot): Promise<void> {
  for (let left = content.rounds; left > 0 && game.getState().stage !== 'end'; left--) {
    await toFinances(name, game, bot);
    for (const order of bot.orders(content, game.getState().view as GameView)) game.getState().addOrder(order);
    await game.getState().play();
    mustBe(name, game, 'resolve');
    game.getState().next();
  }
  mustBe(name, game, 'end');
}

/** The lives a scene's player has unlocked, written to the profile as the game writes them: when, and in which life. */
async function unlock(store: MemoryStore, name: string): Promise<void> {
  const ids = UNLOCKED[name];
  if (ids === undefined) return;
  await store.saveProfile(withUnlocked(await store.loadProfile(), ids));
}

/**
 * A profile with these lives unlocked as the game writes them (when, and in which life), added to what it holds: a scene's lives (`LIVED`) may
 * have unlocked some already, and what a real life earned is kept as it was.
 */
export function withUnlocked(profile: Profile, ids: readonly string[]): Profile {
  const made = Object.fromEntries(ids.map((id, i) => [id, { at: 1_000 + i, gameId: `earned-${i + 1}` }]));
  return { ...profile, unlocked: { ...made, ...profile.unlocked } };
}

/** The life on a device, saved again as a newer version of the game would save it: in a format this one does not know how to read. */
async function asNewer(store: MemoryStore): Promise<void> {
  const saved = (await store.loadGame()) as SavedGame;
  await store.saveGame({ ...saved, format: SAVE_FORMAT + 1 } as unknown as SavedGame);
}

/** The round store of a game, as a scene's script needs it: its state as it is now, each time asked. */
export type SceneGame = { getState(): RoundState & RoundActions };

/** Takes one step, as the player would, with the choices of the scene's player where the step has none. */
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
    case 'buy':
      for (const itemId of step.items) game.getState().addOrder({ type: 'buyItem', itemId, ...(step.financed === true ? { financed: true } : null) });
      return;
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
  const bot = playerOf(reach);
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
 * soon. Nothing but memory: no database of the device, no cloud. A scene that names where its orders are kept (`sceneBasket`) has that basket.
 */
export function sceneServices(store: MemoryStore, name?: string): { sessions: Sessions; store: PlayerStore; tapGuardMs: number; basket?: BasketKeep } {
  const basket = name === undefined ? undefined : sceneBasket(name);
  return { sessions: fixedSessions(store), store, tapGuardMs: 0, ...(basket ? { basket } : {}) };
}
