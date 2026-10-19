import { describe, expect, it } from 'vitest';
import { upToDateView } from '@/online/rooms';
import { newer } from '@ratrace/core/game/room';

describe('games on other rules', () => {
  it('tells a game on newer rules from one on older ones', () => {
    const page = { engine: '0.38.0', content: '1.39.0' };
    expect(newer({ engine: '0.38.0', content: '1.40.0' }, page)).toBe(true);
    expect(newer({ engine: '0.39.0', content: '1.30.0' }, page)).toBe(true);
    expect(newer({ engine: '0.36.0', content: '1.37.0' }, page)).toBe(false);
    expect(newer({ engine: '0.38.0', content: '1.39.0' }, page)).toBe(false);
    // Numbers, not text: 0.10 comes after 0.9.
    expect(newer({ engine: '0.10.0', content: '1.0.0' }, { engine: '0.9.0', content: '1.0.0' })).toBe(true);
  });

  it('makes a life shown on older rules whole for this page, changing nothing it was told', () => {
    const old = { round: 3, player: { cityId: 'madrid', cash: 5, life: { lifeId: 'nurse' } } };
    expect(upToDateView(old)).toEqual({ round: 3, player: { cityId: 'madrid', cash: 5, life: { lifeId: 'nurse', workCityId: 'madrid' } } });
    const current = { round: 3, player: { cityId: 'madrid', life: { workCityId: 'london' } } };
    expect(upToDateView(current)).toBe(current);
  });
});
