/*
 * The pure side of pulling a sheet down to close it, on the phone and on the web: where the panel stands for how far it is pulled, whether it is
 * closed or goes back when it is let go, how dim the page round it is, and how long it takes to leave. Each is a worklet, so that the phone's UI
 * thread works them out as the finger moves; nothing here knows Reanimated or the gestures (`useSheetPull.ts`, `sheetDrag.tsx`).
 */

/** How far a pointer goes before a press is a drag of the sheet, on the phone and on the web: a little more than a card or a slider waits (6). */
export const GRAB = 10;
/** Let go past this share of its height, the sheet closes (about a third, as a phone's own sheets). */
export const CLOSE_SHARE = 1 / 3;
/** A flick: let go moving down at least this fast (points a second), the sheet closes from wherever it is below its rest. */
export const FLICK = 900;
/** How far a panel pulled up past its rest can go, however far the finger does: a little give, never a gap. */
export const RUBBER = 24;
/** The longest a sheet takes to slide away once it is let go to close; a quick flick takes the finger's own pace. */
export const SLIDE_MS = 200;
/** The shortest slide away, so that it is seen at all. */
const SLIDE_MIN_MS = 60;

/** Where the panel stands, `translation` points from its rest: down, with the finger; up, with half of it at first and never past `RUBBER`. */
export function pulledTo(translation: number): number {
  'worklet';
  if (translation >= 0) return translation;
  const up = -translation;
  return -(RUBBER * up) / (up + 2 * RUBBER);
}

/**
 * What a panel let go `at` points below its rest, moving at `velocity` (down is positive), does: closes, or goes back to its rest. A flick down closes
 * it, a flick back up keeps it; otherwise a third of its `height` decides. A panel not measured yet (`height` 0) closes by a flick only.
 */
export function letGo(at: number, velocity: number, height: number): 'close' | 'back' {
  'worklet';
  if (at <= 0) return 'back';
  if (velocity >= FLICK) return 'close';
  if (velocity <= -FLICK) return 'back';
  return height > 0 && at > height * CLOSE_SHARE ? 'close' : 'back';
}

/** The dimmed page's opacity with the panel `pull` points down: whole at rest (and above it), none once it has gone its whole `height`. */
export function dimOf(pull: number, height: number): number {
  'worklet';
  if (height <= 0 || pull <= 0) return 1;
  return Math.max(0, 1 - pull / height);
}

/** How long the slide away takes for the `left` points still to go: at the finger's `velocity` when that is quicker, never longer than `SLIDE_MS`. */
export function slideMs(left: number, velocity: number): number {
  'worklet';
  if (velocity <= 0) return SLIDE_MS;
  return Math.round(Math.min(SLIDE_MS, Math.max(SLIDE_MIN_MS, (left / velocity) * 1000)));
}
