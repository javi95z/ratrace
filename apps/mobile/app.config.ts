import type { ConfigContext, ExpoConfig } from 'expo/config';

/*
 * app.json is the app's config; this only guards it. A build made on EAS for players (the `preview` APK, the `production` store build), and the web
 * export Vercel deploys (a preview or production deployment), must carry the
 * live project: with no EXPO_PUBLIC_SUPABASE_* the app plays offline and says nothing, and one pointed at the fake project of the device checks, or at
 * anything on this machine or its network, would ship a game no player can reach. Such a build stops here. Development builds and builds made on this
 * machine outside EAS are not held to it: the device checks run release builds on the fake project on purpose.
 *
 * The web Vercel deploys is held to the rest of what the live web needs as well, the Next web's NEXT_PUBLIC_* under Expo's names: the notices' key
 * (with none, the notices' switch is gone for every player who turned them on, who can no longer turn them off), who answers for the game (the legal
 * page's operator) and the site's own https address (its canonical, its sitemap, its links). A build on Vercel that does not say which it is (`VERCEL`
 * with no `VERCEL_ENV`: the project's system variables not exposed) is refused, never let through unchecked.
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

/** What the live web needs beyond the project, each named in full as the export reads it (`game/site.ts`, `online/push.web.ts`). */
const WEB_SETTINGS = ['EXPO_PUBLIC_VAPID_PUBLIC_KEY', 'EXPO_PUBLIC_LEGAL_NAME', 'EXPO_PUBLIC_LEGAL_EMAIL', 'EXPO_PUBLIC_SITE_URL'] as const;

/** What is wrong with a Vercel deployment's settings of the live web beyond the project, or null. */
const webProblem = (env: Env, build: string, where: string): string | null => {
  for (const name of WEB_SETTINGS) if (!env[name]?.trim()) return `${build} has no ${name}: set it in ${where}.`;
  let site: URL;
  try {
    site = new URL(env.EXPO_PUBLIC_SITE_URL!.trim());
  } catch {
    return `${build}'s EXPO_PUBLIC_SITE_URL is not an address.`;
  }
  if (site.protocol !== 'https:') return `${build}'s EXPO_PUBLIC_SITE_URL is not https.`;
  if (nearby(site.hostname)) return `${build}'s EXPO_PUBLIC_SITE_URL is on this machine or its network, not the live site.`;
  return null;
};

export const serverProblem = (env: Env): string | null => {
  if (env.VERCEL && !env.VERCEL_ENV) {
    return "A build on Vercel with no VERCEL_ENV: it cannot be told from a build on this machine, so it is not made. Expose the system environment variables in the Vercel project's settings.";
  }
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
  return env.VERCEL_ENV && HELD.has(env.VERCEL_ENV) ? webProblem(env, build, where) : null;
};

export const withServerCheck = (config: ExpoConfig, env: Env): ExpoConfig => {
  const problem = serverProblem(env);
  if (problem) throw new Error(problem);
  return config;
};

/**
 * Google on the phone itself (online/google.ts): a build that names its iOS Google client (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, from the project's EAS
 * environment) is given the library's plugin with that client's URL scheme, which Google's sheet comes back to; Android needs none. A build that
 * names none has no plugin, and goes to Google through the browser as it always did.
 */
export const withGoogleOnDevice = (config: ExpoConfig, env: Env): ExpoConfig => {
  const ios = env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!ios) return config;
  const scheme = `com.googleusercontent.apps.${ios.replace(/\.apps\.googleusercontent\.com$/, '')}`;
  return { ...config, plugins: [...(config.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }]] };
};

export default ({ config }: ConfigContext): ExpoConfig => withGoogleOnDevice(withServerCheck(config as ExpoConfig, process.env), process.env);
