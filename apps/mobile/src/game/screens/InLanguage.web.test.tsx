// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { params } from '../../testing/fakes';
import { InLanguage } from './InLanguage';

/*
 * On the web a page in a language the game does not have (`/de/records`, which the site's middleware never lets through) is the page of nothing,
 * fetched only then: its chunk is the 404's own, never in the scripts a page's HTML loads (`scripts/webSize.ts` holds the front door to it).
 */

const fetched = vi.hoisted(() => ({ count: 0 }));
vi.mock('./NotFound', () => {
  fetched.count += 1;
  return { NotFound: () => <p>the page of nothing</p> };
});

afterEach(() => {
  cleanup();
  delete params.locale;
});

it('draws a page in one of the game\'s languages as it is, and fetches nothing more', () => {
  params.locale = 'es';
  render(<InLanguage><p>the page</p></InLanguage>);
  expect(screen.getByText('the page')).toBeTruthy();
  expect(fetched.count).toBe(0);
});

it('shows the page of nothing for any other language, fetched only then', async () => {
  params.locale = 'de';
  render(
    <Suspense fallback={null}>
      <InLanguage>
        <p>the page</p>
      </InLanguage>
    </Suspense>,
  );
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 50));
  });
  expect(await screen.findByText('the page of nothing')).toBeTruthy();
  expect(screen.queryByText('the page')).toBeNull();
  expect(fetched.count).toBe(1);
});
