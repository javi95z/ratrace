import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { alertRequest, APP_PAGES, fingerprintOf, PAGES, placeOf, reportErrors, scrub } from '../../../supabase/functions/_shared/errors.ts';
import type { ErrorRow, ErrorsDeps } from '../../../supabase/functions/_shared/errors.ts';
import { watched } from '../../../supabase/functions/_shared/watch.ts';

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** The database and the alert, kept here: what was noted, what was sent, and what the next note answers. */
function fake(answers: Array<{ seen: number; alert: boolean }> = []) {
  const noted: ErrorRow[] = [];
  const alerts: string[] = [];
  const asked: string[] = [];
  const state = { allowed: true };
  const deps: ErrorsDeps = {
    allow: async (user) => {
      asked.push(user);
      return state.allowed;
    },
    note: async (row) => {
      noted.push(row);
      return answers.shift() ?? { seen: 1, alert: false };
    },
    alert: async (title, text) => {
      alerts.push(`${title}\n${text}`);
    },
    now: () => new Date('2026-10-16T12:00:00.000Z'),
  };
  return { deps, noted, alerts, asked, state };
}

const report = (over: Record<string, unknown> = {}) => ({ message: 'boom', stack: 'Error: boom\n    at play (https://ratrace.app/_next/static/chunks/page-3f2a1b9c.js:1:2345)', place: '/play', build: '0.35.0/1.35.0', browser: 'Chrome 140', ...over });

describe('what a report never carries', () => {
  it('takes out e-mail addresses, tokens, ids, long numbers and what follows ? or # in an address', () => {
    expect(scrub('no player for ana.garcia+game@gmail.com')).toBe('no player for <email>');
    expect(scrub('refused eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc_DEF-123')).toBe('refused <token>');
    expect(scrub('game 0a4fb313-975e-4fbb-a503-2087414daddf is gone')).toBe('game <id> is gone');
    expect(scrub('fetch https://riat.supabase.co/rest/v1/games?select=*&id=eq.1#access_token=x failed')).toBe('fetch https://riat.supabase.co/rest/v1/games failed');
    expect(scrub('key sb_publishable_AbCdEfGhIjKlMnOpQrStUvWx12 refused')).toBe('key <token> refused');
    expect(scrub('call +34612345678 or 123456')).toBe('call +<number> or <number>');
    // An address of the game's own, with what a room or a sign-in carries after it, and a machine's address.
    expect(scrub('could not open /en/room?code=K7M2QX#access_token=x for 192.168.1.20')).toBe('could not open /en/room for <ip>');
    expect(scrub('engine 0.35.0/1.35.0')).toBe('engine 0.35.0/1.35.0');
    // What an error says to be useful stays.
    expect(scrub('Cannot read properties of undefined (reading \'round\') at play (page-3f2a1b9c.js:1:2345)')).toBe('Cannot read properties of undefined (reading \'round\') at play (page-3f2a1b9c.js:1:2345)');
  });

  it('cleans in a time that grows with the text, not with its square, whatever the text', () => {
    const worst = ['a'.repeat(50_000), 'a.'.repeat(25_000), 'eyJ'.repeat(17_000), 'http://'.repeat(7_000), '/a'.repeat(25_000), `${'a'.repeat(30_000)}@`, '1.'.repeat(25_000)];
    for (const text of worst) {
      const started = performance.now();
      scrub(text);
      expect(performance.now() - started, text.slice(0, 12)).toBeLessThan(250);
    }
  });

  it('keeps a page as one of the game\'s own, and nothing a player could make up: no query, no hash, no language', () => {
    expect(placeOf('/es/play?code=ABC123#x')).toBe('/play');
    expect(placeOf('/ru')).toBe('/');
    expect(placeOf('/en/room')).toBe('/room');
    expect(placeOf('/play')).toBe('/play');
    expect(placeOf('/es/room/0a4fb313-975e-4fbb-a503-2087414daddf')).toBe('/room');
    expect(placeOf('nonsense')).toBe('/other');
    expect(placeOf('/es/@everyone click https://evil.example')).toBe('/other');
    expect(placeOf(`/${'x'.repeat(400)}`)).toBe('/other');
  });

  it("keeps the app's screens under app:, as a page's (no query, no hash, nothing after the screen's own name), and the web's places as they were", () => {
    expect(placeOf('app:/play')).toBe('app:/play');
    expect(placeOf('app:/')).toBe('app:/');
    expect(placeOf('app:/rankings?tab=friends')).toBe('app:/rankings');
    expect(placeOf('app:/room#x')).toBe('app:/room');
    expect(placeOf('app:/settings')).toBe('app:/settings');
    expect(placeOf('app:/x/y')).toBe('/other');
    expect(placeOf('app:/play/0a4fb313-975e-4fbb-a503-2087414daddf')).toBe('app:/play');
    expect(placeOf('app:/es/play')).toBe('/other');
    expect(placeOf('app:/dev')).toBe('/other');
    expect(placeOf('app:play')).toBe('/other');
    expect(placeOf('app:')).toBe('/other');
    expect(placeOf('APP:/play')).toBe('/other');
    expect(placeOf('app:app:/play')).toBe('/other');
    expect(placeOf('/app:/play')).toBe('/other');
    expect(placeOf('/settings')).toBe('/other');
    for (const page of APP_PAGES) expect(placeOf(`app:${page}`)).toBe(`app:${page}`);
    expect([...APP_PAGES].sort()).toEqual(['/', '/challenge', '/collection', '/legal', '/new', '/play', '/player', '/rankings', '/records', '/room', '/settings']);
  });

  it('knows every page the game has', () => {
    const app = fileURLToPath(new URL('../../../apps/web/src/app/[locale]/', import.meta.url));
    const pages = readdirSync(app, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => `/${entry.name}`);
    expect([...PAGES].sort()).toEqual(['/', ...pages].sort());
  });
});

