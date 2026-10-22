import { describe, expect, it } from 'vitest';
import type { Counted as WebCounted } from '@/pwa/events';
import { readFileSync } from 'node:fs';
import { answerTrack, EVENTS, MAX_EVENT_BODY, PLATFORMS, readEvent, trackEvent } from '../../../supabase/functions/_shared/events.ts';
import type { Counted, EventsDeps, KeptEvent } from '../../../supabase/functions/_shared/events.ts';
import { readJson } from '../../../supabase/functions/_shared/http.ts';

// The server keeps exactly the events the web counts, each with exactly its props: a change to one
// that is not made to the other does not compile.
const fromWeb = (event: WebCounted): Counted => event;
const toWeb = (event: Counted): WebCounted => event;
void fromWeb;
void toWeb;

/** The database, kept here: what it was handed to count, and whether the day's ceiling is reached. */
function fake() {
  const counted: KeptEvent[] = [];
  const handed: unknown[][] = [];
  const state = { full: false };
  const deps: EventsDeps = {
    count: async (...args) => {
      handed.push(args);
      if (state.full) return false;
      counted.push(args[0]);
      return true;
    },
  };
  return { deps, counted, handed, state };
}

/** Every event the game counts, with every value each of its props may take. */
const EVERY: Array<{ name: string; props: Record<string, string | boolean> }> = [
  ...['solo', 'ranked', 'challenge', 'practice'].map((mode) => ({ name: 'life_start', props: { mode } })),
  ...['solo', 'ranked', 'challenge', 'practice'].flatMap((mode) => [true, false].map((escaped) => ({ name: 'life_end', props: { mode, escaped } }))),
  { name: 'challenge_attempt', props: {} },
  ...['friends', 'public'].map((kind) => ({ name: 'game_start', props: { kind } })),
  ...['code', 'link', 'quick'].map((via) => ({ name: 'game_join', props: { via } })),
  { name: 'account_kept', props: {} },
  { name: 'app_installed', props: {} },
  ...['card', 'invite'].map((what) => ({ name: 'share', props: { what } })),
];

describe('the events the game counts', () => {
  it('are the eight the web counts, on the three platforms the game runs on', () => {
    expect(Object.keys(EVENTS).sort()).toEqual(['account_kept', 'app_installed', 'challenge_attempt', 'game_join', 'game_start', 'life_end', 'life_start', 'share']);
    expect([...PLATFORMS]).toEqual(['ios', 'android', 'web']);
    expect(new Set(EVERY.map((event) => event.name)).size).toBe(8);
  });

  it('keeps and counts each of the eight with each of its allowed props, on each platform', async () => {
    const { deps, counted } = fake();
    for (const platform of PLATFORMS) {
      for (const event of EVERY) {
        expect(await trackEvent(deps, { ...event, platform })).toEqual({ status: 204, body: {} });
      }
    }
    expect(counted).toEqual(PLATFORMS.flatMap((platform) => EVERY.map((event) => ({ ...event, platform }))));
  });

  it('takes an event of no props with its props left out, and keeps them as none', async () => {
    const { deps, counted } = fake();
    expect((await trackEvent(deps, { name: 'app_installed', platform: 'android' })).status).toBe(204);
    expect(counted).toEqual([{ name: 'app_installed', props: {}, platform: 'android' }]);
  });

  it('keeps the props it knows, built afresh, never the object it was sent', () => {
    const sent = JSON.parse('{"name":"life_end","props":{"escaped":true,"mode":"solo"},"platform":"ios"}');
    const read = readEvent(sent);
    expect(read).toEqual({ name: 'life_end', props: { mode: 'solo', escaped: true }, platform: 'ios' });
    expect('name' in read && read.props).not.toBe(sent.props);
  });
});

