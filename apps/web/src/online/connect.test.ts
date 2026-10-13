import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectSupabase } from './connect';

/** The parts of the Supabase client the game uses, answering as told and remembering what they were asked. */
const client = vi.hoisted(() => {
  const asked: unknown[][] = [];
  const answers: Record<string, unknown> = {};
  const listeners: Array<(event: string, session: unknown) => void> = [];
  return {
    asked,
    answers,
    listeners,
    created: [] as unknown[][],
    make: () => ({
      auth: {
        getSession: async () => answers.getSession,
        signInAnonymously: async () => answers.signInAnonymously,
        linkIdentity: async (...a: unknown[]) => (asked.push(['linkIdentity', ...a]), answers.linkIdentity),
        signInWithOAuth: async (...a: unknown[]) => (asked.push(['signInWithOAuth', ...a]), answers.signInWithOAuth),
        onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
          listeners.push(listener);
          return { data: { subscription: { unsubscribe: () => listeners.splice(listeners.indexOf(listener), 1) } } };
        },
      },
      from: (table: string) => ({
        upsert: async (...a: unknown[]) => (asked.push(['upsert', table, ...a]), answers.upsert),
      }),
    }),
  };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a: unknown[]) => (client.created.push(a), client.make()) }));

const user = { id: 'u-1', is_anonymous: true, email: undefined };
beforeEach(() => {
  client.asked.length = 0;
  client.created.length = 0;
  client.listeners.length = 0;
  Object.assign(client.answers, {
    getSession: { data: { session: null }, error: null },
    signInAnonymously: { data: { user }, error: null },
    linkIdentity: { data: {}, error: null },
    signInWithOAuth: { data: {}, error: null },
    upsert: { error: null },
  });
});

describe('the cloud, made from the Supabase client', () => {
  it('is made with the two public values, and keeps the session in the browser', async () => {
    await connectSupabase('https://project.supabase.co', 'sb_publishable_x');
    expect(client.created[0].slice(0, 2)).toEqual(['https://project.supabase.co', 'sb_publishable_x']);
    expect(client.created[0][2]).toMatchObject({ auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
  });

  it('says who is signed in, or nobody', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.currentUser()).toBeNull();
    client.answers.getSession = { data: { session: { user: { id: 'u-2', is_anonymous: false, email: 'ana@example.com' } } }, error: null };
    expect(await cloud.currentUser()).toEqual({ id: 'u-2', is_anonymous: false, email: 'ana@example.com' });
  });

  it('fails, instead of answering "nobody", when it could not find out who is signed in', async () => {
    // A stored session that could not be renewed comes back as no session and an error. Reading that as
    // "nobody" would have the game make a new guest over the player who is stored.
    client.answers.getSession = { data: { session: null }, error: new Error('refresh failed: 503') };
    const cloud = await connectSupabase('u', 'k');
    await expect(cloud.currentUser()).rejects.toThrow('refresh failed: 503');
  });

  it('makes a guest, or says it could not', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.signInAsGuest()).toEqual({ id: 'u-1', is_anonymous: true, email: undefined });
    client.answers.signInAnonymously = { data: { user: null }, error: new Error('anonymous sign-ins are disabled') };
    expect(await cloud.signInAsGuest()).toBeNull();
  });

  it('links Google to the player signed in, and signs in as an existing player, each back to the address given', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.linkGoogle('http://localhost:3000/es')).toBe(true);
    expect(await cloud.signInWithGoogle('http://localhost:3000/es')).toBe(true);
    expect(client.asked).toEqual([
      ['linkIdentity', { provider: 'google', options: { redirectTo: 'http://localhost:3000/es' } }],
      ['signInWithOAuth', { provider: 'google', options: { redirectTo: 'http://localhost:3000/es' } }],
    ]);
    client.answers.linkIdentity = { data: {}, error: new Error('manual linking is disabled') };
    client.answers.signInWithOAuth = { data: {}, error: new Error('provider is not enabled') };
    expect(await cloud.linkGoogle('x')).toBe(false);
    expect(await cloud.signInWithGoogle('x')).toBe(false);
  });

  it('writes the player\'s profile with the language of the page every time, so a change of language is kept', async () => {
    const cloud = await connectSupabase('u', 'k');
    await cloud.ensureProfile('u-1', 'es');
    expect(client.asked).toEqual([['upsert', 'profiles', { user_id: 'u-1', language: 'es' }, { onConflict: 'user_id' }]]);
    client.answers.upsert = { error: new Error('offline') };
    await expect(cloud.ensureProfile('u-1', 'es')).rejects.toThrow('offline');
  });

  it('tells of every change of who is signed in, until told to stop', async () => {
    const cloud = await connectSupabase('u', 'k');
    const heard: unknown[] = [];
    const stop = cloud.onUser((next) => heard.push(next));
    client.listeners[0]('SIGNED_IN', { user: { id: 'u-3', is_anonymous: false, email: 'b@example.com' } });
    client.listeners[0]('SIGNED_OUT', null);
    expect(heard).toEqual([{ id: 'u-3', is_anonymous: false, email: 'b@example.com' }, null]);
    stop();
    expect(client.listeners).toHaveLength(0);
  });
});
