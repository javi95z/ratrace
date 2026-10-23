// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { SupabaseAccount } from '@ratrace/online/supabase';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountCloud } from '../testing/accountCloud';
import { backFromGoogle, openForGoogle } from './browser.web';

/*
 * Google on the web (browser.web.ts): by the Next web's road. The page leaves for Google and comes back to the very page the player was on, without
 * whatever a sign-in left after the hash (apps/web/src/game/context.tsx, `useAccount`); the client reads the code from the address it comes back to.
 * No browser of the system is opened, and expo-web-browser is never named.
 */

/** A file of the app, as written: its name passed loose, since Vite takes a literal `new URL('./x', import.meta.url)` for an asset. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

afterEach(() => window.history.replaceState(null, '', '/'));

describe('Google on the web', () => {
  it('comes back to the page the player is on, without its hash', () => {
    window.history.replaceState(null, '', '/en/account?tab=1#error=x');
    expect(backFromGoogle()).toBe('http://localhost:3000/en/account?tab=1');
    window.history.replaceState(null, '', '/es/settings');
    expect(backFromGoogle()).toBe('http://localhost:3000/es/settings');
  });

  it('leaves the page for Google, as the Next web does: no browser is opened for it', async () => {
    const { cloud } = accountCloud();
    const linkGoogle = vi.fn(async () => true);
    const signInWithGoogle = vi.fn(async () => true);
    const account = new SupabaseAccount(async () => ({ ...cloud, linkGoogle, signInWithGoogle }), () => window.location.href, () => undefined);
    await account.start('en');
    window.history.replaceState(null, '', '/en/account#x');
    expect(openForGoogle).toBeUndefined();
    await expect(account.keepWithGoogle(backFromGoogle(), openForGoogle)).resolves.toBe(true);
    await expect(account.useExistingAccount(backFromGoogle(), openForGoogle)).resolves.toBe(true);
    expect(linkGoogle.mock.calls).toEqual([['http://localhost:3000/en/account']]);
    expect(signInWithGoogle.mock.calls).toEqual([['http://localhost:3000/en/account']]);
  });

  it('never names the system\'s browser', () => {
    expect(read('./browser.web.ts')).not.toMatch(/expo-web-browser/);
  });
});
