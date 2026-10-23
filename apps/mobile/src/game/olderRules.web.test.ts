import type { OlderRules } from '@ratrace/core/session/legacy';
import { expect, test, vi } from 'vitest';
import { loadBundledRules } from './olderRules.web';

/*
 * On the web the older rules come from the site, as the Next web has them (session/rulesFromSite): the file next to the page,
 * imported by the browser, so the bundle of the app carries none of them.
 */

test("the rules asked for are the site's file for that engine and content, and the module it answers is what comes back", async () => {
  const module = { ENGINE_VERSION: '0.40.0', CONTENT_VERSION: '1.41.0' } as unknown as OlderRules;
  const load = vi.fn(async () => module);
  const rules = await loadBundledRules({ engine: '0.40.0', content: '1.41.0' }, load);
  expect(load).toHaveBeenCalledExactlyOnceWith('/rules/v0.40.0-1.41.0.js');
  expect(rules).toBe(module);
});

test('rules the site cannot give wait, kept: unreachable, whether the file is missing, the site late or the module broken', async () => {
  for (const failure of [new TypeError('Failed to fetch dynamically imported module'), new SyntaxError('Unexpected token'), 'offline']) {
    const load = vi.fn(async () => {
      throw failure;
    });
    expect(await loadBundledRules({ engine: '0.40.0', content: '1.41.0' }, load)).toBe('unreachable');
  }
});

test('without a loader of its own it asks the browser for the import, and a failure there is unreachable too', async () => {
  // jsdom has no dynamic import of a site address: whatever goes wrong is a life kept, never lost.
  expect(await loadBundledRules({ engine: '0.0.1', content: '0.0.1' })).toBe('unreachable');
});
