/*
 * What `web-life.ts` checks of a run apart from the browser, so it can be tested without starting one (the script runs as it is imported).
 */

/**
 * The project the app's web was started with, as its page has it (`process.env`, which Expo's development server fills with the `EXPO_PUBLIC_*` of
 * its environment), or null: a run of this script must have none (no `EXPO_PUBLIC_SUPABASE_URL` nor `_PUBLISHABLE_KEY`).
 */
export function projectNamed(env: Readonly<Record<string, string | undefined>>): string | null {
  const named = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].filter((key) => (env[key] ?? '') !== '');
  return named.length === 0 ? null : named.join(', ');
}

/** Whether a request stays on this machine. */
export const onThisMachine = (href: string): boolean => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(href).hostname);
