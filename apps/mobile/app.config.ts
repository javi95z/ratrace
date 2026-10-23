import type { ConfigContext, ExpoConfig } from 'expo/config';

/*
 * app.json is the app's config; this only guards it. A build made on EAS for players (the `preview` APK, the `production` store build) must carry the
 * live project: with no EXPO_PUBLIC_SUPABASE_* the app plays offline and says nothing, and one pointed at the fake project of the device checks, or at
 * anything on this machine or its network, would ship a game no player can reach. Such a build stops here. Development builds and builds made on this
 * machine outside EAS are not held to it: the device checks run release builds on the fake project on purpose.
 */

type Env = Record<string, string | undefined>;

const HELD = new Set(['preview', 'production']);

const nearby = (host: string): boolean =>
  host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0$)/.test(host) || host === '[::1]';

export const serverProblem = (env: Env): string | null => {
  const profile = env.EAS_BUILD_PROFILE;
  if (!profile || !HELD.has(profile)) return null;
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) return `The ${profile} build has no EXPO_PUBLIC_SUPABASE_URL: set it in the project's EAS environment.`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `The ${profile} build's EXPO_PUBLIC_SUPABASE_URL is not an address.`;
  }
  if (parsed.protocol !== 'https:') return `The ${profile} build's EXPO_PUBLIC_SUPABASE_URL is not https.`;
  if (nearby(parsed.hostname)) return `The ${profile} build's EXPO_PUBLIC_SUPABASE_URL is on this machine or its network, not the live project.`;
  if (!key) return `The ${profile} build has no EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: set it in the project's EAS environment.`;
  if (/fake/i.test(key)) return `The ${profile} build's EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a fake one.`;
  return null;
};

export const withServerCheck = (config: ExpoConfig, env: Env): ExpoConfig => {
  const problem = serverProblem(env);
  if (problem) throw new Error(problem);
  return config;
};

export default ({ config }: ConfigContext): ExpoConfig => withServerCheck(config as ExpoConfig, process.env);
