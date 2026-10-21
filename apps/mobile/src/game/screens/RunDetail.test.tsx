// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

// The graph of a life is Task 17's `WorthGraph`, ported in another lane; until the lanes were merged RunDetail drew a stub of it in its place.
// Now the two have met, the stub is gone and RunDetail takes the real one: this fails while both are there, or while RunDetail draws the other.
test('the sheet of a past life draws the graph of a life that is there: the real one, or until it lands its stub, never both', () => {
  const real = existsSync(join(here, 'WorthGraph.tsx'));
  const stub = existsSync(join(here, 'WorthGraphStub.tsx'));
  expect(real && stub, 'WorthGraph.tsx and WorthGraphStub.tsx are both here: delete the stub and import the real one in RunDetail').toBe(false);
  expect(real || stub).toBe(true);
  const detail = readFileSync(join(here, 'RunDetail.tsx'), 'utf8');
  expect(detail).toContain(real ? "import { WorthGraph } from './WorthGraph';" : "import { WorthGraph } from './WorthGraphStub';");
});
