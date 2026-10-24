// @vitest-environment jsdom
import { MAP_ART } from '@ratrace/content';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { spriteOf } from '@/ui/Sprite';
import { LifeMap } from './LifeMap';

afterEach(cleanup);

describe('the map of a life', () => {
  it('draws the world from where the sprites are served, not from a path relative to the page', () => {
    const { container } = render(<LifeMap route={['madrid', 'london']} label="map" />);
    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe(`/sprites/${spriteOf(MAP_ART)?.src}`);
  });
});
