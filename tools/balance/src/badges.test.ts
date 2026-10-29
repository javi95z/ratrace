import { BADGE_RARITY, badges, content, lives, RARITY_BANDS } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { slow } from './slow';
import { badgeShares } from './badges';
import { bots } from '@ratrace/content';
import { seedsFor } from './simulate';

/**
 * The rarity of each badge against how often the balance bots earn it, over every life. The bots
 * are not players, so each band is given some room either way; a badge that drifts out of it has
 * changed in difficulty, and its rarity should be looked at again. Rarities that are judgements
 * (what the bots never try) are not measured.
 */
describe('the rarity of the badges', () => {
  it('matches how often each is earned, give or take', { timeout: slow(300_000) }, () => {
    const shares = badgeShares(content, lives, seedsFor(6), bots);
    const room: Record<string, [number, number]> = {
      common: [RARITY_BANDS.common[0] - 10, 100],
      uncommon: [RARITY_BANDS.uncommon[0] - 5, RARITY_BANDS.uncommon[1] + 10],
      rare: [RARITY_BANDS.rare[0] - 1.5, RARITY_BANDS.rare[1] + 5],
      legendary: [0, RARITY_BANDS.legendary[1] + 2],
    };
    const outside = badges
      .filter((badge) => BADGE_RARITY[badge.id]?.judged !== true)
      .map((badge) => ({ id: badge.id, rarity: BADGE_RARITY[badge.id].rarity, share: shares[badge.id] ?? 0 }))
      .filter(({ rarity, share }) => share < room[rarity][0] || share > room[rarity][1]);
    expect(outside).toEqual([]);
  });

  it('gives every badge a rarity, and every rarity a badge', () => {
    for (const rarity of Object.keys(RARITY_BANDS)) expect(badges.some((badge) => BADGE_RARITY[badge.id]?.rarity === rarity), rarity).toBe(true);
    expect(badges.filter((badge) => !(BADGE_RARITY[badge.id]?.rarity in RARITY_BANDS)).map((badge) => badge.id)).toEqual([]);
    expect(Object.keys(BADGE_RARITY).filter((id) => !badges.some((badge) => badge.id === id))).toEqual([]);
  });
});
