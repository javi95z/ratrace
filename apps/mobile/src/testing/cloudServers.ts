import { vi } from 'vitest';

/*
 * The game's project as the account's real client reaches it over the network, for the tests of the phone's cloud (online/index.test.ts) and of the
 * game over it (game/oneCloud.test.tsx): a stand-in for `fetch`, never the live project.
 */

/** A token as the cloud signs one, for the client to read who and until when. */
function token(sub: string): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, is_anonymous: true })}.signature`;
}

/**
 * The cloud's servers, as the client reaches them: a guest made on `signup` (counted), its sign-out, and the tables and functions the account
 * reads, empty. Every request is kept.
 */
export function servers() {
  const asked: string[] = [];
  let guests = 0;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    asked.push(`${method} ${url.pathname}`);
    if (url.pathname === '/auth/v1/signup') {
      guests += 1;
      const user = { id: `guest-${guests}`, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
      return json({ access_token: token(user.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `refresh-${guests}`, user });
    }
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
    if (url.pathname.startsWith('/rest/v1/')) return method === 'GET' ? json([]) : new Response(null, { status: 201 });
    return json({});
  });
  return { fetch, asked, guests: () => guests };
}

