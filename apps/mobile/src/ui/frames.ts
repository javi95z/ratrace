/*
 * The web's hard pixel frames (the `frame`, `bevel`, `sunk`, `frame-raised`, `lamp`, `frame-double`
 * and `tab` utilities of apps/web/src/app/globals.css), as the rectangles their box-shadows paint.
 */
import { EDGE, type ColorToken } from './theme';

export type FrameKind = 'frame' | 'bevel' | 'sunk' | 'raised' | 'lamp' | 'double' | 'tab';

/** The colours a frame is drawn in: its outline, its lit edge, its shaded edge, the ring of a double frame. */
export type FrameTone = { frame?: ColorToken; hi?: ColorToken; lo?: ColorToken; ring?: ColorToken };

export const GOLD: FrameTone = { frame: 'gold-900', hi: 'gold-200', lo: 'gold-700' };
export const CREAM: FrameTone = { frame: 'ink-900', hi: 'white', lo: 'ink-200' };
export const WINE: FrameTone = { hi: 'wine-500', lo: 'wine-900' };

/** A rectangle in points, relative to the box's top left; negative values lie outside the box. */
export type Strip = { x: number; y: number; w: number; h: number; color: ColorToken };

const E = EDGE;

/** The four outside strips, each only as long as its side: the corners stay empty. */
const outline = (w: number, h: number, color: ColorToken): Strip[] => [
  { x: 0, y: -E, w, h: E, color },
  { x: 0, y: h, w, h: E, color },
  { x: -E, y: 0, w: E, h, color },
  { x: w, y: 0, w: E, h, color },
];

const top = (w: number, t: number, color: ColorToken): Strip => ({ x: 0, y: 0, w, h: t, color });
const bottom = (w: number, h: number, t: number, color: ColorToken): Strip => ({ x: 0, y: h - t, w, h: t, color });
const left = (h: number, t: number, color: ColorToken): Strip => ({ x: 0, y: 0, w: t, h, color });
const right = (w: number, h: number, t: number, color: ColorToken): Strip => ({ x: w - t, y: 0, w: t, h, color });

/** A ring between `inner` and `outer` points off the box, corners included. */
const ring = (w: number, h: number, inner: number, outer: number, color: ColorToken): Strip[] => {
  const t = outer - inner;
  return [
    { x: -outer, y: -outer, w: w + 2 * outer, h: t, color },
    { x: -outer, y: h + inner, w: w + 2 * outer, h: t, color },
    { x: -outer, y: -inner, w: t, h: h + 2 * inner, color },
    { x: w + inner, y: -inner, w: t, h: h + 2 * inner, color },
  ];
};

/**
 * The strips of a frame round a w x h box, in the order they are drawn: a later strip lies over an
 * earlier one (the reverse of the shadow list in CSS, where the first shadow is on top).
 */
export function stripsOf(kind: FrameKind, w: number, h: number, tone: FrameTone): Strip[] {
  const frame = tone.frame ?? 'night-900';
  const hi = tone.hi ?? 'night-500';
  // First in CSS = on top, so listed here top-first and reversed at the end.
  let css: Strip[];
  switch (kind) {
    case 'frame':
      css = outline(w, h, frame);
      break;
    case 'bevel':
      css = [
        ...outline(w, h, frame),
        top(w, E, hi),
        left(h, E, hi),
        bottom(w, h, E, tone.lo ?? 'night-900'),
        right(w, h, E, tone.lo ?? 'night-900'),
      ];
      break;
    case 'sunk':
      css = [top(w, E, 'night-900'), left(h, E, 'night-900')];
      break;
    case 'raised':
      css = [
        ...outline(w, h, frame),
        top(w, E, hi),
        bottom(w, h, 3, tone.lo ?? 'night-800'),
        { x: E, y: h, w: w - 2 * E, h: 4, color: frame },
      ];
      break;
    case 'lamp':
      css = [top(w, E, hi), bottom(w, h, E, tone.lo ?? 'night-900')];
      break;
    case 'double':
      css = [
        ...ring(w, h, 0, 2, 'night-900'),
        ...ring(w, h, 2, 4, tone.ring ?? 'gold-700'),
        ...ring(w, h, 4, 6, 'night-900'),
      ];
      break;
    case 'tab':
      css = [...outline(w, h, 'night-900'), top(w, E, 'gold-200'), bottom(w, h, E, 'gold-700')];
      break;
  }
  return css.reverse().map((c) => ({ ...c, w: Math.max(0, c.w), h: Math.max(0, c.h) }));
}

/**
 * A strip placed by its distances from the box's edges, so it needs no measuring: along each axis
 * either both insets (it stretches), or one inset and a size.
 */
export type Anchor = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
  color: ColorToken;
};

