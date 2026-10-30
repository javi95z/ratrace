/*
 * The sheen of a legendary card (`CardDef.legendary`): a soft band of light that sweeps across its picture once every `SHEEN_MS`, then waits out of
 * sight until the next run. The phone moves it with Reanimated (`Sheen` in Shine.tsx), the web with a CSS animation (Shine.web.tsx), both from here.
 */

/** One run of the sheen, in milliseconds: a crossing, then a wait. */
export const SHEEN_MS = 2600;
/** The share of a run the band takes to cross the picture; the rest it waits past its right edge. */
export const SHEEN_CROSS = 0.4;
/** How wide the band is, as a share of the picture. */
export const SHEEN_SHARE = 0.22;
/** Its slant, in degrees (the rare card's band of light leans the same way). */
export const SHEEN_SKEW = -20;

/** Where the band's left edge is, in points from the picture's, at `progress` (0 to 1) of a run: out of sight before and after its crossing. */
export function sheenX(progress: number, width: number): number {
  'worklet';
  const band = width * SHEEN_SHARE;
  const from = -2 * band;
  const to = width + band;
  const crossed = Math.max(0, Math.min(1, progress / SHEEN_CROSS));
  return from + crossed * (to - from);
}
