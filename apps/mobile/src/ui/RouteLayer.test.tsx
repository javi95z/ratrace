// @vitest-environment jsdom
import { MAP_PLACES } from '@ratrace/content';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { routeLights } from './drawings';
import { COLORS } from './theme';

vi.mock('@shopify/react-native-skia', async () => (await import('./testing/skia')).skiaFake());

const { drawn } = await import('./testing/skia');
const { RouteLayer } = await import('./RouteLayer');

afterEach(cleanup);

const places = [MAP_PLACES.madrid, MAP_PLACES.london, MAP_PLACES.new_york];

test('it draws the dashed gold line, then each light filled and outlined before the next, from routeLights', () => {
  const { container } = render(<RouteLayer places={places} width={350} ratio={0.5} />);
  const { line, lights } = routeLights(places, 350, 0.5);
  expect(drawn(container, 'Path')).toHaveLength(1);
  expect(drawn(container, 'Path')[0]).toMatchObject({ path: line!.path, style: 'stroke', strokeWidth: line!.strokeWidth, strokeJoin: 'round', color: COLORS['gold-500'] });
  expect(drawn(container, 'DashPathEffect')[0]).toMatchObject({ intervals: line!.dash });
  const rects = drawn(container, 'Rect');
  expect(rects).toHaveLength(2 * lights.length);
  expect(rects[0]).toMatchObject({ x: lights[0].x, y: lights[0].y, width: lights[0].size, height: lights[0].size, color: lights[0].fill });
  expect(rects[1]).toMatchObject({ x: lights[0].x, style: 'stroke', strokeWidth: lights[0].edgeWidth, color: COLORS['night-900'] });
});

test('a life lived in one city is a light and no line', () => {
  const { container } = render(<RouteLayer places={[MAP_PLACES.madrid]} width={350} ratio={0.5} />);
  expect(drawn(container, 'Path')).toEqual([]);
  expect(drawn(container, 'Rect')).toHaveLength(2);
});
