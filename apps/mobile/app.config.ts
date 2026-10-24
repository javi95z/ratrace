import type { ConfigContext, ExpoConfig } from 'expo/config';

/*
 * app.json is the app's config; this only guards it. A build made on EAS for players (the `preview` APK, the `production` store build), and the web
 * export Vercel deploys (a preview or production deployment), must carry the
 * live project: with no EXPO_PUBLIC_SUPABASE_* the app plays offline and says nothing, and one pointed at the fake project of the device checks, or at
 * anything on this machine or its network, would ship a game no player can reach. Such a build stops here. Development builds and builds made on this
 * machine outside EAS are not held to it: the device checks run release builds on the fake project on purpose.
 */

type Env = Record<string, string | undefined>;

const HELD = new Set(['preview', 'production']);

const nearby = (host: string): boolean =>
  host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0$)/.test(host) || host === '[::1]';

/**
 * The build held to the live project, by name, or null: an EAS `preview` or `production` build, or a Vercel deployment of the web export
 * (`VERCEL_ENV` `preview` or `production`: `pnpm web:build` runs `expo export`, which reads this config). A build on this machine, the checks'
 * own on the fake project among them, has neither.
 */
const heldBuild = (env: Env): { build: string; where: string } | null => {
  if (env.EAS_BUILD_PROFILE && HELD.has(env.EAS_BUILD_PROFILE)) return { build: `The ${env.EAS_BUILD_PROFILE} build`, where: "the project's EAS environment" };
  if (env.VERCEL_ENV && HELD.has(env.VERCEL_ENV)) return { build: `Vercel's ${env.VERCEL_ENV} build`, where: "the Vercel project's environment" };
  return null;
};

export const serverProblem = (env: Env): string | null => {
  const held = heldBuild(env);
  if (!held) return null;
  const { build, where } = held;
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) return `${build} has no EXPO_PUBLIC_SUPABASE_URL: set it in ${where}.`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `${build}'s EXPO_PUBLIC_SUPABASE_URL is not an address.`;
  }
  if (parsed.protocol !== 'https:') return `${build}'s EXPO_PUBLIC_SUPABASE_URL is not https.`;
  if (nearby(parsed.hostname)) return `${build}'s EXPO_PUBLIC_SUPABASE_URL is on this machine or its network, not the live project.`;
  if (!key) return `${build} has no EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: set it in ${where}.`;
  if (/fake/i.test(key)) return `${build}'s EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a fake one.`;
  return null;
};

export const withServerCheck = (config: ExpoConfig, env: Env): ExpoConfig => {
  const problem = serverProblem(env);
  if (problem) throw new Error(problem);
  return config;
};

export default ({ config }: ConfigContext): ExpoConfig => withServerCheck(config as ExpoConfig, process.env);
