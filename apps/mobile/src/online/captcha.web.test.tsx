// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptchaHost, phoneTurnstile, TURNSTILE_SCRIPT } from './captcha.web';

/*
 * The guard at the door of guest sign-in on the web (captcha.web.tsx): the Next web's Turnstile (apps/web/src/online/captcha.ts), its script added to
 * the page the first time a word is asked for, its widget drawn into the page itself. No web view: there is nothing for `CaptchaHost` to draw.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const scripts = () => [...document.head.querySelectorAll('script')].filter((script) => script.src === TURNSTILE_SCRIPT);

afterEach(() => {
  for (const script of scripts()) script.remove();
  delete (window as { turnstile?: unknown }).turnstile;
  document.body.innerHTML = '';
});

describe('Turnstile on the web', () => {
  it('is the Next web\'s, word for word, under the phone\'s names', () => {
    const web = read('../../../web/src/online/captcha.ts');
    const asTheApp = web
      .slice(web.indexOf('/** The part of Cloudflare\'s Turnstile'))
      .replace("const SCRIPT = '", "export const TURNSTILE_SCRIPT = '")
      .replace('script.src = SCRIPT;', 'script.src = TURNSTILE_SCRIPT;')
      .replace('export function turnstile(', 'export function phoneTurnstile(');
    expect(asTheApp).toContain('export function phoneTurnstile(');
    expect(read('./captcha.web.tsx')).toContain(asTheApp);
  });

  it('loads its script only when a word is asked for, and gives the word its widget gives', async () => {
    const ask = phoneTurnstile('0x4AAAAAAA');
    expect(scripts()).toHaveLength(0);
    const word = ask();
    expect(scripts()).toHaveLength(1);
    const render = vi.fn((_holder: HTMLElement, options: Record<string, unknown>) => {
      (options.callback as (word: string) => void)('a-word');
      return 'widget-1';
    });
    (window as { turnstile?: unknown }).turnstile = { render, remove: vi.fn() };
    scripts()[0].onload?.(new Event('load'));
    await expect(word).resolves.toBe('a-word');
    expect(render.mock.calls[0][1]).toMatchObject({ sitekey: '0x4AAAAAAA', appearance: 'interaction-only', retry: 'never' });
  });

  it('gives no word when its script does not come', async () => {
    const word = phoneTurnstile('0x4AAAAAAA')();
    scripts()[0].onerror?.(new Event('error'));
    await expect(word).resolves.toBeNull();
  });

  it('needs no host in the app\'s tree, and no web view anywhere', () => {
    const { container } = render(<CaptchaHost />);
    expect(container.innerHTML).toBe('');
    expect(read('./captcha.web.tsx')).not.toMatch(/['"]react-native-webview/);
  });
});
