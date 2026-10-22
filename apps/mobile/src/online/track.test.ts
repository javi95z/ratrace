import type { Sent } from '@ratrace/online/errors';
import type { Cloud, TrackedEvent } from '@ratrace/online/supabase';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readEvent } from '../../../../supabase/functions/_shared/events.ts';
import type { Counted } from '../game/events';
import { KvStore, kvText } from '../kvStore';
import { servers } from '../testing/cloudServers';
import { appState } from '../testing/fakes';
import { released } from '../ui/testing/released';
import { forgetThePhone, phoneOnline } from './index';
import { countInstalled, INSTALL_TRIES, phoneTrack, trackTo } from './track';
import type { KeptText, TrackParts } from './track';

/*
 * What the game counts of how it is played, from the phone to the game's own project (the function `track`): the web's eight events, each with the
 * web's props and the phone's platform, in a release build only, never awaited, never kept for later, never with anything of who.
 */

/** Every event the game counts, as the web types them (apps/web/src/pwa/events.ts). */
const EVERY: Counted[] = [
  { name: 'life_start', mode: 'solo' },
  { name: 'life_end', mode: 'challenge', escaped: true },
  { name: 'challenge_attempt' },
  { name: 'game_start', kind: 'public' },
  { name: 'game_join', via: 'link' },
  { name: 'account_kept' },
  { name: 'app_installed' },
  { name: 'share', what: 'invite' },
];

/** The cloud as the sender reaches it: what it was handed to count, and what it answers. */
function cloudCounting(answer: () => Promise<Sent> = async () => 'sent') {
  const sent: TrackedEvent[] = [];
  const cloud = { track: vi.fn(async (event: TrackedEvent) => (sent.push(event), answer())) } as unknown as Cloud;
  return { cloud, sent };
}
/** The sender's world: a release build on an iPhone, connected, with the cloud given. */
const parts = (cloud: Cloud | null, over: Partial<TrackParts> = {}): TrackParts => ({ cloud: () => cloud, platform: 'ios', release: true, connected: () => true, ...over });
/** Lets what was sent on its way get there. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A note kept in memory, as the phone's store keeps short texts. */
function notes(): KeptText & { kept: Map<string, string> } {
  const kept = new Map<string, string>();
  return { kept, getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => void kept.set(key, value) };
}
/** An account that tells its listeners when the test says it changed. */
function account() {
  const listeners = new Set<() => void>();
  return { subscribe: (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener)), changed: () => [...listeners].forEach((one) => one()), listening: () => listeners.size };
}

describe('the events, as the phone counts them', () => {
  it('sends each of the eight with the web\'s props and the phone\'s platform, as the function reads them, and nothing more', async () => {
    const { cloud, sent } = cloudCounting();
    const track = trackTo(parts(cloud));
    for (const event of EVERY) expect(track(event)).toBeUndefined();
    await settle();
    expect(sent).toEqual([
      { name: 'life_start', props: { mode: 'solo' }, platform: 'ios' },
      { name: 'life_end', props: { mode: 'challenge', escaped: true }, platform: 'ios' },
      { name: 'challenge_attempt', props: {}, platform: 'ios' },
      { name: 'game_start', props: { kind: 'public' }, platform: 'ios' },
      { name: 'game_join', props: { via: 'link' }, platform: 'ios' },
      { name: 'account_kept', props: {}, platform: 'ios' },
      { name: 'app_installed', props: {}, platform: 'ios' },
      { name: 'share', props: { what: 'invite' }, platform: 'ios' },
    ]);
    // Every one is an event the function takes, whole: what it keeps is what was sent.
    for (const body of sent) expect(readEvent(body)).toEqual(body);
    // And an Android phone says so.
    const android = cloudCounting();
    trackTo(parts(android.cloud, { platform: 'android' }))({ name: 'share', what: 'card' });
    await settle();
    expect(android.sent).toEqual([{ name: 'share', props: { what: 'card' }, platform: 'android' }]);
  });

  it('sends nothing in development, as the web counts nothing out of production, nor from anything that is not a phone', async () => {
    const { cloud, sent } = cloudCounting();
    for (const event of EVERY) trackTo(parts(cloud, { release: false }))(event);
    for (const event of EVERY) trackTo(parts(cloud, { platform: 'web' }))(event);
    await settle();
    expect(sent).toEqual([]);
  });

  it('drops an event while the phone is offline, or before there is a cloud to send it to, and never sends it later', async () => {
    const { cloud, sent } = cloudCounting();
    let online = false;
    let reached: Cloud | null = null;
    const track = trackTo(parts(null, { cloud: () => reached, connected: () => online }));
    track({ name: 'share', what: 'card' });
    reached = cloud;
    track({ name: 'share', what: 'invite' });
    online = true;
    await settle();
    expect(sent).toEqual([]);
    track({ name: 'account_kept' });
    await settle();
    expect(sent).toEqual([{ name: 'account_kept', props: {}, platform: 'ios' }]);
  });

  it('is silent when an event is refused, cannot be sent, or the cloud breaks: counting is never in the way of the game', async () => {
    for (const answer of [async (): Promise<Sent> => 'never', async (): Promise<Sent> => 'later', () => Promise.reject(new Error('no network'))]) {
      const { cloud } = cloudCounting(answer);
      expect(() => trackTo(parts(cloud))({ name: 'life_start', mode: 'ranked' })).not.toThrow();
    }
    const throwing = { track: () => { throw new Error('broken'); } } as unknown as Cloud;
    expect(() => trackTo(parts(throwing))({ name: 'life_start', mode: 'ranked' })).not.toThrow();
    expect(() => trackTo(parts(null, { cloud: () => { throw new Error('no cloud'); } }))({ name: 'account_kept' })).not.toThrow();
    // A cloud that counts nothing (one made before there was a function to count with) is no cloud to count with.
    expect(() => trackTo(parts({} as Cloud))({ name: 'account_kept' })).not.toThrow();
    // Nothing rejected goes unheard: the test would fail on it.
    await settle();
  });
});

