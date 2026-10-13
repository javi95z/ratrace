// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { turnstile } from './captcha';

type Options = Record<string, unknown> & { callback(token: string): void };

/** Cloudflare's widget, as far as the game uses it: it remembers what it was asked to draw and to take away. */
function widgets(drawing: (options: Options) => void = () => {}) {
  const drawn: Array<{ holder: HTMLElement; options: Options }> = [];
  const removed: string[] = [];
  return {
    drawn,
    removed,
    api: {
      render: (holder: HTMLElement, options: Options) => {
        drawn.push({ holder, options });
        drawing(options);
        return `w-${drawn.length}`;
      },
      remove: (id: string) => void removed.push(id),
    },
  };
}
const page = window as unknown as { turnstile?: unknown };
const scripts = () => [...document.head.querySelectorAll('script')].filter((script) => script.src.startsWith('https://challenges.cloudflare.com/'));
/** The script arrives, and brings what it brings. */
function arrives(api: unknown) {
  page.turnstile = api;
  scripts()[0].dispatchEvent(new Event('load'));
}
/** Lets what was promised so far happen. */
const settle = () => new Promise((done) => setTimeout(done, 0));

afterEach(() => {
  vi.useRealTimers();
  for (const script of scripts()) script.remove();
  document.body.innerHTML = '';
  delete page.turnstile;
});

describe('the guard at the door', () => {
  it('loads nothing until it is asked, and then Cloudflare\'s script once', async () => {
    const ask = turnstile('site-key');
    expect(scripts()).toEqual([]);
    void ask();
    void ask();
    await settle();
    expect(scripts().map((script) => script.src)).toEqual(['https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit']);
    expect(scripts()[0].async).toBe(true);
  });

  it('hands over the word Turnstile gives for this site, and clears up after itself', async () => {
    const { api, drawn, removed } = widgets();
    const word = turnstile('site-key')();
    await settle();
    arrives(api);
    await settle();
    expect(drawn).toHaveLength(1);
    expect(drawn[0].options).toMatchObject({ sitekey: 'site-key', appearance: 'interaction-only', retry: 'never', 'refresh-expired': 'never' });
    // The widget has a place on the page, in case it has something to ask the person.
    expect(document.body.contains(drawn[0].holder)).toBe(true);
    expect(removed).toEqual([]);
    drawn[0].options.callback('a-word');
    expect(await word).toBe('a-word');
    expect(removed).toEqual(['w-1']);
    expect(document.body.contains(drawn[0].holder)).toBe(false);
    expect(document.body.children).toHaveLength(0);
  });

  it('asks afresh every time, because a word is good once, and fetches the script only the first time', async () => {
    const { api, drawn, removed } = widgets();
    const ask = turnstile('site-key');
    const first = ask();
    await settle();
    arrives(api);
    await settle();
    drawn[0].options.callback('one');
    expect(await first).toBe('one');
    const second = ask();
    await settle();
    expect(drawn).toHaveLength(2);
    drawn[1].options.callback('two');
    expect(await second).toBe('two');
    expect(removed).toEqual(['w-1', 'w-2']);
    expect(scripts()).toHaveLength(1);
  });

  it('has no word when Turnstile could not, when the person did not answer it in time, or when the browser cannot show it', async () => {
    for (const refusal of ['error-callback', 'timeout-callback', 'unsupported-callback']) {
      const { api, drawn, removed } = widgets();
      const word = turnstile('site-key')();
      await settle();
      arrives(api);
      await settle();
      (drawn[0].options[refusal] as () => unknown)();
      expect(await word, refusal).toBeNull();
      expect(removed, refusal).toEqual(['w-1']);
      expect(document.body.children, refusal).toHaveLength(0);
      for (const script of scripts()) script.remove();
      delete page.turnstile;
    }
  });

  it('takes an answer that comes at once, and still takes the widget away', async () => {
    const { api, removed } = widgets((options) => options.callback('at-once'));
    const word = turnstile('site-key')();
    await settle();
    arrives(api);
    expect(await word).toBe('at-once');
    expect(removed).toEqual(['w-1']);
    expect(document.body.children).toHaveLength(0);
  });

  it('has no word when the script cannot be had, and asks for it again the next time', async () => {
    const ask = turnstile('site-key');
    const word = ask();
    await settle();
    scripts()[0].dispatchEvent(new Event('error'));
    expect(await word).toBeNull();
    expect(scripts()).toEqual([]);
    // The next time, it is fetched again, and this time it comes.
    const { api, drawn } = widgets();
    const again = ask();
    await settle();
    expect(scripts()).toHaveLength(1);
    arrives(api);
    await settle();
    drawn[0].options.callback('later');
    expect(await again).toBe('later');
  });

  it('has no word when the script came and brought nothing, or when Turnstile breaks', async () => {
    const nothing = turnstile('site-key')();
    await settle();
    scripts()[0].dispatchEvent(new Event('load'));
    expect(await nothing).toBeNull();
    for (const script of scripts()) script.remove();

    const broken = turnstile('site-key')();
    await settle();
    arrives({
      render: () => {
        throw new Error('no such site key');
      },
      remove: () => {},
    });
    expect(await broken).toBeNull();
    expect(document.body.children).toHaveLength(0);
  });

  it('does not wait for ever for an answer', async () => {
    vi.useFakeTimers();
    const { api, drawn, removed } = widgets();
    const word = turnstile('site-key', 5_000)();
    await vi.advanceTimersByTimeAsync(0);
    arrives(api);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(drawn).toHaveLength(1);
    expect(removed).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await word).toBeNull();
    expect(removed).toEqual(['w-1']);
    // An answer after that is nobody's.
    drawn[0].options.callback('too-late');
    expect(removed).toEqual(['w-1']);
  });
});
