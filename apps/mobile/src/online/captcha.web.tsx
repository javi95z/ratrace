import type { Captcha } from '@ratrace/online/connect';

/*
 * The web export's twin of `captcha.tsx` (Metro picks it for the web): the guard at the door of guest sign-in as the Next web has it
 * (apps/web/src/online/captcha.ts), word for word under the phone's names. A page needs no web view to run Turnstile: its script is added to the page
 * the first time a word is asked for, and its widget drawn into the page itself, seen only if it has something to ask. So `CaptchaHost` draws nothing.
 */

/** The part of Cloudflare's Turnstile this game uses. */
interface Turnstile {
  render(holder: HTMLElement, options: Record<string, unknown>): string | null | undefined;
  remove(widget: string): void;
}

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** How long a person is given, if Turnstile has something to ask them. */
const PATIENCE = 120_000;
/** Where the widget stands if it has to be seen: over everything, at the foot of the page. */
const PLACE = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647';

/**
 * Cloudflare's Turnstile for one site key. Its script is fetched the first time a word is asked
 * for, so a player who is already signed in never loads it. Most people are never shown anything:
 * the widget appears only if it has something to ask them, and is taken away once it has answered.
 */
export function phoneTurnstile(siteKey: string, patience = PATIENCE): Captcha {
  let loading: Promise<Turnstile | null> | null = null;
  const load = (): Promise<Turnstile | null> =>
    (loading ??= new Promise((done) => {
      const script = document.createElement('script');
      // A script that did not come is asked for again the next time. One that never answers at all is not waited for for ever.
      const failed = () => {
        clearTimeout(timer);
        script.remove();
        loading = null;
        done(null);
      };
      const timer = setTimeout(failed, patience);
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.onload = () => {
        const api = (window as { turnstile?: Turnstile }).turnstile;
        if (!api) return failed();
        clearTimeout(timer);
        done(api);
      };
      script.onerror = failed;
      document.head.appendChild(script);
    }));

  return async () => {
    const api = await load();
    if (api === null) return null;
    return new Promise((done) => {
      const holder = document.createElement('div');
      holder.style.cssText = PLACE;
      document.body.appendChild(holder);
      let widget: string | null | undefined;
      let over = false;
      const tidy = () => {
        if (widget) {
          try {
            api.remove(widget);
          } catch {
            // Already gone.
          }
          widget = null;
        }
        holder.remove();
      };
      /** The first answer is the answer. Anything after it is nobody's. */
      const settle = (word: string | null) => {
        if (over) return;
        over = true;
        clearTimeout(timer);
        tidy();
        done(word);
      };
      const timer = setTimeout(() => settle(null), patience);
      try {
        widget = api.render(holder, {
          sitekey: siteKey,
          theme: 'dark',
          appearance: 'interaction-only',
          // One try, one word: whoever asked decides whether to ask again.
          retry: 'never',
          'refresh-expired': 'never',
          callback: (word: string) => settle(word),
          // Answering true says the failure has been dealt with here.
          'error-callback': () => (settle(null), true),
          'timeout-callback': () => settle(null),
          'unsupported-callback': () => settle(null),
        });
        // An answer that came before the widget had a name left it standing.
        if (over) tidy();
      } catch {
        settle(null);
      }
    });
  };
}

/** Nothing to draw on the web: the widget is drawn into the page by `phoneTurnstile` itself. Kept so that the game's context is the phone's. */
export function CaptchaHost() {
  return null;
}
