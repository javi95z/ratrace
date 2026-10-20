/**
 * The hourly health check (roadmap step 17g): is the game up for a stranger right now? The site
 * answers, a guest gets in, the engine plays, a game with friends opens. The guest is removed after.
 * It also keeps the free Supabase project from pausing. Run by `.github/workflows/health.yml`, or by
 * hand with `pnpm online:health`. A failure exits with 1, and GitHub mails whoever owns the schedule.
 *
 * Reads SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (else apps/web/.env.local), SUPABASE_SECRET_KEY (to
 * remove the guest; without it the guest stays) and SITE_URL. Nothing secret is printed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { createClient } from '@supabase/supabase-js';

const envFile = fileURLToPath(new URL('../../../apps/web/.env.local', import.meta.url));
const local: Record<string, string> = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split('\n')
        .filter((line) => /^\s*[A-Z_]+=/.test(line))
        .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
    )
  : {};
const url = process.env.SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const site = (process.env.SITE_URL || 'https://ratrace-plum.vercel.app').replace(/\/$/, '');
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are needed');

const failed: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failed.push(what);
};
const answered = (result: { error: unknown }) => result.error === null;
const get = (path: string) => fetch(`${site}${path}`, { signal: AbortSignal.timeout(20_000) }).then((r) => r.status, () => 0);

check((await get('/es')) === 200, 'the site answers');

let roomId: string | undefined;
const guest = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const signed = await guest.auth.signInAnonymously();
const id = signed.data.user?.id ?? null;
if (id) console.log(`· guest ${id}`);
check(id !== null, 'a guest signs in');
try {
  if (id !== null) {
    const versions = { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    check(answered(await guest.functions.invoke('engine', { body: { ...versions, lifeId: 'nurse', seed: 'health', log: [] } })), 'the engine plays a life');
    const opened = await guest.functions.invoke('rooms', { body: { action: 'open', lifeId: 'nurse', seconds: 90, ...versions } });
    roomId = (opened.data as { room?: { id: string } } | null)?.room?.id;
    check(answered(opened) && typeof roomId === 'string', 'a game with friends opens');
    if (roomId) check(answered(await guest.functions.invoke('rooms', { body: { action: 'leave', roomId } })), 'and is left');
  }
} finally {
  if (id !== null && secret) {
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    // The game is removed with its guest: an hourly check leaves nothing behind.
    if (roomId) check((await admin.from('rooms').delete().eq('id', roomId)).error === null, 'its game is removed');
    const removed = await admin.auth.admin.deleteUser(id);
    check(removed.error === null, `the guest is removed${removed.error ? `: ${removed.error.message}` : ''}`);
  } else if (id !== null) console.log('· no SUPABASE_SECRET_KEY: the guest stays');
}

if (failed.length > 0) {
  console.error(`\nUnhealthy: ${failed.length} failed.`);
  process.exit(1);
}
console.log('\nHealthy.');