describe('the install, counted once', () => {
  it('is counted on the first launch, once the cloud is there, and never on a launch after it', async () => {
    const { cloud, sent } = cloudCounting();
    const noted = notes();
    const who = account();
    let reached: Cloud | null = null;
    countInstalled(parts(null, { cloud: () => reached }), [who], noted);
    await settle();
    expect(sent).toEqual([]);
    // The account connects as the app starts: the install goes then.
    reached = cloud;
    who.changed();
    who.changed();
    await settle();
    expect(sent).toEqual([{ name: 'app_installed', props: {}, platform: 'ios' }]);
    expect(who.listening()).toBe(0);
    // The next launch: noted, so nothing.
    const next = account();
    countInstalled(parts(cloud), [next], noted);
    next.changed();
    await settle();
    expect(sent).toHaveLength(1);
    expect(next.listening()).toBe(0);
  });

  it('waits on the first launch for a connection, tries again on that launch when it did not get through, and never on another', async () => {
    let answer: Sent = 'later';
    const { cloud, sent } = cloudCounting(async () => answer);
    const noted = notes();
    const who = account();
    const connection = account();
    let online = false;
    countInstalled(parts(cloud, { connected: () => online }), [who, connection], noted);
    await settle();
    expect(sent).toEqual([]);
    // The network comes back: tried, and it did not get through.
    online = true;
    connection.changed();
    await settle();
    expect(sent).toHaveLength(1);
    // Tried again on the same launch, as the connection or the account changes, until it gets through.
    connection.changed();
    await settle();
    expect(sent).toHaveLength(2);
    answer = 'sent';
    who.changed();
    await settle();
    expect(sent).toHaveLength(3);
    expect(who.listening() + connection.listening()).toBe(0);
    // Never on the next launch, whatever became of it.
    const next = account();
    countInstalled(parts(cloud), [next], noted);
    next.changed();
    await settle();
    expect(sent).toHaveLength(3);
  });

  it('gives up on the launch after a few tries that did not get through, and at once on one the function refused', async () => {
    const { cloud, sent } = cloudCounting(async () => 'later');
    const who = account();
    countInstalled(parts(cloud), [who], notes());
    for (let change = 0; change < 2 * INSTALL_TRIES; change += 1) {
      await settle();
      who.changed();
    }
    await settle();
    expect(sent).toHaveLength(INSTALL_TRIES);
    expect(who.listening()).toBe(0);

    const refused = cloudCounting(async () => 'never');
    const again = account();
    countInstalled(parts(refused.cloud), [again], notes());
    await settle();
    again.changed();
    await settle();
    expect(refused.sent).toHaveLength(1);
    expect(again.listening()).toBe(0);
  });

  it('notes nothing and sends nothing in development: the first release launch is the one counted', async () => {
    const { cloud, sent } = cloudCounting();
    const noted = notes();
    const who = account();
    countInstalled(parts(cloud, { release: false }), [who], noted);
    who.changed();
    await settle();
    expect(sent).toEqual([]);
    expect(noted.kept.size).toBe(0);
    expect(who.listening()).toBe(0);
    countInstalled(parts(cloud), [account()], noted);
    await settle();
    expect(sent).toEqual([{ name: 'app_installed', props: {}, platform: 'ios' }]);
  });

  it('counts nothing on a phone that keeps nothing, rather than on every launch', async () => {
    const { cloud, sent } = cloudCounting();
    const broken: KeptText = { getItem: () => { throw new Error('no store'); }, setItem: () => { throw new Error('no store'); } };
    expect(() => countInstalled(parts(cloud), [account()], broken)).not.toThrow();
    await settle();
    expect(sent).toEqual([]);
  });
});

