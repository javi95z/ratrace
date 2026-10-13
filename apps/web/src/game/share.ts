import { worthBars } from './present';

/**
 * The picture of a life, to share. It is laid out on a small grid and drawn four times larger
 * with no smoothing, so it is pixel art like the rest of the game. This file decides what goes
 * where and returns a list of things to draw; the canvas only draws them, which is why the
 * layout can be tested without one.
 */
export const CARD = { w: 270, h: 337, scale: 4 } as const;

export interface ShareInput {
  title: string;
  life: string;
  /** Age and city. */
  where: string;
  /** How the life ended: out of the rat race, or not. */
  outcome: string;
  escaped: boolean;
  /** Sprite id of the portrait. */
  portrait: string;
  scoreLabel: string;
  score: string;
  /** The three parts of the score, with their figures already written. */
  parts: Array<{ label: string; value: string }>;
  netWorthLabel: string;
  netWorth: string;
  /** Net worth in start-of-game cents at the start and after every round. */
  history: number[];
  badgesLabel: string;
  /** Sprite ids of the badges earned in the life. */
  badges: string[];
}

export type DrawOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string; tag?: 'bar' }
  /** A sprite, pixel for pixel on the grid. */
  | { kind: 'sprite'; id: string; x: number; y: number; w: number; h: number }
  /** `y` is the baseline. The drawer shrinks the text if it is wider than `maxWidth`. */
  | { kind: 'text'; text: string; x: number; y: number; size: number; font: 'pixel' | 'sans'; color: string; align: 'left' | 'center' | 'right'; maxWidth: number };

const C = {
  night900: '#0b1022', night800: '#141b33', night700: '#1f2a4d', night600: '#263566', night500: '#3b4f8a',
  wine: '#d1495b', gold: '#f2c14e', goldLight: '#ffe9a8', teal: '#7fd1b9', ink300: '#8b93a7', ink200: '#c9cfdc', cream: '#f4f1e4', ink900: '#1a1c2c',
} as const;

const MARGIN = 12;
const INNER = CARD.w - 2 * MARGIN;
const BADGE = 64;
const MAX_BADGES = 4;

export function shareCard(input: ShareInput): DrawOp[] {
  const ops: DrawOp[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: string, tag?: 'bar') => ops.push({ kind: 'rect', x, y, w, h, color, ...(tag ? { tag } : {}) });
  const text = (value: string, x: number, y: number, size: number, font: 'pixel' | 'sans', color: string, align: 'left' | 'center' | 'right', maxWidth: number) =>
    ops.push({ kind: 'text', text: value, x, y, size, font, color, align, maxWidth });
  const middle = CARD.w / 2;

  // The night, and a pixel frame around it.
  rect(0, 0, CARD.w, CARD.h, C.night800);
  rect(4, 4, CARD.w - 8, 2, C.night900);
  rect(4, CARD.h - 6, CARD.w - 8, 2, C.night900);
  rect(4, 4, 2, CARD.h - 8, C.night900);
  rect(CARD.w - 6, 4, 2, CARD.h - 8, C.night900);

  text(input.title, middle, 24, 15, 'pixel', C.gold, 'center', INNER);

  // Who lived, where, and how it ended.
  rect(MARGIN, 32, BADGE + 4, BADGE + 4, C.night900);
  ops.push({ kind: 'sprite', id: input.portrait, x: MARGIN + 2, y: 34, w: 64, h: 64 });
  const beside = MARGIN + BADGE + 12;
  const besideWidth = CARD.w - MARGIN - beside;
  text(input.life, beside, 52, 15, 'pixel', C.cream, 'left', besideWidth);
  text(input.where, beside, 67, 9, 'sans', C.ink200, 'left', besideWidth);
  text(input.outcome, beside, 84, 9, 'sans', input.escaped ? C.teal : C.ink200, 'left', besideWidth);

  // The score and what it is made of.
  rect(MARGIN, 106, INNER, 78, C.night700);
  text(input.scoreLabel.toUpperCase(), middle, 118, 8, 'pixel', C.ink300, 'center', INNER - 8);
  text(input.score, middle, 150, 34, 'pixel', C.gold, 'center', INNER - 8);
  const gap = 4;
  const partWidth = Math.floor((INNER - 8 - gap * (input.parts.length - 1)) / Math.max(1, input.parts.length));
  input.parts.forEach((part, i) => {
    const x = MARGIN + 4 + i * (partWidth + gap);
    rect(x, 156, partWidth, 24, C.night900);
    text(part.value, x + partWidth / 2, 167, 10, 'pixel', C.cream, 'center', partWidth - 4);
    text(part.label, x + partWidth / 2, 177, 7, 'sans', C.ink300, 'center', partWidth - 4);
  });

  // Net worth, and the graph of a lifetime.
  text(input.netWorthLabel, MARGIN, 198, 8, 'sans', C.ink300, 'left', 150);
  text(input.netWorth, CARD.w - MARGIN, 199, 13, 'pixel', C.gold, 'right', INNER - 154);
  const top = 204;
  const height = 44;
  const { zero, bars } = worthBars(input.history);
  const step = bars.length > 0 ? Math.max(2, Math.floor(INNER / bars.length)) : 0;
  const barWidth = Math.max(1, step - 3);
  const left = MARGIN + Math.floor((INNER - (bars.length * step - (step - barWidth))) / 2);
  const line = Math.min(height - 1, Math.round(zero * height));
  bars.forEach((bar, i) => {
    const tall = bar.h > 0 ? Math.max(2, Math.round(bar.h * height)) : 0;
    // A round in debt hangs under the line; the others stand on it. Neither leaves the graph.
    const y = bar.negative ? line + 1 : Math.max(0, Math.min(Math.round(bar.y * height), line - tall));
    const h = bar.negative ? Math.min(tall, height - (line + 1)) : Math.min(tall, line - y);
    rect(left + i * step, top + y, barWidth, h, bar.negative ? C.wine : i === bars.length - 1 ? C.goldLight : C.gold, 'bar');
  });
  rect(MARGIN, top + line, INNER, 1, C.night500);

  // The badges of the life: four are drawn, and the count says the rest.
  text(`${input.badgesLabel} · ${input.badges.length}`, MARGIN, 262, 8, 'pixel', C.ink300, 'left', INNER);
  // Four badges are a little wider than the room between the margins. They are round, with empty corners,
  // so each may stand four pixels into the next without touching it.
  input.badges.slice(0, MAX_BADGES).forEach((id, i) => {
    ops.push({ kind: 'sprite', id, x: MARGIN + 1 + i * (BADGE - 4), y: 266, w: BADGE, h: BADGE });
  });
  return ops;
}
