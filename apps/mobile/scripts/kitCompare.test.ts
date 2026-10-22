import { expect, test } from 'vitest';
import { blendedEdges, differences, groundOf, inkOf, PENDING_SECTIONS, PHASE_2_SECTIONS, PHASE_3_SECTIONS, reportFolder, SECTIONS, textSummary, verdictOf, wrongPage, type Image, type Result } from './kitCompare';

const NIGHT = [0x14, 0x1b, 0x33];
const GOLD = [0xf2, 0xc1, 0x4e];

/** A w x h image of night with gold columns at `golds`. */
function image(w: number, h: number, golds: number[]): Image {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...(golds.includes(x) ? GOLD : NIGHT), 255], (y * w + x) * 4);
  return { width: w, height: h, data };
}

test('an edge a device pixel off is not beyond; a point (3 device pixels) off it is beyond but not loose; further it is loose', () => {
  const web = image(20, 4, [5, 6, 7]);
  expect(differences(web, image(20, 4, [5, 6, 7]), 0, 4).raw).toBe(0);
  const one = differences(web, image(20, 4, [6, 7, 8]), 0, 4);
  expect(one.raw).toBeGreaterThan(0);
  expect(one.beyond).toBe(0);
  const three = differences(web, image(20, 4, [8, 9, 10]), 0, 4);
  expect(three.beyond).toBeGreaterThan(0);
  expect(three.loose).toBe(0);
  expect(differences(web, image(20, 4, [12, 13, 14]), 0, 4).loose).toBeGreaterThan(0);
});

test('a line on its own small fill (a Tag) is measured by its glyphs, not by the window round it', () => {
  // 30 × 30 device pixels of ground; a teal tag from (5, 10) to (25, 20); cream glyphs from (9, 12) to (21, 18).
  const TEAL = [0x1f, 0x6f, 0x66];
  const CREAM = [0xf4, 0xf1, 0xe4];
  const draw = (dx: number): Image => {
    const w = 30;
    const data = new Uint8Array(w * w * 4);
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const tag = x >= 5 && x < 25 && y >= 10 && y < 20;
        const glyph = x >= 9 + dx && x < 21 + dx && y >= 12 && y < 18 && (x + y) % 2 === 0;
        data.set([...(glyph ? CREAM : tag ? TEAL : NIGHT), 255], (y * w + x) * 4);
      }
    }
    return { width: w, height: w, data };
  };
  // The line's box (in points, at 1×) is the tag's inside; the window looked in reaches past the tag onto the ground.
  const box = { x: 7, y: 11, w: 16, h: 8, text: '+120 $', color: CREAM as [number, number, number], opacity: 1 };
  const same = inkOf(draw(0), draw(0), [box], 1, 0, 30);
  expect(same.checks[0].web).toEqual([9, 12, 21, 18]);
  expect(same.checks[0].unmeasured).toBeUndefined();
  // The mask is the glyphs and a pixel round them, never the tag's whole window.
  expect(same.mask[5 * 30 + 15]).toBe(0);
  expect(same.mask[15 * 30 + 6]).toBe(0);
  const moved = inkOf(draw(0), draw(2), [box], 1, 0, 30);
  expect(moved.checks[0].apart).toBe(2);
});

