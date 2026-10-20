/**
 * The pure side of the phone's motion: the web's `steps()` timing, the table of every animation
 * (duration and step count as `globals.css` declares them) and the frames of every one of them, read off
 * their `@keyframes`. Nothing here knows Reanimated; the hooks in `animations.tsx` only play these.
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

/**
 * The numbers an animated style is made of: what every effect of the stylesheet moves, each at the value of an element
 * left alone. Distances are points, angles degrees; `translateXPct` and `translateYPct` are percent of the element's own
 * box (the web's `translateX(650%)`); `bgX` is a background position in percent of the box (the rainbow's);
 * `reveal` is the share of the width left uncovered (the web's `clip-path: inset(0 R 0 0)` is `1 - R`).
 */
export type Frame = {
  opacity: number;
  translateX: number;
  translateY: number;
  translateXPct: number;
  translateYPct: number;
  scale: number;
  rotate: number;
  rotateY: number;
  skewX: number;
  bgX: number;
  reveal: number;
};

/** How far a coin or a spark goes: the web's `--dx`/`--dy` (`--sx`/`--sy` for a spark), in points. */
export type Reach = { dx: number; dy: number };
const NO_REACH: Reach = { dx: 0, dy: 0 };

/**
 * A keyframe: the properties it names, and where. A property it leaves out keeps the element's own value there. `fx` and
 * `fy` are shares of the reach: the web's `calc(var(--dx) * 0.55)` is `fx: 0.55`.
 */
type Stop = { at: number; fx?: number; fy?: number } & Partial<Frame>;

/** The state of an element that is not (or no longer) being animated. */
export const REST: Frame = { opacity: 1, translateX: 0, translateY: 0, translateXPct: 0, translateYPct: 0, scale: 1, rotate: 0, rotateY: 0, skewX: 0, bgX: 0, reveal: 1 };

/**
 * CSS animates a property over the keyframes that name it, with the timing function running inside each interval between
 * two of them; `transform` is one property whatever functions it holds, and a keyframe that names it names them all (what
 * it leaves out is the identity). So a coin's opacity (named at 0, 15, 90 and 100 %) and its transform (0, 15, 55 and
 * 100 %) each step in ten, over their own intervals.
 */
const GROUPS: ReadonlyArray<{ fields: ReadonlyArray<keyof Frame>; names: ReadonlyArray<keyof Stop> }> = [
  { fields: ['opacity'], names: ['opacity'] },
  {
    fields: ['translateX', 'translateY', 'translateXPct', 'translateYPct', 'scale', 'rotate', 'rotateY', 'skewX'],
    names: ['translateX', 'translateY', 'translateXPct', 'translateYPct', 'scale', 'rotate', 'rotateY', 'skewX', 'fx', 'fy'],
  },
  { fields: ['bgX'], names: ['bgX'] },
  { fields: ['reveal'], names: ['reveal'] },
];

