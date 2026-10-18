import { describe, expect, it } from 'vitest';
import { BADGE_RARITY } from './rarity';
import { lifePoints, POINTS_BADGES_MAX, POINTS_FINISHED, progressOf, promoted, RANK_FROM, RANKS, rankOf } from './rank';

const usd = (x: number) => x * 100;
const bare = { netWorth: 0, badges: [], escaped: false, challenge: false };

describe('lifePoints', () => {
  it('gives something even for a ruined life', () => {
    expect(lifePoints({ ...bare, netWorth: usd(-50_000) })).toBe(POINTS_FINISHED);
    expect(lifePoints({ ...bare, netWorth: Number.NaN })).toBe(POINTS_FINISHED);
  });
  it('rises with net worth, badges by rarity, the escape and the challenge', () => {
    const base = lifePoints(bare);
    expect(lifePoints({ ...bare, netWorth: usd(1_000_000) })).toBeGreaterThan(lifePoints({ ...bare, netWorth: usd(100_000) }));
    const rare = Object.keys(BADGE_RARITY).find((id) => BADGE_RARITY[id].rarity === 'rare') as string;
    const common = Object.keys(BADGE_RARITY).find((id) => BADGE_RARITY[id].rarity === 'common') as string;
    expect(lifePoints({ ...bare, badges: [rare] })).toBeGreaterThan(lifePoints({ ...bare, badges: [common] }));
    expect(lifePoints({ ...bare, escaped: true })).toBeGreaterThan(base);
    expect(lifePoints({ ...bare, challenge: true })).toBeGreaterThan(base);
  });
  it('counts a badge once and caps what badges give', () => {
    const rare = Object.keys(BADGE_RARITY).find((id) => BADGE_RARITY[id].rarity === 'rare') as string;
    expect(lifePoints({ ...bare, badges: [rare, rare] })).toBe(lifePoints({ ...bare, badges: [rare] }));
    expect(lifePoints({ ...bare, badges: Object.keys(BADGE_RARITY) })).toBe(POINTS_FINISHED + POINTS_BADGES_MAX);
  });
  it('is a whole number', () => {
    expect(Number.isInteger(lifePoints({ ...bare, netWorth: 123456789, badges: ['escaped', 'unknown'], escaped: true, challenge: true }))).toBe(true);
  });
});

describe('ranks', () => {
  it('start at zero and rise in order', () => {
    expect(RANK_FROM[RANKS[0]]).toBe(0);
    for (let i = 1; i < RANKS.length; i += 1) expect(RANK_FROM[RANKS[i]]).toBeGreaterThan(RANK_FROM[RANKS[i - 1]]);
  });
  it('are found at their thresholds', () => {
    expect(rankOf(0)).toBe('sewer');
    expect(rankOf(RANK_FROM.office - 1)).toBe('sewer');
    expect(rankOf(RANK_FROM.office)).toBe('office');
    expect(rankOf(1e9)).toBe('king');
  });
  it('report progress to the next rank', () => {
    const p = progressOf(RANK_FROM.office + 25);
    expect(p).toMatchObject({ rank: 'office', next: 'stock', toNext: RANK_FROM.stock - RANK_FROM.office - 25 });
    expect(p.share).toBeCloseTo(0.25);
    expect(progressOf(RANK_FROM.king + 5)).toMatchObject({ rank: 'king', next: null, toNext: 0, share: 1 });
    expect(progressOf(-5)).toMatchObject({ rank: 'sewer', points: 0 });
  });
  it('know a promotion', () => {
    expect(promoted(RANK_FROM.office - 1, RANK_FROM.office)).toBe(true);
    expect(promoted(0, 10)).toBe(false);
  });
});
