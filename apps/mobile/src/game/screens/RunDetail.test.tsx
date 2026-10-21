// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

// The graph of a life is Task 17's `WorthGraph`, ported in another lane; until the lanes were merged RunDetail drew a stub of it in its place.
// Now the two have met: the real graph is here, the stub is gone, and RunDetail draws the real one. This fails if the stub ever comes back.
test('the sheet of a past life draws the real graph of a life, never a stub of it', () => {
  expect(existsSync(join(here, 'WorthGraph.tsx')), 'WorthGraph.tsx').toBe(true);
  expect(existsSync(join(here, 'WorthGraphStub.tsx')), 'WorthGraphStub.tsx is back: delete it and draw the real graph').toBe(false);
  const detail = readFileSync(join(here, 'RunDetail.tsx'), 'utf8');
  expect(detail).toContain("import { WorthGraph } from './WorthGraph';");
  expect(detail).not.toContain('WorthGraphStub');
});
