import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { KEYFRAMES, REST, cardMatrix, countUpValue, frameAt, frameFor, holoShift, stepped, styleOf, type Frame, type KeyframeName } from './motion';

test('steps(n, end) holds each value to the end of its slice and is 1 at t = 1', () => {
  expect(stepped(0, 4)).toBe(0);
  expect(stepped(0.24, 4)).toBe(0);
  expect(stepped(0.26, 4)).toBe(0.25);
  expect(stepped(0.99, 4)).toBe(0.75);
  expect(stepped(1, 4)).toBe(1);
  expect(stepped(0.26, 4, 'end')).toBe(0.25);
});

test('steps(n, start) jumps at the start of each slice and is 0 only at t = 0', () => {
  expect(stepped(0, 2, 'start')).toBe(0);
  expect(stepped(0.01, 2, 'start')).toBe(0.5);
  expect(stepped(0.5, 2, 'start')).toBe(0.5);
  expect(stepped(0.51, 2, 'start')).toBe(1);
  expect(stepped(1, 2, 'start')).toBe(1);
});

test('KEYFRAMES matches every --animate-* declaration of globals.css', () => {
  const css = readFileSync(new URL('../../../web/src/app/globals.css', import.meta.url), 'utf8');
  const declared = [...css.matchAll(/--animate-([a-z]+):\s*([a-z]+)\s+([\d.]+)s\s+steps\((\d+),\s*(start|end)\)(?:\s+(none|backwards|forwards|both))?(?:\s+(infinite))?;/g)];
  expect(declared.length).toBe(Object.keys(KEYFRAMES).length);
  for (const [, name, frames, secs, steps, jump, fill, infinite] of declared) {
    expect(frames).toBe(name);
    const k = (KEYFRAMES as Record<string, (typeof KEYFRAMES)['rise']>)[name];
    expect(k, name).toBeDefined();
    expect(k.ms, name).toBe(Math.round(Number(secs) * 1000));
    expect(k.steps, name).toBe(Number(steps));
    expect(k.jump, name).toBe(jump);
    expect(k.fill, name).toBe(fill ?? 'none');
    expect(k.loop, name).toBe(infinite === 'infinite');
  }
});

test('rise climbs 8 px and fades in over four steps', () => {
  expect(frameAt('rise', 0)).toMatchObject({ opacity: 0, translateY: 8, scale: 1 });
  expect(frameAt('rise', 0.3)).toMatchObject({ opacity: 0.25, translateY: 6, scale: 1 });
  expect(frameAt('rise', 0.99)).toMatchObject({ opacity: 0.75, translateY: 2, scale: 1 });
  expect(frameAt('rise', 1)).toEqual(REST);
});

test('blink is shown for the first half of its second and hidden for the rest', () => {
  expect(frameAt('blink', 0).opacity).toBe(1);
  expect(frameAt('blink', 0.4).opacity).toBe(1);
  expect(frameAt('blink', 0.5).opacity).toBe(1);
  expect(frameAt('blink', 0.51).opacity).toBe(0);
  expect(frameAt('blink', 0.99).opacity).toBe(0);
});

test('pop jumps and lands, stepping inside each of its three intervals', () => {
  expect(frameAt('pop', 0)).toEqual(REST);
  expect(frameAt('pop', 0.35)).toMatchObject({ opacity: 1, translateY: -6, scale: 1.15 });
  expect(frameAt('pop', 0.7)).toMatchObject({ opacity: 1, translateY: 0, scale: 0.94 });
  expect(frameAt('pop', 1)).toEqual(REST);
  // half way up: three of six steps
  expect(frameAt('pop', 0.35 / 2 + 0.001).translateY).toBeCloseTo(-3);
});

test('sink shrinks to 0.7 at the middle and comes back', () => {
  expect(frameAt('sink', 0)).toEqual(REST);
  expect(frameAt('sink', 0.5)).toMatchObject({ opacity: 0.5, translateY: 0, scale: 0.7 });
  expect(frameAt('sink', 1)).toEqual(REST);
});

test('fill modes decide what is shown before the start and after the end', () => {
  // rise is `backwards`: its first frame before it starts, its own state after
  expect(frameFor('rise', 'before', 0)).toMatchObject({ opacity: 0, translateY: 8, scale: 1 });
  expect(frameFor('rise', 'after', 1)).toEqual(REST);
  // pop has no fill: nothing is held before it starts
  expect(frameFor('pop', 'before', 0)).toEqual(REST);
  expect(frameFor('pop', 'running', 0.35)).toEqual(frameAt('pop', 0.35));
});