test('ink in another line\'s box is that line\'s where the two share a colour, and this one\'s where they do not (a descender over the line under it)', () => {
  const CREAM = [0xf4, 0xf1, 0xe4];
  // 20 × 20 at 1×: a gold line in rows 2–9 whose descender goes on to row 11, over a line whose box starts at row 9 (cream glyphs in rows 12–16).
  const w = 20;
  const data = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const gold = x >= 4 && x < 8 && y >= 2 && y < 12;
      const cream = x >= 4 && x < 14 && y >= 12 && y < 17;
      data.set([...(gold ? GOLD : cream ? CREAM : NIGHT), 255], (y * w + x) * 4);
    }
  }
  const img = { width: w, height: w, data };
  const name = { x: 3, y: 1, w: 6, h: 9, text: 'name', color: GOLD as [number, number, number], opacity: 1 };
  const under = { x: 3, y: 9, w: 12, h: 9, text: 'under', color: CREAM as [number, number, number], opacity: 1 };
  const { checks, mask } = inkOf(img, img, [name, under], 1, 0, 20);
  // The descender (rows 9–11, in the other's box) is the gold line's ink, and masked as a glyph's.
  expect(checks[0].web).toEqual([4, 2, 8, 12]);
  expect(mask[11 * w + 5]).toBe(1);
  // Two lines of one colour: the other's box is the other's.
  const twin = { ...under, color: GOLD as [number, number, number] };
  expect(inkOf(img, img, [name, twin], 1, 0, 20).checks[0].web).toEqual([4, 2, 8, 9]);
  // A grey line beside a cream one: the cream glyphs' edges, a blend of cream and the ground, may be grey, so the other's box is the other's.
  const GREY = [0x8b, 0x93, 0xa7] as [number, number, number];
  const blended = new Uint8Array(data);
  for (let x = 4; x < 8; x++) for (const y of [9, 10, 11]) blended.set([...GREY, 255], (y * w + x) * 4);
  const greyName = { ...name, color: GREY };
  expect(inkOf({ width: w, height: w, data: blended }, { width: w, height: w, data: blended }, [greyName, under], 1, 0, 20).checks[0].web).toBeNull();
  // Two rects of one line (its words, and the ellipsis that cuts them short) are one line's: neither keeps the other's ink from it.
  expect(inkOf(img, img, [name, { ...name, x: 3, w: 2 }], 1, 0, 20).checks[0].web).toEqual([4, 2, 8, 12]);
  // The next line of the same words (a paragraph that wraps) is a line of its own: its box is its own.
  expect(inkOf(img, img, [name, { ...name, y: 9 }], 1, 0, 20).checks[0].web).toEqual([4, 2, 8, 9]);
  // A line of the same colour that something is drawn over (the page under a fixed bar) claims nothing of what is drawn over it.
  expect(inkOf(img, img, [name, { ...twin, covered: true }], 1, 0, 20).checks[0].web).toEqual([4, 2, 8, 12]);
});

test('ink that fills its whole window is reported unmeasured, not as text in place', () => {
  const w = 10;
  const data = new Uint8Array(w * w * 4);
  for (let i = 0; i < w * w; i++) data.set([...GOLD, 255], i * 4);
  const img = { width: w, height: w, data };
  const { checks } = inkOf(img, img, [{ x: 3, y: 4, w: 4, h: 2, text: 'x', color: GOLD as [number, number, number], opacity: 1 }], 1, 0, 10);
  expect(checks[0].unmeasured).toBe(true);
});

test('a dot on the ground is ground; a night-700 fill, the dot\'s colour, is ground only where a dot would be', () => {
  const w = 36;
  const fill = new Uint8Array(w * w * 4);
  for (let i = 0; i < w * w; i++) fill.set([0x1f, 0x2a, 0x4d, 255], i * 4);
  const g = groundOf({ width: w, height: w, data: fill });
  // The middle of the first 18-pixel tile is a dot's place; its corner is not.
  expect(g[9 * w + 9]).toBe(1);
  expect(g[0]).toBe(0);
  // A disc of radius 4 device pixels in each 18 × 18 tile: about a sixth of a fill, never the whole of it.
  expect(g.reduce((n, v) => n + v, 0) / g.length).toBeLessThan(0.2);
  // Plain night-800 is ground everywhere.
  expect(groundOf(image(w, w, [])).every((v) => v === 1)).toBe(true);
});

test('a section\'s picture and numbers go to the report of the phase that added it: phase 1\'s files are not touched by a phase 2 shot', () => {
  expect(reportFolder('buttons')).toBe('phase-1-parity');
  expect(reportFolder('dots')).toBe('phase-1-parity');
  expect(reportFolder('motion-2')).toBe('phase-2-parity');
  expect([...PHASE_2_SECTIONS]).toEqual(['motion-2']);
  for (const section of PHASE_2_SECTIONS) expect(SECTIONS).toContain(section);
  // phase 1 is the 14 sections it shot
  expect(SECTIONS.filter((s) => reportFolder(s) === 'phase-1-parity')).toHaveLength(14);
  // phase 3's text fields go beside phase 3's scenes
  expect(reportFolder('forms')).toBe('phase-3-parity');
  expect([...PHASE_3_SECTIONS]).toEqual(['forms']);
  for (const section of PHASE_3_SECTIONS) expect(SECTIONS).toContain(section);
});

