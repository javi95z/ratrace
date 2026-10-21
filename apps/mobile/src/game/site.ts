/*
 * The web's own constants of where the game lives and who answers for it (apps/web/src/lib/site.ts, which a test holds this file to), read from the
 * build's variables, never from the code. Where the web is deployed they are `NEXT_PUBLIC_...`; here they are `EXPO_PUBLIC_...`, which Expo puts into
 * the app as it is built (named in full, or it cannot).
 */

/**
 * Where the game lives, on the web: the way into it that goes with a picture of a life (`share.invite`). Set `EXPO_PUBLIC_SITE_URL` where it is served from
 * anywhere else; the last word is the address the web is published at today, as the web's own (Vercel's name for its production address is the web's alone).
 * The variable is trimmed, as the legal notice's are, and an empty one is no address: the published one stands (`new URL('')` would throw as the app starts).
 */
export const SITE_URL = new URL(process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://ratrace-plum.vercel.app');

/** Who answers for the game, named in the legal notice. */
export const LEGAL_NAME = process.env.EXPO_PUBLIC_LEGAL_NAME?.trim() ?? '';
export const LEGAL_EMAIL = process.env.EXPO_PUBLIC_LEGAL_EMAIL?.trim() ?? '';