describe('what is refused', () => {
  const refused = async (raw: unknown, field: string) => {
    const { deps, handed } = fake();
    expect(await trackEvent(deps, raw)).toEqual({ status: 400, body: { error: 'bad-request', field } });
    // The database is not even asked.
    expect(handed).toEqual([]);
  };

  it('refuses an event the game does not count, and names that are not events of their own', async () => {
    await refused({ name: 'page_view', props: {}, platform: 'web' }, 'name');
    await refused({ name: 'LIFE_START', props: { mode: 'solo' }, platform: 'web' }, 'name');
    await refused({ name: 'toString', props: {}, platform: 'web' }, 'name');
    await refused({ name: '__proto__', props: {}, platform: 'web' }, 'name');
    await refused({ name: 7, props: {}, platform: 'web' }, 'name');
    await refused({ props: {}, platform: 'web' }, 'name');
  });

  it('refuses a platform the game does not run on', async () => {
    await refused({ name: 'app_installed', props: {}, platform: 'windows' }, 'platform');
    await refused({ name: 'app_installed', props: {} }, 'platform');
    await refused({ name: 'app_installed', props: {}, platform: 'IOS' }, 'platform');
  });

  it('refuses a prop the event does not have, and an event missing one it has', async () => {
    await refused({ name: 'life_start', props: { mode: 'solo', lifeId: 'nurse' }, platform: 'ios' }, 'props');
    await refused({ name: 'life_start', props: {}, platform: 'ios' }, 'props');
    await refused({ name: 'life_end', props: { mode: 'solo' }, platform: 'ios' }, 'props');
    await refused({ name: 'account_kept', props: { via: 'google' }, platform: 'web' }, 'props');
    await refused({ name: 'share', props: { what: 'card', what2: 'card' }, platform: 'web' }, 'props');
  });

  it('refuses a value a prop may not take, even one that means the same', async () => {
    await refused({ name: 'life_start', props: { mode: 'hardcore' }, platform: 'ios' }, 'props');
    await refused({ name: 'life_end', props: { mode: 'solo', escaped: 'true' }, platform: 'ios' }, 'props');
    await refused({ name: 'life_end', props: { mode: 'solo', escaped: 1 }, platform: 'ios' }, 'props');
    await refused({ name: 'game_join', props: { via: ['code'] }, platform: 'android' }, 'props');
    await refused({ name: 'game_start', props: { kind: { friends: true } }, platform: 'android' }, 'props');
    await refused({ name: 'share', props: { what: null }, platform: 'android' }, 'props');
  });

  it('refuses a prop that looks like an id, a score or a name, wherever it is put', async () => {
    await refused({ name: 'life_start', props: { mode: '0a4fb313-975e-4fbb-a503-2087414daddf' }, platform: 'ios' }, 'props');
    await refused({ name: 'life_start', props: { mode: 'solo', id: '0a4fb313-975e-4fbb-a503-2087414daddf' }, platform: 'ios' }, 'props');
    await refused({ name: 'life_end', props: { mode: 'solo', escaped: true, score: 1234 }, platform: 'ios' }, 'props');
    await refused({ name: 'game_join', props: { via: 'code', code: 'K7M2QX' }, platform: 'web' }, 'props');
    await refused({ name: 'account_kept', props: { email: 'ana@example.com' }, platform: 'web' }, 'props');
    await refused({ name: 'app_installed', props: {}, platform: 'ios', user: '0a4fb313-975e-4fbb-a503-2087414daddf' }, 'body');
    await refused({ name: 'app_installed', props: {}, platform: 'ios', device: 'ExponentPushToken[abc]' }, 'body');
  });

  it('refuses what is not an event at all', async () => {
    for (const raw of [null, 'life_start', 42, [], [{ name: 'app_installed', props: {}, platform: 'ios' }]]) await refused(raw, 'body');
    await refused({ name: 'app_installed', props: [], platform: 'ios' }, 'props');
    await refused({ name: 'app_installed', props: 'none', platform: 'ios' }, 'props');
    await refused({ name: 'app_installed', props: null, platform: 'ios' }, 'props');
  });

  it('refuses a body larger than any event, unread, even one sent in chunks that never says its size', async () => {
    const event = JSON.stringify({ name: 'life_end', props: { mode: 'practice', escaped: false }, platform: 'android' });
    expect(event.length).toBeLessThan(MAX_EVENT_BODY / 4);
    const post = (body: string, headers: Record<string, string> = {}) => new Request('https://x.test/functions/v1/track', { method: 'POST', body, headers });
    expect(await readJson(post(event), MAX_EVENT_BODY)).toEqual({ value: JSON.parse(event) });
    const big = JSON.stringify({ name: 'app_installed', props: {}, platform: 'ios', pad: 'x'.repeat(MAX_EVENT_BODY) });
    expect((await readJson(post(big), MAX_EVENT_BODY) as { refusal: Response }).refusal.status).toBe(413);
    expect((await readJson(post(event, { 'content-length': String(MAX_EVENT_BODY + 1) }), MAX_EVENT_BODY) as { refusal: Response }).refusal.status).toBe(413);
    expect((await readJson(new Request('https://x.test/functions/v1/track'), MAX_EVENT_BODY) as { refusal: Response }).refusal.status).toBe(405);
    // Chunks without end: the reading stops once it is past the cap, and the rest is never asked for.
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(256)));
      },
    });
    const chunked = new Request('https://x.test/functions/v1/track', { method: 'POST', body: endless, duplex: 'half' } as RequestInit);
    expect(chunked.headers.get('content-length')).toBeNull();
    expect((await readJson(chunked, MAX_EVENT_BODY) as { refusal: Response }).refusal.status).toBe(413);
    expect(pulled).toBeLessThan(20);
    // A body of letters that take several bytes each, within the cap in characters, is read whole.
    const russian = JSON.stringify({ name: 'share', props: { what: 'card' }, platform: 'web', note: 'ж'.repeat(300) });
    expect(russian.length).toBeLessThan(MAX_EVENT_BODY);
    expect(await readJson(post(russian), MAX_EVENT_BODY)).toEqual({ value: JSON.parse(russian) });
  });
});

