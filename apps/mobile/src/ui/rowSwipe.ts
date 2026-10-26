/*
 * The pure side of a row swiped away (`SwipeAway.tsx`): where the row stands for how far it is dragged, and whether a drag let go takes it away.
 * Each is a worklet, worked out on the phone's UI thread as the finger moves. A row goes to the left, as a phone's own list rows do (Mail, Gmail).
 */

/** How far a finger goes sideways before a press is a swipe of the row: as a swipe of the tabs (`tabTurn.ts`), so a tap or a scroll is never one. */
export { SWIPE_CANCEL, SWIPE_GRAB } from './tabTurn';
/** Let go past this share of the row's width, it goes; crossing it is felt. */
export const AWAY_SHARE = 0.4;
/** A flick to the left: let go moving at least this fast (points a second), it goes however short the drag. */
export const AWAY_FLICK = 800;
/** How far the row goes to the right, where nothing is: a little give, never a gap. */
export const RIGHT_GIVE = 24;
/** How long the row takes to leave, and its place to close after it. */
export const LEAVE_MS = 160;
export const CLOSE_MS = 160;

/** Where the row stands, `translation` points from its rest: with the finger to the left, with a little give to the right. */
export function swipedTo(translation: number): number {
  'worklet';
  if (translation <= 0) return translation;
  return (RIGHT_GIVE * translation) / (translation + 2 * RIGHT_GIVE);
}

/** Whether the row stands past where letting go takes it away. */
export function pastAway(at: number, width: number): boolean {
  'worklet';
  return width > 0 && at < -width * AWAY_SHARE;
}

/** Whether a drag let go at `at`, moving at `velocity`, takes the row away: past the line, or flicked to the left, unless flicked back. */
export function awayOf(at: number, velocity: number, width: number): boolean {
  'worklet';
  if (at >= 0 || velocity >= AWAY_FLICK) return false;
  return velocity <= -AWAY_FLICK || pastAway(at, width);
}
