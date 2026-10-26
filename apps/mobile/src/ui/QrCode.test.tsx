import { expect, it } from 'vitest';
import { qrRuns } from './QrCode';

it('encodes a friend\'s link as a QR code: its three finders in their corners, each row\'s dark modules in runs', () => {
  const { size, rows } = qrRuns('https://ratrace-plum.vercel.app/es/rankings?tab=friends&friend=ABCD2345');
  // A code of version 4 or more (17 + 4 × version modules a side) for a link this long.
  expect(size).toBeGreaterThanOrEqual(33);
  expect((size - 17) % 4).toBe(0);
  expect(rows).toHaveLength(size);
  // The finders' top edges: seven dark modules at the top left and right, and at the top of the bottom left.
  expect(rows[0]).toContainEqual([0, 7]);
  expect(rows[0]).toContainEqual([size - 7, 7]);
  expect(rows[size - 7]).toContainEqual([0, 7]);
  // Runs never touch: two runs side by side would be one.
  for (const runs of rows) for (let at = 1; at < runs.length; at += 1) expect(runs[at][0]).toBeGreaterThan(runs[at - 1][0] + runs[at - 1][1]);
});
