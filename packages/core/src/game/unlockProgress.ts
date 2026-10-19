/** How far a player is towards a goal, as far as this device can tell. */
export interface UnlockProgress {
  have: number;
  need: number;
}

/**
 * Progress towards the goal that opens a life, only where the device records what the goal counts.
 * Lives lived to the end are kept; the richest a life ever was is not (a finished life keeps only its
 * final net worth), so a goal of that kind shows its requirement and nothing more.
 * `finished` is null while the device has not said how many lives were lived.
 */
export function unlockProgress(unlock: string, finished: number | null): UnlockProgress | null {
  if (unlock === 'finish_one_life' && finished !== null) return { have: Math.min(finished, 1), need: 1 };
  return null;
}
