/*
 * When the game may ask the player to rate it in their phone's store (game/askReview.ts): only after something good (the life's first way out of
 * the rat race taken in, a life ended among the player's three best), never more than three times, and never twice within 120 days. What has been
 * asked is kept on the phone (`kvReview` in kvStore.ts); the store itself decides whether its prompt is shown at all, and says nothing of it.
 */

/** What the phone remembers of the asking: how many times, and when last (ms since the epoch). */
export interface ReviewsAsked {
  times: number;
  last: number;
}

/** Where that is kept: read at once, nothing kept read as null. */
export interface ReviewMemory {
  read(): ReviewsAsked | null;
  write(asked: ReviewsAsked): void;
}

/** The store's own prompt (expo-store-review): whether this phone has one, and asking it. */
export interface ReviewStore {
  hasAction(): Promise<boolean>;
  requestReview(): Promise<void>;
}

export const MOST_ASKS = 3;
export const ASK_GAP_MS = 120 * 24 * 60 * 60 * 1000;

/** Whether the game may ask again, as what it has asked stands at `now`. */
export function mayAsk(asked: ReviewsAsked | null, now: number): boolean {
  if (asked === null) return true;
  return asked.times < MOST_ASKS && now - asked.last >= ASK_GAP_MS;
}

/**
 * Asks the store for its prompt where the game may (`mayAsk`), in a build for players only (`release`) and where the store has a prompt to show,
 * and notes that it asked. Says whether it did. Nothing it calls ever throws out of it: a store that fails is a prompt not shown, and not counted.
 */
export async function askForReview({ store, memory, now, release }: { store: () => Promise<ReviewStore | null>; memory: ReviewMemory; now: () => number; release: boolean }): Promise<boolean> {
  if (!release || !mayAsk(memory.read(), now())) return false;
  try {
    const loaded = await store();
    if (loaded === null || !(await loaded.hasAction())) return false;
    // Looked at again, and noted before it is shown: a second call while the store was asked never asks twice.
    const before = memory.read();
    if (!mayAsk(before, now())) return false;
    memory.write({ times: (before?.times ?? 0) + 1, last: now() });
    await loaded.requestReview();
    return true;
  } catch {
    return false;
  }
}

/** Whether a life just finished stands among the player's three best scores: fewer than three lives scored more. */
export function amongBestThree(score: number, scores: readonly number[]): boolean {
  return scores.filter((other) => other > score).length < 3;
}
