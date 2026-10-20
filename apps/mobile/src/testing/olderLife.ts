import type { OlderRules } from '@ratrace/core/session/legacy';
import { SAVE_FORMAT } from '@ratrace/core/session/types';
import type { RoundLog, SavedGame } from '@ratrace/core/session/types';
import { loadBundledRules } from '../game/olderRules';
import { KvStore } from '../kvStore';

/*
 * For tests and the development page: a life begun under older rules, as a phone that carried them would have saved
 * it. Behind the dev route, and in the tests; nothing of the app reaches it.
 */

/** The rules the fixture is begun under: the engine and the content of a bundle the app carries. */
export const OLDER = { engine: '0.37.0', content: '1.38.0' } as const;

const SEED = 'older-seed';

/**
 * A life of a nurse begun under `rules` and played one round in: every card of the first hand answered with its first
 * option, the round played with no orders. Built by the bundle's own `stepLife`, one step at a time, as it plays a life on.
 */
export function olderLife(rules: OlderRules, at: number): SavedGame {
  const { stepLife } = rules;
  const start = rules.lives.find((life) => life.id === 'nurse')?.start;
  if (!stepLife || start === undefined) throw new Error(`rules ${OLDER.engine}/${OLDER.content} cannot play a nurse step by step`);
  let life = rules.replayLife(rules.content, start, SEED, []);
  const picks: number[] = [];
  while ((rules.viewOf(life.state) as { phase: string }).phase === 'cards') {
    picks.push(0);
    life = stepLife(rules.content, life, { card: 0 });
  }
  life = stepLife(rules.content, life, { orders: [] });
  const log: RoundLog[] = [{ picks, orders: [] }];
  return { format: SAVE_FORMAT, gameId: 'older-life', engineVersion: OLDER.engine, contentVersion: OLDER.content, lifeId: 'nurse', seed: SEED, log, updatedAt: at, ...life };
}

/** Writes that life where the phone keeps the life in progress, for the game to take up the next time it is asked for one. */
export async function putOlderLife(): Promise<void> {
  const rules = await loadBundledRules(OLDER);
  if (typeof rules === 'string') throw new Error(`the app does not carry rules ${OLDER.engine}/${OLDER.content}`);
  await new KvStore().saveGame(olderLife(rules, Date.now()));
}
