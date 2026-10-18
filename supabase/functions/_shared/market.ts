// "Your market moved": the notice that tells a player with a ranked life in progress that something
// they hold moved a lot in the round they last played. Which asset, and what is said of it, are
// worked out here, without a server, and tested.
//
// What it may say is held to what is already true and already shown to the player:
// - It reads the world as it stands at the player's round, `timeline[round]`: the return of each
//   asset over the round that just ended. That is what the game shows on opening, so the notice is
//   always true when it is read.
// - It never reads `timeline[round + 1]`. That is what the market does when the player plays on,
//   and in a ranked life, where the score is the ranking, to tell it would be to hand out the
//   future. Only the server can see it, and it must stay there.
// - It never changes a rule: the replay is the one the game itself plays, and nothing is written.
import { startOf } from './challenge.ts';
import { readLog } from './replay.ts';
import type { GameModule } from './game/types.ts';
import type { NoticeLocale } from './notice.ts';

/** How far an asset must have moved, in basis points, for it to be worth a notice: 5%. */
export const MIN_MOVE_BP = 500;

/** A life untouched for less than this is being played: it needs no telling. In hours. */
export const QUIET_HOURS = 20;
/** A life untouched for longer than this is left to the notice of lives left halfway. In days. */
export const LAST_DAYS = 6;

/** What the notice is about: the asset, as the player's language names it, and by how much it moved, in whole percent. */
export interface Mover {
  assetId: string;
  /** Signed, in whole percent: 12 for a rise of 12%, -9 for a fall of 9%. Never within 5 of zero. */
  percent: number;
}

/** The names of what can be held, as the game shows them: brands and coins keep their name, the funds and bonds are translated. */
const SAME: Readonly<Record<string, string>> = {
  sp500: 'S&P 500',
  msci_world: 'MSCI World',
  apple: 'Apple',
  microsoft: 'Microsoft',
  nvidia: 'Nvidia',
  amazon: 'Amazon',
  tesla: 'Tesla',
  inditex: 'Inditex',
  lvmh: 'LVMH',
  ferrari: 'Ferrari',
  santander: 'Santander',
  coca_cola: 'Coca-Cola',
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  dogecoin: 'Dogecoin',
};

export const ASSET_NAMES: Readonly<Record<NoticeLocale, Readonly<Record<string, string>>>> = {
  en: {
    ...SAME,
    treasury_bills: 'US Treasury bills',
    treasury_short: 'US Treasury 2Y',
    treasury_long: 'US Treasury 10Y',
    bund: 'German Bund',
    reit: 'Global REIT',
    small_caps: 'Russell 2000',
    gold: 'Gold',
  },
  es: {
    ...SAME,
    treasury_bills: 'Letras del Tesoro EE. UU.',
    treasury_short: 'Bono EE. UU. 2 años',
    treasury_long: 'Bono EE. UU. 10 años',
    bund: 'Bund alemán',
    reit: 'Fondo inmobiliario global',
    small_caps: 'Pequeñas empresas EE. UU.',
    gold: 'Oro',
  },
  ru: {
    ...SAME,
    treasury_bills: 'Казначейские векселя США',
    treasury_short: 'Облигации США, 2 года',
    treasury_long: 'Облигации США, 10 лет',
    bund: 'Облигации Германии',
    reit: 'Глобальный фонд недвижимости',
    small_caps: 'Малые компании США',
    gold: 'Золото',
  },
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * The held asset that moved most, if any moved by 5% or more: its return over the round that just
 * ended, against what the player holds. A bigger holding wins a tie, then the asset's id, so the
 * same life always gives the same answer. Unknown shapes give null; nothing is trusted.
 */
export function moverOf(positions: unknown, returnBp: unknown, minBp: number = MIN_MOVE_BP): Mover | null {
  if (!isRecord(positions) || !isRecord(returnBp)) return null;
  let best: { id: string; bp: number; value: number } | null = null;
  for (const id of Object.keys(positions).sort()) {
    const held = positions[id];
    const bp = returnBp[id];
    if (!isRecord(held) || typeof held.value !== 'number' || !(held.value > 0)) continue;
    if (typeof bp !== 'number' || !Number.isFinite(bp) || Math.abs(bp) < minBp) continue;
    if (best === null || Math.abs(bp) > Math.abs(best.bp) || (Math.abs(bp) === Math.abs(best.bp) && held.value > best.value)) best = { id, bp, value: held.value };
  }
  return best === null ? null : { assetId: best.id, percent: Math.sign(best.bp) * Math.round(Math.abs(best.bp) / 100) };
}

/**
 * What a life at its round holds that moved, from the state the game itself played. Only the world
 * of the player's own round is read, never the next. Null when the life is over, still at its
 * start, or nothing held moved enough.
 */
export function moverOfState(state: unknown): Mover | null {
  if (!isRecord(state) || state.finished === true) return null;
  const { round, timeline, player } = state;
  if (typeof round !== 'number' || round < 1 || !Array.isArray(timeline) || !isRecord(player)) return null;
  const world = timeline[round];
  return isRecord(world) ? moverOf(player.positions, world.assetReturnBp) : null;
}

/** A ranked life in progress, as the database gives it for this notice. */
export interface MarketRow {
  game_id: string;
  life_id: string;
  engine_version: string;
  content_version: string;
  challenge: string | null;
  log: unknown;
}

/**
 * Plays a life again from its seed and log and says what moved in it. Null if the server no longer
 * holds the life's versions, the log cannot be played, or nothing moved. It never throws: one life
 * that cannot be read must not stop the notices of the others.
 */
export function marketMover(games: Readonly<Record<string, GameModule>>, row: MarketRow, seed: string): Mover | null {
  try {
    const game = games[`${row.engine_version}/${row.content_version}`];
    if (!game) return null;
    const start = startOf(game, row.life_id, row.challenge);
    const log = readLog(row.log, game);
    if (start === null || log === null || log.length === 0) return null;
    const mover = moverOfState(game.replayLog(game.content, start, seed, log));
    // An asset the notice cannot name in every language is not told of.
    return mover !== null && assetName(mover.assetId, 'en') !== null ? mover : null;
  } catch {
    return null;
  }
}

/** The name of an asset in a language, or null for one the notice does not know: then it says nothing. */
export const assetName = (assetId: string, lang: NoticeLocale): string | null => (Object.hasOwn(ASSET_NAMES[lang], assetId) ? ASSET_NAMES[lang][assetId] : null);