test('a section waits for its batch pass, unjudged, until it is shot: phase 3\'s forms', () => {
  expect([...PENDING_SECTIONS]).toEqual(['forms']);
  for (const section of PENDING_SECTIONS) expect(SECTIONS).toContain(section);
});

test('an edge one shot blends and the other draws hard is told from a colour that is simply not there', () => {
  const MID = [0x80, 0x78, 0x42];
  const RED = [0xff, 0x00, 0x00];
  /** A 40 x 4 image: night, a gold run from 10 to 14, and `edge` in column 15 (a partly covered pixel, or a wrong colour). */
  const strip = (edge: number[] | null): Image => {
    const img = image(40, 4, [10, 11, 12, 13, 14]);
    if (edge) for (let y = 0; y < 4; y++) img.data.set([...edge, 255], (y * 40 + 15) * 4);
    return img;
  };
  // the web antialiases its edge at a fractional place, the app's is hard: the pixel between is half gold, half night
  const blended = strip(MID);
  const hard = strip(null);
  const d = differences(blended, hard, 0, 4);
  expect(d.loose).toBeGreaterThan(0);
  const found = blendedEdges(blended, hard, d.map);
  expect(found.of).toBeGreaterThan(0);
  expect(found.explained).toBe(found.of);
  // a colour that neither shot has anywhere near is no blend of two that are there
  const odd = strip(RED);
  const e = differences(odd, hard, 0, 4);
  const not = blendedEdges(odd, hard, e.map);
  expect(not.of).toBeGreaterThan(0);
  expect(not.explained).toBe(0);
});

/** A result of a comparison with the numbers a verdict is made of; the rest is what it needs to be one. */
const resultOf = (over: Partial<Result> = {}): Result => ({
  section: 'buttons',
  rawPercent: 2.67,
  beyondPercent: 0.2,
  beyond: 10,
  loosePercent: 0.1,
  loose: 5,
  beyondPlain: 12,
  loosePlain: 6,
  shape: 0,
  texts: [
    { text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 0.67 },
    { text: 'b', web: null, app: null, apart: 0, unmeasured: true },
  ],
  places: [],
  crop: [62, 400],
  ...over,
});

test('half the screen unlike is the app showing something else, not a difference to list: the same guard for the kit and the scenes', () => {
  expect(wrongPage(resultOf({ rawPercent: 50 }), 'kit', '/x/app.png')).toBeNull();
  const message = wrongPage(resultOf({ section: 'home-new', rawPercent: 66.99 }), 'scene', '/x/app.png');
  expect(message).toBe('home-new: the app\'s shot is not the scene (67 % unlike); look at /x/app.png');
  expect(wrongPage(resultOf({ section: 'tabs', rawPercent: 51 }), 'kit', '/y.png')).toBe('tabs: the app\'s shot is not the kit (51 % unlike); look at /y.png');
});

test('the text of a comparison is told in three numbers: the lines measured, those found in one shot only, and how far apart the rest stand', () => {
  expect(textSummary(resultOf())).toEqual({ lines: 2, unmeasured: 1, oneSided: 0, worstPt: 0.67 });
  const texts = [
    { text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 1.5 },
    { text: 'b', web: [0, 0, 1, 1], app: null, apart: Infinity },
    { text: 'c', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 0.25 },
  ] as Result['texts'];
  expect(textSummary(resultOf({ texts }))).toEqual({ lines: 3, unmeasured: 0, oneSided: 1, worstPt: 1.5 });
});

test('a comparison is clean when no shape differs, no text is in one shot only, and every line stands within a point; the wrong page is told first', () => {
  expect(verdictOf(resultOf())).toBe('clean');
  expect(verdictOf(resultOf({ shape: 1 }))).toBe('differs');
  expect(verdictOf(resultOf({ texts: [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 1.01 }] }))).toBe('differs');
  expect(verdictOf(resultOf({ texts: [{ text: 'a', web: [0, 0, 1, 1], app: null, apart: Infinity }] }))).toBe('differs');
  expect(verdictOf(resultOf({ rawPercent: 76, shape: 0 }))).toBe('wrong page');
});
