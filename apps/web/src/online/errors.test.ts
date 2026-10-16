import { describe, expect, it } from 'vitest';
import { scrub as scrubOnTheServer } from '../../../../supabase/functions/_shared/errors.ts';
import { browserOf, buildOf, errorOf, errorWatch, scrub, watchPage } from './errors';
import type { ErrorReport, Sent } from './errors';

/** Lets what a timer started finish: the sending is a promise. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A watch over a page of its own: what it sent, the timers it set, and what the next sends answer. */
function watching(answers: Array<Sent | Error> = []) {
  const sent: ErrorReport[][] = [];
  const timers: number[] = [];
  const due: Array<() => void> = [];
  const page = { path: '/es/play' };
  const watch = errorWatch({
    send: async (reports) => {
      sent.push(reports);
      const answer = answers.shift() ?? 'sent';
      if (answer instanceof Error) throw answer;
      return answer;
    },
    place: () => page.path,
    build: '0.35.0/1.35.0',
    browser: 'Chrome 140 Android',
    schedule: (run, ms) => {
      timers.push(ms);
      due.push(run);
    },
  });
  /** Runs every timer set so far, and lets what they started finish. */
  const tick = async () => {
    for (const run of due.splice(0)) run();
    await settle();
  };
  return { watch, sent, timers, page, tick };
}

const STACK = 'TypeError: x is undefined\n    at play (https://ratrace.app/_next/static/chunks/page-3f2a1b9c.js:1:2345)';

