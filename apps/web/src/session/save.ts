import type { LifeDef } from '@ratrace/content';
import { CONTENT_VERSION } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, findInvariantBreaks, realNetWorth } from '@ratrace/engine';
import type { Content, GameState, StartConfig } from '@ratrace/engine';
import { SAVE_FORMAT } from './types';
import type { Lost, RoundLog, SavedGame } from './types';

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

export interface Replayed {
  state: GameState;
  /** Net worth in start-of-game cents at the start and after every round played. */
  history: number[];
  bankruptcies: number;
}

/**
 * Plays a game again from its seed and the log of what the player did.
 * The engine is deterministic, so this gives back exactly the game that was played.
 */
export function replay(content: Content, start: StartConfig, seed: string, log: RoundLog[]): Replayed {
  if (log.length > content.rounds) throw new Error('the log is longer than a life');
  let state = createGame({ content, start }, seed);
  const history = [realNetWorth(state)];
  let bankruptcies = 0;

  log.forEach((entry, i) => {
    for (const pick of entry.picks) {
      if (state.phase !== 'cards') throw new Error('the log answers more cards than the round had');
      state = applyCard(content, state, pick).state;
    }
    if (entry.orders === null) {
      if (i < log.length - 1) throw new Error('the log goes on after a round that was never played');
      return;
    }
    const result = applyRound(content, state, { orders: entry.orders });
    for (const event of result.events) if (event.kind === 'bankrupt') bankruptcies += 1;
    state = result.state;
    history.push(realNetWorth(state));
  });
  return { state, history, bankruptcies };
}

function readLog(raw: unknown): RoundLog[] | null {
  if (!Array.isArray(raw)) return null;
  const log: RoundLog[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) return null;
    const { picks, orders } = entry;
    if (!Array.isArray(picks) || !picks.every(isCount)) return null;
    if (orders !== null && !Array.isArray(orders)) return null;
    log.push({ picks, orders: orders as RoundLog['orders'] });
  }
  return log;
}

/** Where a log says the player is: the rounds played, and the cards answered in the round in progress. */
interface Standing {
  played: number;
  answered: number;
}

/**
 * Reads where a log stops. Only the round in progress may be unplayed, and it is the last entry
 * if it is there at all; a log with an unplayed round in the middle cannot be played again, so it is null.
 */
function standingOf(log: RoundLog[]): Standing | null {
  const pending = log.length > 0 && log[log.length - 1].orders === null ? log[log.length - 1] : null;
  const played = pending === null ? log.length : log.length - 1;
  if (log.slice(0, played).some((entry) => entry.orders === null)) return null;
  return { played, answered: pending?.picks.length ?? 0 };
}

/** True if the stored state is a sound game that stands exactly where the log says the player is, to the very card. */
function stateFits(content: Content, state: unknown, seed: string, at: Standing): state is GameState {
  try {
    const candidate = state as GameState;
    if (findInvariantBreaks(content, candidate).length > 0) return false;
    return candidate.seed === seed && candidate.round === at.played && candidate.answered === at.answered;
  } catch {
    return false;
  }
}

export type Opened = { ok: true; save: SavedGame; repaired: boolean } | { ok: false; lost: Lost };

/**
 * Checks a stored game before anything trusts it.
 *
 * A save written under other rules is `outdated`: the same seed would give a different game now.
 * A save whose state is unsound, or does not stand where its log says, is rebuilt by replaying
 * the log from the seed. Only when that cannot be done either is the save `damaged`.
 */
export function openSave(raw: unknown, content: Content, lives: ReadonlyArray<LifeDef>): Opened {
  if (!isRecord(raw)) return { ok: false, lost: 'damaged' };
  // A higher format was written by a newer version of the game. There are no older formats to migrate from yet.
  if (typeof raw.format === 'number' && raw.format > SAVE_FORMAT) return { ok: false, lost: 'outdated' };
  if (raw.format !== SAVE_FORMAT) return { ok: false, lost: 'damaged' };
  if (typeof raw.engineVersion !== 'string' || typeof raw.contentVersion !== 'string' || typeof raw.gameId !== 'string') {
    return { ok: false, lost: 'damaged' };
  }
  if (raw.engineVersion !== ENGINE_VERSION || raw.contentVersion !== CONTENT_VERSION) return { ok: false, lost: 'outdated' };

  const life = lives.find((candidate) => candidate.id === raw.lifeId);
  const log = readLog(raw.log);
  const seed = raw.seed;
  const at = log === null ? null : standingOf(log);
  if (!life || log === null || at === null || typeof seed !== 'string') return { ok: false, lost: 'damaged' };

  const header = {
    format: SAVE_FORMAT,
    gameId: raw.gameId,
    engineVersion: raw.engineVersion,
    contentVersion: raw.contentVersion,
    lifeId: life.id,
    seed,
    log,
    updatedAt: isCount(raw.updatedAt) ? raw.updatedAt : 0,
  } as const;

  const historyFits = Array.isArray(raw.history) && raw.history.length === at.played + 1 && raw.history.every((x) => Number.isSafeInteger(x));
  if (stateFits(content, raw.state, seed, at) && historyFits && isCount(raw.bankruptcies) && isCount(raw.updatedAt)) {
    return { ok: true, repaired: false, save: { ...header, history: raw.history as number[], bankruptcies: raw.bankruptcies, state: raw.state } };
  }
  try {
    return { ok: true, repaired: true, save: { ...header, ...replay(content, life.start, seed, log) } };
  } catch {
    return { ok: false, lost: 'damaged' };
  }
}
