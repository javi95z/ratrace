// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_URL } from '../game/site';
import { WordsProvider } from '../game/words';
import { KvStore } from '../kvStore';
import { servers } from '../testing/cloudServers';
import { appState, webViews } from '../testing/fakes';
import { CaptchaHost, phoneTurnstile, TURNSTILE_SCRIPT } from './captcha';
import { forgetThePhone, phoneOnline } from './index';

/*
 * The guard at the door of guest sign-in, where the project has one (`EXPO_PUBLIC_TURNSTILE_SITE_KEY`, as the web's `NEXT_PUBLIC_TURNSTILE_SITE_KEY`):
 * Cloudflare's Turnstile, in a page of the phone's own, as from the game's site. Most people are asked nothing: the page runs out of sight, and a sheet
 * shows it only if Turnstile has something to ask. Its word goes to the account; none, and the account stays offline, as on the web.
 */

const URL_OF_PROJECT = 'https://abcdefghijklmnop.supabase.co';
const SITE = SITE_URL.origin;
/** What the page says, as the phone hears it: its words, from the page that was loaded (`url`). */
const says = (message: unknown, url = `${SITE}/`) => ({ nativeEvent: { data: typeof message === 'string' ? message : JSON.stringify(message), url } });
/** The page in front, and what it was drawn with. */
const page = () => webViews[webViews.length - 1];
const html = () => (page().props.source as { html: string }).html;
/** Lets the client's work, and the sheet's, happen. */
const settled = (ms = 20) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const host = () => render(<WordsProvider locale="en"><CaptchaHost /></WordsProvider>);
const sheet = () => screen.queryByRole('heading', { name: 'A quick check' });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  appState.set('background');
  forgetThePhone();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** A build with a project named, and the guard at its door when a site key is given. */
function configured(siteKey: string) {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', URL_OF_PROJECT);
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
  vi.stubEnv('EXPO_PUBLIC_TURNSTILE_SITE_KEY', siteKey);
  const project = servers();
  vi.stubGlobal('fetch', project.fetch);
  return project;
}
/** What the guest sign-ins carried to the project. */
const signUps = (project: ReturnType<typeof servers>) =>
  project.fetch.mock.calls.filter(([input]) => String(input).endsWith('/auth/v1/signup')).map(([, init]) => JSON.parse(String(init?.body)) as { gotrue_meta_security?: { captcha_token?: string } });

describe('the guest sign-in, with the guard at the door', () => {
  it('waits for Turnstile\'s word, and signs the guest in with it', async () => {
    const project = configured('0x4AAAAAAAsite');
    host();
    const online = phoneOnline(new KvStore());
    let started = false;
    void online.account.start('en').then(() => (started = true));
    await settled();
    // Asked, out of sight: no sheet, and no guest until the word has come.
    expect(webViews).toHaveLength(1);
    expect(sheet()).toBeNull();
    expect(signUps(project)).toEqual([]);
    expect(started).toBe(false);
    act(() => page().props.onMessage?.(says({ turnstile: 'word', word: '0.a-Word_from.Turnstile' })));
    await settled();
    expect(started).toBe(true);
    expect(signUps(project).map((body) => body.gotrue_meta_security?.captcha_token)).toEqual(['0.a-Word_from.Turnstile']);
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    // The page is taken away with its answer.
    expect(webViews).toEqual([]);
  });

  it('asks nothing where the project has no guard, as the web: the guest is made at once', async () => {
    const project = configured('');
    host();
    const online = phoneOnline(new KvStore());
    await online.account.start('en');
    expect(webViews).toEqual([]);
    expect(signUps(project)).toHaveLength(1);
    expect(signUps(project)[0].gotrue_meta_security?.captcha_token).toBeUndefined();
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
  });

  it('gives up after two minutes, as the web does: no word, and the page taken away', async () => {
    vi.useFakeTimers();
    host();
    const ask = phoneTurnstile('0x4AAAAAAAsite');
    let word: string | null | undefined;
    void ask().then((said) => (word = said));
    await act(() => vi.advanceTimersByTimeAsync(119_999));
    expect(word).toBeUndefined();
    expect(webViews).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(word).toBeNull();
    expect(webViews).toEqual([]);
  });

  it('leaves the account offline when no word came in its time: no guest is made, and the game plays on', async () => {
    const project = configured('0x4AAAAAAAsite');
    host();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    const online = phoneOnline(new KvStore());
    let started = false;
    void online.account.start('en').then(() => (started = true));
    for (let tries = 0; webViews.length === 0 && tries < 100; tries += 1) await act(() => vi.advanceTimersByTimeAsync(10));
    expect(webViews).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(started).toBe(true);
    expect(signUps(project)).toEqual([]);
    expect(online.account.state()).toEqual({ kind: 'offline' });
    expect(webViews).toEqual([]);
  });
});

