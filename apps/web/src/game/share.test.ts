import { describe, expect, it } from 'vitest';
import { CARD, shareCard } from './share';
import type { DrawOp, ShareInput } from './share';

const input = (over: Partial<ShareInput> = {}): ShareInput => ({
  title: 'THE RAT RACE',
  life: 'Nurse',
  where: 'Age 62 · Madrid',
  outcome: 'You left the rat race at 46.',
  escaped: true,
  portrait: 'portrait.nurse.58',
  scoreLabel: 'Score',
  score: '364',
  parts: [
    { label: 'Wealth', value: '311' },
    { label: 'Status', value: '53' },
    { label: 'Escape bonus', value: '×1.37' },
  ],
  netWorthLabel: 'Net worth, in the dollars of age 22',
  netWorth: '$1,999,329',
  history: Array.from({ length: 21 }, (_, i) => i * i * 500_000),
  badgesLabel: 'Badges',
  badges: ['badge.first_100k', 'badge.millionaire', 'badge.escaped'],
  ...over,
});

const texts = (ops: DrawOp[]) => ops.filter((op): op is Extract<DrawOp, { kind: 'text' }> => op.kind === 'text');
const sprites = (ops: DrawOp[]) => ops.filter((op): op is Extract<DrawOp, { kind: 'sprite' }> => op.kind === 'sprite');
const rects = (ops: DrawOp[]) => ops.filter((op): op is Extract<DrawOp, { kind: 'rect' }> => op.kind === 'rect');

describe('the share card', () => {
  it('is a 1080 by 1350 picture drawn from a grid four times smaller', () => {
    expect(CARD.w * CARD.scale).toBe(1080);
    expect(Math.round(CARD.h * CARD.scale)).toBe(1348);
    expect(Number.isInteger(CARD.scale)).toBe(true);
  });

  it('says who lived, how it ended, and the score with its three parts', () => {
    const said = texts(shareCard(input())).map((op) => op.text);
    for (const line of ['THE RAT RACE', 'Nurse', 'Age 62 · Madrid', 'You left the rat race at 46.', 'SCORE', '364', 'Wealth', '311', 'Status', '53', 'Escape bonus', '×1.37', '$1,999,329', 'Net worth, in the dollars of age 22']) {
      expect(said, line).toContain(line);
    }
  });

  it('draws the portrait and the badges pixel for pixel, at their own size', () => {
    const drawn = sprites(shareCard(input()));
    expect(drawn.map((op) => op.id)).toEqual(['portrait.nurse.58', 'badge.first_100k', 'badge.millionaire', 'badge.escaped']);
    for (const op of drawn) expect([op.w, op.h]).toEqual([64, 64]);
  });

  it('shows four badges at most, and says how many there are', () => {
    const many = shareCard(input({ badges: Array.from({ length: 9 }, (_, i) => `badge.b${i}`) }));
    expect(sprites(many).filter((op) => op.id.startsWith('badge.')).map((op) => op.id)).toEqual(['badge.b0', 'badge.b1', 'badge.b2', 'badge.b3']);
    expect(texts(many).map((op) => op.text)).toContain('Badges · 9');
    const none = shareCard(input({ badges: [] }));
    expect(sprites(none).map((op) => op.id)).toEqual(['portrait.nurse.58']);
    expect(texts(none).map((op) => op.text)).toContain('Badges · 0');
  });

  it('draws one bar for every round of the life, gold above the line and red below', () => {
    const bars = (history: number[]) => rects(shareCard(input({ history }))).filter((op) => op.tag === 'bar');
    expect(bars(input().history)).toHaveLength(21);
    const mixed = bars([-100, 0, 300]);
    expect(mixed.map((bar) => bar.color)).toEqual(['#d1495b', '#f2c14e', '#ffe9a8']);
    // The red one hangs below the others' feet.
    expect(mixed[0].y).toBeGreaterThanOrEqual(mixed[2].y + mixed[2].h);
    expect(mixed[1].h).toBe(0);
  });

  it('keeps everything inside the picture, and every text inside the width it was given', () => {
    for (const card of [shareCard(input()), shareCard(input({ life: 'A very long name for a life that goes on', badges: [], history: [5] })), shareCard(input({ history: [] }))]) {
      for (const op of card) {
        if (op.kind === 'text') {
          const left = op.align === 'left' ? op.x : op.align === 'right' ? op.x - op.maxWidth : op.x - op.maxWidth / 2;
          expect(left, op.text).toBeGreaterThanOrEqual(0);
          expect(left + op.maxWidth, op.text).toBeLessThanOrEqual(CARD.w);
          expect(op.y - op.size, op.text).toBeGreaterThanOrEqual(0);
          expect(op.y, op.text).toBeLessThanOrEqual(CARD.h);
        } else {
          expect(op.x, op.kind).toBeGreaterThanOrEqual(0);
          expect(op.y, op.kind).toBeGreaterThanOrEqual(0);
          expect(op.x + op.w, op.kind).toBeLessThanOrEqual(CARD.w);
          expect(op.y + op.h, op.kind).toBeLessThanOrEqual(CARD.h);
        }
      }
    }
  });

  it('uses only colours of the palette, and whole pixels', () => {
    const PALETTE = ['#0b1022', '#141b33', '#1f2a4d', '#263566', '#3b4f8a', '#d1495b', '#f2c14e', '#ffe9a8', '#7fd1b9', '#8b93a7', '#c9cfdc', '#f4f1e4', '#1a1c2c'];
    for (const op of shareCard(input())) {
      if (op.kind !== 'sprite') expect(PALETTE, `${op.kind} ${op.color}`).toContain(op.color);
      if (op.kind !== 'text') for (const n of [op.x, op.y, op.w, op.h]) expect(Number.isInteger(n), JSON.stringify(op)).toBe(true);
    }
  });

  it('paints the background first, so nothing is hidden under it', () => {
    const first = shareCard(input())[0];
    expect(first).toMatchObject({ kind: 'rect', x: 0, y: 0, w: CARD.w, h: CARD.h });
  });
});
