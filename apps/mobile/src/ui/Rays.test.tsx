// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { raysOf } from './drawings';
import { COLORS } from './theme';

vi.mock('@shopify/react-native-skia', async () => (await import('./testing/skia')).skiaFake());

const { drawn } = await import('./testing/skia');
const { Rays } = await import('./Rays');

afterEach(cleanup);

test('the rays are gold-900 all over a square canvas and the gold-700 rays of raysOf over it', () => {
  const { container } = render(<Rays size={64} />);
  expect(container.querySelector('[data-skia="Canvas"]')!.getAttribute('data-size')).toBe('64x64');
  expect(drawn(container, 'Fill')[0]).toMatchObject({ color: COLORS['gold-900'] });
  expect(drawn(container, 'Path')[0]).toMatchObject({ path: raysOf(64, 64), color: COLORS['gold-700'] });
});
