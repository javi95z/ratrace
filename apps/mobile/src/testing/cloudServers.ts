import { createHash } from 'node:crypto';
import { vi } from 'vitest';

/*
 * The game's project as the account's real client reaches it over the network, for the tests of the phone's cloud (online/index.test.ts) and of the
 * game over it (game/oneCloud.test.tsx): a stand-in for `fetch`, never the live project.
 */

/** A token as the cloud signs one, for the client to read who and until when. */
function token(sub: string, anonymous = true): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, is_anonymous: anonymous })}.signature`;
}

/** A session as the cloud hands one over, for `id`: a guest's, or a Google account's (with its address). */
function sessionOf(id: string, refresh: string, email?: string) {
  const user = { id, aud: 'authenticated', role: 'authenticated', is_anonymous: email === undefined, email, app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
  return { access_token: token(id, email === undefined), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: refresh, user };
}

/**
 * The cloud's servers, as the client reaches them: a guest made on `signup` (counted), its sign-out, and the tables and functions the account
 * reads, empty. And Google, as the project hands the trip to it: a guest who asks to keep their account is sent to Google (`google.back()` is where
 * Google sends the browser back to, with a code), and the code is exchanged once, against the trip's PKCE verifier, for the guest's own player, now
 * with a Google address. Every request is kept (a session's grant with its kind).
 */
export function servers() {
  const asked: string[] = [];
  let guests = 0;
  /** Each code Google gave, with the challenge of the trip it ended and the player it is for; the address of the last trip back. */
  const codes = new Map<string, { challenge: string; id: string }>();
  let back: string | null = null;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    asked.push(`${method} ${url.pathname}${url.pathname === '/auth/v1/token' ? `?grant_type=${url.searchParams.get('grant_type')}` : ''}`);
    if (url.pathname === '/auth/v1/signup') {
      guests += 1;
      return json(sessionOf(`guest-${guests}`, `refresh-${guests}`));
    }
    if (url.pathname === '/auth/v1/user/identities/authorize') {
      // The guest signed in is the one keeping their account (the only one these servers make is the last).
      const code = `google-code-${codes.size + 1}`;
      codes.set(code, { challenge: String(url.searchParams.get('code_challenge')), id: `guest-${guests}` });
      const returnTo = new URL(String(url.searchParams.get('redirect_to')));
      returnTo.searchParams.set('code', code);
      back = returnTo.href;
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?state=${code}` });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { auth_code?: string; code_verifier?: string };
      const held = codes.get(String(body.auth_code));
      // A code is good once, and only with the verifier its trip began with.
      codes.delete(String(body.auth_code));
      const challenge = createHash('sha256').update(String(body.code_verifier)).digest('base64url');
      if (!held || challenge !== held.challenge) return json({ code: 400, error_code: 'bad_code_verifier', msg: 'invalid code or verifier' }, 400);
      return json(sessionOf(held.id, `refresh-google-${held.id}`, 'ana@example.com'));
    }
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
    if (url.pathname.startsWith('/rest/v1/')) return method === 'GET' ? json([]) : new Response(null, { status: 201 });
    return json({});
  });
  return { fetch, asked, guests: () => guests, google: { back: () => back } };
}

