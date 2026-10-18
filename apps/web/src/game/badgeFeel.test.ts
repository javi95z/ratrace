import { badges, BADGE_RARITY, rarityOf } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { SCORE } from '@/ui/sound';
import type { Cue } from '@/ui/sound';
import { badgeCue, cuesFor } from './sound';
import type { Heard } from './sound';

const ofRarity = (rarity: string) => badges.find((badge) => rarityOf(badge.id) === rarity)!.id;

describe('the sound of a badge', () => {
  it('rings the rarest tier among the badges earned together', () => {
    expect(badgeCue([ofRarity('common')])).toBe('badge');
    expect(badgeCue([ofRarity('common'), ofRarity('uncommon')])).toBe('badgeUncommon');
    expect(badgeCue([ofRarity('uncommon'), ofRarity('rare'), ofRarity('common')])).toBe('badgeRare');
    expect(badgeCue([ofRarity('rare'), ofRarity('legendary')])).toBe('badgeLegendary');
  });

  it('has a longer cue for each rarer tier, none beyond two seconds', () => {
    const length = (cue: Cue) => Math.max(...SCORE[cue].map((note) => note.at + note.for));
    const tiers: Cue[] = ['badge', 'badgeUncommon', 'badgeRare', 'badgeLegendary'];
    for (let i = 1; i < tiers.length; i++) expect(length(tiers[i])).toBeGreaterThan(length(tiers[i - 1]));
    expect(length('badgeLegendary')).toBeLessThanOrEqual(2);
  });

  it('plays the tier of the badge when one is earned in a step', () => {
    const base = { stage: 'outcome', view: {}, resolved: null, orders: [], refusal: null, earned: [], story: [] } as unknown as Heard;
    const after = { ...base, earned: [ofRarity('legendary')] };
    expect(cuesFor(after, base)).toContain('badgeLegendary');
  });

  it('keeps every judged badge a secret that the collection can hint at by group', () => {
    const judged = badges.filter((badge) => BADGE_RARITY[badge.id]?.judged);
    expect(judged.length).toBeGreaterThan(0);
    for (const badge of judged) expect(badge.group).toBeTruthy();
  });
});