describe('what makes two errors one kind', () => {
  it('reads the place in the code from the stack, never the numbers in its first line', async () => {
    const at = (round: number) => `Error: invariant broken at round ${round} (rng.cards): not a saved stream.\n    at check (https://a.app/_next/static/chunks/page-3f2a1b9c8d.js:1:2345)`;
    expect(await fingerprintOf('page', '/play', 'invariant broken at round 12 (rng.cards): not a saved stream.', at(12))).toBe(await fingerprintOf('page', '/play', 'invariant broken at round 13 (rng.cards): not a saved stream.', at(13)));
  });

  it('is the source, the place, the message and the first frame of the stack, whatever the build, the line or the numbers in it', async () => {
    const one = await fingerprintOf('page', '/play', 'step 12 refused', 'Error\n    at play (https://a.app/_next/static/chunks/page-3f2a1b9c8d.js:1:2345)');
    const two = await fingerprintOf('page', '/play', 'step 13 refused', 'Error\n    at play (https://a.app/_next/static/chunks/page-77aa0e1f42.js:1:9999)');
    expect(one).toBe(two);
    expect(one).toMatch(/^[0-9a-f]{32}$/);
    expect(await fingerprintOf('page', '/new', 'step 12 refused', null)).not.toBe(await fingerprintOf('page', '/play', 'step 12 refused', null));
    expect(await fingerprintOf('page', '/play', 'other', null)).not.toBe(await fingerprintOf('page', '/play', 'step 12 refused', null));
    expect(await fingerprintOf('function', 'ranked', 'server', null)).not.toBe(await fingerprintOf('page', 'ranked', 'server', null));
  });
});

