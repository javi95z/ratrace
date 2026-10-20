/**
 * The pure side of the phone's motion: the web's `steps()` timing, the table of every animation
 * (duration and step count as `globals.css` declares them) and the frames of the ones the kit uses
 * now. Nothing here knows Reanimated; the hooks in `animations.tsx` only play these.
 */

export type Jump = 'start' | 'end';
export type Fill = 'none' | 'backwards' | 'forwards' | 'both';
export type KeyframeName =
  | 'rise' | 'blink' | 'reveal' | 'fall' | 'alarm' | 'fly' | 'pop' | 'sink' | 'spark'
  | 'medal' | 'tear' | 'page' | 'light' | 'paper' | 'glint' | 'holo' | 'legend';

/**
 * CSS `steps(steps, jump)`: `end` holds each value until the end of its slice (floor, and 1 at t = 1),
 * `start` jumps at the start of it (ceil, and 0 only at t = 0).
 */
export function stepped(t: number, steps: number, jump: Jump = 'end'): number {
  'worklet';
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return (jump === 'start' ? Math.ceil(t * steps) : Math.floor(t * steps)) / steps;
}

/** Every `--animate-*` of `globals.css`: duration, `steps(n, jump)`, fill mode, whether it runs for ever. */
export const KEYFRAMES: Record<KeyframeName, { ms: number; steps: number; jump: Jump; fill: Fill; loop: boolean }> = {
  rise: { ms: 280, steps: 4, jump: 'end', fill: 'backwards', loop: false },
  blink: { ms: 1000, steps: 2, jump: 'start', fill: 'none', loop: true },
  reveal: { ms: 500, steps: 8, jump: 'end', fill: 'backwards', loop: false },
  fall: { ms: 1600, steps: 16, jump: 'end', fill: 'forwards', loop: false },
  alarm: { ms: 1200, steps: 2, jump: 'start', fill: 'none', loop: true },
  fly: { ms: 700, steps: 10, jump: 'end', fill: 'both', loop: false },
  pop: { ms: 500, steps: 6, jump: 'end', fill: 'none', loop: false },
  sink: { ms: 450, steps: 5, jump: 'end', fill: 'none', loop: false },
  spark: { ms: 600, steps: 6, jump: 'end', fill: 'both', loop: false },
  medal: { ms: 900, steps: 12, jump: 'end', fill: 'both', loop: false },
  tear: { ms: 900, steps: 9, jump: 'end', fill: 'both', loop: false },
  page: { ms: 1500, steps: 15, jump: 'end', fill: 'both', loop: false },
  light: { ms: 300, steps: 3, jump: 'end', fill: 'both', loop: false },
  paper: { ms: 800, steps: 12, jump: 'end', fill: 'both', loop: false },
  glint: { ms: 3600, steps: 18, jump: 'end', fill: 'none', loop: true },
  holo: { ms: 4000, steps: 40, jump: 'end', fill: 'none', loop: true },
  legend: { ms: 700, steps: 10, jump: 'end', fill: 'backwards', loop: false },
};

/** The numbers an animated style is made of. */
export type Frame = { opacity: number; translateY: number; scale: number };

type Stop = { at: number } & Frame;

/**
 * The `@keyframes` of the effects built so far. A property a keyframe does not name keeps the
 * element's own value, which is written out here (opacity 1, no shift, scale 1).
 */
const STOPS: Partial<Record<KeyframeName, Stop[]>> = {
  // from { opacity: 0; translateY(8px) } to { opacity: 1; translateY(0) }
  rise: [
    { at: 0, opacity: 0, translateY: 8, scale: 1 },
    { at: 1, opacity: 1, translateY: 0, scale: 1 },
  ],
  // to { visibility: hidden }: it flips, it does not fade; see `frameAt`.
  blink: [
    { at: 0, opacity: 1, translateY: 0, scale: 1 },
    { at: 1, opacity: 0, translateY: 0, scale: 1 },
  ],
  // 35% { translateY(-6px) scale(1.15) } 70% { translateY(0) scale(0.94) } 100% { translateY(0) scale(1) }
  pop: [
    { at: 0, opacity: 1, translateY: 0, scale: 1 },
    { at: 0.35, opacity: 1, translateY: -6, scale: 1.15 },
    { at: 0.7, opacity: 1, translateY: 0, scale: 0.94 },
    { at: 1, opacity: 1, translateY: 0, scale: 1 },
  ],
  // 50% { scale(0.7); opacity 0.5 } 100% { scale(1); opacity 1 }
  sink: [
    { at: 0, opacity: 1, translateY: 0, scale: 1 },
    { at: 0.5, opacity: 0.5, translateY: 0, scale: 0.7 },
    { at: 1, opacity: 1, translateY: 0, scale: 1 },
  ],
};

/** The state of an element that is not (or no longer) being animated. */
export const REST: Frame = { opacity: 1, translateY: 0, scale: 1 };

/** True for the effects whose frames are built. */
export function isBuilt(name: KeyframeName): boolean {
  return STOPS[name] !== undefined;
}

/**
 * The frame at progress `p` (0 to 1) of the animation `name`. As in CSS the timing function runs
 * inside each interval between two keyframes, so a three-stop effect steps three times over.
 */
export function frameAt(name: KeyframeName, p: number): Frame {
  'worklet';
  const stops = STOPS[name];
  if (!stops) return REST;
  const { steps, jump } = KEYFRAMES[name];
  const clamped = Math.min(1, Math.max(0, p));
  let i = 0;
  while (i < stops.length - 2 && clamped >= stops[i + 1].at) i += 1;
  const a = stops[i];
  const b = stops[i + 1];
  const local = stepped((clamped - a.at) / (b.at - a.at), steps, jump);
  if (name === 'blink') return local < 1 ? a : b;
  return {
    opacity: a.opacity + (b.opacity - a.opacity) * local,
    translateY: a.translateY + (b.translateY - a.translateY) * local,
    scale: a.scale + (b.scale - a.scale) * local,
  };
}

/**
 * What an element shows when the animation has `phase` of its life behind it: `before` its start,
 * `running` at progress `p`, or `after` its end, with the fill mode deciding what is held outside.
 */
export function frameFor(name: KeyframeName, phase: 'before' | 'running' | 'after', p: number): Frame {
  'worklet';
  const { fill } = KEYFRAMES[name];
  if (phase === 'before') return fill === 'backwards' || fill === 'both' ? frameAt(name, 0) : REST;
  if (phase === 'after') return fill === 'forwards' || fill === 'both' ? frameAt(name, 1) : REST;
  return frameAt(name, p);
}

/** Ease-out cubic: fast at first, slowing to the last. */
export function easeOutCubic(t: number): number {
  'worklet';
  return 1 - (1 - t) ** 3;
}

/** A counted figure `t` (0 to 1) of the way from `from` to `target`, as the web's `useCountUp` rounds it. */
export function countUpValue(from: number, target: number, t: number): number {
  return Math.round(from + (target - from) * easeOutCubic(Math.min(1, Math.max(0, t))));
}
