// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetConnection, phoneConnection, phonePage, whileActive } from './page.web';

/*
 * What the browser tells the account of the page (page.web.ts): the Next web's `browserPage` (apps/web/src/online/index.ts), word for word; and
 * whether there is a connection, as the Next web's `useRanking` reads it (`navigator.onLine`, the window's `online` and `offline`).
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const visibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
};
const onLine = (now: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(now);

afterEach(() => {
  forgetConnection();
  vi.restoreAllMocks();
});

describe('the page', () => {
  it('is the Next web\'s, word for word', () => {
    const web = read('../../../web/src/online/index.ts');
    const start = web.indexOf('export const browserPage: Page = {');
    const browserPage = web.slice(start, web.indexOf('\n};\n', start) + 4);
    expect(start).toBeGreaterThan(0);
    expect(read('./page.web.ts')).toContain(browserPage.replace('export const browserPage: Page', 'export const phonePage: Page'));
  });

  it('says the connection is back when the window does, and the page shown when it is made visible again', () => {
    const online = vi.fn();
    const shown = vi.fn();
    const stopOnline = phonePage.onOnline(online);
    const stopShown = phonePage.onShown(shown);
    window.dispatchEvent(new Event('online'));
    visibility('hidden');
    visibility('visible');
    expect(online).toHaveBeenCalledTimes(1);
    expect(shown).toHaveBeenCalledTimes(1);
    stopOnline();
    stopShown();
    window.dispatchEvent(new Event('online'));
    visibility('visible');
    expect(online).toHaveBeenCalledTimes(1);
    expect(shown).toHaveBeenCalledTimes(1);
  });
});

describe('whether there is a connection now', () => {
  it('is the browser\'s word, and every change of it is told until the listener stops', () => {
    onLine(true);
    expect(phoneConnection.connected()).toBe(true);
    const heard = vi.fn();
    const stop = phoneConnection.subscribe(heard);
    onLine(false);
    window.dispatchEvent(new Event('offline'));
    expect(phoneConnection.connected()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new Event('online'));
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('the page in front', () => {
  it('is said at once, and again each time it changes, until stopped', () => {
    visibility('visible');
    const set = vi.fn();
    const stop = whileActive(set);
    visibility('hidden');
    visibility('hidden');
    visibility('visible');
    stop();
    visibility('hidden');
    expect(set.mock.calls).toEqual([[true], [false], [true]]);
  });
});
