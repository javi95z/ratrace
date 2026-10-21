// @vitest-environment jsdom
import { MAP_ART, MAP_PLACES } from '@ratrace/content';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { spriteOf } from '../../ui/sprites';
import { COLORS } from '../../ui/theme';
import { LifeMap, routeLights, routeOf } from './LifeMap';

afterEach(cleanup);

describe('the way a life went', () => {
  it('starts where the life does and follows every move, once each step (the web\'s milestones test)', () => {
    expect(routeOf('nurse', [{ round: 2, kind: 'moved', cityId: 'london' }, { round: 5, kind: 'moved', cityId: 'madrid' }])).toEqual(['madrid', 'london', 'madrid']);
    expect(routeOf('nurse', [])).toEqual(['madrid']);
    // A move to where the life already is is no step.
    expect(routeOf('nurse', [{ round: 2, kind: 'moved', cityId: 'madrid' }])).toEqual(['madrid']);
    expect(routeOf('nobody', [])).toEqual([]);
  });
});

describe('the map of a life', () => {
  const map = spriteOf(MAP_ART)!;
  const ratio = map.h / map.w;

  it('draws the web\'s gold dashed line from city to city, in the units of its picture (a hundredth of its width)', () => {
    const places = [MAP_PLACES.madrid, MAP_PLACES.london];
    const width = 350;
    const unit = width / 100;
    const { line } = routeLights(places, width, ratio);
    expect(line).toEqual({
      path: `M${places[0].x * width} ${places[0].y * width * ratio} L${places[1].x * width} ${places[1].y * width * ratio}`,
      strokeWidth: 0.6 * unit,
      dash: [1.2 * unit, 0.8 * unit],
      color: COLORS['gold-500'],
    });
    // One city lived in is a light and no line.
    expect(routeLights([MAP_PLACES.madrid], width, ratio).line).toBeNull();
  });

  it('lights each city lived in, the last the brightest and the largest, each outlined in the night', () => {
    const places = [MAP_PLACES.madrid, MAP_PLACES.london, MAP_PLACES.new_york];
    const width = 200;
    const unit = width / 100;
    const { lights } = routeLights(places, width, ratio);
    expect(lights).toHaveLength(3);
    expect(lights[0]).toEqual({ x: places[0].x * width - 0.9 * unit, y: places[0].y * width * ratio - 0.9 * unit, size: 1.8 * unit, fill: COLORS['gold-500'], edge: COLORS['night-900'], edgeWidth: 0.3 * unit });
    expect(lights[2]).toMatchObject({ x: places[2].x * width - 1.4 * unit, size: 2.8 * unit, fill: COLORS.cream });
  });

  it('is a picture with the route in words, and nothing where the life lived in no city the map knows', () => {
    render(<LifeMap route={['madrid', 'london']} label="A map of the world with your route: Madrid, London" />);
    const figure = screen.getByRole('img', { name: 'A map of the world with your route: Madrid, London' });
    // As wide as there is room, up to the map's own size, the map's shape kept: its pixels square at any width.
    expect(figure.style.maxWidth).toBe(`${map.w}px`);
    cleanup();
    const { container } = render(<LifeMap route={['atlantis']} label="nowhere" />);
    expect(container.innerHTML).toBe('');
  });
});