/** The `@keyframes` of `globals.css`, one list a name, in the stylesheet's order. */
const STOPS: Record<KeyframeName, Stop[]> = {
  // from { opacity: 0; translateY(8px) } to { opacity: 1; translateY(0) }
  rise: [
    { at: 0, opacity: 0, translateY: 8 },
    { at: 1, opacity: 1, translateY: 0 },
  ],
  // to { visibility: hidden }: it flips, it does not fade; see `frameAt`.
  blink: [
    { at: 0, opacity: 1 },
    { at: 1, opacity: 0 },
  ],
  // from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) }
  reveal: [
    { at: 0, reveal: 0 },
    { at: 1, reveal: 1 },
  ],
  // from { opacity 1; translateY(-16px) rotate(0) } to { opacity 0; translateY(340px) rotate(360deg) }
  fall: [
    { at: 0, opacity: 1, translateY: -16, rotate: 0 },
    { at: 1, opacity: 0, translateY: 340, rotate: 360 },
  ],
  // 50% { opacity: 0.35 }
  alarm: [{ at: 0.5, opacity: 0.35 }],
  // opacity at 0, 15, 90, 100 %; transform at 0, 15, 55, 100 %; the arc is 18 and 28 px above the straight line
  fly: [
    { at: 0, opacity: 0, translateX: 0, translateY: 0, scale: 0.6 },
    { at: 0.15, opacity: 1, fx: 0.1, fy: 0.1, translateY: -18, scale: 1 },
    { at: 0.55, fx: 0.55, fy: 0.55, translateY: -28, scale: 1 },
    { at: 0.9, opacity: 1 },
    { at: 1, opacity: 0, fx: 1, fy: 1, scale: 0.7 },
  ],
  // 35% { translateY(-6px) scale(1.15) } 70% { translateY(0) scale(0.94) } 100% { translateY(0) scale(1) }
  pop: [
    { at: 0.35, translateY: -6, scale: 1.15 },
    { at: 0.7, translateY: 0, scale: 0.94 },
    { at: 1, translateY: 0, scale: 1 },
  ],
  // 50% { scale(0.7); opacity 0.5 } 100% { scale(1); opacity 1 }
  sink: [
    { at: 0.5, opacity: 0.5, scale: 0.7 },
    { at: 1, opacity: 1, scale: 1 },
  ],
  // from { opacity 1; translate(0, 0) } to { opacity 0; translate(var(--sx), var(--sy)) }
  spark: [
    { at: 0, opacity: 1, translateX: 0, translateY: 0 },
    { at: 1, opacity: 0, fx: 1, fy: 1 },
  ],
  // 0% { opacity 0; scale(0.2) rotateY(0) } 60% { opacity 1; scale(1.12) rotateY(540deg) } 100% { scale(1) rotateY(720deg) }
  medal: [
    { at: 0, opacity: 0, scale: 0.2, rotateY: 0 },
    { at: 0.6, opacity: 1, scale: 1.12, rotateY: 540 },
    { at: 1, scale: 1, rotateY: 720 },
  ],
  // 0%, 30% { translateY(0) rotate(0); opacity 1 } 100% { translate(30px, 140%) rotate(16deg); opacity 0 }
  tear: [
    { at: 0, translateYPct: 0, translateX: 0, rotate: 0, opacity: 1 },
    { at: 0.3, translateYPct: 0, translateX: 0, rotate: 0, opacity: 1 },
    { at: 1, translateX: 30, translateYPct: 140, rotate: 16, opacity: 0 },
  ],
  // 0% { opacity 0; scale(0.9) } 12%, 80% { opacity 1; scale(1) } 100% { opacity 0; scale(1) }
  page: [
    { at: 0, opacity: 0, scale: 0.9 },
    { at: 0.12, opacity: 1, scale: 1 },
    { at: 0.8, opacity: 1, scale: 1 },
    { at: 1, opacity: 0, scale: 1 },
  ],
  // from { opacity 0.25; scale(0.6) } to { opacity 1; scale(1) }
  light: [
    { at: 0, opacity: 0.25, scale: 0.6 },
    { at: 1, opacity: 1, scale: 1 },
  ],
  // 0% { opacity 0; rotate(-540deg) scale(0.15) } 70% { opacity 1; rotate(6deg) scale(1.04) } 100% { opacity 1; rotate(0) scale(1) }
  paper: [
    { at: 0, opacity: 0, rotate: -540, scale: 0.15 },
    { at: 0.7, opacity: 1, rotate: 6, scale: 1.04 },
    { at: 1, opacity: 1, rotate: 0, scale: 1 },
  ],
  // 0% { translateX(-150%) skewX(-20deg); opacity 1 } 35% { translateX(650%) ...; opacity 1 } 36%, 100% { translateX(650%) ...; opacity 0 }
  glint: [
    { at: 0, translateXPct: -150, skewX: -20, opacity: 1 },
    { at: 0.35, translateXPct: 650, skewX: -20, opacity: 1 },
    { at: 0.36, translateXPct: 650, skewX: -20, opacity: 0 },
    { at: 1, translateXPct: 650, skewX: -20, opacity: 0 },
  ],
  // to { background-position: 200% 0 }
  holo: [{ at: 1, bgX: 200 }],
  // 0% { opacity 0; perspective(600px) rotateY(180deg) scale(0.6) } 60% { opacity 1; ... rotateY(-10deg) scale(1.05) } 100% { ... rotateY(0) scale(1) }
  legend: [
    { at: 0, opacity: 0, rotateY: 180, scale: 0.6 },
    { at: 0.6, opacity: 1, rotateY: -10, scale: 1.05 },
    { at: 1, rotateY: 0, scale: 1 },
  ],
};

