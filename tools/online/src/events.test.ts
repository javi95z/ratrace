import { describe, expect, it } from 'vitest';
import type { Counted as WebCounted } from '@/pwa/events';
import { callerOf, EVENTS, MAX_EVENT_BODY, PLATFORMS, readEvent, trackEvent } from '../../../supabase/functions/_shared/events.ts';
import type { Counted, EventsDeps, KeptEvent } from '../../../supabase/functions/_shared/events.ts';
import { readJson } from '../../../supabase/functions/_shared/http.ts';
import { allowedHashed, LIMITS } from '../../../supabase/functions/_shared/rate.ts';
import type { Counter } from '../../../supabase/functions/_shared/rate.ts';

// The server keeps exactly the events the web counts, each with exactly its props: a change to one
// that is not made to the other does not compile.
const fromWeb = (event: WebCounted): Counted => event;
const toWeb = (event: Counted): WebCounted => event;
void fromWeb;
void toWeb;

/** The database, kept here: what was counted, and whether the next call is within the limit. */
function fake() {
  const counted: KeptEvent[] = [];
  const asked: string[] = [];
  const state = { allowed: true };
  const deps: EventsDeps = {
    allow: async (who) => {
      asked.push(who);
      return state.allowed;
    },
    count: async (event) => {
      counted.push(event);
    },
  };
  return { deps, counted, asked, state };
}

const WHO = '0123456789abcdef0123456789abcdef';

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
    const { deps, counted, asked } = fake();
    for (const platform of PLATFORMS) {
      for (const event of EVERY) {
        expect(await trackEvent(deps, WHO, { ...event, platform })).toEqual({ status: 204, body: {} });
      }
    }
    expect(counted).toEqual(PLATFORMS.flatMap((platform) => EVERY.map((event) => ({ ...event, platform }))));
    expect(asked).toHaveLength(EVERY.length * 3);
    expect(asked.every((who) => who === WHO)).toBe(true);
  });

  it('takes an event of no props with its props left out, and keeps them as none', async () => {
    const { deps, counted } = fake();
    expect((await trackEvent(deps, WHO, { name: 'app_installed', platform: 'android' })).status).toBe(204);
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
    const { deps, counted, asked } = fake();
    expect(await trackEvent(deps, WHO, raw)).toEqual({ status: 400, body: { error: 'bad-request', field } });
    // Nothing is counted, and the database is not even asked about the limit.
    expect(counted).toEqual([]);
    expect(asked).toEqual([]);
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

  it('refuses a body larger than any event, unread', async () => {
    const event = JSON.stringify({ name: 'life_end', props: { mode: 'practice', escaped: false }, platform: 'android' });
    expect(event.length).toBeLessThan(MAX_EVENT_BODY / 4);
    const post = (body: string, headers: Record<string, string> = {}) => new Request('https://x.test/functions/v1/track', { method: 'POST', body, headers });
    expect(await readJson(post(event), MAX_EVENT_BODY)).toEqual({ value: JSON.parse(event) });
    const big = JSON.stringify({ name: 'app_installed', props: {}, platform: 'ios', pad: 'x'.repeat(MAX_EVENT_BODY) });
    expect((await readJson(post(big), MAX_EVENT_BODY) as { refusal: Response }).refusal.status).toBe(413);
    expect((await readJson(post(event, { 'content-length': String(MAX_EVENT_BODY + 1) }), MAX_EVENT_BODY) as { refusal: Response }).refusal.status).toBe(413);
    expect((await readJson(new Request('https://x.test/functions/v1/track'), MAX_EVENT_BODY) as { refusal: Response }).refusal.status).toBe(405);
  });
});

describe('the limit', () => {
  it('is two hundred a day for each caller', () => {
    expect(LIMITS.events).toEqual([200, 86_400]);
  });

  it('answers 429 and counts nothing when a caller is over it', async () => {
    const { deps, counted, state } = fake();
    state.allowed = false;
    expect(await trackEvent(deps, WHO, { name: 'share', props: { what: 'card' }, platform: 'web' })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(counted).toEqual([]);
  });

  it('holds: the two hundred and first call of a day is refused, and another caller is not held by it', async () => {
    // The database's own counter, as `take_rate_by_hash` counts: so many in a window, then no.
    const used = new Map<string, number>();
    const asked: unknown[] = [];
    const db: Counter = {
      rpc: async (name, args) => {
        asked.push(name);
        const key = `${args.who}/${args.what}`;
        used.set(key, (used.get(key) ?? 0) + 1);
        return { data: (used.get(key) ?? 0) <= args.at_most, error: null };
      },
    };
    const { deps: base, counted } = fake();
    const deps: EventsDeps = { ...base, allow: (who) => allowedHashed(db, who, 'events') };
    const event = { name: 'life_start', props: { mode: 'solo' }, platform: 'ios' };
    for (let i = 0; i < 200; i += 1) expect((await trackEvent(deps, WHO, event)).status).toBe(204);
    expect((await trackEvent(deps, WHO, event)).status).toBe(429);
    expect((await trackEvent(deps, 'fedcba9876543210fedcba9876543210', event)).status).toBe(204);
    expect(counted).toHaveLength(201);
    expect(new Set(asked)).toEqual(new Set(['take_rate_by_hash']));
  });

  it('fails, instead of letting everything through, when the calls cannot be counted', async () => {
    const db: Counter = { rpc: async () => ({ data: null, error: { message: 'the database is away' } }) };
    await expect(allowedHashed(db, WHO, 'events')).rejects.toThrow('the database is away');
  });
});

describe('who a caller is, for the limit and nothing else', () => {
  const at = new Date('2026-10-23T10:00:00.000Z');
  const headers = (ip: string) => new Headers({ 'x-forwarded-for': `${ip}, 10.0.0.1` });

  it('is a hash of the address, the day and a secret: never the address itself', async () => {
    const who = await callerOf(headers('203.0.113.7'), 'salt', at);
    expect(who).toMatch(/^[0-9a-f]{32}$/);
    expect(who).not.toContain('203');
    expect(await callerOf(headers('203.0.113.7'), 'salt', at)).toBe(who);
    // Another address, another secret or another day is another caller.
    expect(await callerOf(headers('203.0.113.8'), 'salt', at)).not.toBe(who);
    expect(await callerOf(headers('203.0.113.7'), 'pepper', at)).not.toBe(who);
    expect(await callerOf(headers('203.0.113.7'), 'salt', new Date('2026-10-24T10:00:00.000Z'))).not.toBe(who);
  });

  it('reads the address the platform saw first, and makes one caller of all who have none', async () => {
    const seen = await callerOf(new Headers({ 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': '203.0.113.7' }), 'salt', at);
    expect(seen).toBe(await callerOf(new Headers({ 'cf-connecting-ip': '198.51.100.4' }), 'salt', at));
    expect(await callerOf(new Headers({ 'x-real-ip': '203.0.113.7' }), 'salt', at)).toBe(await callerOf(headers('203.0.113.7'), 'salt', at));
    expect(await callerOf(new Headers(), 'salt', at)).toBe(await callerOf(new Headers(), 'salt', at));
    expect(await callerOf(new Headers(), 'salt', at)).toMatch(/^[0-9a-f]{32}$/);
  });
});
