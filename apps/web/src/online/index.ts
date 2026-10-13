import { connectSupabase } from './connect';
import { offlineAccount } from './offline';
import { SupabaseAccount } from './supabase';
import type { Account } from './types';

/**
 * The account of this browser. With no Supabase project in the build's settings there is none,
 * and the game is exactly what it is without a network.
 */
export function browserAccount(): Account {
  // Named in full, because the build writes these two values into the page only where it sees them so.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof window === 'undefined') return offlineAccount;
  return new SupabaseAccount(
    () => connectSupabase(url, key),
    () => window.location.href,
    (address) => window.history.replaceState(window.history.state, '', address),
  );
}