describe('reporting the errors of a page', () => {
  it("notes the app's reports under its own screens, apart from the web's", async () => {
    const { deps, noted } = fake();
    await reportErrors(deps, ME, { reports: [report({ place: 'app:/play?code=QQQ' }), report({ place: '/es/play' }), report({ place: 'app:/kit' })] });
    expect(noted.map((row) => row.place)).toEqual(['app:/play', '/play', '/other']);
    expect(noted[0].fingerprint).not.toBe(noted[1].fingerprint);
  });

  it('notes each report, cleaned, and keeps nothing of who sent it', async () => {
    const { deps, noted } = fake();
    const reply = await reportErrors(deps, ME, { reports: [report({ message: `no game ${ME} for ana@x.com`, place: '/es/play?code=QQQ' })] });
    expect(reply).toEqual({ status: 200, body: { noted: 1 } });
    expect(noted[0]).toMatchObject({ source: 'page', place: '/play', message: 'no game <id> for <email>', build: '0.35.0/1.35.0', browser: 'Chrome 140' });
    expect(noted[0].fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(noted)).not.toContain(ME);
  });

  it('cuts what is longer than is kept, rather than refusing it', async () => {
    const { deps, noted } = fake();
    await reportErrors(deps, ME, { reports: [report({ message: 'x '.repeat(450), stack: 'at a\n'.repeat(1500), build: 'b'.repeat(150), browser: 'c'.repeat(150) })] });
    expect(noted[0].message.length).toBeLessThanOrEqual(500);
    expect(noted[0].stack?.length).toBeLessThanOrEqual(4000);
    expect(noted[0].build?.length).toBeLessThanOrEqual(80);
    expect(noted[0].browser?.length).toBeLessThanOrEqual(80);
  });

  it('leaves out the noise of other people\'s code: extensions, the empty "Script error." and the ResizeObserver loop', async () => {
    const { deps, noted } = fake();
    const reply = await reportErrors(deps, ME, {
      reports: [report({ message: 'Script error.' }), report({ message: 'ResizeObserver loop completed with undelivered notifications.' }), report({ stack: 'at x (chrome-extension://abc/content.js:1:1)' }), report()],
    });
    expect(reply.body).toEqual({ noted: 1 });
    expect(noted).toHaveLength(1);
  });

  it('sends an alert only when the database says the kind is worth one, and the alert says what and where', async () => {
    const { deps, alerts } = fake([{ seen: 1, alert: true }, { seen: 2, alert: false }]);
    await reportErrors(deps, ME, { reports: [report({ message: 'the game refused a step' }), report({ message: 'other' })] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('the game refused a step');
    expect(alerts[0]).toContain('/play');
    expect(alerts[0]).toContain('0.35.0/1.35.0');
    expect(alerts[0]).not.toContain(ME);
  });

  it('counts the call before anything is noted, and refuses beyond the limit', async () => {
    const { deps, noted, asked, state } = fake();
    state.allowed = false;
    expect(await reportErrors(deps, ME, { reports: [report()] })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(noted).toEqual([]);
    expect(asked).toEqual([ME]);
  });

  it('refuses, before counting the call, a report too long to be a page\'s', async () => {
    const { deps, noted, asked } = fake();
    for (const over of [{ message: 'x'.repeat(1001) }, { stack: 'x'.repeat(8001) }, { place: '/'.repeat(501) }, { build: 'b'.repeat(201) }, { browser: 'c'.repeat(201) }]) {
      expect(await reportErrors(deps, ME, { reports: [report(over)] }), Object.keys(over)[0]).toMatchObject({ status: 400 });
    }
    expect(noted).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('takes out what a terminal or the database would read as something else: control characters and halves of a character', async () => {
    const { deps, noted } = fake();
    await reportErrors(deps, ME, { reports: [report({ message: 'a\u0000b\u001b]52;c;aGk=\u0007c\ud83d', stack: 'line one\n\tat x (a.js)\u001b[2J', build: 'v\u0000', browser: 'B\u009b' })] });
    expect(noted[0]).toMatchObject({ message: 'a b ]52;c;aGk= c\ufffd', stack: 'line one\n\tat x (a.js) [2J', build: 'v ', browser: 'B ' });
  });

  it('refuses what is not a batch of reports', async () => {
    const { deps, noted, asked } = fake();
    expect(await reportErrors(deps, ME, 'boom')).toMatchObject({ status: 400 });
    expect(await reportErrors(deps, ME, { reports: [] })).toMatchObject({ status: 400 });
    expect(await reportErrors(deps, ME, { reports: Array.from({ length: 11 }, () => report()) })).toMatchObject({ status: 400 });
    expect(await reportErrors(deps, ME, { reports: [{ stack: 'no message' }] })).toMatchObject({ status: 400 });
    expect(await reportErrors(deps, ME, { reports: [report({ place: 7 })] })).toMatchObject({ status: 400 });
    expect(noted).toEqual([]);
    expect(asked).toEqual([]);
  });
});

describe('the alert', () => {
  it('speaks each service in its own way, and only over https', () => {
    expect(alertRequest('https://hooks.slack.com/services/T/B/x', 'Title', 'Body')).toEqual({ url: 'https://hooks.slack.com/services/T/B/x', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Title\n```Body```' }) } });
    expect(alertRequest('https://discord.com/api/webhooks/1/x', 'Title', 'Body')?.init.body).toBe(JSON.stringify({ content: 'Title\n```\nBody\n```', allowed_mentions: { parse: [] } }));
    expect(alertRequest('https://ntfy.sh/ratrace-x1y2', 'Title', 'Body')).toEqual({ url: 'https://ntfy.sh/ratrace-x1y2', init: { method: 'POST', headers: { Title: 'Title', 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Body' } });
    expect(alertRequest('http://ntfy.sh/x', 'Title', 'Body')).toBeNull();
    expect(alertRequest('not an address', 'Title', 'Body')).toBeNull();
    // What a player wrote is shown as text, never as a mention, a link or a command of the service.
    const said = '@everyone <!channel> [win](https://evil.example) ``` & <https://evil|click>';
    const discord = JSON.parse(alertRequest('https://discord.com/api/webhooks/1/x', 'Title', said)?.init.body as string) as { content: string; allowed_mentions: unknown };
    expect(discord.allowed_mentions).toEqual({ parse: [] });
    expect(discord.content).toBe("Title\n```\n@everyone <!channel> [win](https://evil.example) ''' & <https://evil|click>\n```");
    const slack = JSON.parse(alertRequest('https://hooks.slack.com/services/T/B/x', 'Title', said)?.init.body as string) as { text: string };
    expect(slack.text).toBe("Title\n```@everyone &lt;!channel&gt; [win](https://evil.example) ''' &amp; &lt;https://evil|click&gt;```");
    // A header carries plain printable characters only, or the alert would not be sent at all.
    expect(alertRequest('https://ntfy.sh/x', 'The Rat Race: é\nnew', 'Body')?.init.headers.Title).toBe('The Rat Race: ? new');
    // Discord takes two thousand characters at most.
    expect((alertRequest('https://discord.com/api/webhooks/1/x', 'T', 'b'.repeat(5000))?.init.body as string).length).toBeLessThan(2100);
  });
});

describe('the errors of a function', () => {
  const ok = new Response('{}', { status: 200 });
  it('notes what a function throws, under its name, writes the whole of it to the logs, and answers 500', async () => {
    const { deps, noted } = fake([{ seen: 1, alert: true }]);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alerts: string[] = [];
    const handler = watched('ranked', async () => {
      throw new Error(`the life ${ME} cannot be opened`);
    }, () => ({ ...deps, alert: async (title, text) => void alerts.push(`${title} ${text}`) }));
    const res = await handler(new Request('https://x/ranked', { method: 'POST' }), {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server' });
    expect(noted[0]).toMatchObject({ source: 'function', place: 'ranked', message: 'the life <id> cannot be opened' });
    expect(alerts[0]).toContain('ranked');
    // The stack stays in the function's logs, as it was before the function was watched.
    expect(logged.mock.calls[0][1]).toBeInstanceOf(Error);
    logged.mockRestore();
  });

  it('notes an answer of 500 and above with its word, and nothing else', async () => {
    const { deps, noted } = fake();
    const failing = watched('rooms', async () => new Response(JSON.stringify({ error: 'server' }), { status: 500 }), () => deps);
    expect((await failing(new Request('https://x/rooms'), {})).status).toBe(500);
    expect(noted[0]).toMatchObject({ source: 'function', place: 'rooms', message: 'answered 500: server' });
    const fine = watched('rooms', async () => ok.clone(), () => deps);
    const refused = watched('rooms', async () => new Response('{"error":"too-many"}', { status: 429 }), () => deps);
    await fine(new Request('https://x/rooms'), {});
    await refused(new Request('https://x/rooms'), {});
    expect(noted).toHaveLength(1);
  });

  it('answers as the function did even when the error cannot be noted', async () => {
    const handler = watched('engine', async () => new Response('{"error":"server"}', { status: 503 }), () => ({
      note: async () => {
        throw new Error('the database is away');
      },
      alert: async () => {},
      now: () => new Date(),
    }));
    expect((await handler(new Request('https://x/engine'), {})).status).toBe(503);
  });
});
