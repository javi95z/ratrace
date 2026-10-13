import { readProfile } from '@/session/profile';
import { SAVE_FORMAT } from '@/session/types';
import type { Earned, FinishedRun, Profile } from '@/session/types';

/**
 * How two copies of a player's things become one, when a device meets its account. Everything
 * here is a pure rule: what is unlocked is joined and nothing is lost; finished lives are joined
 * by id; and of a life in progress, one copy is taken whole, never a mix of two.
 */

/**
 * What a player has unlocked: the profile without what belongs to the device. That is its
 * settings, and whether the guide is on: a switch the player can turn either way on each device,
 * which joined like a badge ("off anywhere is off") could never be turned back on.
 */
export interface Progress {
  badges: Record<string, Earned>;
  gallery: string[];
  unlocked: Record<string, Earned>;
  /** The tips of the guide already read. */
  guide: { seen: string[] };
}

export const progressOf = (profile: Profile): Progress => ({ badges: profile.badges, gallery: profile.gallery, unlocked: profile.unlocked, guide: { seen: profile.guide.seen } });

/** The profile with this progress in it. What belongs to the device is left as it is. */
export const withProgress = (profile: Profile, progress: Progress): Profile => ({
  ...profile,
  badges: progress.badges,
  gallery: progress.gallery,
  unlocked: progress.unlocked,
  guide: { ...profile.guide, seen: progress.guide.seen },
});

/** Reads progress as the cloud holds it, checked part by part like a stored profile. What is not progress is none. */
export function readProgress(raw: unknown): Progress {
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
  return progressOf(readProfile({ ...source, format: SAVE_FORMAT }));
}

/** Everything either side has earned, each thing dated by the day it was first earned. */
function earliest(a: Record<string, Earned>, b: Record<string, Earned>): Record<string, Earned> {
  const out: Record<string, Earned> = { ...a };
  for (const [id, entry] of Object.entries(b)) {
    if (!Object.hasOwn(out, id) || entry.at < out[id].at) out[id] = entry;
  }
  return out;
}
const joined = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])];

/**
 * Two copies of what a player has unlocked, as one. A badge earned anywhere is earned, an item
 * owned anywhere is in the gallery, and a tip seen anywhere is seen. Nothing is ever taken away,
 * so it can be done as often as two devices meet.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  return {
    badges: earliest(a.badges, b.badges),
    gallery: joined(a.gallery, b.gallery),
    unlocked: earliest(a.unlocked, b.unlocked),
    guide: { seen: joined(a.guide.seen, b.guide.seen) },
  };
}

const sameEarned = (a: Record<string, Earned>, b: Record<string, Earned>): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([id, entry]) => Object.hasOwn(b, id) && b[id].at === entry.at && b[id].gameId === entry.gameId);
const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item) => b.includes(item));

/** True if two copies hold the same, in whatever order: there is then nothing to write. */
export function sameProgress(a: Progress, b: Progress): boolean {
  return sameEarned(a.badges, b.badges) && sameEarned(a.unlocked, b.unlocked) && sameSet(a.gallery, b.gallery) && sameSet(a.guide.seen, b.guide.seen);
}

/**
 * Finished lives from the device and from the account, joined by id, the latest first. Of a life
 * both have, the device's copy is kept. `added` are the ones the device did not have.
 */
export function mergeRuns(device: readonly FinishedRun[], cloud: readonly FinishedRun[]): { all: FinishedRun[]; added: FinishedRun[] } {
  const known = new Set(device.map((run) => run.runId));
  const added = cloud.filter((run) => !known.has(run.runId));
  return { all: [...device, ...added].sort((a, b) => b.finishedAt - a.finishedAt), added };
}

/** A life in progress as the account holds it. */
export interface CloudGame {
  id: string;
  lifeId: string;
  engineVersion: string;
  contentVersion: string;
  seed: string | null;
  round: number;
  status: string;
  log: unknown;
  /** How the life stood when it was saved, in a word. Two copies with the same one are the same. */
  stateHash?: string | null;
  updatedAt: string;
}

/** The life in progress on the device, as far as choosing between two copies needs to know it. */
export interface DeviceGame {
  gameId: string;
  /** How much of it has been played. See `stepsOf`. */
  steps: number;
  finished: boolean;
}

/** How much of a life a log holds: every card answered and every round played. More is further along. */
export function stepsOf(log: unknown): number {
  if (!Array.isArray(log)) return 0;
  let steps = 0;
  for (const entry of log as Array<{ picks?: unknown; orders?: unknown }>) {
    if (Array.isArray(entry?.picks)) steps += entry.picks.length;
    if (entry?.orders !== null && entry?.orders !== undefined) steps += 1;
  }
  return steps;
}

export type GameChoice =
  /** The device carries on with what it has. `offer` is a different life waiting in the account, if there is one. */
  | { take: 'device'; offer: CloudGame | null }
  /** The device takes the account's copy, whole. */
  | { take: 'cloud'; game: CloudGame };

/**
 * Which life the device plays, given what it has and what the account holds (the latest first).
 *
 * - No life on the device: it takes the account's.
 * - The same life on both: the copy with more of it played. Two copies are never mixed.
 * - A different life on each: the device keeps its own. The account's is offered, never imposed.
 * - A life that is over on the device stays there, where its score can still be looked at, and
 *   the account's is offered.
 *
 * A game this build could not play is left alone: one on other versions, one that is over, one with no seed.
 */
export function chooseGame(device: DeviceGame | null, cloud: readonly CloudGame[], versions: { engine: string; content: string }): GameChoice {
  const playable = cloud.filter((game) => game.status === 'playing' && game.seed !== null && game.engineVersion === versions.engine && game.contentVersion === versions.content);
  if (device === null) return playable.length > 0 ? { take: 'cloud', game: playable[0] } : { take: 'device', offer: null };

  const same = playable.find((game) => game.id === device.gameId);
  if (same && stepsOf(same.log) > device.steps) return { take: 'cloud', game: same };
  return { take: 'device', offer: playable.find((game) => game.id !== device.gameId) ?? null };
}
