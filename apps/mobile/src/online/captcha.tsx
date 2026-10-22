import type { Captcha } from '@ratrace/online/connect';
import { useCallback, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SITE_URL } from '../game/site';
import { useT } from '../game/words';
import { Sheet } from '../ui/overlay';
import { COLORS } from '../ui/theme';

/*
 * The guard at the door of guest sign-in, on the phone: Cloudflare's Turnstile, as the web's (apps/web/src/online/captcha.ts), for the project's site
 * key (`EXPO_PUBLIC_TURNSTILE_SITE_KEY`). Turnstile does not run in an app, only in a page (developers.cloudflare.com/turnstile/get-started/
 * mobile-implementation): it runs here in a WebView, in a page of the phone's own given the game's site for its address (`baseUrl`), so that its
 * hostname is one the site key is for. Most people are asked nothing: the page runs out of sight, and only if Turnstile has something to ask
 * (its `before-interactive-callback`) is it shown again, in a sheet. The word comes back through the page's `postMessage`, read strictly. One page,
 * one try, one word, as on the web; none in two minutes, and the account is left offline, as the web's is.
 *
 * The one place of the app that shows a web page (architecture.test.ts holds it so).
 */

/** Cloudflare's script, the web's own address for it. */
export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** How long a person is given, as on the web. */
const PATIENCE = 120_000;
/** The game's site: the page's address, so its hostname is the one the site key is for. Read when a page is made, never as the app loads. */
const site = (): string => SITE_URL.origin;
/** A site key as Cloudflare writes one: anything else is never put in a page. */
const SITE_KEY = /^[\w-]{1,128}$/;
/** A word as Turnstile gives one: printable, with no space, and not too long. */
const WORD = /^[\w.:+/=-]{1,4096}$/;

/** What is being asked: by which ask, and whether the page is in sight. */
interface Asking {
  id: number;
  siteKey: string;
  shown: boolean;
  settle(word: string | null): void;
}
let asking: Asking | null = null;
let asks = 0;
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of [...listeners]) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const current = () => asking;

/** The page in sight, in a sheet: Turnstile has something to ask. */
function show(id: number): void {
  if (asking?.id !== id || asking.shown) return;
  asking = { ...asking, shown: true };
  changed();
}

/**
 * Turnstile for one site key. Each word is asked for afresh (a word is good once); an ask made while another waits ends that one, with no word. The
 * page is drawn by `CaptchaHost`, which the game's context holds: with none drawn, no word comes, and the ask ends in its time.
 */
export function phoneTurnstile(siteKey: string, patience = PATIENCE): Captcha {
  return () =>
    new Promise((done) => {
      if (!SITE_KEY.test(siteKey)) return done(null);
      asking?.settle(null);
      const id = (asks += 1);
      let over = false;
      const settle = (word: string | null) => {
        if (over) return;
        over = true;
        clearTimeout(timer);
        if (asking?.id === id) {
          asking = null;
          changed();
        }
        done(word);
      };
      const timer = setTimeout(() => settle(null), patience);
      asking = { id, siteKey, shown: false, settle };
      changed();
    });
}

/** What the page says: its word, that it has something to ask, or that it could not. */
type Said = { turnstile: 'word'; word: string } | { turnstile: 'interactive' } | { turnstile: 'failed' };

/** What a message from the page says, read strictly: from the game's site, in the page's own shape, or nothing. */
function readSaid(data: unknown, url: unknown): Said | null {
  try {
    if (typeof url !== 'string' || new URL(url).origin !== site()) return null;
    if (typeof data !== 'string' || data.length > 8192) return null;
    const said: unknown = JSON.parse(data);
    if (typeof said !== 'object' || said === null || Array.isArray(said)) return null;
    const { turnstile, word, ...rest } = said as Record<string, unknown>;
    if (Object.keys(rest).length > 0) return null;
    if (turnstile === 'word') return typeof word === 'string' && WORD.test(word) ? { turnstile, word } : null;
    if ((turnstile === 'interactive' || turnstile === 'failed') && word === undefined) return { turnstile };
    return null;
  } catch {
    return null;
  }
}

/** Where the page may go: the game's site (its own address) and a blank page, and inside it, Turnstile's frames. Nowhere else. */
function mayLoad({ url, isTopFrame }: { url: string; isTopFrame: boolean }): boolean {
  if (url === 'about:blank' || url === 'about:srcdoc') return true;
  try {
    const { origin } = new URL(url);
    return isTopFrame ? origin === site() : origin === 'https://challenges.cloudflare.com';
  } catch {
    return false;
  }
}