test('a count-up runs ease-out cubic from its start to its target and rounds', () => {
  expect(countUpValue(0, 1000, 0)).toBe(0);
  expect(countUpValue(0, 1000, 0.5)).toBe(875);
  expect(countUpValue(0, 1000, 1)).toBe(1000);
  expect(countUpValue(100, 0, 1)).toBe(0);
  expect(countUpValue(0, 10, 2)).toBe(10);
});

// ---------------------------------------------------------------------------------------------------------------
// Every @keyframes of globals.css, read and held against the frames. The stylesheet is the reference: a keyframe
// that moves, or a step that is counted differently, fails here.

const globals = readFileSync(new URL('../../../web/src/app/globals.css', import.meta.url), 'utf8');
const NAMES = Object.keys(KEYFRAMES) as KeyframeName[];

/** The text between the braces of `@keyframes name`. */
function blockOf(name: string): string {
  const start = globals.indexOf(`@keyframes ${name} {`);
  expect(start, `@keyframes ${name}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = globals.indexOf('{', start); i < globals.length; i++) {
    if (globals[i] === '{') depth += 1;
    if (globals[i] === '}' && --depth === 0) return globals.slice(globals.indexOf('{', start) + 1, i);
  }
  throw new Error(`@keyframes ${name} is not closed`);
}

/** The keyframes of a block: each offset a selector names (`from`, `to`, `35%`, `0%, 30%`) with its declarations. */
function cssStops(name: string): Array<{ at: number; decls: Record<string, string> }> {
  const out: Array<{ at: number; decls: Record<string, string> }> = [];
  for (const [, selector, body] of blockOf(name).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
    for (const at of selector.split(',').map((s) => s.trim())) out.push({ at: at === 'from' ? 0 : at === 'to' ? 1 : Number.parseFloat(at) / 100, decls });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** `fn(args)` calls of a transform, with nested parentheses kept inside their argument. */
function calls(value: string): Array<{ fn: string; args: string[] }> {
  const out: Array<{ fn: string; args: string[] }> = [];
  for (let i = 0; i < value.length; ) {
    const open = value.indexOf('(', i);
    if (open < 0) break;
    const fn = value.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    const args: string[] = [];
    let from = j;
    for (; depth > 0; j++) {
      if (value[j] === '(') depth += 1;
      else if (value[j] === ')') depth -= 1;
      else if (value[j] === ',' && depth === 1) {
        args.push(value.slice(from, j).trim());
        from = j + 1;
      }
    }
    args.push(value.slice(from, j - 1).trim());
    out.push({ fn, args });
    i = j;
  }
  return out;
}

const REACH = { dx: 100, dy: 200 };

/** A frame whose named fields are those numbers, give or take what floating point loses on the way. */
function close(frame: Frame, want: Partial<Frame>) {
  for (const [field, value] of Object.entries(want)) expect(frame[field as keyof Frame], field).toBeCloseTo(value as number, 9);
}

/** A length of a transform in the stylesheet: pixels and percent of the box, and how far `--dx`/`--dy` goes into it. */
function length(arg: string, axis: 'x' | 'y') {
  const own = axis === 'x' ? 'dx' : 'dy';
  const calc = /^calc\((.*)\)$/.exec(arg)?.[1] ?? arg;
  const via = new RegExp(`var\\(--(?:d|s)${axis}\\)(?:\\s*\\*\\s*([\\d.]+))?`).exec(calc);
  const px = /(?:^|\s)([+-]?\s*[\d.]+)px/.exec(calc.replace(via?.[0] ?? '', ''));
  const pct = /^(-?[\d.]+)%$/.exec(arg);
  expect(via || px || pct || /^0$/.test(arg), `a length: ${arg}`).toBeTruthy();
  return {
    px: (px ? Number(px[1].replace(/\s/g, '')) : 0) + (via ? Number(via[1] ?? 1) * REACH[own] : 0),
    pct: pct ? Number(pct[1]) : 0,
  };
}

/** What a keyframe's declarations say, as the frame fields they set. */
function named(decls: Record<string, string>): Partial<Frame> {
  const out: Partial<Frame> = {};
  if (decls.opacity !== undefined) out.opacity = Number(decls.opacity);
  if (decls.visibility === 'hidden') out.opacity = 0;
  if (decls['clip-path'] !== undefined) out.reveal = 1 - Number(/inset\(0 ([\d.]+)/.exec(decls['clip-path'])![1]) / 100;
  if (decls['background-position'] !== undefined) out.bgX = Number.parseFloat(decls['background-position']);
  if (decls.transform !== undefined) {
    // a transform names the whole list: what it leaves out is the identity
    Object.assign(out, { translateX: 0, translateY: 0, translateXPct: 0, translateYPct: 0, scale: 1, rotate: 0, rotateY: 0, skewX: 0 });
    for (const { fn, args } of calls(decls.transform)) {
      if (fn === 'translate' || fn === 'translateX' || fn === 'translateY') {
        const [x, y] = fn === 'translateY' ? [undefined, args[0]] : [args[0], args[1]];
        if (x !== undefined) Object.assign(out, { translateX: length(x, 'x').px, translateXPct: length(x, 'x').pct });
        if (y !== undefined) Object.assign(out, { translateY: length(y, 'y').px, translateYPct: length(y, 'y').pct });
      } else if (fn === 'scale') out.scale = Number(args[0]);
      else if (fn === 'rotate') out.rotate = Number.parseFloat(args[0]);
      else if (fn === 'rotateY') out.rotateY = Number.parseFloat(args[0]);
      else if (fn === 'skewX') out.skewX = Number.parseFloat(args[0]);
      else if (fn === 'perspective') expect(Number.parseFloat(args[0])).toBe(600);
      else throw new Error(`a transform the frames do not know: ${fn}`);
    }
  }
  return out;
}

test.each(NAMES)('%s: at every keyframe of the stylesheet the frame is what the stylesheet says', (name) => {
  for (const { at, decls } of cssStops(name)) {
    const frame = frameAt(name, at, REACH);
    for (const [field, want] of Object.entries(named(decls))) {
      expect(frame[field as keyof Frame], `${name} at ${at * 100}%: ${field}`).toBeCloseTo(want as number, 9);
    }
  }
});

test.each(NAMES)('%s: it moves nothing the stylesheet does not name', (name) => {
  const moved = new Set<string>();
  for (const { decls } of cssStops(name)) for (const field of Object.keys(named(decls))) moved.add(field);
  for (let p = 0; p <= 1; p += 1 / 64) {
    const frame = frameAt(name, p, REACH);
    for (const field of Object.keys(REST) as Array<keyof Frame>) {
      if (!moved.has(field)) expect(frame[field], `${name} at ${p}: ${field}`).toBe(REST[field]);
    }
  }
});

test('every keyframe the game plays has its frames', () => {
  for (const name of NAMES) expect(cssStops(name).length, name).toBeGreaterThan(0);
});

test('fall turns once round while it drops 356 px, and is gone at the end, in sixteen steps', () => {
  expect(frameAt('fall', 0)).toMatchObject({ opacity: 1, translateY: -16, rotate: 0 });
  expect(frameAt('fall', 0.5)).toMatchObject({ opacity: 0.5, translateY: -16 + 356 / 2, rotate: 180 });
  // sixteen slices of 100 ms: nothing moves inside one
  expect(frameAt('fall', 0.06)).toEqual(frameAt('fall', 0.0001));
  expect(frameAt('fall', 0.06).translateY).toBe(-16);
  expect(frameAt('fall', 0.0626).translateY).toBeCloseTo(-16 + 356 / 16);
  expect(frameAt('fall', 1)).toMatchObject({ opacity: 0, translateY: 340, rotate: 360 });
});

test('each property steps over the keyframes that name it: a coin flown is still in the air at 90 %, and fades only in the last tenth', () => {
  // opacity names 0, 15, 90 and 100 %; transform names 0, 15, 55 and 100 %: two lists, each stepping in ten
  close(frameAt('fly', 0, REACH), { opacity: 0, translateX: 0, translateY: 0, scale: 0.6 });
  close(frameAt('fly', 0.15, REACH), { opacity: 1, translateX: 10, translateY: 20 - 18, scale: 1 });
  // between 15 and 90 % opacity holds at 1; the transform has gone on to 55 %
  close(frameAt('fly', 0.55, REACH), { opacity: 1, translateX: 55, translateY: 110 - 28, scale: 1 });
  expect(frameAt('fly', 0.89, REACH).opacity).toBe(1);
  // the last tenth: ten steps from 1 to 0, so the first of them lands at 0.9 of the way to the end
  expect(frameAt('fly', 0.9, REACH).opacity).toBe(1);
  expect(frameAt('fly', 0.911, REACH).opacity).toBeCloseTo(0.9);
  // the last 45 % of the transform: ten steps of 4.5 % each
  expect(frameAt('fly', 0.55 + 0.45 / 10 + 0.001, REACH).translateX).toBeCloseTo(55 + 4.5);
  close(frameAt('fly', 1, REACH), { opacity: 0, translateX: 100, translateY: 200, scale: 0.7 });
});

test('a spark flies to its own place and fades out, and a reach of nothing stays where it began', () => {
  expect(frameAt('spark', 0, { dx: 20, dy: -10 })).toMatchObject({ opacity: 1, translateX: 0, translateY: 0 });
  expect(frameAt('spark', 1, { dx: 20, dy: -10 })).toMatchObject({ opacity: 0, translateX: 20, translateY: -10 });
  expect(frameAt('spark', 0.5, { dx: 20, dy: -10 })).toMatchObject({ opacity: 0.5, translateX: 10, translateY: -5 });
  expect(frameAt('spark', 1)).toMatchObject({ translateX: 0, translateY: 0 });
});

test('the medal spins one and a half times to 540 degrees, over-swells at 60 %, and settles at 720', () => {
  expect(frameAt('medal', 0)).toMatchObject({ opacity: 0, scale: 0.2, rotateY: 0 });
  expect(frameAt('medal', 0.6)).toMatchObject({ opacity: 1, scale: 1.12, rotateY: 540 });
  expect(frameAt('medal', 1)).toMatchObject({ opacity: 1, scale: 1, rotateY: 720 });
  // twelve steps in each interval: half way to 60 % is six steps of twelve
  expect(frameAt('medal', 0.3 + 0.001).rotateY).toBeCloseTo(270);
});

test('the torn page waits out 30 %, then drops and turns in nine steps', () => {
  expect(frameAt('tear', 0.3)).toMatchObject({ opacity: 1, translateX: 0, translateYPct: 0, rotate: 0 });
  expect(frameAt('tear', 0.1)).toMatchObject({ opacity: 1, translateX: 0, translateYPct: 0, rotate: 0 });
  // 0.7 of the time left in nine slices: the first lands at 0.3 + 0.7 / 9
  expect(frameAt('tear', 0.3 + 0.7 / 9 - 0.001).rotate).toBe(0);
  close(frameAt('tear', 0.3 + 0.7 / 9 + 0.001), { translateX: 30 / 9, translateYPct: 140 / 9, rotate: 16 / 9 });
  expect(frameAt('tear', 1)).toMatchObject({ opacity: 0, translateX: 30, translateYPct: 140, rotate: 16 });
});

test('the new page appears in the first 12 %, stays to 80 %, and is put away', () => {
  expect(frameAt('page', 0)).toMatchObject({ opacity: 0, scale: 0.9 });
  expect(frameAt('page', 0.12)).toMatchObject({ opacity: 1, scale: 1 });
  expect(frameAt('page', 0.5)).toMatchObject({ opacity: 1, scale: 1 });
  expect(frameAt('page', 0.8)).toMatchObject({ opacity: 1, scale: 1 });
  expect(frameAt('page', 1)).toMatchObject({ opacity: 0, scale: 1 });
});

test('the paper is thrown spinning from -540 degrees, over-turns to 6, and lands flat', () => {
  expect(frameAt('paper', 0)).toMatchObject({ opacity: 0, rotate: -540, scale: 0.15 });
  expect(frameAt('paper', 0.7)).toMatchObject({ opacity: 1, rotate: 6, scale: 1.04 });
  expect(frameAt('paper', 1)).toMatchObject({ opacity: 1, rotate: 0, scale: 1 });
});

test('the glint crosses the card in 35 % of its time, leaves, and waits out of sight', () => {
  expect(frameAt('glint', 0)).toMatchObject({ opacity: 1, translateXPct: -150, skewX: -20 });
  // eighteen steps across the first 35 %: each is 800 / 18 of 650 + 150 percent
  expect(frameAt('glint', 0.35 / 18 + 0.0001).translateXPct).toBeCloseTo(-150 + 800 / 18);
  expect(frameAt('glint', 0.35)).toMatchObject({ opacity: 1, translateXPct: 650 });
  // the next 1 % fades it out, in the same eighteen steps; from 36 % it is off
  expect(frameAt('glint', 0.3555).opacity).toBeCloseTo(1 - 9 / 18);
  expect(frameAt('glint', 0.36)).toMatchObject({ opacity: 0, translateXPct: 650 });
  expect(frameAt('glint', 0.9)).toMatchObject({ opacity: 0, translateXPct: 650 });
});

test('the rainbow slides 200 % of the card in forty steps and begins again', () => {
  expect(frameAt('holo', 0).bgX).toBe(0);
  expect(frameAt('holo', 0.5).bgX).toBe(100);
  expect(frameAt('holo', 0.5 - 0.0001).bgX).toBeCloseTo(95);
  expect(frameAt('holo', 1).bgX).toBe(200);
  expect(KEYFRAMES.holo.loop).toBe(true);
});

test('a legendary card turns over from its back, over-turns past flat, and lands', () => {
  expect(frameAt('legend', 0)).toMatchObject({ opacity: 0, rotateY: 180, scale: 0.6 });
  expect(frameAt('legend', 0.6)).toMatchObject({ opacity: 1, rotateY: -10, scale: 1.05 });
  expect(frameAt('legend', 1)).toMatchObject({ opacity: 1, rotateY: 0, scale: 1 });
});

test('the lamp on the line of a life lights from a quarter to full, in three steps', () => {
  expect(frameAt('light', 0)).toMatchObject({ opacity: 0.25, scale: 0.6 });
  close(frameAt('light', 0.34), { opacity: 0.25 + 0.75 / 3, scale: 0.6 + 0.4 / 3 });
  expect(frameAt('light', 1)).toMatchObject({ opacity: 1, scale: 1 });
});

test('the picture is uncovered from the left in eight steps', () => {
  expect(frameAt('reveal', 0).reveal).toBe(0);
  expect(frameAt('reveal', 0.124).reveal).toBe(0);
  expect(frameAt('reveal', 0.126).reveal).toBe(0.125);
  expect(frameAt('reveal', 1).reveal).toBe(1);
});

test('the alarm lamp dims to 35 % at the middle of a second beat and back, two steps each way, starting at once', () => {
  const at = (p: number) => frameAt('alarm', p).opacity;
  expect(at(0)).toBe(1);
  // steps(2, start) jumps at the beginning of each slice: half way to the dim at once, all the way past a quarter
  expect(at(0.1)).toBeCloseTo(1 - 0.65 / 2);
  expect(at(0.3)).toBeCloseTo(0.35);
  expect(at(0.5)).toBeCloseTo(0.35);
  expect(at(0.6)).toBeCloseTo(0.35 + 0.65 / 2);
  expect(at(0.8)).toBe(1);
});

test('what an effect shows before it starts and after it ends follows its fill', () => {
  // medal is `both`: its first frame while it waits, its last once done
  expect(frameFor('medal', 'before', 0)).toEqual(frameAt('medal', 0));
  expect(frameFor('medal', 'after', 1)).toEqual(frameAt('medal', 1));
  // the glint has no fill: the box's own state outside the run; a caller can name it
  expect(frameFor('glint', 'before', 0)).toEqual(REST);
  expect(frameFor('glint', 'after', 1, undefined, { opacity: 0 })).toEqual({ ...REST, opacity: 0 });
  // fall holds its end (forwards) and has nothing before it
  expect(frameFor('fall', 'after', 1)).toEqual(frameAt('fall', 1));
  expect(frameFor('fall', 'before', 0)).toEqual(REST);
  // a coin flown carries its reach into the frame it holds
  expect(frameFor('fly', 'after', 1, REACH)).toMatchObject({ translateX: 100, translateY: 200 });
});

// ---------------------------------------------------------------------------------------------------------------

test('a frame becomes a style: its opacity and the transform functions its effect moves, in the stylesheet\'s order', () => {
  const keys = (name: KeyframeName) => styleOf(name, frameAt(name, 0.5, REACH)).transform.map((t) => Object.keys(t)[0]);
  expect(keys('rise')).toEqual(['translateY']);
  expect(keys('pop')).toEqual(['translateY', 'scale']);
  expect(keys('sink')).toEqual(['scale']);
  expect(keys('fall')).toEqual(['translateY', 'rotate']);
  expect(keys('fly')).toEqual(['translateX', 'translateY', 'scale']);
  expect(keys('spark')).toEqual(['translateX', 'translateY']);
  expect(keys('medal')).toEqual(['scale', 'scaleX']);
  expect(keys('tear')).toEqual(['translateX', 'translateY', 'rotate']);
  expect(keys('paper')).toEqual(['rotate', 'scale']);
  expect(keys('glint')).toEqual(['translateX', 'skewX']);
  expect(keys('legend')).toEqual(['matrix']);
  expect(keys('page')).toEqual(['scale']);
  expect(keys('light')).toEqual(['scale']);
  for (const name of ['blink', 'alarm', 'reveal'] as const) expect(keys(name), name).toEqual([]);
});

test('angles are degrees, a percent of the box is a percent, a turn about the vertical axis is a squeeze sideways', () => {
  expect(styleOf('glint', frameAt('glint', 0.35))).toEqual({ opacity: 1, transform: [{ translateX: '650%' }, { skewX: '-20deg' }] });
  expect(styleOf('tear', frameAt('tear', 1))).toEqual({ opacity: 0, transform: [{ translateX: 30 }, { translateY: '140%' }, { rotate: '16deg' }] });
  expect(styleOf('fly', frameAt('fly', 1, REACH))).toEqual({ opacity: 0, transform: [{ translateX: 100 }, { translateY: 200 }, { scale: 0.7 }] });
  // the medal at 60 %: scale 1.12 and 540 degrees, which is the back of a thing turned half way again: square on and mirrored
  const medal = styleOf('medal', frameAt('medal', 0.6)).transform;
  expect(medal[0]).toEqual({ scale: 1.12 });
  expect((medal[1] as { scaleX: number }).scaleX).toBeCloseTo(-1, 9);
  expect((styleOf('medal', frameAt('medal', 0.6 * 0.75 + 0.001)).transform[1] as { scaleX: number }).scaleX).toBeCloseTo(Math.cos((405 * Math.PI) / 180), 9);
});

/** The web's `perspective(600px) rotateY(angle) scale(s)` worked out in full, as a browser does: where a point of the card's plane lands on the screen. */
function webCard(angle: number, scale: number, x: number, y: number) {
  const a = (angle * Math.PI) / 180;
  const sx = x * scale;
  const sy = y * scale;
  // rotateY, then the perspective that divides by 1 - z / 600
  const rx = sx * Math.cos(a);
  const rz = -sx * Math.sin(a);
  const w = 1 - rz / 600;
  return { x: rx / w, y: sy / w };
}
/** Where a flat matrix (column-major, as CSS and React Native write it) puts that point. */
function flat(m: number[], x: number, y: number) {
  const w = m[3] * x + m[7] * y + m[15];
  return { x: (m[0] * x + m[4] * y + m[12]) / w, y: (m[1] * x + m[5] * y + m[13]) / w };
}

test('the legendary card turned flat lands every point where the web\'s 3D perspective puts it, for every angle and scale the keyframes pass through', () => {
  for (const [angle, scale] of [[180, 0.6], [90, 0.8], [28, 0.96], [-10, 1.05], [0, 1], [-45, 1.2], [135, 0.7]] as const) {
    const m = cardMatrix(angle, scale);
    for (const [x, y] of [[0, 0], [144, 0], [-144, 0], [144, 100], [-144, -100], [60, -37]]) {
      const want = webCard(angle, scale, x, y);
      const got = flat(m, x, y);
      expect(got.x, `${angle} ${scale} at ${x},${y}`).toBeCloseTo(want.x, 7);
      expect(got.y, `${angle} ${scale} at ${x},${y}`).toBeCloseTo(want.y, 7);
    }
    // and there is no depth left for the phone to sort by
    expect([m[2], m[6], m[10], m[14]]).toEqual([0, 0, 1, 0]);
  }
});

test('the legend style is that matrix and its opacity', () => {
  const frame = frameAt('legend', 0.6);
  expect(styleOf('legend', frame)).toEqual({ opacity: 1, transform: [{ matrix: cardMatrix(-10, 1.05) }] });
  expect(cardMatrix(0, 1)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
});

test('the picture uncovered is a width in percent of the box that holds it', () => {
  expect(styleOf('reveal', frameAt('reveal', 0.5))).toMatchObject({ width: '50%' });
  expect(styleOf('reveal', frameAt('reveal', 0))).toMatchObject({ width: '0%' });
});

test('the rainbow moves no transform: it is how far a background has slid, which a box of a given width turns into points', () => {
  expect(styleOf('holo', frameAt('holo', 0.5))).toEqual({ opacity: 1, transform: [] });
  // the web's `background-position: 100% 0` of an image twice the box's width leaves its left edge a whole box off to the left
  expect(holoShift(0, 288)).toBeCloseTo(0);
  expect(holoShift(100, 288)).toBe(-288);
  expect(holoShift(200, 288)).toBe(-576);
  expect(holoShift(frameAt('holo', 0.5).bgX, 100)).toBe(-100);
});