const A = {
  // outside strips, one per side, as long as the side
  oTop: (c: ColorToken): Anchor => ({ top: -E, height: E, left: 0, right: 0, color: c }),
  oBottom: (c: ColorToken): Anchor => ({ bottom: -E, height: E, left: 0, right: 0, color: c }),
  oLeft: (c: ColorToken): Anchor => ({ left: -E, width: E, top: 0, bottom: 0, color: c }),
  oRight: (c: ColorToken): Anchor => ({ right: -E, width: E, top: 0, bottom: 0, color: c }),
  // inside strips
  iTop: (t: number, c: ColorToken): Anchor => ({ top: 0, height: t, left: 0, right: 0, color: c }),
  iBottom: (t: number, c: ColorToken): Anchor => ({ bottom: 0, height: t, left: 0, right: 0, color: c }),
  iLeft: (t: number, c: ColorToken): Anchor => ({ left: 0, width: t, top: 0, bottom: 0, color: c }),
  iRight: (t: number, c: ColorToken): Anchor => ({ right: 0, width: t, top: 0, bottom: 0, color: c }),
};
const outlineA = (c: ColorToken): Anchor[] => [A.oTop(c), A.oBottom(c), A.oLeft(c), A.oRight(c)];

const ringA = (inner: number, outer: number, color: ColorToken): Anchor[] => {
  const t = outer - inner;
  return [
    { top: -outer, height: t, left: -outer, right: -outer, color },
    { bottom: -outer, height: t, left: -outer, right: -outer, color },
    { left: -outer, width: t, top: -inner, bottom: -inner, color },
    { right: -outer, width: t, top: -inner, bottom: -inner, color },
  ];
};

/** The same strips as `stripsOf`, in the same order, placed without knowing the box's size. */
export function anchorsOf(kind: FrameKind, tone: FrameTone): Anchor[] {
  const frame = tone.frame ?? 'night-900';
  const hi = tone.hi ?? 'night-500';
  let css: Anchor[];
  switch (kind) {
    case 'frame':
      css = outlineA(frame);
      break;
    case 'bevel': {
      const lo = tone.lo ?? 'night-900';
      css = [...outlineA(frame), A.iTop(E, hi), A.iLeft(E, hi), A.iBottom(E, lo), A.iRight(E, lo)];
      break;
    }
    case 'sunk':
      css = [A.iTop(E, 'night-900'), A.iLeft(E, 'night-900')];
      break;
    case 'raised':
      css = [
        ...outlineA(frame),
        A.iTop(E, hi),
        A.iBottom(3, tone.lo ?? 'night-800'),
        { bottom: -4, height: 4, left: E, right: E, color: frame },
      ];
      break;
    case 'lamp':
      css = [A.iTop(E, hi), A.iBottom(E, tone.lo ?? 'night-900')];
      break;
    case 'double':
      css = [...ringA(0, 2, 'night-900'), ...ringA(2, 4, tone.ring ?? 'gold-700'), ...ringA(4, 6, 'night-900')];
      break;
    case 'tab':
      css = [...outlineA('night-900'), A.iTop(E, 'gold-200'), A.iBottom(E, 'gold-700')];
      break;
  }
  return css.reverse();
}

/**
 * Where a box is cut from a frame drawn across several boxes stacked with nothing between them (a panel whose lines are the rows of a list): the top
 * box has the frame's top and sides, a middle one its sides only, the bottom one its sides and bottom. A strip along the top or the bottom edge (one
 * stretched between the left and the right, with a height of its own) belongs to that edge; every other runs down a side, the length of the box, and
 * so meets the same strip of the box above and below it: the boxes stacked draw the one frame.
 */
export type FrameCut = 'top' | 'middle' | 'bottom';

/** The strips of a frame that a box cut from it draws (`FrameCut`). */
export function cutAnchors(anchors: readonly Anchor[], cut: FrameCut): Anchor[] {
  return anchors.filter((a) => {
    const across = a.left !== undefined && a.right !== undefined && a.height !== undefined;
    if (!across) return true;
    const atTop = a.top !== undefined;
    return atTop ? cut === 'top' : cut === 'bottom';
  });
}

/** What an anchored strip covers in a w x h box (the inverse of `anchorsOf`, for tests). */
export function resolveAnchor(a: Anchor, w: number, h: number): Strip {
  const axis = (start: number | undefined, end: number | undefined, size: number | undefined, total: number) => {
    if (start !== undefined && end !== undefined) return [start, Math.max(0, total - start - end)] as const;
    if (start !== undefined && size !== undefined) return [start, size] as const;
    return [total - (end as number) - (size as number), size as number] as const;
  };
  const [x, sw] = axis(a.left, a.right, a.width, w);
  const [y, sh] = axis(a.top, a.bottom, a.height, h);
  return { x, y, w: sw, h: sh, color: a.color };
}