/**
 * What the page may load: Cloudflare's own example for Turnstile in a mobile WebView (developers.cloudflare.com/turnstile/get-started/
 * mobile-implementation, "Content Security Policy"), with the page's own inline style let in besides.
 */
export const PAGE_POLICY = "default-src 'self'; script-src 'self' challenges.cloudflare.com 'unsafe-inline'; connect-src 'self' challenges.cloudflare.com; frame-src 'self' challenges.cloudflare.com; style-src 'self' 'unsafe-inline'";

/** The page: Turnstile's script, and the widget for the site key, its answers posted back. The site key and the look are written in as JSON. */
function pageFor(siteKey: string, appearance: 'interaction-only' | 'always'): string {
  const background = COLORS['night-800'];
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${PAGE_POLICY}">
<style>html,body{margin:0;padding:0;background:${background}}#widget{display:flex;justify-content:center;padding:8px 0}</style>
</head><body><div id="widget"></div>
<script>
(function () {
  var over = false;
  function say(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  function fail() { if (!over) { over = true; say({ turnstile: 'failed' }); } }
  window.ratraceNoTurnstile = fail;
  window.ratraceTurnstile = function () {
    try {
      window.turnstile.render('#widget', {
        sitekey: ${JSON.stringify(siteKey)},
        theme: 'dark',
        appearance: ${JSON.stringify(appearance)},
        retry: 'never',
        'refresh-expired': 'never',
        callback: function (word) { if (!over) { over = true; say({ turnstile: 'word', word: word }); } },
        'error-callback': function () { fail(); return true; },
        'timeout-callback': fail,
        'unsupported-callback': fail,
        'before-interactive-callback': function () { say({ turnstile: 'interactive' }); }
      });
    } catch (error) { fail(); }
  };
})();
</script>
<script src="${TURNSTILE_SCRIPT}" async onload="ratraceTurnstile()" onerror="ratraceNoTurnstile()"></script>
</body></html>`;
}

/**
 * The page of one ask. Storage and cookies are kept, as Turnstile asks of a WebView. Every load is put to `mayLoad`, the one gate: the library's
 * `originWhitelist` is let pass everything (`*`), because what it turns away it hands to the phone to open (react-native-webview's
 * `createOnShouldStartLoadWithRequest`), a link out of the page, or one of the game's own `theratrace://`. Turned away by `mayLoad`, a load is
 * only cancelled: nothing is opened. What the page says is taken only for the ask it belongs to.
 */
function TurnstilePage({ ask, appearance, height }: { ask: Asking; appearance: 'interaction-only' | 'always'; height: number }) {
  const { id, settle } = ask;
  const heard = useCallback(
    (event: WebViewMessageEvent) => {
      const said = readSaid(event.nativeEvent.data, event.nativeEvent.url);
      if (said === null || asking?.id !== id) return;
      if (said.turnstile === 'word') settle(said.word);
      else if (said.turnstile === 'failed') settle(null);
      else show(id);
    },
    [id, settle],
  );
  return (
    <WebView
      source={{ html: pageFor(ask.siteKey, appearance), baseUrl: `${site()}/` }}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={mayLoad}
      onMessage={heard}
      onError={() => settle(null)}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      scrollEnabled={false}
      style={{ height, backgroundColor: COLORS['night-800'] }}
    />
  );
}

/**
 * Where Turnstile's page is drawn, for the whole app (the game's context holds it): out of sight while it decides by itself, in a sheet if it has
 * something to ask. Closed, the sheet gives no word.
 */
export function CaptchaHost() {
  const ask = useSyncExternalStore(subscribe, current, current);
  const words = useT('phone.captcha');
  const common = useT('common');
  return (
    <>
      {ask !== null && !ask.shown ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
          <TurnstilePage key={ask.id} ask={ask} appearance="interaction-only" height={1} />
        </View>
      ) : null}
      <Sheet open={ask?.shown === true} onClose={() => ask?.settle(null)} title={words('title')} closeLabel={common('close')}>
        {ask?.shown ? <TurnstilePage key={ask.id} ask={ask} appearance="always" height={96} /> : null}
      </Sheet>
    </>
  );
}
