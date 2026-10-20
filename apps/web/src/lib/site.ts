/**
 * Where the game lives. Links in shared cards, the canonical address and the sitemap are absolute,
 * so they need it: set `NEXT_PUBLIC_SITE_URL` where it is served from anywhere else. Vercel names
 * its production address itself; the last word is the address the game is published at today.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://ratrace-plum.vercel.app'),
);

/** Who answers for the game, named in the legal notice: set `NEXT_PUBLIC_LEGAL_NAME` and `NEXT_PUBLIC_LEGAL_EMAIL` where it is deployed, never in the code. */
export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() ?? '';
export const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL?.trim() ?? '';
