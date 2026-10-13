import type { User } from '@supabase/supabase-js';
import type { Cloud, CloudUser } from './supabase';

const userOf = (user: User | null | undefined): CloudUser | null => (user ? { id: user.id, is_anonymous: user.is_anonymous === true, email: user.email } : null);

/**
 * The cloud, made from the Supabase client. The client is loaded here and nowhere else, and only
 * when an account starts, so a game with no project configured never downloads it.
 * `key` is the publishable key: it is public by design. The secret key has no business in a browser.
 */
export async function connectSupabase(url: string, key: string): Promise<Cloud> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return {
    async currentUser() {
      // A stored session that could not be renewed comes back as no session and an error. That is
      // not "nobody is signed in": said so, the game would make a new guest over the stored player.
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return userOf(data.session?.user);
    },
    async signInAsGuest() {
      const { data, error } = await client.auth.signInAnonymously();
      return error ? null : userOf(data.user);
    },
    async linkGoogle(redirectTo) {
      // On success the client itself sends the browser to Google.
      const { error } = await client.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      return error === null;
    },
    async signInWithGoogle(redirectTo) {
      // Replaces whoever is signed in here with the player the Google account belongs to.
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      return error === null;
    },
    async ensureProfile(userId, language) {
      const { error } = await client.from('profiles').upsert({ user_id: userId, language }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onUser(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(userOf(session?.user)));
      return () => data.subscription.unsubscribe();
    },
  };
}