/** What a keyframe says of a property: its own number, or the element's, with the reach folded into a coin's travel. */
function read(stop: Stop, field: keyof Frame, reach: Reach): number {
  'worklet';
  if (field === 'translateX') return (stop.translateX ?? 0) + (stop.fx ?? 0) * reach.dx;
  if (field === 'translateY') return (stop.translateY ?? 0) + (stop.fy ?? 0) * reach.dy;
  return stop[field] ?? REST[field];
}

/**
 * The frame at progress `p` (0 to 1) of the animation `name`. As in CSS the timing function runs inside each interval
 * between two keyframes that name a property, so a three-stop effect steps three times over. `reach` is where a coin or
 * a spark goes; it is nothing to the rest.
 */
export function frameAt(name: KeyframeName, p: number, reach: Reach = NO_REACH): Frame {
  'worklet';
  const stops = STOPS[name];
  const { steps, jump } = KEYFRAMES[name];
  const clamped = Math.min(1, Math.max(0, p));
  const out: Frame = { ...REST };
  for (const group of GROUPS) {
    // The keyframes that name this property: the last at or before `p`, and the first after it. A missing end is the
    // element's own value (at 0 and at 100 %).
    let a: Stop | null = null;
    let b: Stop | null = null;
    for (const stop of stops) {
      if (!group.names.some((key) => stop[key] !== undefined)) continue;
      if (stop.at <= clamped) a = stop;
      else {
        b = stop;
        break;
      }
    }
    if (a === null && b === null) continue;
    const from = a === null ? 0 : a.at;
    const to = b === null ? 1 : b.at;
    const local = to > from ? stepped((clamped - from) / (to - from), steps, jump) : 0;
    for (const field of group.fields) {
      const x = a === null ? REST[field] : read(a, field, reach);
      const y = b === null ? REST[field] : read(b, field, reach);
      out[field] = x + (y - x) * local;
    }
  }
  // visibility is not a number: it is shown through the first half and hidden from there, never half there
  if (name === 'blink') out.opacity = stepped(clamped, steps, jump) < 1 ? 1 : 0;
  return out;
}

/**
 * What an element shows when the animation has `phase` of its life behind it: `before` its start,
 * `running` at progress `p`, or `after` its end, with the fill mode deciding what is held outside. What is
 * not held is the element's own state, which is `rest` where it differs from an element left alone.
 */
export function frameFor(name: KeyframeName, phase: 'before' | 'running' | 'after', p: number, reach: Reach = NO_REACH, rest?: Partial<Frame>): Frame {
  'worklet';
  const { fill } = KEYFRAMES[name];
  if (phase === 'before') return fill === 'backwards' || fill === 'both' ? frameAt(name, 0, reach) : { ...REST, ...rest };
  if (phase === 'after') return fill === 'forwards' || fill === 'both' ? frameAt(name, 1, reach) : { ...REST, ...rest };
  return frameAt(name, p, reach);
}

