/*
 * The pure side of pulling a sheet down to close it, on the phone and on the web: where the panel stands for how far it is pulled, whether it is
 * closed or goes back when it is let go, how dim the page round it is, and how long it takes to leave. Each is a worklet, so that the phone's UI
 * thread works them out as the finger moves; nothing here knows Reanimated or the gestures (`useSheetPull.ts`, `sheetDrag.tsx`).
 */

/** How far a pointer goes before a press is a drag of the sheet, on the phone and on the web: a little more than a card or a slider waits (6). */
export const GRAB = 10;
/** Let go past this share of its height, the sheet closes (about a third, as a phone's own sheets). */
export const CLOSE_SHARE = 1 / 3;
/** A flick: let go moving down at least this fast (points a second), the sheet closes, once it has travelled `FLICK_TRAVEL`. */
export const FLICK = 900;
/** How far a flick must have taken the panel to close it: a quick twitch past the slop (a mouse's, a finger's) is not a close. */
export const FLICK_TRAVEL = 24;
/** How far a panel pulled up past its rest can go, however far the finger does: a little give, never a gap. */
export const RUBBER = 24;
/** The longest a sheet takes to slide away once it is let go to close; a quick flick takes the finger's own pace. Closed by a press, it takes this. */
export const SLIDE_MS = 200;
/** How long a sheet takes to come up from the foot of the screen as it opens: the slide away, the other way, slowing as it lands. */
export const ENTER_MS = 240;
/** How far past its own height a sheet stands when it has gone (or before it has come): its frame and shadow clear the foot of the screen. */
export const OFF = 24;
/** The shortest slide away, so that it is seen at all. */
const SLIDE_MIN_MS = 60;

/**
 * Where the panel stands, `translation` points from its rest: down, with the finger; up, with half of it at first and never past `RUBBER`. A sheet
 * `locked` (one that cannot be closed now: an account being deleted) gives the same little either way.
 */
export function pulledTo(translation: number, locked = false): number {
  'worklet';
  if (translation >= 0 && !locked) return translation;
  const far = Math.abs(translation);
  return (Math.sign(translation) * RUBBER * far) / (far + 2 * RUBBER);
}

/**
 * What a panel let go `at` points below its rest, moving at `velocity` (down is positive), does: closes, or goes back to its rest. A flick down closes
 * it, a flick back up keeps it; otherwise a third of its `height` decides. A panel not measured yet (`height` 0) closes by a flick only.
 */
export function letGo(at: number, velocity: number, height: number): 'close' | 'back' {
  'worklet';
  if (at <= 0) return 'back';
  if (velocity >= FLICK) return at >= FLICK_TRAVEL ? 'close' : 'back';
  if (velocity <= -FLICK) return 'back';
  return height > 0 && at > height * CLOSE_SHARE ? 'close' : 'back';
}

/*
 * A sheet of two heights, on the phone (a long sheet to read or browse, which its owner asks for: `Sheet`'s `half`): it opens with half the screen
 * shown, the rest of it below the foot of the screen, is pulled up to its whole height and down again to the half, and closes from the half as a
 * sheet of one height does from its whole. Only a sheet taller than `HALF_FROM` of the screen stands at a half: a shorter one is whole at once.
 */

/** The share of the screen a sheet of two heights shows at its half. */
export const HALF = 0.5;
/** A sheet stands at a half only where it is taller than this share of the screen: shorter, its half would be nearly its whole. */
export const HALF_FROM = 0.65;

/** How far below its whole a sheet `height` tall stands at its half, on a `screen` that tall: none where it is not tall enough to have one. */
export function halfOf(height: number, screen: number): number {
  'worklet';
  if (height <= 0 || screen <= 0 || height <= screen * HALF_FROM) return 0;
  return height - screen * HALF;
}

/**
 * Where a sheet of two heights let go `at` points below its whole, moving at `velocity` (down positive), goes: its whole (`full`), its half, or away.
 * A flick up takes it whole; a flick down takes it to its half from above it, away from below it; otherwise the nearer height, or away past a third of
 * what the half shows. With no half (`half` 0) it is the sheet of one height (`letGo`).
 */
export function settleAt(at: number, velocity: number, height: number, half: number): 'full' | 'half' | 'close' {
  'worklet';
  if (half <= 0) return letGo(at, velocity, height) === 'close' ? 'close' : 'full';
  if (at <= 0 || velocity <= -FLICK) return 'full';
  if (velocity >= FLICK) return at < half ? 'half' : at - half >= FLICK_TRAVEL ? 'close' : 'half';
  if (at > half + (height - half) * CLOSE_SHARE) return 'close';
  return at < half / 2 ? 'full' : 'half';
}

/**
 * The dimmed page's opacity with the panel `pull` points down: whole at rest (and above it, and anywhere above its half, `half`), none once it has
 * gone its whole `height`.
 */
export function dimOf(pull: number, height: number, half = 0): number {
  'worklet';
  if (height <= 0 || pull <= half) return 1;
  return Math.max(0, 1 - (pull - half) / (height - half));
}

/** How long the slide away takes for the `left` points still to go: at the finger's `velocity` when that is quicker, never longer than `SLIDE_MS`. */
export function slideMs(left: number, velocity: number): number {
  'worklet';
  if (velocity <= 0) return SLIDE_MS;
  return Math.round(Math.min(SLIDE_MS, Math.max(SLIDE_MIN_MS, (left / velocity) * 1000)));
}

/**
 * The spring a sheet let go of short of closing goes back on: quick and only just damped, as a phone's own sheet settles, without a bounce past its
 * rest worth seeing.
 */
export const BACK_SPRING = { stiffness: 380, damping: 36, mass: 1 };

/**
 * The spring back for a panel let go moving at `velocity`: it keeps a downward speed (the panel turns and comes back), never an upward one, and never
 * passes its rest, which would show the dimmed page under a panel standing on the foot of the screen.
 */
export function backSpring(velocity: number) {
  'worklet';
  return { ...BACK_SPRING, velocity: Math.max(0, velocity), overshootClamping: true };
}