describe('the phone\'s sender, over the phone\'s cloud', () => {
  const URL_OF_PROJECT = 'https://abcdefghijklmnop.supabase.co';
  afterEach(() => {
    appState.set('background');
    forgetThePhone();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts to the project\'s `track` function through a client with no session, with the publishable key and no player\'s token, the install once', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', URL_OF_PROJECT);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    const project = servers();
    vi.stubGlobal('fetch', project.fetch);
    const online = phoneOnline(new KvStore());
    const track = phoneTrack(online.account, kvText, { release: true, platform: 'android' });
    // Before the account has connected there is nowhere to send to: dropped.
    track({ name: 'share', what: 'card' });
    await online.account.start('en');
    await new Promise((resolve) => setTimeout(resolve, 20));
    track({ name: 'life_start', mode: 'solo' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const counted = project.fetch.mock.calls.filter(([input]) => String(input).startsWith(`${URL_OF_PROJECT}/functions/v1/track`));
    const bodies = counted.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual([
      { name: 'app_installed', props: {}, platform: 'android' },
      { name: 'life_start', props: { mode: 'solo' }, platform: 'android' },
    ]);
    for (const [, init] of counted) {
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('apikey')).toBe('sb_publishable_x');
      // The guest is signed in, and still no token of theirs goes with an event: only the publishable key.
      expect(new Headers(init?.headers).get('authorization')).toBeNull();
    }
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    // While the player's own calls carry their session, as they must.
    const theirs = project.fetch.mock.calls.filter(([input]) => String(input).includes('/rest/v1/'));
    expect(theirs.length).toBeGreaterThan(0);
    for (const [, init] of theirs) expect(new Headers(init?.headers).get('authorization')).toMatch(/^Bearer ey/);

    // The next launch of the app: the install is not counted again.
    appState.set('background');
    forgetThePhone();
    project.fetch.mockClear();
    const next = phoneOnline(new KvStore());
    phoneTrack(next.account, kvText, { release: true, platform: 'android' });
    appState.set('active');
    await next.account.start('en');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(project.fetch.mock.calls.filter(([input]) => String(input).includes('/functions/v1/track'))).toEqual([]);
  });

  it('is what the game counts with: the game\'s context hands it the account, once for each start of the app', () => {
    const context = readFileSync(new URL('../game/context.tsx', import.meta.url), 'utf8');
    expect(context).toContain('track: phoneTrack(online.account, kvText) }');
    expect(context.match(/\bphoneTrack\(/g)).toHaveLength(1);
  });

  it('sends nothing in a build with no project', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const online = phoneOnline(new KvStore());
    const track = phoneTrack(online.account, kvText, { release: true, platform: 'ios' });
    for (const event of EVERY) track(event);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads a release build as one: `__DEV__` written in as `false` there, the build is said to be a release', () => {
    const built = released(fileURLToPath(new URL('./track.ts', import.meta.url)));
    expect(built).toContain('var isRelease = () => true;');
  });

  it('sends nothing out of a release build: the sender reads the build as development in a test', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', URL_OF_PROJECT);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    const project = servers();
    vi.stubGlobal('fetch', project.fetch);
    const online = phoneOnline(new KvStore());
    const track = phoneTrack(online.account, kvText, { platform: 'ios' });
    await online.account.start('en');
    track({ name: 'life_start', mode: 'solo' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(project.asked.filter((one) => one.includes('/functions/v1/track'))).toEqual([]);
  });
});