/** The transform functions an effect moves, in the order its stylesheet writes them. */
const TRANSFORMS: Record<KeyframeName, ReadonlyArray<'translateX' | 'translateY' | 'translateXPct' | 'translateYPct' | 'scale' | 'rotate' | 'rotateY' | 'skewX' | 'card'>> = {
  rise: ['translateY'],
  blink: [],
  reveal: [],
  fall: ['translateY', 'rotate'],
  alarm: [],
  fly: ['translateX', 'translateY', 'scale'],
  pop: ['translateY', 'scale'],
  sink: ['scale'],
  spark: ['translateX', 'translateY'],
  medal: ['scale', 'rotateY'],
  tear: ['translateX', 'translateYPct', 'rotate'],
  page: ['scale'],
  light: ['scale'],
  paper: ['rotate', 'scale'],
  glint: ['translateXPct', 'skewX'],
  holo: [],
  legend: ['card'],
};

const DEG = Math.PI / 180;

/**
 * `perspective(600px) rotateY(angle) scale(s)` as one flat matrix (CSS order, column-major as CSS and React Native write
 * it). A real 3D turn is not drawn the web's way on the phone: iOS sorts the layer's turned half behind the box it sits in
 * and hides it (a card seen at 45 degrees shows its left half only). So the turn is made flat: the sideways squeeze
 * of `cos(angle)`, and the perspective as the web's own `w = 1 + x sin(angle) / 600` that the far edge is shrunk by, with
 * no depth left for anything to be sorted by.
 */
export function cardMatrix(angle: number, scale: number): number[] {
  'worklet';
  const a = angle * DEG;
  // what floating point leaves of a sine that is nothing (1e-19) is nothing
  const clean = (v: number) => Math.round(v * 1e12) / 1e12;
  return [clean(scale * Math.cos(a)), 0, 0, clean((scale * Math.sin(a)) / 600), 0, scale, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** One function of an animated transform: a number of points, or a string where the unit is a percent or degrees. */
type Move = Record<string, number | string | number[]>;

/**
 * A frame as a React Native style: its opacity, and the transform of the functions its effect moves (a function
 * the effect does not touch is left out, so nothing is drawn that the stylesheet does not draw). The picture
 * uncovered (`reveal`) is a width in percent of the box that holds it. The rainbow (`holo`) is no style: it is a
 * background sliding, which `holoShift` turns into points for what draws it.
 */
export function styleOf(name: KeyframeName, f: Frame): { opacity: number; transform: Move[]; width?: string } {
  'worklet';
  const transform: Move[] = [];
  for (const fn of TRANSFORMS[name]) {
    if (fn === 'translateX') transform.push({ translateX: f.translateX });
    else if (fn === 'translateY') transform.push({ translateY: f.translateY });
    else if (fn === 'translateXPct') transform.push({ translateX: `${f.translateXPct}%` });
    else if (fn === 'translateYPct') transform.push({ translateY: `${f.translateYPct}%` });
    else if (fn === 'scale') transform.push({ scale: f.scale });
    else if (fn === 'rotate') transform.push({ rotate: `${f.rotate}deg` });
    // A flat thing turned about its vertical axis, seen square on, is squeezed sideways by cos(angle), and mirrored past 90 degrees.
    else if (fn === 'rotateY') transform.push({ scaleX: Math.cos(f.rotateY * DEG) });
    else if (fn === 'skewX') transform.push({ skewX: `${f.skewX}deg` });
    else transform.push({ matrix: cardMatrix(f.rotateY, f.scale) });
  }
  return name === 'reveal' ? { opacity: f.opacity, transform, width: `${f.reveal * 100}%` } : { opacity: f.opacity, transform };
}

/**
 * How far the rainbow's gradient has slid, in points, when the web's `background-position` is `bgX` percent: the gradient is two
 * boxes wide, and a position of p % puts p % of the room left over (the box less the gradient: minus one box) at its left, so
 * 100 % is a whole box to the left and 200 % two, where the repeat of the gradient begins again.
 */
export function holoShift(bgX: number, width: number): number {
  'worklet';
  return -(bgX / 100) * width;
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