describe('the page Turnstile runs in', () => {
  it('is a page of the game\'s site, loading the web\'s own script for this site key, asking only if it must', async () => {
    host();
    void phoneTurnstile('0x4AAAAAAAsite')();
    await settled();
    const web = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../web/src/online/captcha.ts'), 'utf8');
    expect(web).toContain(`const SCRIPT = '${TURNSTILE_SCRIPT}';`);
    expect(html()).toContain(`src="${TURNSTILE_SCRIPT}"`);
    expect(html()).toContain('"0x4AAAAAAAsite"');
    // The web's options: interaction only, one try, one word.
    for (const option of ['"interaction-only"', "theme: 'dark'", "retry: 'never'", "'refresh-expired': 'never'", "'before-interactive-callback'"]) expect(html()).toContain(option);
    expect(page().props.source).toMatchObject({ baseUrl: `${SITE}/` });
    // Its storage and cookies are kept, as Turnstile asks; nothing of it is opened in a window of its own.
    expect(page().props).toMatchObject({ javaScriptEnabled: true, domStorageEnabled: true, setSupportMultipleWindows: false });
    expect(page().props.incognito).toBeUndefined();
  });

  it('leaves the game\'s site for nothing: only Turnstile\'s own frames load inside it', async () => {
    host();
    void phoneTurnstile('0x4AAAAAAAsite')();
    await settled();
    const may = page().props.onShouldStartLoadWithRequest as (request: { url: string; isTopFrame: boolean }) => boolean;
    expect(may({ url: `${SITE}/`, isTopFrame: true })).toBe(true);
    expect(may({ url: 'about:blank', isTopFrame: true })).toBe(true);
    expect(may({ url: 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/av0/rcv0/0/abc', isTopFrame: false })).toBe(true);
    expect(may({ url: 'https://www.cloudflare.com/privacypolicy/', isTopFrame: true })).toBe(false);
    expect(may({ url: 'https://evil.example/', isTopFrame: true })).toBe(false);
    expect(may({ url: 'https://evil.example/', isTopFrame: false })).toBe(false);
    expect(may({ url: 'not an address', isTopFrame: true })).toBe(false);
  });

  it('takes no word but one the page plainly said: from the game\'s site, in its own shape', async () => {
    host();
    let word: string | null | undefined;
    void phoneTurnstile('0x4AAAAAAAsite')().then((said) => (word = said));
    await settled();
    const hear = (message: unknown, url?: string) => act(() => page().props.onMessage?.(says(message, url)));
    hear({ turnstile: 'word', word: 'from-elsewhere' }, 'https://evil.example/');
    hear('not json');
    hear('"a-word"');
    hear(null);
    hear({ turnstile: 'word' });
    hear({ turnstile: 'word', word: 42 });
    hear({ turnstile: 'word', word: '' });
    hear({ turnstile: 'word', word: 'has spaces in it' });
    hear({ turnstile: 'word', word: 'x'.repeat(5000) });
    hear({ turnstile: 'word', word: 'a-word', more: true });
    hear({ turnstile: 'something', word: 'a-word' });
    hear(JSON.stringify({ turnstile: 'word', word: 'a-word' }).repeat(1000));
    await settled();
    expect(word).toBeUndefined();
    expect(webViews).toHaveLength(1);
    hear({ turnstile: 'word', word: 'a-word' });
    await settled();
    expect(word).toBe('a-word');
  });

  it('has no word when Turnstile could not, or its script could not be had, or the page broke', async () => {
    host();
    for (const fail of [() => page().props.onMessage?.(says({ turnstile: 'failed' })), () => (page().props.onError as () => void)()]) {
      const word = phoneTurnstile('0x4AAAAAAAsite')();
      await settled();
      act(fail);
      expect(await word).toBeNull();
      await settled();
      expect(webViews).toEqual([]);
    }
    // A site key that is not one is never put in a page.
    expect(await phoneTurnstile('0x4"</script><script>alert(1)')()).toBeNull();
    expect(webViews).toEqual([]);
  });

  it('asks afresh every time, because a word is good once, and a late word from an earlier page is nobody\'s', async () => {
    host();
    const first = phoneTurnstile('0x4AAAAAAAsite')();
    await settled();
    const earlier = page();
    act(() => earlier.props.onMessage?.(says({ turnstile: 'word', word: 'one' })));
    expect(await first).toBe('one');
    const second = phoneTurnstile('0x4AAAAAAAsite')();
    await settled();
    expect(page()).not.toBe(earlier);
    act(() => earlier.props.onMessage?.(says({ turnstile: 'word', word: 'stale' })));
    act(() => page().props.onMessage?.(says({ turnstile: 'word', word: 'two' })));
    expect(await second).toBe('two');
  });
});

describe('the sheet, when Turnstile has something to ask', () => {
  it('opens with the page in it, takes the word given there, and closes', async () => {
    host();
    let word: string | null | undefined;
    void phoneTurnstile('0x4AAAAAAAsite')().then((said) => (word = said));
    await settled();
    act(() => page().props.onMessage?.(says({ turnstile: 'interactive' })));
    await settled();
    expect(sheet()).not.toBeNull();
    // The page is shown in the sheet, the widget in sight from the start.
    expect(webViews).toHaveLength(1);
    expect(html()).toContain('"always"');
    expect(sheet()?.closest('[aria-modal="true"]')?.querySelector('[data-webview]')).not.toBeNull();
    act(() => page().props.onMessage?.(says({ turnstile: 'word', word: 'asked-word' })));
    await settled();
    expect(word).toBe('asked-word');
    await settled(700);
    expect(sheet()).toBeNull();
    expect(webViews).toEqual([]);
  });

  it('has no word when the player closes it', async () => {
    host();
    const word = phoneTurnstile('0x4AAAAAAAsite')();
    await settled();
    act(() => page().props.onMessage?.(says({ turnstile: 'interactive' })));
    await settled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await word).toBeNull();
  });

  it('says what it is in each language', async () => {
    for (const [locale, title] of [['es', 'Una comprobación rápida'], ['ru', 'Быстрая проверка']] as const) {
      render(<WordsProvider locale={locale}><CaptchaHost /></WordsProvider>);
      const word = phoneTurnstile('0x4AAAAAAAsite')();
      await settled();
      act(() => page().props.onMessage?.(says({ turnstile: 'interactive' })));
      await settled();
      // The kit sets Cyrillic in words of their own, which jsdom reads as one: the words are compared, not the spaces between them.
      expect(screen.getByRole('heading', { name: (name) => name.replace(/\s/g, '') === title.replace(/\s/g, '') })).toBeTruthy();
      act(() => page().props.onMessage?.(says({ turnstile: 'failed' })));
      expect(await word).toBeNull();
      // Gone before the next opens: sheets take turns.
      await settled(700);
      cleanup();
    }
  });
});
