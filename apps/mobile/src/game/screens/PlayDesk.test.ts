import { expect, test, vi } from 'vitest';

// Only the grid's arithmetic is read here: the columns' pieces are the screens' own tests'.
vi.mock('./Finance', () => ({}));
vi.mock('./Hud', () => ({}));
vi.mock('./News', () => ({}));
vi.mock('./Profile', () => ({}));
vi.mock('../context', () => ({}));
vi.mock('../../ui/kit', () => ({}));
vi.mock('../../ui/Page', () => ({}));
vi.mock('../../ui/Sprite', () => ({}));
vi.mock('react-native-safe-area-context', () => ({}));
vi.mock('react-native', () => ({}));
const { deskColumns } = await import('./PlayDesk');

test('a tablet held sideways shares its width as the web\'s grid does: the sides grow to their most, then the round\'s column takes the rest', () => {
  // An iPad Pro 11" held sideways.
  expect(deskColumns(1210)).toEqual({ left: 372, middle: 434, right: 340 });
  // The least a desk is.
  expect(deskColumns(1024)).toEqual({ left: 310, middle: 360, right: 290 });
  // A wide one stops at 1480.
  expect(deskColumns(2000)).toEqual(deskColumns(1480));
});