describe('the ceiling of a day', () => {
  it('answers 429 and counts nothing once the day\'s counts of an event on a platform are at their ceiling', async () => {
    const { deps, counted, state } = fake();
    state.full = true;
    expect(await trackEvent(deps, { name: 'share', props: { what: 'card' }, platform: 'web' })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(counted).toEqual([]);
  });

  it('is held by the database, in one constant of twenty thousand, with nothing kept about callers', () => {
    const migration = readFileSync(new URL('../../../supabase/migrations/20261022144500_app_events.sql', import.meta.url), 'utf8');
    expect(migration.match(/ceiling constant integer := (\d+);/)?.[1]).toBe('20000');
    expect(migration).not.toMatch(/\b(hash|address|ip|caller)\b\s+text/i);
  });
});

describe('a call of track', () => {
  const KEY = { apikey: 'sb_publishable_test' };
  const call = (body: unknown, headers: Record<string, string>) =>
    new Request('https://x.test/functions/v1/track', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });
  const event = { name: 'life_start', props: { mode: 'solo' }, platform: 'ios' };

  it('counts the event of two callers alike, handing the database the event and nothing about either', async () => {
    const { deps, handed } = fake();
    const first = await answerTrack(call(event, { ...KEY, 'x-forwarded-for': '203.0.113.7', 'user-agent': 'A', authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.x' }), deps);
    const second = await answerTrack(call(event, { ...KEY, 'cf-connecting-ip': '198.51.100.4', 'user-agent': 'B' }), deps);
    expect([first.status, second.status]).toEqual([204, 204]);
    expect(await first.text()).toBe('');
    expect(handed).toEqual([[{ name: 'life_start', props: { mode: 'solo' }, platform: 'ios' }], [{ name: 'life_start', props: { mode: 'solo' }, platform: 'ios' }]]);
  });

  it('refuses a call with no key before anything is read', async () => {
    const { deps, handed } = fake();
    const answer = await answerTrack(call(event, {}), deps);
    expect(answer.status).toBe(401);
    expect(await answer.json()).toEqual({ error: 'no-key' });
    expect((await answerTrack(call(event, { apikey: '' }), deps)).status).toBe(401);
    expect(handed).toEqual([]);
  });

  it('answers what is not an event 400, and an event past the ceiling 429', async () => {
    const { deps, state } = fake();
    const bad = await answerTrack(call({ ...event, id: 'x' }, KEY), deps);
    expect([bad.status, await bad.json()]).toEqual([400, { error: 'bad-request', field: 'body' }]);
    state.full = true;
    const full = await answerTrack(call(event, KEY), deps);
    expect([full.status, await full.json()]).toEqual([429, { error: 'too-many' }]);
  });

  it('is behind the project\'s publishable key in the function itself', () => {
    const source = readFileSync(new URL('../../../supabase/functions/track/index.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/withSupabase\(\s*(\/\/[^\n]*\n\s*)?\{ auth: 'publishable:\*' \}/);
  });
});