describe('what leaves the page', () => {
  it('is cleaned the way the server cleans it', () => {
    const samples = [
      'no player for ana.garcia+game@gmail.com',
      'refused eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc_DEF-123',
      'game 0a4fb313-975e-4fbb-a503-2087414daddf is gone',
      'fetch https://riat.supabase.co/rest/v1/games?select=*&id=eq.1#access_token=x failed',
      'key sb_publishable_AbCdEfGhIjKlMnOpQrStUvWx12 refused',
      'call +34612345678 or 123456',
      STACK,
    ];
    for (const sample of samples) expect(scrub(sample)).toBe(scrubOnTheServer(sample));
    expect(scrub('no player for ana@x.com')).toBe('no player for <email>');
  });

  it('says what was said, and where in the code, of whatever the page wrote as an error', () => {
    const failure = new TypeError('x is undefined');
    expect(errorOf(['the game refused a step:', failure])).toEqual({ message: 'the game refused a step: TypeError: x is undefined', stack: failure.stack });
    expect(errorOf([new Error('plain')]).message).toBe('plain');
    // An object is said by its message, or by its kind: never written out whole, with whatever it holds.
    expect(errorOf([{ message: 'row not found', details: 'ana@x.com', hint: null }])).toEqual({ message: 'row not found', stack: null });
    expect(errorOf(['refused', { email: 'ana@x.com' }, 7, null, undefined])).toEqual({ message: 'refused Object 7 null undefined', stack: null });
    expect(errorOf([new (class Odd {})()]).message).toBe('Odd');
  });

  it('names the browser by its name, its major version and its system, and nothing finer', () => {
    expect(browserOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.80 Mobile Safari/537.36')).toBe('Chrome 140 Android');
    expect(browserOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1')).toBe('Safari 18 iOS');
    expect(browserOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.101 Mobile/15E148 Safari/604.1')).toBe('Chrome 140 iOS');
    expect(browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.54')).toBe('Edge 140 Windows');
    expect(browserOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0')).toBe('Firefox 143 macOS');
    expect(browserOf('Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36')).toBe('Samsung 28 Android');
    expect(browserOf('curl/8.7.1')).toBe('other');
  });

  it('names the build by the versions of the game and, where the build knows it, its commit', () => {
    expect(buildOf('0.35.0', '1.35.0', 'abcdef1234567890')).toBe('0.35.0/1.35.0 abcdef1');
    expect(buildOf('0.35.0', '1.35.0', undefined)).toBe('0.35.0/1.35.0');
  });
});

describe('the watch over a page', () => {
  it('gathers what goes wrong together and sends it in one call, cleaned, with the path of the page alone', async () => {
    const { watch, sent, page, tick } = watching();
    page.path = '/es/room/0a4fb313-975e-4fbb-a503-2087414daddf';
    watch.report('no game for ana@x.com', STACK);
    watch.report('the room could not be looked for', null);
    expect(sent).toEqual([]);
    await tick();
    expect(sent).toEqual([
      [
        { message: 'no game for <email>', stack: STACK, place: '/es/room/<id>', build: '0.35.0/1.35.0', browser: 'Chrome 140 Android' },
        { message: 'the room could not be looked for', stack: null, place: '/es/room/<id>', build: '0.35.0/1.35.0', browser: 'Chrome 140 Android' },
      ],
    ]);
  });

  it('reports each kind once, and ten kinds at most in the life of a page', async () => {
    const { watch, sent, tick } = watching();
    watch.report('step 12 refused', null);
    watch.report('step 13 refused', null);
    for (let n = 0; n < 12; n += 1) watch.report(`kind ${'abcdefghijkl'[n]}`, null);
    await tick();
    await tick();
    expect(sent.flat()).toHaveLength(10);
    expect(sent.flat()[0].message).toBe('step 12 refused');
  });

  it('leaves out the noise of other people\'s code, which would use up the ten', async () => {
    const { watch, sent, tick } = watching();
    watch.report('Script error.', null);
    watch.report('ResizeObserver loop completed with undelivered notifications.', null);
    watch.report('boom', 'at x (chrome-extension://abc/content.js:1:1)');
    watch.report('  ', null);
    await tick();
    expect(sent).toEqual([]);
  });

  it('keeps what could not be sent and tries again, later each time, five tries in all, and again whenever it is asked', async () => {
    const { watch, sent, timers, tick } = watching(['later', new Error('no network'), 'later', 'later', 'later', 'sent']);
    watch.report('boom', null);
    for (let n = 0; n < 6; n += 1) await tick();
    expect(sent).toHaveLength(5);
    expect(timers).toEqual([2_000, 30_000, 60_000, 120_000, 240_000]);
    // Someone signed in: it is sent at once.
    await watch.flush();
    expect(sent).toHaveLength(6);
    expect(sent[5]).toEqual(sent[0]);
    await watch.flush();
    expect(sent).toHaveLength(6);
  });

  it('drops what the server will never take, and sends nothing of it again', async () => {
    const { watch, sent, timers, tick } = watching(['never']);
    watch.report('boom', null);
    await tick();
    await watch.flush();
    expect(sent).toHaveLength(1);
    expect(timers).toEqual([2_000]);
  });

  it('sends what goes wrong while it is sending in the next call, not in the same one', async () => {
    const { watch, sent, tick } = watching();
    watch.report('first', null);
    const sending = tick();
    watch.report('second', null);
    await sending;
    await tick();
    expect(sent.map((batch) => batch.map((one) => one.message))).toEqual([['first'], ['second']]);
  });
});

describe('what the watch hears of a page', () => {
  it('hears errors nobody caught, promises nobody handled, and what the game writes as an error, and writes it all the same', async () => {
    const { watch, sent, tick } = watching();
    const page = new EventTarget();
    const written: unknown[][] = [];
    const log = { error: (...args: unknown[]) => void written.push(args) };
    const stop = watchPage(watch, page, log);

    const thrown = new Error('nobody caught this');
    page.dispatchEvent(Object.assign(new Event('error'), { message: 'Uncaught Error: nobody caught this', error: thrown }));
    page.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('nobody handled this') }));
    log.error('the game refused a step:', new Error('no'));
    expect(written).toEqual([['the game refused a step:', new Error('no')]]);
    await tick();
    expect(sent.flat().map((one) => one.message)).toEqual(['Uncaught Error: nobody caught this', 'unhandled: nobody handled this', 'the game refused a step: no']);
    expect(sent.flat()[0].stack).toBe(scrub(thrown.stack ?? ''));

    // Stopped, it hears nothing, and the log is the page's own again.
    stop();
    log.error('after');
    page.dispatchEvent(Object.assign(new Event('error'), { message: 'after' }));
    await tick();
    expect(sent.flat()).toHaveLength(3);
    expect(written).toHaveLength(2);
  });

  it('says where a script failed when the browser gives no stack', async () => {
    const { watch, sent, tick } = watching();
    const page = new EventTarget();
    watchPage(watch, page, { error: () => {} });
    page.dispatchEvent(Object.assign(new Event('error'), { message: 'boom', error: null, filename: 'https://ratrace.app/_next/static/chunks/main.js', lineno: 3, colno: 9 }));
    await tick();
    expect(sent.flat()[0]).toMatchObject({ message: 'boom', stack: 'at https://ratrace.app/_next/static/chunks/main.js:3:9' });
  });

  it('never lets a fault of its own break the page\'s log', () => {
    const page = new EventTarget();
    const written: unknown[][] = [];
    const log = { error: (...args: unknown[]) => void written.push(args) };
    const broken = { report: () => { throw new Error('the watch is broken'); }, flush: async () => {} };
    watchPage(broken, page, log);
    expect(() => log.error('still written')).not.toThrow();
    expect(written).toEqual([['still written']]);
  });
});
