/**
 * Where the game lives. Links in shared cards, the canonical address and the sitemap are absolute,
 * so they need it: set `NEXT_PUBLIC_SITE_URL` where it is served from anywhere else. Vercel names
 * its production address itself; the last word is the address the game is published at today.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://ratrace-plum.vercel.app'),
);
