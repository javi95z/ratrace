/*
 * The pure side of swiping between tabs (`TabSwipe.tsx`): where the panel stands for how far it is dragged, and which way, if any, a drag let go
 * turns the tabs. Each is a worklet, worked out on the phone's UI thread as the finger moves. A drag to the left brings the next tab (the one on the
 * right of the strip), as a phone's own paged tabs do.
 */

/** How far a finger goes sideways before a press is a swipe of the tabs: a little more than a card waits (6), so a tap or a scroll is never one. */
export const SWIPE_GRAB = 14;
/** How far up or down a finger may go before a swipe is no longer one: the page's scroll has it then. */
export const SWIPE_CANCEL = 10;
/** Let go past this share of the panel's width, the tab turns. */
export const TURN_SHARE = 1 / 4;
/** A flick: let go moving sideways at least this fast (points a second), the tab turns however short the drag. */
export const TURN_FLICK = 600;
/** How far the panel goes towards a side with no tab: a little give, never a gap. */
export const EDGE_GIVE = 32;
/** How long the panel takes to leave as a tab turns, and the next one to come in its place. */
export const LEAVE_MS = 140;
export const ENTER_MS = 220;

/** Where the panel stands, `translation` points from its rest: with the finger towards a tab there is, with a little give towards none. */
export function draggedTo(translation: number, hasPrev: boolean, hasNext: boolean): number {
  'worklet';
  const towardNext = translation < 0;
  if (towardNext ? hasNext : hasPrev) return translation;
  const far = Math.abs(translation);
  return (Math.sign(translation) * EDGE_GIVE * far) / (far + 2 * EDGE_GIVE);
}

/** Which way a drag let go at `at` points, moving at `velocity`, turns the tabs: +1 to the next, -1 to the one before, 0 back to rest. */
export function turnOf(at: number, velocity: number, width: number, hasPrev: boolean, hasNext: boolean): -1 | 0 | 1 {
  'worklet';
  const way = at < 0 ? 1 : at > 0 ? -1 : 0;
  if (way === 0 || (way > 0 ? !hasNext : !hasPrev)) return 0;
  // A flick back the other way keeps it, however far it went.
  if (Math.sign(velocity) === Math.sign(at) && Math.abs(velocity) >= TURN_FLICK) return way;
  if (Math.sign(velocity) === -Math.sign(at) && Math.abs(velocity) >= TURN_FLICK) return 0;
  return width > 0 && Math.abs(at) > width * TURN_SHARE ? way : 0;
}
