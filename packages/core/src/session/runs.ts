import { isWeek } from './challenge';
import { SAVE_FORMAT } from './types';
import type { FinishedRun } from './types';

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const strings = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter((entry): entry is string => typeof entry === 'string'))] : []);
const figure = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
/** The furthest a date can be from 1970 and still be a date. */
export const DAY_LIMIT = 8.64e15;
export const isDay = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= DAY_LIMIT;

/**
 * A stored finished life, checked before a screen is given it. A life finished before badges and
 * cities were recorded opens with none; a figure that is no figure reads as zero. What cannot be
 * shown at all (no id, no life, a day that is no day) is null, and the list leaves it out:
 * one bad record must not take the whole history down.
 */
export function readRun(raw: unknown): FinishedRun | null {
  if (!isRecord(raw) || typeof raw.runId !== 'string' || typeof raw.lifeId !== 'string' || !isDay(raw.finishedAt)) return null;
  return {
    format: SAVE_FORMAT,
    runId: raw.runId,
    engineVersion: typeof raw.engineVersion === 'string' ? raw.engineVersion : '',
    contentVersion: typeof raw.contentVersion === 'string' ? raw.contentVersion : '',
    lifeId: raw.lifeId,
    seed: typeof raw.seed === 'string' ? raw.seed : '',
    log: Array.isArray(raw.log) ? (raw.log as FinishedRun['log']) : [],
    finishedAt: raw.finishedAt,
    score: figure(raw.score),
    netWorth: figure(raw.netWorth),
    status: figure(raw.status),
    escapedAtRound: typeof raw.escapedAtRound === 'number' && Number.isSafeInteger(raw.escapedAtRound) && raw.escapedAtRound >= 0 ? raw.escapedAtRound : null,
    bankruptcies: Math.max(0, Math.trunc(figure(raw.bankruptcies))),
    history: Array.isArray(raw.history) ? raw.history.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : [],
    badges: strings(raw.badges),
    cities: strings(raw.cities),
    verified: false,
    ...(raw.ranked === true ? { ranked: true as const } : {}),
    ...(raw.room === true ? { room: true as const } : {}),
    ...(isWeek(raw.challenge) ? { challenge: raw.challenge } : {}),
  };
}

/** Every stored life that can be shown, the latest first. */
export function readRuns(raw: readonly unknown[]): FinishedRun[] {
  return raw.map(readRun).filter((run): run is FinishedRun => run !== null).sort((a, b) => b.finishedAt - a.finishedAt);
}
