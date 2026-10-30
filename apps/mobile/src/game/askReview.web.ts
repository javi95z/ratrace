import type { ReviewMemory } from './reviewTimes';

/** Nothing on the web: a page has no store to be rated in (`askReview.ts` is the phone's). */
export function askReview(memory: ReviewMemory): void {
  void memory;
}
